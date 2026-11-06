/* Private one-use release to the fixed owned qualification controller.
 * Source preparation only: actual launch/custody qualification remains closed. */
#define _DARWIN_C_SOURCE 1
#include "fixture_controller_handoff.h"
#include "fixture_controller_wire.h"
#include "fixture_authorization_frame.h"
#include "owner_config.h"
#include "owner_privilege_drop.h"
#include "system_peer_binding.h"
#include "synthetic_fixture_readiness.h"
#include <Security/Security.h>
#include <unistd.h>
#include <grp.h>
#include <fcntl.h>
#include <poll.h>
#include <sys/wait.h>
#include <sys/resource.h>
#include <signal.h>
#include <time.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#define CONTROLLER AX_SYNTH_APP "/Contents/MacOS/AxiomIssuerController"
static uint64_t milliseconds(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000+(uint64_t)t.tv_nsec/1000000;}
static int transfer(int fd,unsigned char*p,size_t n,int writing,uint64_t deadline){while(n){uint64_t at=milliseconds();if(at>=deadline)return 0;struct pollfd q={fd,writing?POLLOUT:POLLIN,0};int ready=poll(&q,1,(int)(deadline-at));if(ready<0&&errno==EINTR)continue;if(ready<=0||q.revents&(POLLERR|POLLNVAL))return 0;ssize_t got=writing?write(fd,p,n>4096?4096:n):read(fd,p,n);if(got<0&&(errno==EINTR||errno==EAGAIN||errno==EWOULDBLOCK))continue;if(got<=0)return 0;p+=got;n-=(size_t)got;}return 1;}
static int child_current(pid_t child,AxSystemPeer*peer){
 int status;pid_t observed=waitpid(child,&status,WNOHANG);if(observed!=0)return 0;
 const char*requirement=ax_system_peer_requirement(peer);if(!requirement)return 0;
 CFNumberRef pid=CFNumberCreate(NULL,kCFNumberIntType,&child);if(!pid)return 0;const void*keys[]={kSecGuestAttributePid};const void*values[]={pid};CFDictionaryRef attributes=CFDictionaryCreate(NULL,keys,values,1,&kCFTypeDictionaryKeyCallBacks,&kCFTypeDictionaryValueCallBacks);SecCodeRef code=NULL;SecRequirementRef expected=NULL;CFStringRef text=CFStringCreateWithCString(NULL,requirement,kCFStringEncodingUTF8);int ok=attributes&&text&&SecRequirementCreateWithString(text,kSecCSDefaultFlags,&expected)==errSecSuccess&&expected&&SecCodeCopyGuestWithAttributes(NULL,attributes,kSecCSDefaultFlags,&code)==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,expected)==errSecSuccess;
 if(code)CFRelease(code);if(expected)CFRelease(expected);if(text)CFRelease(text);if(attributes)CFRelease(attributes);CFRelease(pid);return ok&&ax_system_peer_current(peer)&&ax_fixture_maintenance_current();
}
typedef struct {int input,output,nullfd;int maximum;} ChildIO;
static int prepare_io(void*value){ChildIO*c=value;if(dup2(c->input,3)<0||dup2(c->output,4)<0||dup2(c->nullfd,0)<0||dup2(c->nullfd,1)<0||dup2(c->nullfd,2)<0||chdir(AX_SYNTH_ROOT))return 0;for(int fd=5;fd<c->maximum;fd++)close(fd);return 1;}
static int clear_groups(void*v){(void)v;return setgroups(0,NULL)==0;}static int gid(void*v,gid_t n){(void)v;return setgid(n)==0;}static int uid(void*v,uid_t n){(void)v;return setuid(n)==0;}static int ids(void*v,uid_t u,gid_t g){(void)v;return getuid()==u&&geteuid()==u&&getgid()==g&&getegid()==g;}
static int high_pipe(int p[2]){int low[2];if(pipe(low))return 0;p[0]=fcntl(low[0],F_DUPFD_CLOEXEC,10);p[1]=fcntl(low[1],F_DUPFD_CLOEXEC,10);close(low[0]);close(low[1]);return p[0]>=10&&p[1]>=10;}
int ax_fixture_controller_handoff(const unsigned char*bytes,size_t length,uint64_t deadline){
 AxFixtureAuthorization auth;memset(&auth,0,sizeof auth);if(!ax_fixture_authorization_decode(bytes,length,&auth))return 0;size_t cases=auth.count;ax_fixture_authorization_wipe(&auth);
 if(AX_FIXTURE_CONTROLLER_UID<=0||AX_FIXTURE_CONTROLLER_GID<=0||AX_FIXTURE_CONTROLLER_UID==AX_FIXTURE_FIXED_UID||milliseconds()>=deadline||!ax_fixture_maintenance_current())return 0;
 struct sigaction sa;if(sigaction(SIGCHLD,NULL,&sa)||sa.sa_handler!=SIG_DFL||(sa.sa_flags&SA_NOCLDWAIT))return 0;AxSystemPeer peer={0};if(!ax_system_peer_prepare(&peer,AX_SYSTEM_PEER_CONTROLLER))return 0;
 int input[2]={-1,-1},output[2]={-1,-1},nullfd=-1,ok=0,owned=0;pid_t child=-1;unsigned char hello[AX_FIXTURE_HELLO_SIZE]={0},echo[AX_FIXTURE_ECHO_SIZE]={0};struct rlimit limit;
 if(!high_pipe(input)||!high_pipe(output)||(nullfd=open("/dev/null",O_RDWR|O_NOFOLLOW|O_CLOEXEC))<0||getrlimit(RLIMIT_NOFILE,&limit)||limit.rlim_cur==RLIM_INFINITY||limit.rlim_cur>1048576)goto finish;
 {int original=nullfd;nullfd=fcntl(original,F_DUPFD_CLOEXEC,10);close(original);if(nullfd<10)goto finish;}
 memcpy(hello,AX_FIXTURE_HELLO,8);memcpy(hello+8,AX_SYNTH_GENERATION,32);arc4random_buf(hello+40,32);for(unsigned i=0;i<8;i++)hello[72+i]=(unsigned char)(deadline>>(56-i*8));
 ChildIO childio={input[0],output[1],nullfd,(int)limit.rlim_cur};AxOwnerDropOps drop={&childio,prepare_io,clear_groups,gid,uid,ids};
 char*const argv[]={(char*)CONTROLLER,(char*)"--qualification-reviewed-issuer",NULL};char*const environment[]={(char*)"LANG=C",NULL};
 /* All objects/config prepared above. Post-fork child uses syscall-only drop+exec. */
 child=fork();if(child==0){if(!ax_owner_drop_privileges(&drop,AX_FIXTURE_CONTROLLER_UID,AX_FIXTURE_CONTROLLER_GID))_exit(72);execve(CONTROLLER,argv,environment);_exit(73);}if(child<0)goto finish;owned=1;close(input[0]);input[0]=-1;close(output[1]);output[1]=-1;
 int input_flags=fcntl(input[1],F_GETFL),output_flags=fcntl(output[0],F_GETFL);if(input_flags<0||output_flags<0||fcntl(input[1],F_SETFL,input_flags|O_NONBLOCK)||fcntl(output[0],F_SETFL,output_flags|O_NONBLOCK))goto finish;
 int no_sigpipe=1;if(fcntl(input[1],F_SETNOSIGPIPE,no_sigpipe)||!ax_system_peer_current(&peer)||!transfer(input[1],hello,sizeof hello,1,deadline)||!transfer(output[0],echo,sizeof echo,0,deadline)||memcmp(echo,AX_FIXTURE_ECHO,8)||memcmp(echo+8,hello+40,32)||!child_current(child,&peer))goto finish;
 /* Positive stream progress advances this same owned pipe exactly once. An error,
  * timeout or unknown completion never replays a prefix or selects another child. */
 if(!transfer(input[1],(unsigned char*)bytes,length,1,deadline)||close(input[1]))goto finish;input[1]=-1;
 for(size_t i=0;i<=cases;i++){unsigned char result[AX_FIXTURE_RESULT_SIZE];if(!transfer(output[0],result,sizeof result,0,deadline)||memcmp(result,i==cases?AX_FIXTURE_DONE:AX_FIXTURE_RESULT,8)||result[8]!=(unsigned char)i||result[9]!=1||result[10]||result[11])goto finish;}
 {unsigned char extra;struct pollfd p={output[0],POLLIN,0};uint64_t now=milliseconds();if(now>=deadline||poll(&p,1,(int)(deadline-now))<=0||read(output[0],&extra,1)!=0)goto finish;}
 while(milliseconds()<deadline){int status;pid_t got=waitpid(child,&status,WNOHANG);if(got==child){owned=0;child=-1;ok=WIFEXITED(status)&&WEXITSTATUS(status)==0;break;}if(got<0&&errno!=EINTR){owned=0;child=-1;break;}struct timespec pause={0,1000000};nanosleep(&pause,NULL);}
 finish:if(owned&&child>0){int status;pid_t observed=waitpid(child,&status,WNOHANG);if(observed==0){kill(child,SIGKILL);uint64_t cleanup=milliseconds()+2000;while(milliseconds()<cleanup){pid_t got=waitpid(child,&status,WNOHANG);if(got==child||(got<0&&errno!=EINTR))break;struct timespec pause={0,1000000};nanosleep(&pause,NULL);}}}
 for(unsigned i=0;i<2;i++){if(input[i]>=0)close(input[i]);if(output[i]>=0)close(output[i]);}if(nullfd>=0)close(nullfd);memset(hello,0,sizeof hello);memset(echo,0,sizeof echo);ax_system_peer_revoke(&peer);return ok;
}
