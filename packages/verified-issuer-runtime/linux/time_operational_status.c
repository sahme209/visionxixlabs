#define _GNU_SOURCE
#include "time_operational_status.h"
#include <string.h>
#include <stdio.h>
#include <limits.h>
#include <errno.h>
#include <unistd.h>
#include <poll.h>
#include <time.h>
#include <signal.h>
#include <pthread.h>
struct cursor {const unsigned char *p;size_t n;};
static int line(struct cursor *c,char *out,size_t cap){
 size_t n=0;while(n<c->n&&c->p[n]!='\n'){if(!c->p[n]||c->p[n]=='\r'||n+1>=cap)return -1;n++;}
 if(n==c->n)return -1;memcpy(out,c->p,n);out[n]=0;c->p+=n+1;c->n-=n+1;return 0;
}
static int literal(struct cursor*c,const char*v){char b[160];return line(c,b,sizeof b)||strcmp(b,v)?-1:0;}
static int number(struct cursor*c,uint64_t*out){
 char b[32];if(line(c,b,sizeof b)||!b[0]||(b[0]=='0'&&b[1]))return -1;uint64_t n=0;
 for(size_t i=0;b[i];i++){if(b[i]<'0'||b[i]>'9'||n>(UINT64_MAX-(unsigned)(b[i]-'0'))/10)return -1;n=n*10+(unsigned)(b[i]-'0');}*out=n;return 0;
}
static int name(struct cursor*c,char*out,size_t cap,int digest){
 if(line(c,out,cap)||!out[0]||(digest&&strlen(out)!=64))return -1;
 for(size_t i=0;out[i];i++){char b=out[i];if(digest?!(b>='0'&&b<='9')&&!(b>='a'&&b<='f'):!((b>='a'&&b<='z')||(b>='A'&&b<='Z')||(b>='0'&&b<='9')||b=='_'||b=='-'))return -1;}return 0;
}
static int end(struct cursor*c){return literal(c,"END")||c->n?-1:0;}
int axiom_operational_policy_decode(const unsigned char*b,size_t n,struct axiom_operational_policy*p){
 if(!b||!p||!n||n>AXIOM_OPERATIONAL_WIRE_MAX)return -1;struct cursor c={b,n};memset(p,0,sizeof *p);
 return literal(&c,"AXIOM_OPERATIONAL_POLICY_V1")||literal(&c,"aws-linux-operational-v1")||literal(&c,"aws-time-sync-ntp")||number(&c,&p->revision)||!p->revision||p->revision>9007199254740991ULL||number(&c,&p->reader_uid)||!p->reader_uid||p->reader_uid>=UINT32_MAX||number(&c,&p->reader_gid)||!p->reader_gid||p->reader_gid>=UINT32_MAX||end(&c)?-1:0;
}
int axiom_operational_accept_derive(const struct axiom_operational_policy*p,const char*digest,const char*boot,uint64_t device,uint64_t inode,const unsigned char*nonce,size_t nonce_length,struct axiom_operational_acceptance*a){
 if(!p||!digest||!boot||!nonce||!a||nonce_length!=32||!p->revision||p->revision>9007199254740991ULL||!p->reader_uid||p->reader_uid>=UINT32_MAX||!p->reader_gid||p->reader_gid>=UINT32_MAX||strnlen(digest,65)!=64||strlen(digest)!=64||strnlen(boot,129)>128||!boot[0]||!inode)return -1;
 for(size_t i=0;i<64;i++)if(!((digest[i]>='0'&&digest[i]<='9')||(digest[i]>='a'&&digest[i]<='f')))return -1;
 unsigned char nonzero=0;for(size_t i=0;i<32;i++)nonzero|=nonce[i];if(!nonzero)return -1;
 memset(a,0,sizeof *a);memcpy(a->profile,digest,65);memcpy(a->boot,boot,strlen(boot)+1);a->revision=p->revision;a->reader_gid=p->reader_gid;a->directory_device=device;a->directory_inode=inode;a->publisher_uid=0;
 memcpy(a->host,"host_",5);memcpy(a->source_generation,"source_",7);const char hex[]="0123456789abcdef";
 for(size_t i=0;i<32;i++){a->host[5+2*i]=a->source_generation[7+2*i]=hex[nonce[i]>>4];a->host[6+2*i]=a->source_generation[8+2*i]=hex[nonce[i]&15];}
 unsigned char encoded[AXIOM_OPERATIONAL_WIRE_MAX];size_t length;return axiom_operational_accept_encode(a,encoded,&length);
}
int axiom_operational_accept_decode(const unsigned char*b,size_t n,struct axiom_operational_acceptance*a){
 if(!b||!a||!n||n>AXIOM_OPERATIONAL_WIRE_MAX)return -1;struct cursor c={b,n};memset(a,0,sizeof *a);
 return literal(&c,"AXIOM_ACCEPT_V1")||name(&c,a->profile,sizeof a->profile,1)||number(&c,&a->revision)||!a->revision||name(&c,a->host,sizeof a->host,0)||name(&c,a->source_generation,sizeof a->source_generation,0)||name(&c,a->boot,sizeof a->boot,0)||number(&c,&a->directory_device)||number(&c,&a->directory_inode)||number(&c,&a->publisher_uid)||number(&c,&a->reader_gid)||a->publisher_uid!=0||!a->reader_gid||a->reader_gid>UINT32_MAX||end(&c)?-1:0;
}
static int encode_accept(const struct axiom_operational_acceptance*a,unsigned char*b,size_t*n){
 int v=snprintf((char*)b,AXIOM_OPERATIONAL_WIRE_MAX,"AXIOM_ACCEPT_V1\n%s\n%llu\n%s\n%s\n%s\n%llu\n%llu\n%llu\n%llu\nEND\n",a->profile,(unsigned long long)a->revision,a->host,a->source_generation,a->boot,(unsigned long long)a->directory_device,(unsigned long long)a->directory_inode,(unsigned long long)a->publisher_uid,(unsigned long long)a->reader_gid);if(v<1||(unsigned)v>=AXIOM_OPERATIONAL_WIRE_MAX)return -1;*n=(size_t)v;return 0;
}
int axiom_operational_accept_encode(const struct axiom_operational_acceptance*a,unsigned char*b,size_t*n){struct axiom_operational_acceptance copy;if(!a||!b||!n||encode_accept(a,b,n))return -1;return axiom_operational_accept_decode(b,*n,&copy);}
static int decode(const unsigned char*b,size_t n,struct axiom_operational_status*s,int check){
 if(!b||!s||!n||n>AXIOM_OPERATIONAL_WIRE_MAX)return -1;struct cursor c={b,n};uint64_t state=0;memset(s,0,sizeof *s);
 if(literal(&c,check?"AXIOM_CHECK_V1":"AXIOM_STATUS_V1")||number(&c,&s->sequence)||name(&c,s->profile,sizeof s->profile,1)||number(&c,&s->revision)||!s->revision||name(&c,s->host,sizeof s->host,0)||name(&c,s->source_generation,sizeof s->source_generation,0)||number(&c,&s->publication)||number(&c,&s->marker)||number(&c,&s->transition)||number(&c,&state)||state>3||end(&c))return -1;s->state=(enum axiom_operational_state)state;return 0;
}
int axiom_operational_status_decode(const unsigned char*b,size_t n,struct axiom_operational_status*s){return decode(b,n,s,0);}
int axiom_operational_check_decode(const unsigned char*b,size_t n,struct axiom_operational_status*s){return decode(b,n,s,1);}
static int encode(const struct axiom_operational_status*s,unsigned char*b,size_t*n,int check){
 if(!s||!b||!n)return -1;int v=snprintf((char*)b,AXIOM_OPERATIONAL_WIRE_MAX,"%s\n%llu\n%s\n%llu\n%s\n%s\n%llu\n%llu\n%llu\n%u\nEND\n",check?"AXIOM_CHECK_V1":"AXIOM_STATUS_V1",(unsigned long long)s->sequence,s->profile,(unsigned long long)s->revision,s->host,s->source_generation,(unsigned long long)s->publication,(unsigned long long)s->marker,(unsigned long long)s->transition,(unsigned)s->state);
 if(v<1||(unsigned)v>=AXIOM_OPERATIONAL_WIRE_MAX)return -1;*n=(size_t)v;struct axiom_operational_status copy;return decode(b,*n,&copy,check);
}
int axiom_operational_status_encode(const struct axiom_operational_status*s,unsigned char*b,size_t*n){return encode(s,b,n,0);}
int axiom_operational_check_encode(const struct axiom_operational_status*s,unsigned char*b,size_t*n){return encode(s,b,n,1);}
int axiom_operational_same(const struct axiom_operational_status*a,const struct axiom_operational_status*b){return a&&b&&a->revision==b->revision&&a->publication==b->publication&&a->marker==b->marker&&a->transition==b->transition&&a->state==b->state&&!strcmp(a->profile,b->profile)&&!strcmp(a->host,b->host)&&!strcmp(a->source_generation,b->source_generation);}
int axiom_operational_monotonic(uint64_t*v){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0||t.tv_nsec>=1000000000||(uint64_t)t.tv_sec>((uint64_t)INT64_MAX-(uint64_t)t.tv_nsec)/1000000000)return -1;*v=(uint64_t)t.tv_sec*1000000000+(uint64_t)t.tv_nsec;return 0;}
static int waitfd(int fd,short events,uint64_t deadline){uint64_t now;if(axiom_operational_monotonic(&now)||now>=deadline)return -1;uint64_t ms=(deadline-now+999999)/1000000;struct pollfd p={fd,events,0};int r=poll(&p,1,(int)(ms>500?500:ms));return r==1&&(p.revents&events)&&!(p.revents&(POLLERR|POLLNVAL))?0:-1;}
int axiom_operational_write_frame(int fd,const unsigned char*b,size_t n,uint64_t deadline){if(!n||n>4096)return -1;size_t off=0;while(off<n){if(waitfd(fd,POLLOUT,deadline))return -1;sigset_t blocked,old,pending;sigemptyset(&blocked);sigaddset(&blocked,SIGPIPE);if(pthread_sigmask(SIG_BLOCK,&blocked,&old))return -1;int existed=sigpending(&pending)==0&&sigismember(&pending,SIGPIPE);ssize_t v=write(fd,b+off,n-off);int saved=errno;if(v<0&&saved==EPIPE&&!existed){struct timespec zero={0,0};(void)sigtimedwait(&blocked,NULL,&zero);}if(pthread_sigmask(SIG_SETMASK,&old,NULL))return -1;errno=saved;if(v>0)off+=(size_t)v;else if(v<0&&(errno==EAGAIN||errno==EINTR))continue;else return -1;}return 0;}
int axiom_operational_read_frame(int fd,unsigned char*b,size_t*n,uint64_t deadline){size_t off=0;while(off<4096){if(waitfd(fd,POLLIN,deadline))return -1;ssize_t v=read(fd,b+off,1);if(v<0&&(errno==EAGAIN||errno==EINTR))continue;if(v!=1)return -1;off++;if(off>=5&&!memcmp(b+off-5,"\nEND\n",5)){struct pollfd p={fd,POLLIN,0};if(poll(&p,1,0)!=0)return -1;*n=off;return 0;}}return -1;}
int axiom_operational_exchange(int out,int in,const struct axiom_operational_status*q,struct axiom_operational_status*s,uint64_t deadline){unsigned char b[4096];size_t n;if(axiom_operational_check_encode(q,b,&n)||axiom_operational_write_frame(out,b,n,deadline)||axiom_operational_read_frame(in,b,&n,deadline)||axiom_operational_status_decode(b,n,s)||s->sequence!=q->sequence||s->revision!=q->revision||s->publication!=q->publication||s->marker!=q->marker||strcmp(s->profile,q->profile)||strcmp(s->host,q->host)||strcmp(s->source_generation,q->source_generation)||s->state!=AXIOM_OP_READY)return -1;return 0;}

/* Daemon-only issuer: fixed owner-created originals, no argv/environment or
 * JSON health callback. The owner ACKs every transition before it may return. */
#include <sys/stat.h>
#include <sys/xattr.h>
#include <fcntl.h>
static struct axiom_operational_acceptance daemon_acceptance;
static uint64_t daemon_publication,daemon_transition;
static int daemon_initialized;
int axiom_operational_daemon_initialize(void){
 if(daemon_initialized||getuid()!=0)return -1;struct stat a,w,r;
 int af=fcntl(8,F_GETFL),wf=fcntl(11,F_GETFL),rf=fcntl(12,F_GETFL);
 if(af<0||wf<0||rf<0||(af&O_ACCMODE)!=O_RDONLY||(wf&O_ACCMODE)!=O_WRONLY||(rf&O_ACCMODE)!=O_RDONLY||fstat(8,&a)||fstat(11,&w)||fstat(12,&r)||!S_ISREG(a.st_mode)||a.st_uid!=0||(a.st_mode&07777)!=0440||a.st_nlink!=1||!S_ISFIFO(w.st_mode)||!S_ISFIFO(r.st_mode)||w.st_uid!=0||r.st_uid!=0||a.st_size<1||a.st_size>4096)return -1;
 errno=0;if(fgetxattr(8,"system.posix_acl_access",NULL,0)>=0||errno!=ENODATA)return -1;
 unsigned char b[4097];ssize_t n=pread(8,b,sizeof b,0);if(n!=a.st_size||axiom_operational_accept_decode(b,(size_t)n,&daemon_acceptance))return -1;
 if(fcntl(11,F_SETFL,O_NONBLOCK)||fcntl(12,F_SETFL,O_NONBLOCK))return -1;daemon_initialized=1;return 0;
}
int axiom_operational_daemon_publish(uint64_t publication,uint64_t marker,uint32_t state){
 if(!daemon_initialized||!publication||publication<=daemon_publication||state>3||(!daemon_publication&&state!=AXIOM_OP_UNKNOWN)||daemon_transition==UINT64_MAX)return -1;
 struct axiom_operational_status value={0},ack;value.revision=daemon_acceptance.revision;value.publication=publication;value.marker=marker;value.transition=++daemon_transition;value.state=(enum axiom_operational_state)state;
 memcpy(value.profile,daemon_acceptance.profile,sizeof value.profile);memcpy(value.host,daemon_acceptance.host,sizeof value.host);memcpy(value.source_generation,daemon_acceptance.source_generation,sizeof value.source_generation);
 unsigned char b[4096];size_t n;uint64_t now;if(axiom_operational_monotonic(&now)||now>UINT64_MAX-500000000)return -1;uint64_t deadline=now+500000000;
 if(axiom_operational_status_encode(&value,b,&n)||axiom_operational_write_frame(11,b,n,deadline)||axiom_operational_read_frame(12,b,&n,deadline)||axiom_operational_status_decode(b,n,&ack)||ack.sequence||!axiom_operational_same(&value,&ack))return -1;
 daemon_publication=publication;return 0;
}
