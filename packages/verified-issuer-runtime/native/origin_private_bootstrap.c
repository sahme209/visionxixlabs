#define _DARWIN_C_SOURCE 1
#include "origin_private_bootstrap.h"
#include <unistd.h>
#include <fcntl.h>
#include <poll.h>
#include <errno.h>
#include <string.h>
#include <time.h>
#include <sys/stat.h>
void axiom_private_material_wipe(AxiomPrivateMaterial*m){if(m){volatile unsigned char*p=(volatile unsigned char*)m;for(size_t i=0;i<sizeof(*m);i++)p[i]=0;}}
static uint64_t now_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static uint32_t get32(const unsigned char*p){uint32_t n=0;for(int i=0;i<4;i++)n=(n<<8)|p[i];return n;}
static uint64_t get64(const unsigned char*p){uint64_t n=0;for(int i=0;i<8;i++)n=(n<<8)|p[i];return n;}
static int utf8(const unsigned char*p,size_t n){
 for(size_t i=0;i<n;){unsigned c=p[i++],v,min,k;if(c==0)return 0;if(c<128)continue;
 if(c>=194&&c<=223){v=c&31;min=128;k=1;}else if(c>=224&&c<=239){v=c&15;min=2048;k=2;}else if(c>=240&&c<=244){v=c&7;min=65536;k=3;}else return 0;
 if(k>n-i)return 0;while(k--){c=p[i++];if((c&192)!=128)return 0;v=(v<<6)|(c&63);}if(v<min||v>0x10ffff||(v>=0xd800&&v<=0xdfff))return 0;
 }return 1;
}
/* All IO is nonblocking and shares the authenticated original startup deadline.
 * EOF is part of the record, so a writer retaining its endpoint cannot succeed. */
static int read_part(int fd,unsigned char*p,size_t n,uint64_t deadline){
 while(n){uint64_t now=now_ns();if(now>=deadline)return 0;ssize_t r=read(fd,p,n);if(r>0){p+=r;n-=(size_t)r;continue;}if(!r)return 0;if(errno==EINTR)continue;if(errno!=EAGAIN&&errno!=EWOULDBLOCK)return 0;
 uint64_t ms=(deadline-now)/1000000ULL;struct pollfd f={fd,POLLIN,0};int wait=(int)(ms>50?50:ms+1);if(poll(&f,1,wait)<0&&errno!=EINTR)return 0;
 }return now_ns()<deadline;
}
static int read_eof(int fd,uint64_t deadline){for(;;){uint64_t now=now_ns();if(now>=deadline)return 0;unsigned char extra;ssize_t n=read(fd,&extra,1);if(!n)return 1;if(n>0)return 0;if(errno==EINTR)continue;if(errno!=EAGAIN&&errno!=EWOULDBLOCK)return 0;struct pollfd f={fd,POLLIN,0};uint64_t ms=(deadline-now)/1000000ULL;if(poll(&f,1,(int)(ms>50?50:ms+1))<0&&errno!=EINTR)return 0;}}
static int valid_header(const unsigned char*frame,const AxiomPrivateBinding*b){
 uint32_t total=get32(frame+16),dsn=get32(frame+20),session=get32(frame+24);
 return !memcmp(frame,"axiom.private/1",16)&&!get32(frame+28)&&dsn&&dsn<=8192&&session>=32&&session<=4096&&total==AXIOM_PRIVATE_FRAME_HEADER+dsn+32+session&&total<AXIOM_PRIVATE_FRAME_CAP&&get64(frame+32)==b->epoch&&get64(frame+40)==b->deadline&&!memcmp(frame+48,b->client,32)&&!memcmp(frame+80,b->broker,32);
}
int axiom_private_frame_read(int fd,const AxiomPrivateBinding*b,AxiomPrivateMaterial*m){
 unsigned char frame[AXIOM_PRIVATE_FRAME_CAP]={0};int ok=0;axiom_private_material_wipe(m);
 if(!b||!m||!b->epoch||now_ns()>=b->deadline)goto done;struct stat st;if(fstat(fd,&st)||!S_ISFIFO(st.st_mode)||st.st_nlink!=0)goto done;int flags=fcntl(fd,F_GETFL);if(flags<0||(flags&O_ACCMODE)!=O_RDONLY||fcntl(fd,F_SETFL,flags|O_NONBLOCK))goto done;
 if(!read_part(fd,frame,AXIOM_PRIVATE_FRAME_HEADER,b->deadline))goto done;
 uint32_t total=get32(frame+16),dsn=get32(frame+20),session=get32(frame+24);
 if(!valid_header(frame,b))goto done;
 if(!read_part(fd,frame+AXIOM_PRIVATE_FRAME_HEADER,total-AXIOM_PRIVATE_FRAME_HEADER,b->deadline)||!read_eof(fd,b->deadline)||!utf8(frame+AXIOM_PRIVATE_FRAME_HEADER,dsn))goto done;
 memcpy(m->datasource,frame+AXIOM_PRIVATE_FRAME_HEADER,dsn);memcpy(m->vault,frame+AXIOM_PRIVATE_FRAME_HEADER+dsn,32);memcpy(m->session,frame+AXIOM_PRIVATE_FRAME_HEADER+dsn+32,session);m->datasource_length=dsn;m->session_length=session;ok=1;
 done:;volatile unsigned char*p=frame;for(size_t i=0;i<sizeof(frame);i++)p[i]=0;if(!ok)axiom_private_material_wipe(m);return ok;
}
