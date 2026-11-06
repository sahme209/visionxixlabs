/* Compiled local preparation only. owner_config.h keeps operational entry OFF.
 * No generated executable is run by the source qualification tests. */
#define _DARWIN_C_SOURCE 1
#include "owner_config.h"
#include "synthetic_fixture_readiness.h"
#include "owner_launch.h"
#include "owner_journal_native.h"
#include "owner_protocol.h"
#include "owner_privilege_drop.h"
#include "owner_resume.h"
#include "system_peer_binding.h"
#include "origin_process_identity.h"
#include <xpc/xpc.h>
#include <Security/Security.h>
#include <dispatch/dispatch.h>
#include <mach/mach.h>
#include <mach-o/dyld.h>
#include <sys/resource.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <sys/acl.h>
#include "protected_acl_empty.h"
#include <fcntl.h>
#include <unistd.h>
#include <signal.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <errno.h>
extern OSStatus SecCodeCreateWithXPCMessage(xpc_object_t,SecCSFlags,SecCodeRef*) __attribute__((weak_import));
typedef struct {xpc_connection_t connection;int ended;} OwnerPeer;
static AxOwnerLaunch launch;
static AxOwnerSlot slot;
static dispatch_queue_t queue;
static xpc_connection_t listener;
static AxSystemPeer broker_peer;
static AxOwnerResume resume_state;
static uint64_t lifetime;
static unsigned peers;
static int ending;
static unsigned char generation[16];
static uint64_t now_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static int fixed_generation(void){
 const char*s=AX_SYNTH_GENERATION;if(strlen(s)!=32)return 0;
 for(size_t i=0;i<16;i++){unsigned v=0;for(size_t j=0;j<2;j++){char c=s[2*i+j];unsigned n;if(c>='0'&&c<='9')n=(unsigned)(c-'0');else if(c>='a'&&c<='f')n=(unsigned)(c-'a'+10);else return 0;v=16*v+n;}generation[i]=(unsigned char)v;}return 1;
}
static int protected_file(const char*path,int directory){
 char copy[PATH_MAX],canonical[PATH_MAX];if(!path||strlen(path)>=sizeof(copy)||!realpath(path,canonical)||strcmp(path,canonical))return 0;
 strcpy(copy,path);struct stat s;
 for(;;){if(lstat(copy,&s)||S_ISLNK(s.st_mode)||s.st_uid!=0||(s.st_mode&0022))return 0;
  acl_t acl=acl_get_file(copy,ACL_TYPE_EXTENDED);if(!acl)return 0;
  int empty=ax_acl_is_empty(acl);int freed=acl_free(acl);
  if(!empty||freed)return 0;
  if(!strcmp(copy,path)){if(directory?!S_ISDIR(s.st_mode):(!S_ISREG(s.st_mode)||s.st_nlink!=1))return 0;}
  else if(!S_ISDIR(s.st_mode))return 0;
  char*end=strrchr(copy,'/');if(!end)return 0;if(end==copy)break;*end=0;
 }return 1;
}
static int fixed_environment(void*context){
 (void)context;
 if(!ax_fixture_selected_principals()||getuid()!=0||geteuid()!=0||!AX_OWNER_FIXED_UID||!AX_OWNER_FIXED_GID||AX_OWNER_PROFILE!=AX_OWNER_PROFILE_SYSTEM||!AX_OWNER_MAX_LIFETIME_NS||!SecCodeCreateWithXPCMessage)return 0;
 char running[PATH_MAX],canonical[PATH_MAX];uint32_t n=sizeof(running);struct stat own;
 if(_NSGetExecutablePath(running,&n)||!realpath(running,canonical)||strcmp(canonical,AX_OWNER_PATH)||!protected_file(AX_OWNER_PATH,0)||!protected_file(AX_SYNTH_BROKER,0)||!protected_file(AX_SYNTH_ROOT,1)||stat(AX_OWNER_PATH,&own)||!axiom_origin_loaded_file_matches((uintptr_t)&fixed_environment,&own))return 0;
 /* No inherited capabilities beyond standard descriptors. Fail instead of
  * guessing which inherited writable handles may safely reach the child. */
 for(int fd=0;fd<3;fd++)if(fcntl(fd,F_GETFD)<0)return 0;
 struct rlimit limits;if(getrlimit(RLIMIT_NOFILE,&limits)||limits.rlim_cur>65536)return 0;
 for(int fd=3;fd<(int)limits.rlim_cur;fd++){errno=0;if(fcntl(fd,F_GETFD)>=0||errno!=EBADF)return 0;}
 thread_act_array_t threads=NULL;mach_msg_type_number_t count=0;
 if(task_threads(mach_task_self(),&threads,&count)!=KERN_SUCCESS)return 0;
 int single=count==1;for(mach_msg_type_number_t i=0;i<count;i++)mach_port_deallocate(mach_task_self(),threads[i]);
 vm_deallocate(mach_task_self(),(vm_address_t)threads,count*sizeof(thread_t));
 return single&&fixed_generation();
}
static int clear_groups(void*p){(void)p;return setgroups(0,NULL)==0;}
static int prepare_io(void*p){
 AxOwnerNativeJournal*n=p;
 if(!n||n->fd<3||n->dirfd<3||n->fd==n->dirfd)return 0;
 /* Close inherited root-write capabilities BEFORE non-root stop/exec. */
 if(close(n->fd)||close(n->dirfd))return 0;n->fd=n->dirfd=-1;
 int fd=open("/dev/null",O_RDWR|O_CLOEXEC|O_NOFOLLOW);if(fd<0)return 0;
 struct stat s;int ok=fstat(fd,&s)==0&&S_ISCHR(s.st_mode);
 for(int i=0;ok&&i<3;i++)if(dup2(fd,i)!=i||fcntl(i,F_SETFD,0))ok=0;
 if(fd>2&&close(fd))ok=0;return ok;
}
static int drop_gid(void*p,gid_t g){(void)p;return setgid(g)==0;}
static int drop_uid(void*p,uid_t u){(void)p;return setuid(u)==0;}
static int verify_ids(void*p,uid_t u,gid_t g){(void)p;return getuid()==u&&geteuid()==u&&getgid()==g&&getegid()==g&&getgroups(0,NULL)==0;}
static pid_t spawn_fixed(void*p){
 (void)p;uint64_t now=now_ns();
 if(now==UINT64_MAX||now>=slot.deadline||now>=lifetime)return -1;
 pid_t child=fork();if(child!=0)return child;
 /* No dispatch/Security/threaded-runtime initialization has occurred in the
  * parent. Actual pre-fork/runtime safety still requires OS qualification. */
 AxOwnerDropOps drop={p,prepare_io,clear_groups,drop_gid,drop_uid,verify_ids};
 if(!ax_owner_drop_privileges(&drop,AX_OWNER_FIXED_UID,AX_OWNER_FIXED_GID))_exit(77);
 /* Parent derives peer identity only AFTER fork while this child waits.
  * An untrusted same-UID SIGCONT can cause refusal/DoS, never owner binding. */
 if(kill(getpid(),SIGSTOP))_exit(79);
 char*argv[]={AX_SYNTH_BROKER,NULL};char*env[]={"PATH=/usr/bin:/bin","LANG=C","LC_ALL=C","TZ=UTC",NULL};
 /* Journal/parent descriptors were created CLOEXEC. No caller env/argv. */
 execve(AX_SYNTH_BROKER,argv,env);_exit(78);
}
static int child_alive(void*p,pid_t child){
 (void)p;if(child<=0)return 0;siginfo_t info;memset(&info,0,sizeof(info));
 return waitid(P_PID,(id_t)child,&info,WEXITED|WNOHANG|WNOWAIT)==0&&info.si_pid==0;
}
static int kill_and_reap(void*p,pid_t child){
 (void)p;if(child<=0)return 0;
 if(child_alive(NULL,child)&&kill(child,SIGTERM)&&errno!=ESRCH)return 0;
 /* Polling only; no blocking wait that could claim bounded cleanup. */
 for(unsigned i=0;i<20;i++){int status;pid_t result=waitpid(child,&status,WNOHANG);
  if(result==child)return WIFEXITED(status)&&WEXITSTATUS(status)==0;if(result<0&&errno!=EINTR)return 0;
  struct timespec pause={0,10000000};nanosleep(&pause,NULL);
 }
 /* A forced broker kill is not proof its Node descendant is quiescent. */
 if(child_alive(NULL,child))kill(child,SIGKILL);
 for(unsigned i=0;i<20;i++){int status;pid_t result=waitpid(child,&status,WNOHANG);if(result==child)break;if(result<0&&errno!=EINTR)break;struct timespec pause={0,10000000};nanosleep(&pause,NULL);}
 return 0;
}
static int message_matches(xpc_object_t message){
 SecCodeRef code=NULL;SecRequirementRef req=NULL;
 const char*expected=ax_system_peer_requirement(&broker_peer);if(!expected)return 0;
 CFStringRef text=CFStringCreateWithCString(NULL,expected,kCFStringEncodingUTF8);if(!text)return 0;
 OSStatus status=SecRequirementCreateWithString(text,kSecCSDefaultFlags,&req);CFRelease(text);if(status!=errSecSuccess||!req)return 0;
 status=SecCodeCreateWithXPCMessage(message,kSecCSDefaultFlags,&code);
 int ok=status==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,req)==errSecSuccess;
 if(code)CFRelease(code);CFRelease(req);return ok&&ax_system_peer_current(&broker_peer);
}
static void stop_owner(void){if(ending)return;ending=1;ax_owner_slot_revoke(&slot);ax_system_peer_revoke(&broker_peer);ax_owner_launch_stop(&launch);_exit(launch.cleanup_unknown?79:0);}
static void reply(xpc_object_t message,const char*status){
 xpc_object_t r=xpc_dictionary_create_reply(message);if(!r)return;
 xpc_dictionary_set_string(r,"status",status);xpc_dictionary_set_int64(r,"child",slot.child);
 xpc_dictionary_set_data(r,"generation",slot.generation,16);xpc_dictionary_set_data(r,"client",slot.client,32);xpc_dictionary_set_data(r,"owner",slot.owner,32);xpc_dictionary_set_uint64(r,"sequence",slot.sequence);
 xpc_connection_t connection=xpc_dictionary_get_remote_connection(message);if(connection)xpc_connection_send_message(connection,r);xpc_release(r);
}
static void handle(OwnerPeer*p,xpc_object_t message){
 uint64_t started=now_ns();if(ending||started==UINT64_MAX||started>=lifetime||started>UINT64_MAX-AX_OWNER_REQUEST_NS){reply(message,"refused");return;}
 const char*op=xpc_dictionary_get_string(message,"op");size_t gl=0,cl=0,bl=0;
 const void*g=xpc_dictionary_get_data(message,"generation",&gl),*c=xpc_dictionary_get_data(message,"client",&cl),*b=xpc_dictionary_get_data(message,"owner",&bl);
 int begin=op&&!strcmp(op,"begin"),ack=op&&!strcmp(op,"ack"),live=op&&!strcmp(op,"live");
 if((!begin&&!ack&&!live)||gl!=16||cl!=32||xpc_dictionary_get_count(message)!=(begin?3U:5U)||(!begin&&bl!=32)){reply(message,"refused");return;}
 xpc_object_t sequence=xpc_dictionary_get_value(message,"sequence");
 if(!begin&&(!sequence||xpc_get_type(sequence)!=XPC_TYPE_UINT64)){reply(message,"refused");return;}
 int auth=message_matches(message);uint64_t now=now_ns();
 if(!auth||now==UINT64_MAX||now-started>=AX_OWNER_REQUEST_NS||now>=lifetime){reply(message,"refused");return;}
 int alive=launch.active&&child_alive(NULL,launch.child),ok=0;const char*status="refused";
 now=now_ns();if(now==UINT64_MAX||now-started>=AX_OWNER_REQUEST_NS||now>=lifetime){reply(message,"refused");return;}
 if(begin){unsigned char random[32];arc4random_buf(random,sizeof(random));ok=ax_owner_slot_begin(&slot,1,alive,now,(uintptr_t)p,g,c,random);status="owner_pending";}
 else if(ack){ok=ax_owner_slot_ack(&slot,1,alive,now,(uintptr_t)p,g,c,b,xpc_dictionary_get_uint64(message,"sequence"));status="owner_authenticated";}
 else{ok=ax_owner_slot_live(&slot,1,alive,now,(uintptr_t)p,g,c,b,xpc_dictionary_get_uint64(message,"sequence"));status="owner_current";}
 reply(message,ok?status:"refused");if(slot.phase==AX_OWNER_REVOKED)stop_owner();
}
static uint64_t resume_now(void*p){(void)p;return now_ns();}
static int owned_stopped(void*p,pid_t child){
 (void)p;if(child!=launch.child||!launch.active)return 0;
 for(;;){
  uint64_t n=now_ns();if(n==UINT64_MAX||n>=slot.deadline||n>=lifetime||!child_alive(NULL,child))return 0;
  siginfo_t info;memset(&info,0,sizeof(info));
  if(waitid(P_PID,(id_t)child,&info,WSTOPPED|WNOHANG|WNOWAIT))return 0;
  if(info.si_pid==child)return info.si_code==CLD_STOPPED&&info.si_status==SIGSTOP;
  struct timespec pause={0,1000000};if(nanosleep(&pause,NULL)&&errno!=EINTR)return 0;
 }
}
static int select_peer(void*p){(void)p;return ax_system_peer_prepare(&broker_peer,AX_SYSTEM_PEER_BROKER);}
static int peer_current(void*p){(void)p;return ax_system_peer_current(&broker_peer);}
static int resume_child(void*p,pid_t child){(void)p;return child==launch.child&&launch.active&&child_alive(NULL,child)&&kill(child,SIGCONT)==0;}
static int configure_listener(void*p){
 (void)p;
 queue=dispatch_queue_create("axiom.synthetic.launch-owner",DISPATCH_QUEUE_SERIAL);if(!queue)return 0;
 listener=xpc_connection_create_mach_service(AX_OWNER_SERVICE,queue,XPC_CONNECTION_MACH_SERVICE_LISTENER);
 const char*expected=ax_system_peer_requirement(&broker_peer);if(!expected||!listener||xpc_connection_set_peer_code_signing_requirement(listener,expected))return 0;
 xpc_connection_set_event_handler(listener,^(xpc_object_t peer){
  if(xpc_get_type(peer)!=XPC_TYPE_CONNECTION)return;
  if(ending||peers>=32){xpc_connection_set_event_handler(peer,^(xpc_object_t e){(void)e;});xpc_connection_activate(peer);xpc_connection_cancel(peer);return;}
  OwnerPeer*p=calloc(1,sizeof(*p));if(!p){xpc_connection_set_event_handler(peer,^(xpc_object_t e){(void)e;});xpc_connection_activate(peer);xpc_connection_cancel(peer);return;}
  p->connection=xpc_retain(peer);peers++;xpc_connection_set_context(peer,p);xpc_connection_set_finalizer_f(peer,free);
  int configured=xpc_connection_set_peer_code_signing_requirement(peer,broker_peer.requirement)==0;
  xpc_connection_set_event_handler(peer,^(xpc_object_t event){if(p->ended)return;if(xpc_get_type(event)==XPC_TYPE_DICTIONARY){handle(p,event);return;}p->ended=1;if(peers)peers--;if(slot.peer==(uintptr_t)p)stop_owner();xpc_connection_cancel(p->connection);xpc_release(p->connection);});
  xpc_connection_activate(peer);if(!configured)xpc_connection_cancel(peer);
 });return 1;

}

int main(int argc,char**argv){
 (void)argv;if(argc!=1||!ax_fixture_selected_principals())return 69;
 AxOwnerNativeJournal native={0};AxOwnerJournalOps journal;
 if(!ax_owner_native_journal_ops(&native,&journal))return 70;
 AxOwnerLaunchOps effects={&native,fixed_environment,spawn_fixed,child_alive,kill_and_reap};
 uint64_t start=now_ns();if(start==UINT64_MAX||!fixed_generation()||!ax_owner_slot_reserve(&slot,start,generation))return 70;
 if(!AX_OWNER_MAX_LIFETIME_NS||start>UINT64_MAX-AX_OWNER_MAX_LIFETIME_NS)return 73;
 lifetime=start+AX_OWNER_MAX_LIFETIME_NS;
 if(!ax_owner_launch_start(&launch,&effects,&journal))return 71;
 if(!ax_owner_slot_child(&slot,launch.child,launch.journal.phase==AX_OWNER_JOURNAL_CREATED,now_ns())){ax_owner_launch_stop(&launch);return 72;}
 AxOwnerResumeOps resume_ops={NULL,resume_now,owned_stopped,select_peer,configure_listener,peer_current,resume_child};
 uint64_t resume_deadline=slot.deadline<lifetime?slot.deadline:lifetime;
 if(!ax_owner_resume_once(&resume_state,&resume_ops,launch.child,resume_deadline)){
  if(resume_state.effect_unknown)launch.cleanup_unknown=1;stop_owner();return 80;
 }
 xpc_connection_activate(listener);
 signal(SIGTERM,SIG_IGN);signal(SIGINT,SIG_IGN);
 dispatch_source_t term=dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL,SIGTERM,0,queue),interrupt=dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL,SIGINT,0,queue);
 if(!term||!interrupt)stop_owner();dispatch_source_set_event_handler(term,^{stop_owner();});dispatch_source_set_event_handler(interrupt,^{stop_owner();});dispatch_resume(term);dispatch_resume(interrupt);
 dispatch_source_t timer=dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,0,0,queue);if(!timer)stop_owner();
 dispatch_source_set_timer(timer,dispatch_time(DISPATCH_TIME_NOW,100000000LL),100000000LL,0);
 dispatch_source_set_event_handler(timer,^{uint64_t now=now_ns();if(now==UINT64_MAX||now>=lifetime||!child_alive(NULL,launch.child)||(slot.phase!=AX_OWNER_AUTHENTICATED&&now>=slot.deadline))stop_owner();});dispatch_resume(timer);
 dispatch_main();
}
