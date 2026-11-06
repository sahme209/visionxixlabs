/* PREPARATION ONLY: actual native adapter is compiled, never invoked by local
 * tests. It grants no installed-platform/durability qualification. */
#define _DARWIN_C_SOURCE 1
#include "owner_journal_native.h"
#include "synthetic_resource_contract.h"
#include <sys/stat.h>
#include <sys/acl.h>
#include "protected_acl_empty.h"
#include <fcntl.h>
#include <unistd.h>
#include <string.h>
static int native_safe_stat(int fd,int directory,struct stat*out){
 struct stat s;if(fstat(fd,&s)||s.st_uid!=0||(directory?!S_ISDIR(s.st_mode):!S_ISREG(s.st_mode))||(s.st_mode&0022)||(!directory&&((s.st_mode&0777)!=0600||s.st_gid!=0||s.st_nlink!=1)))return 0;
 /* Reject all extended ACLs, rather than mistake mode bits for exclusive access. */
 acl_t acl=acl_get_fd_np(fd,ACL_TYPE_EXTENDED);if(!acl)return 0;int empty=ax_acl_is_empty(acl);int freed=acl_free(acl);if(!empty||freed)return 0;
 if(out)*out=s;return 1;
}
static int native_directory(void){
 int fd=open("/",O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return -1;
 if(!native_safe_stat(fd,1,NULL)){close(fd);return -1;}
 char path[]=AX_SYNTH_ROOT;char*save=NULL;char*part=strtok_r(path,"/",&save);
 while(part){
  int next=openat(fd,part,O_RDONLY|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
  int closed=close(fd);fd=-1;
  if(next<0)return -1;
  if(closed||!native_safe_stat(next,1,NULL)){close(next);return -1;}
  fd=next;part=strtok_r(NULL,"/",&save);
 }
 return fd;
}
static int native_current(AxOwnerNativeJournal*n){
 struct stat f,d;if(!n||n->failed||n->closed||n->fd<0||n->dirfd<0||!native_safe_stat(n->fd,0,&f)||!native_safe_stat(n->dirfd,1,&d)||f.st_dev!=n->device||f.st_ino!=n->inode||f.st_dev!=d.st_dev||f.st_size!=n->length){if(n)n->failed=1;return 0;}return 1;
}
static int native_create(void*v){
 AxOwnerNativeJournal*n=v;if(!n||!n->prepared||n->started||n->closed)return 0;n->started=1;n->failed=1;
 if(getuid()!=0||geteuid()!=0)return 0;
 n->dirfd=native_directory();if(n->dirfd<0)return 0;
 n->fd=openat(n->dirfd,"launch-owner.v1",O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);if(n->fd<0)return 0;
 if(fchown(n->fd,0,0)||fchmod(n->fd,0600))return 0;
 struct stat f,d;if(!native_safe_stat(n->fd,0,&f)||!native_safe_stat(n->dirfd,1,&d)||f.st_dev!=d.st_dev||f.st_size!=0)return 0;
 n->device=f.st_dev;n->inode=f.st_ino;n->length=0;n->failed=0;return 1;
}
static int native_append(void*v,const unsigned char*p,size_t length){
 AxOwnerNativeJournal*n=v;if(!n||!p||length!=32||memcmp(p,"AXOWN001",8)||!native_current(n)||n->length<0||n->length>(off_t)((AX_OWNER_MAX_RECORDS-1)*32)){if(n)n->failed=1;return 0;}
 /* One write only. Partial/EINTR/unknown results are consumed, never replayed. */
 ssize_t count=write(n->fd,p,length);if(count!=(ssize_t)length){n->failed=1;return 0;}n->length+=(off_t)length;return native_current(n);
}
static int native_file_barrier(void*v){AxOwnerNativeJournal*n=v;if(!native_current(n))return 0;if(fcntl(n->fd,F_FULLFSYNC,0)){n->failed=1;return 0;}return native_current(n);}
static int native_dir_barrier(void*v){AxOwnerNativeJournal*n=v;if(!native_current(n))return 0;if(fcntl(n->dirfd,F_FULLFSYNC,0)){n->failed=1;return 0;}return native_current(n);}
static int native_close(void*v){
 AxOwnerNativeJournal*n=v;if(!n||!n->prepared||n->closed)return 0;n->closed=1;int ok=1;
 if(n->fd>=0){int fd=n->fd;n->fd=-1;if(close(fd))ok=0;}
 if(n->dirfd>=0){int fd=n->dirfd;n->dirfd=-1;if(close(fd))ok=0;}
 if(!ok)n->failed=1;return ok;
}
int ax_owner_native_journal_ops(AxOwnerNativeJournal*n,AxOwnerJournalOps*o){
 if(!n||!o||n->prepared)return 0;n->fd=n->dirfd=-1;n->prepared=1;n->started=n->failed=n->closed=0;n->length=0;n->device=0;n->inode=0;
 AxOwnerJournalOps ops={n,native_create,native_append,native_file_barrier,native_dir_barrier,native_close};*o=ops;return 1;
}
