/* Actual handoff body; every process/filesystem/Security API is inert. */
#define AX_FIXTURE_CONTROLLER_UID 503
#define AX_FIXTURE_CONTROLLER_GID 503
#define AX_FIXTURE_FIXED_UID 504
#define _DARWIN_C_SOURCE 1
#include <Security/Security.h>
#include <unistd.h>
#include <grp.h>
#include <fcntl.h>
#include <poll.h>
#include <sys/wait.h>
#include <sys/resource.h>
#include <signal.h>
#include <time.h>
#include <assert.h>
#include <string.h>
#define DECL(n) extern __typeof__(n) fake_##n
DECL(clock_gettime);DECL(poll);DECL(read);DECL(write);DECL(waitpid);DECL(close);DECL(pipe);DECL(fcntl);DECL(open);DECL(getrlimit);DECL(fork);DECL(dup2);DECL(chdir);DECL(setgroups);DECL(setgid);DECL(setuid);DECL(getuid);DECL(geteuid);DECL(getgid);DECL(getegid);DECL(execve);DECL(kill);DECL(nanosleep);DECL(sigaction);DECL(arc4random_buf);
DECL(CFNumberCreate);DECL(CFDictionaryCreate);DECL(CFStringCreateWithCString);DECL(CFRelease);DECL(SecRequirementCreateWithString);DECL(SecCodeCopyGuestWithAttributes);DECL(SecCodeCheckValidity);
#define clock_gettime fake_clock_gettime
#define poll fake_poll
#define read fake_read
#define write fake_write
#define waitpid fake_waitpid
#define close fake_close
#define pipe fake_pipe
#define fcntl fake_fcntl
#define open fake_open
#define getrlimit fake_getrlimit
#define fork fake_fork
#define dup2 fake_dup2
#define chdir fake_chdir
#define setgroups fake_setgroups
#define setgid fake_setgid
#define setuid fake_setuid
#define getuid fake_getuid
#define geteuid fake_geteuid
#define getgid fake_getgid
#define getegid fake_getegid
#define execve fake_execve
#define kill fake_kill
#define nanosleep fake_nanosleep
#define sigaction(...) fake_sigaction(__VA_ARGS__)
#define arc4random_buf fake_arc4random_buf
#define CFNumberCreate fake_CFNumberCreate
#define CFDictionaryCreate fake_CFDictionaryCreate
#define CFStringCreateWithCString fake_CFStringCreateWithCString
#define CFRelease fake_CFRelease
#define SecRequirementCreateWithString fake_SecRequirementCreateWithString
#define SecCodeCopyGuestWithAttributes fake_SecCodeCopyGuestWithAttributes
#define SecCodeCheckValidity fake_SecCodeCheckValidity
#include "fixture_controller_handoff.c"
static int fds,ended,foreign,nonce_wrong,short_write,partial_write,eagain_once,poll_timeout,nonblocking,no_child,kills,forks,security_calls;static unsigned char captured[80],received[AX_FIXTURE_AUTH_FRAME_MAX];static size_t hello_used,output_used,received_length;
int ax_fixture_maintenance_current(void){return 1;}int ax_system_peer_prepare(AxSystemPeer*p,int role){assert(role==AX_SYSTEM_PEER_CONTROLLER);p->captured=1;return 1;}int ax_system_peer_current(AxSystemPeer*p){return p->captured;}const char*ax_system_peer_requirement(AxSystemPeer*p){return p->captured?"cdhash H\"0123456789012345678901234567890123456789\"":NULL;}void ax_system_peer_revoke(AxSystemPeer*p){p->captured=0;}
int fake_clock_gettime(clockid_t c,struct timespec*t){(void)c;t->tv_sec=1;t->tv_nsec=0;return 0;}int fake_poll(struct pollfd*p,nfds_t n,int timeout){(void)timeout;if(poll_timeout)return 0;for(nfds_t i=0;i<n;i++)p[i].revents=p[i].events;return 1;}
ssize_t fake_write(int fd,const void*p,size_t n){(void)fd;if(eagain_once){eagain_once=0;errno=EAGAIN;return -1;}if(short_write){errno=EIO;return-1;}size_t actual=partial_write&&n>1?n-1:n;if(hello_used<80){size_t copy=80-hello_used;if(copy>actual)copy=actual;memcpy(captured+hello_used,p,copy);hello_used+=copy;}else{assert(received_length+actual<=sizeof received);memcpy(received+received_length,p,actual);received_length+=actual;}return(ssize_t)actual;}
ssize_t fake_read(int fd,void*out,size_t n){(void)fd;unsigned char sequence[64]={0};memcpy(sequence,AX_FIXTURE_ECHO,8);memcpy(sequence+8,captured+40,32);if(nonce_wrong)sequence[8]^=1;memcpy(sequence+40,AX_FIXTURE_RESULT,8);sequence[49]=1;memcpy(sequence+52,AX_FIXTURE_DONE,8);sequence[60]=1;sequence[61]=1;if(output_used==sizeof sequence){ended=1;return 0;}size_t copy=sizeof sequence-output_used;if(copy>n)copy=n;memcpy(out,sequence+output_used,copy);output_used+=copy;return(ssize_t)copy;}
pid_t fake_waitpid(pid_t p,int*status,int flags){assert(p==7&&flags==WNOHANG);if(no_child){errno=ECHILD;return-1;}*status=0;return ended?p:0;}int fake_close(int fd){(void)fd;return 0;}int fake_pipe(int*p){p[0]=5;p[1]=6;return 0;}int fake_fcntl(int fd,int cmd,...){(void)fd;if(cmd==F_SETFL)nonblocking++;return cmd==F_DUPFD_CLOEXEC?10+fds++:0;}int fake_open(const char*p,int flags,...){assert(!strcmp(p,"/dev/null"));(void)flags;return 5;}int fake_getrlimit(int r,struct rlimit*l){assert(r==RLIMIT_NOFILE);l->rlim_cur=100;return 0;}pid_t fake_fork(void){forks++;return 7;}int fake_dup2(int a,int b){(void)a;return b;}int fake_chdir(const char*p){(void)p;return 0;}int fake_setgroups(int n,const gid_t*g){(void)n;(void)g;return 0;}int fake_setgid(gid_t g){(void)g;return 0;}int fake_setuid(uid_t u){(void)u;return 0;}uid_t fake_getuid(void){return 503;}uid_t fake_geteuid(void){return 503;}gid_t fake_getgid(void){return 503;}gid_t fake_getegid(void){return 503;}int fake_execve(const char*p,char*const*a,char*const*b){(void)p;(void)a;(void)b;return-1;}int fake_kill(pid_t p,int s){assert(p==7&&s==SIGKILL);kills++;ended=1;return 0;}int fake_nanosleep(const struct timespec*a,struct timespec*b){(void)a;(void)b;return 0;}int fake_sigaction(int n,const struct sigaction*a,struct sigaction*b){assert(n==SIGCHLD);(void)a;memset(b,0,sizeof *b);b->sa_handler=SIG_DFL;return 0;}void fake_arc4random_buf(void*p,size_t n){memset(p,7,n);}
CFNumberRef fake_CFNumberCreate(CFAllocatorRef a,CFNumberType t,const void*v){(void)a;(void)t;assert(*(const pid_t*)v==7);return(CFNumberRef)1;}CFDictionaryRef fake_CFDictionaryCreate(CFAllocatorRef a,const void**k,const void**v,CFIndex n,const CFDictionaryKeyCallBacks*b,const CFDictionaryValueCallBacks*c){(void)a;(void)k;(void)v;(void)b;(void)c;assert(n==1);return(CFDictionaryRef)2;}CFStringRef fake_CFStringCreateWithCString(CFAllocatorRef a,const char*s,CFStringEncoding e){(void)a;(void)e;assert(!strncmp(s,"cdhash",6));return(CFStringRef)3;}void fake_CFRelease(CFTypeRef p){assert(p);}OSStatus fake_SecRequirementCreateWithString(CFStringRef s,SecCSFlags f,SecRequirementRef*out){(void)s;(void)f;*out=(SecRequirementRef)4;return 0;}OSStatus fake_SecCodeCopyGuestWithAttributes(SecCodeRef h,CFDictionaryRef a,SecCSFlags f,SecCodeRef*out){(void)h;(void)a;(void)f;security_calls++;*out=(SecCodeRef)5;return 0;}OSStatus fake_SecCodeCheckValidity(SecCodeRef c,SecCSFlags f,SecRequirementRef r){(void)c;(void)f;(void)r;return foreign?errSecCSUnsigned:0;}
static void reset(void){fds=ended=foreign=nonce_wrong=short_write=partial_write=eagain_once=poll_timeout=nonblocking=no_child=kills=forks=security_calls=0;hello_used=output_used=received_length=0;memset(captured,0,sizeof captured);}
int main(int argc,char**argv){(void)argv;AxFixtureAuthorization auth={0};strcpy(auth.requester_token,"axm.desk.dsk.qualification.requester.");memset(auth.requester_token+strlen(auth.requester_token),'a',64);strcpy(auth.reviewer_token,"axm.desk.dsk.qualification.reviewer.");memset(auth.reviewer_token+strlen(auth.reviewer_token),'b',64);auth.count=1;strcpy(auth.scenarios[0].request_id,"request");strcpy(auth.scenarios[0].plan_id,"release_plan_");memset(auth.scenarios[0].plan_id+13,'c',64);strcpy(auth.scenarios[0].client_request_id,"550e8400-e29b-41d4-a716-446655440000");unsigned char bytes[AX_FIXTURE_AUTH_FRAME_MAX];size_t n;assert(ax_fixture_authorization_encode(&auth,bytes,sizeof bytes,&n));if(argc==2){memset(bytes+n,' ',sizeof bytes-n);n=sizeof bytes;bytes[40]=0;bytes[41]=1;bytes[42]=bytes[43]=0;reset();partial_write=1;assert(ax_fixture_controller_handoff(bytes,n,61000));assert(received_length==n&&!memcmp(received,bytes,n));return 0;}reset();assert(ax_fixture_controller_handoff(bytes,n,61000));assert(forks==1&&security_calls==1&&kills==0);reset();foreign=1;assert(!ax_fixture_controller_handoff(bytes,n,61000));assert(hello_used==80);reset();nonce_wrong=1;assert(!ax_fixture_controller_handoff(bytes,n,61000));assert(hello_used==80);reset();no_child=1;assert(!ax_fixture_controller_handoff(bytes,n,61000));assert(kills==0);reset();short_write=1;assert(!ax_fixture_controller_handoff(bytes,n,61000));reset();partial_write=1;assert(ax_fixture_controller_handoff(bytes,n,61000));reset();eagain_once=1;assert(ax_fixture_controller_handoff(bytes,n,61000));assert(nonblocking==2);reset();poll_timeout=1;assert(!ax_fixture_controller_handoff(bytes,n,61000));assert(received_length==0);reset();assert(!ax_fixture_controller_handoff(bytes,n,1000));assert(forks==0);return 0;}
