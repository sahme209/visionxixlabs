/* DORMANT SOURCE ONLY. No native compilation/execution/installation qualified.
 * Target-specific ABI, local filesystem/ACL/persistence and publisher lifecycle
 * must be established by the separately approved native artifact/run. */
#define _GNU_SOURCE
#include "time_publication.h"
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/xattr.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <time.h>
#include <stdio.h>
#include <string.h>
#include <limits.h>
#include <stdlib.h>
#if !defined(__linux__)
#error This adapter requires a separately qualified Linux target
#endif
_Static_assert(sizeof(uid_t)==4 && sizeof(gid_t)==4,"unqualified uid ABI");
_Static_assert(sizeof(dev_t)<=8 && sizeof(ino_t)<=8,"unqualified identity ABI");
static _Noreturn void fatal(void) { _exit(70); }
static int no_acl(int fd) {
 errno=0; ssize_t n=fgetxattr(fd,"system.posix_acl_access",NULL,0);
 return n<0 && errno==ENODATA; /* ENOTSUP is not silent qualification. */
}
static int generation_ok(const char *g) {
 if(!g)return 0; size_t n=strnlen(g,129); if(n<1||n>128)return 0;
 for(size_t i=0;i<n;i++) if(!((g[i]>='A'&&g[i]<='Z')||(g[i]>='a'&&g[i]<='z')||(g[i]>='0'&&g[i]<='9')||g[i]=='_'||g[i]=='-')) return 0;
 return 1;
}
static int directory_ok(const struct axiom_time_context *c) {
 struct stat s; return c && c->directory_fd>=0 && fstat(c->directory_fd,&s)==0 && S_ISDIR(s.st_mode)
 && (s.st_mode&07777)==0750 && s.st_uid==c->publisher_uid && s.st_gid==c->reader_gid
 && (uint64_t)s.st_dev==c->directory_device && (uint64_t)s.st_ino==c->directory_inode && no_acl(c->directory_fd);
}
static int record_file(const struct axiom_time_context *c,int fd,struct stat *s) {
 return fstat(fd,s)==0 && S_ISREG(s->st_mode) && s->st_nlink==1 && (s->st_mode&07777)==0440
 && s->st_uid==c->publisher_uid && s->st_gid==c->reader_gid && s->st_size>0
 && (uint64_t)s->st_size<=AXIOM_TIME_RECORD_MAX && no_acl(fd);
}
static int uint_line(const char *s,uint64_t max,uint64_t *out) {
 if(!s||!*s||(s[0]=='0'&&s[1]))return 0; uint64_t n=0;
 for(;*s;s++){if(*s<'0'||*s>'9')return 0;uint64_t d=(uint64_t)(*s-'0');if(n>(max-d)/10)return 0;n=n*10+d;}
 *out=n;return 1;
}
/* Explicit ASCII wire, never Rust representation or native TimeSpec bytes. */
static int parse(const unsigned char *bytes,size_t n,const char *g,uint64_t *pub,uint64_t *marker) {
 if(!bytes||n<1||n>AXIOM_TIME_RECORD_MAX||!generation_ok(g))return 0;
 char copy[AXIOM_TIME_RECORD_MAX+1];memcpy(copy,bytes,n);copy[n]=0;
 for(size_t i=0;i<n;i++)if(bytes[i]<10||bytes[i]>126||bytes[i]==13)return 0;
 char *lines[12];size_t count=0;char *start=copy;
 for(size_t i=0;i<n;i++)if(copy[i]=='\n'){if(count>=12)return 0;copy[i]=0;lines[count++]=start;start=copy+i+1;}
 if(count!=12||start!=copy+n||strcmp(lines[0],"AXIOM_TIME_V1")||strcmp(lines[1],"clockbound-v2")||strcmp(lines[2],g)||strcmp(lines[11],"END"))return 0;
 uint64_t a,v,b,d;
 if(!uint_line(lines[3],UINT64_MAX,pub)||!*pub||!uint_line(lines[4],INT64_MAX,&a)||!uint_line(lines[5],INT64_MAX,&v)||v<=a
 ||!uint_line(lines[6],INT64_MAX,&b)||!uint_line(lines[7],999999999,&d)||!uint_line(lines[9],UINT64_MAX,marker))return 0;
 if(strcmp(lines[8],"synchronized")&&strcmp(lines[8],"unknown")&&strcmp(lines[8],"disrupted")&&strcmp(lines[8],"free-running"))return 0;
 return !strcmp(lines[10],"0")||!strcmp(lines[10],"1");
}
static int read_all(int fd,unsigned char *out,size_t expected) {
 size_t n=0;while(n<expected){ssize_t r=read(fd,out+n,expected-n);if(r<=0)return 0;n+=(size_t)r;}
 unsigned char extra;return read(fd,&extra,1)==0;
}
static int pread_all(int fd,unsigned char *out,size_t expected) {
 size_t n=0;while(n<expected){ssize_t r=pread(fd,out+n,expected-n,(off_t)n);if(r<=0)return 0;n+=(size_t)r;}
 unsigned char extra;return pread(fd,&extra,1,(off_t)expected)==0;
}
static int same(const struct stat *a,const struct stat *b) {
 return a->st_dev==b->st_dev&&a->st_ino==b->st_ino&&a->st_size==b->st_size&&a->st_mode==b->st_mode
 &&a->st_uid==b->st_uid&&a->st_gid==b->st_gid&&a->st_nlink==b->st_nlink;
}
static int latest_matches(const struct axiom_time_context *c,int fd) {
 struct stat held,named;if(!directory_ok(c)||!record_file(c,fd,&held)||fstatat(c->directory_fd,"current",&named,AT_SYMLINK_NOFOLLOW))return 0;
 return same(&held,&named);
}
static int initial_unknown(const unsigned char *bytes,size_t n) {
 size_t line=0,start=0;
 for(size_t i=0;i<n;i++)if(bytes[i]=='\n'){
  if(line==8)return i-start==7&&!memcmp(bytes+start,"unknown",7);
  line++;start=i+1;
 }
 return 0;
}
void axiom_time_publish_or_die(const struct axiom_time_context *c,const char *g,uint64_t pub,const unsigned char *bytes,size_t n) {
 uint64_t parsed=0,marker=0;if(!directory_ok(c)||!parse(bytes,n,g,&parsed,&marker)||parsed!=pub)fatal();
 if(pub==1&&!initial_unknown(bytes,n))fatal();
 int previous=openat(c->directory_fd,"current",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);
 if(previous>=0){
  struct stat st;unsigned char old[AXIOM_TIME_RECORD_MAX];uint64_t oldpub=0,oldmarker=0;
  int ok=record_file(c,previous,&st)&&read_all(previous,old,(size_t)st.st_size)&&parse(old,(size_t)st.st_size,g,&oldpub,&oldmarker)
   &&oldpub<UINT64_MAX&&oldpub+1==pub&&latest_matches(c,previous);
  if(close(previous)||!ok)fatal();
 }else if(errno!=ENOENT||pub!=1)fatal();
 char name[64];int len=snprintf(name,sizeof(name),".stage-%llu",(unsigned long long)pub);if(len<1||(size_t)len>=sizeof(name))fatal();
 int fd=openat(c->directory_fd,name,O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);if(fd<0)fatal();
 size_t offset=0;while(offset<n){ssize_t k=write(fd,bytes+offset,n-offset);if(k<=0)fatal();offset+=(size_t)k;}
 if(fchown(fd,(uid_t)c->publisher_uid,(gid_t)c->reader_gid)||fchmod(fd,0440)||fsync(fd))fatal();
 struct stat held;if(!record_file(c,fd,&held)||close(fd))fatal(); /* no writable handle at publication */
 if(!directory_ok(c)||renameat(c->directory_fd,name,c->directory_fd,"current")||fsync(c->directory_fd))fatal();
 int check=openat(c->directory_fd,"current",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);struct stat actual;
 if(check<0||!record_file(c,check,&actual)||!same(&held,&actual)||close(check))fatal();
 /* No cleanup/reuse on failure. A failed producer is permanently unavailable;
  * independent native lifecycle/disruption checks must invalidate old files. */
}
static int stamp(clockid_t id,uint64_t *out) {
 struct timespec t;if(clock_gettime(id,&t)||t.tv_sec<0||t.tv_nsec<0||t.tv_nsec>=1000000000)return 0;
 uint64_t sec=(uint64_t)t.tv_sec;if(sec>((uint64_t)INT64_MAX-(uint64_t)t.tv_nsec)/1000000000)return 0;
 *out=sec*1000000000+(uint64_t)t.tv_nsec;return 1;
}
int axiom_time_capture_v2(const struct axiom_time_context *c,const char *g,struct axiom_time_capture *out) {
 if(!out)return -1;memset(out,0,sizeof(*out));out->held_fd=-1;out->time_authority=0;
 if(!directory_ok(c)||!generation_ok(g))return -1;
 if(c->source_fd<0)return -1;int flags=fcntl(c->source_fd,F_GETFL);
 if(flags<0||(flags&O_ACCMODE)!=O_RDONLY)return -1;
 int fd=fcntl(c->source_fd,F_DUPFD_CLOEXEC,5);if(fd<0)return -1;
 struct stat before,after;int ok=record_file(c,fd,&before);
 if(ok){out->bytes=(size_t)before.st_size;ok=pread_all(fd,out->record,out->bytes)&&parse(out->record,out->bytes,g,&out->publication,&out->disruption_marker);}
 if(ok)ok=stamp(CLOCK_MONOTONIC,&out->p0_ns)&&stamp(CLOCK_REALTIME,&out->realtime_ns)&&stamp(CLOCK_MONOTONIC,&out->p1_ns);
 if(ok)ok=record_file(c,fd,&after)&&same(&before,&after)&&latest_matches(c,fd)&&stamp(CLOCK_MONOTONIC,&out->p2_ns)
 &&out->p0_ns<=out->p1_ns&&out->p1_ns<=out->p2_ns;
 if(!ok){close(fd);return -1;}out->held_fd=fd;out->device=(uint64_t)after.st_dev;out->inode=(uint64_t)after.st_ino;return 0;
}
int axiom_time_capture_current(const struct axiom_time_context *c,const struct axiom_time_capture *out) {
 if(!c||c->source_fd<0||!out||out->time_authority!=0||!latest_matches(c,c->source_fd))return -1;
 struct stat st;if(fstat(c->source_fd,&st)||(uint64_t)st.st_dev!=out->device||(uint64_t)st.st_ino!=out->inode||(size_t)st.st_size!=out->bytes)return -1;
 /* Resource identity only, NOT authenticated process liveness/disruption/time. */
 return 0;
}
void axiom_time_capture_release(struct axiom_time_capture *out) {
 if(out&&out->held_fd>=0){int fd=out->held_fd;out->held_fd=-1;if(close(fd))fatal();}
}
