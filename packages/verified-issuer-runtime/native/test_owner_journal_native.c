/* Every native effect below is replaced. No OS journal, ACL, privilege or sync
 * function is invoked. Stub fd values never identify actual process descriptors. */
#define _DARWIN_C_SOURCE 1
#include <sys/stat.h>
#include <sys/acl.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdarg.h>
#include <string.h>
#include <stdint.h>
#include <stdio.h>
#include <assert.h>
#include "owner_journal_native.h"
static unsigned effects,fail_at,nextfd,closed_count,fullsync_count;static off_t fake_length;static int bad_root,bad_acl,bad_file,bad_link;
static int effect(void){effects++;return effects!=fail_at;}
static uid_t fake_getuid(void){return bad_root?501:0;}static uid_t fake_geteuid(void){return bad_root?501:0;}
static int fake_open(const char*p,int flags,...){assert(!strcmp(p,"/")&&(flags&O_NOFOLLOW)&&(flags&O_DIRECTORY));return effect()?(int)nextfd++:-1;}
static int fake_openat(int fd,const char*p,int flags,...){assert(fd>=10&&p[0]&&strchr(p,'/')==NULL&&(flags&O_NOFOLLOW));if(!effect())return -1;if(flags&O_CREAT){assert(!strcmp(p,"launch-owner.v1")&&(flags&O_EXCL)&&(flags&O_CLOEXEC));return 1000;}return (int)nextfd++;}
static int fake_fstat(int fd,struct stat*s){if(!effect())return -1;memset(s,0,sizeof *s);s->st_uid=0;s->st_gid=0;s->st_dev=1;s->st_ino=fd;s->st_mode=(fd==1000?S_IFREG|0600:S_IFDIR|0755);s->st_nlink=fd==1000&&bad_link?2:1;s->st_size=fd==1000?fake_length:0;if(fd==1000&&bad_file)s->st_uid=501;return 0;}
static acl_t fake_acl_get_fd_np(int fd,acl_type_t t){assert(fd>=10&&t==ACL_TYPE_EXTENDED);return effect()?(acl_t)(uintptr_t)1:NULL;}
static acl_t fake_acl_init(int n){assert(n==0);return effect()?(acl_t)(uintptr_t)2:NULL;}
static ssize_t fake_acl_size(acl_t a){assert((uintptr_t)a==1||(uintptr_t)a==2);return effect()?8:-1;}
static ssize_t fake_acl_copy_ext(void*p,acl_t a,ssize_t n){assert(((uintptr_t)a==1||(uintptr_t)a==2)&&n==8);if(!effect())return -1;memset(p,bad_acl&&(uintptr_t)a==1?1:0,8);return 8;}
static int fake_acl_free(void*a){assert((uintptr_t)a==1||(uintptr_t)a==2);return effect()?0:-1;}
static int fake_close(int fd){assert(fd>=10);closed_count++;return effect()?0:-1;}
static int fake_fchown(int fd,uid_t u,gid_t g){assert(fd==1000&&u==0&&g==0);return effect()?0:-1;}
static int fake_fchmod(int fd,mode_t mode){assert(fd==1000&&mode==0600);return effect()?0:-1;}
static ssize_t fake_write(int fd,const void*b,size_t n){assert(fd==1000&&b&&n==32);if(!effect())return 7;fake_length+=(off_t)n;return(ssize_t)n;}
static int fake_fcntl(int fd,int cmd,...){assert(fd>=10&&cmd==F_FULLFSYNC);fullsync_count++;return effect()?0:-1;}
#define getuid fake_getuid
#define geteuid fake_geteuid
#define open fake_open
#define openat fake_openat
#define fstat fake_fstat
#define acl_get_fd_np fake_acl_get_fd_np
#define acl_init fake_acl_init
#define acl_size fake_acl_size
#define acl_copy_ext fake_acl_copy_ext
#define acl_free fake_acl_free
#define close fake_close
#define fchown fake_fchown
#define fchmod fake_fchmod
#define write fake_write
#define fcntl fake_fcntl
#include "owner_journal_native.c"
static void reset(void){effects=fail_at=closed_count=fullsync_count=0;nextfd=10;fake_length=0;bad_root=bad_acl=bad_file=bad_link=0;}
static int run(void){AxOwnerNativeJournal n={0};AxOwnerJournalOps o={0};AxOwnerJournal j={0};assert(ax_owner_native_journal_ops(&n,&o));assert(effects==0);int ok=ax_owner_journal_reserve(&j,&o);if(ok)ok=ax_owner_journal_intent(&j);int healthy=ax_owner_journal_close(&j);return ok&&healthy;}
int main(void){
 reset();assert(run());assert(fake_length==64&&fullsync_count==4);unsigned success_effects=effects;assert(closed_count>2);
 /* Each injected syscall/ACL/barrier/close refusal denies the positive path. */
 for(unsigned i=1;i<=success_effects;i++){reset();fail_at=i;assert(!run());}
 reset();bad_root=1;assert(!run());assert(effects==0);
 reset();bad_acl=1;assert(!run());assert(fake_length==0);
 reset();bad_file=1;assert(!run());assert(fake_length==0);
 reset();bad_link=1;assert(!run());assert(fake_length==0);
 reset();AxOwnerNativeJournal n={0};AxOwnerJournalOps o={0};assert(ax_owner_native_journal_ops(&n,&o));assert(!ax_owner_native_journal_ops(&n,&o));assert(effects==0);
 puts("owner journal actual-adapter stub cases passed");return 0;
}
