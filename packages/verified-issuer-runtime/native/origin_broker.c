/* Fixed canonical origin broker. COMPILE ONLY until the full package/consumer
 * qualification packet is separately authorized. No action/provider endpoint. */
#define _DARWIN_C_SOURCE 1
#include "origin_config.h"
#include "origin_runtime_protocol.h"
#include "origin_root_binding.h"
#include "origin_process_identity.h"
#include <xpc/xpc.h>
#include <Security/Security.h>
#include <dispatch/dispatch.h>
#include <mach-o/dyld.h>
#include <spawn.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <signal.h>
#include <stdio.h>
#include <errno.h>
extern OSStatus SecCodeCreateWithXPCMessage(xpc_object_t,SecCSFlags,SecCodeRef*) __attribute__((weak_import));
static AxiomOriginSlot slot;
static AxiomOriginRootBinding resources;
static int started_once;
static dispatch_queue_t queue;
static unsigned accepted_peers;
static char peer_requirement[4096];
static uint64_t now_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static int message_matches(xpc_object_t message,const char*requirement){
 if(!SecCodeCreateWithXPCMessage||!message||xpc_get_type(message)!=XPC_TYPE_DICTIONARY||!requirement||!requirement[0])return 0;
 SecCodeRef code=NULL;SecRequirementRef req=NULL;CFStringRef text=CFStringCreateWithCString(NULL,requirement,kCFStringEncodingUTF8);if(!text)return 0;
 OSStatus status=SecRequirementCreateWithString(text,kSecCSDefaultFlags,&req);CFRelease(text);if(status!=errSecSuccess||!req)return 0;
 status=SecCodeCreateWithXPCMessage(message,kSecCSDefaultFlags,&code);int ok=status==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,req)==errSecSuccess;
 if(code)CFRelease(code);CFRelease(req);return ok;
}
static int child_alive(void){if(slot.child<=0)return 0;siginfo_t info;memset(&info,0,sizeof(info));if(waitid(P_PID,(id_t)slot.child,&info,WEXITED|WNOHANG|WNOWAIT))return 0;return info.si_pid==0;}
static void stop_owned(void){if(slot.child>0&&child_alive())kill(slot.child,SIGKILL);}
static void reap_owned(pid_t child,unsigned remaining){int status;pid_t result=waitpid(child,&status,WNOHANG);if(result==child||result<0)return;if(!remaining){fputs("verified_issuer_child_cleanup_unknown\n",stderr);return;}dispatch_after(dispatch_time(DISPATCH_TIME_NOW,10000000LL),queue,^{reap_owned(child,remaining-1);});}
static void reply(xpc_object_t message,const char*status,pid_t child,const unsigned char*a,const unsigned char*b){xpc_object_t value=xpc_dictionary_create_reply(message);if(!value)return;xpc_dictionary_set_string(value,"status",status);xpc_dictionary_set_int64(value,"child",child);if(a)xpc_dictionary_set_data(value,"client",a,32);if(b)xpc_dictionary_set_data(value,"broker",b,32);xpc_connection_t peer=xpc_dictionary_get_remote_connection(message);if(peer)xpc_connection_send_message(peer,value);xpc_release(value);}
static int claim_startup(void){
 if(!AXIOM_ISSUER_SPAWN_CLAIM[0])return 0;char parent[PATH_MAX];if(strlen(AXIOM_ISSUER_SPAWN_CLAIM)>=sizeof(parent))return 0;strcpy(parent,AXIOM_ISSUER_SPAWN_CLAIM);char*end=strrchr(parent,'/');if(!end||end==parent||strcmp(end+1,"issuer-startup-claim.json"))return 0;*end=0;
 char canonical[PATH_MAX];struct stat dir;if(!realpath(parent,canonical)||strcmp(parent,canonical)||lstat(parent,&dir)||!S_ISDIR(dir.st_mode)||dir.st_uid!=getuid()||(dir.st_mode&0777)!=0700)return 0;
 int fd=open(AXIOM_ISSUER_SPAWN_CLAIM,O_CREAT|O_EXCL|O_NOFOLLOW|O_WRONLY|O_CLOEXEC,0600);if(fd<0)return 0;const char bytes[]="{\"status\":\"startup_consumed_unknown_no_retry\"}\n";int ok=write(fd,bytes,sizeof(bytes)-1)==(ssize_t)sizeof(bytes)-1&&fsync(fd)==0;int closed=close(fd);return ok&&!closed;
}
static void drain(int fd){
 if(fcntl(fd,F_SETFL,O_NONBLOCK)){close(fd);stop_owned();axiom_origin_slot_revoke(&slot);return;}
 dispatch_source_t source=dispatch_source_create(DISPATCH_SOURCE_TYPE_READ,(uintptr_t)fd,0,queue);if(!source){close(fd);stop_owned();axiom_origin_slot_revoke(&slot);return;}
 __block uint64_t window=now_ns();__block size_t bytes=0;
 dispatch_source_set_event_handler(source,^{char buffer[4096];ssize_t count=read(fd,buffer,sizeof(buffer));if(count==0){dispatch_source_cancel(source);return;}if(count<0){if(errno!=EAGAIN&&errno!=EINTR)dispatch_source_cancel(source);return;}uint64_t now=now_ns();if(now<window||now==UINT64_MAX){stop_owned();axiom_origin_slot_revoke(&slot);dispatch_source_cancel(source);return;}if(now-window>=1000000000ULL){window=now;bytes=0;}bytes+=(size_t)count;if(bytes>1024U*1024U){stop_owned();axiom_origin_slot_revoke(&slot);dispatch_source_cancel(source);}});
 dispatch_source_set_cancel_handler(source,^{close(fd);dispatch_release(source);});dispatch_resume(source);
}
static int fixed_start(void){
 if(started_once)return 0;started_once=1;if(!claim_startup()||!axiom_origin_bind_root(&resources))return 0;
 char bootstrap[PATH_MAX];if(snprintf(bootstrap,sizeof(bootstrap),"%s/__axiom_runtime__/origin-bootstrap",AXIOM_ISSUER_PACKAGE_ROOT)>=(int)sizeof(bootstrap)||!axiom_origin_root_current(&resources))return 0;
 posix_spawnattr_t attr;posix_spawn_file_actions_t actions;int output[2]={-1,-1},error[2]={-1,-1};if(posix_spawnattr_init(&attr))return 0;if(posix_spawn_file_actions_init(&actions)){posix_spawnattr_destroy(&attr);return 0;}
 int failed=pipe(output)||pipe(error);if(!failed)for(int i=0;i<2;i++)if(fcntl(output[i],F_SETFD,FD_CLOEXEC)||fcntl(error[i],F_SETFD,FD_CLOEXEC))failed=1;
 failed=failed||posix_spawnattr_setflags(&attr,POSIX_SPAWN_CLOEXEC_DEFAULT)||posix_spawn_file_actions_addopen(&actions,0,"/dev/null",O_RDONLY,0)||posix_spawn_file_actions_adddup2(&actions,output[1],1)||posix_spawn_file_actions_adddup2(&actions,error[1],2);
 char*argv[]={bootstrap,NULL};char*environment[]={"PATH=/usr/bin:/bin:/usr/sbin:/sbin","LANG=C","LC_ALL=C","TZ=UTC",NULL};pid_t child=-1;
 if(!failed)failed=posix_spawn(&child,bootstrap,&actions,&attr,argv,environment);
 if(output[1]>=0)close(output[1]);if(error[1]>=0)close(error[1]);posix_spawn_file_actions_destroy(&actions);posix_spawnattr_destroy(&attr);
 if(failed||!axiom_origin_slot_spawn(&slot,child,now_ns())){if(child>0){kill(child,SIGKILL);reap_owned(child,20);}if(output[0]>=0)close(output[0]);if(error[0]>=0)close(error[0]);return 0;}
 drain(output[0]);drain(error[0]);
 dispatch_source_t exited=dispatch_source_create(DISPATCH_SOURCE_TYPE_PROC,(uintptr_t)child,DISPATCH_PROC_EXIT,queue);if(!exited){stop_owned();axiom_origin_slot_revoke(&slot);reap_owned(child,20);return 0;}
 dispatch_source_set_event_handler(exited,^{axiom_origin_slot_revoke(&slot);reap_owned(child,20);dispatch_source_cancel(exited);});dispatch_source_set_cancel_handler(exited,^{dispatch_release(exited);});dispatch_resume(exited);
 dispatch_after(dispatch_time(DISPATCH_TIME_NOW,(int64_t)AXIOM_ORIGIN_STARTUP_NS),queue,^{if(slot.phase!=AXIOM_ORIGIN_CONSUMED){stop_owned();axiom_origin_slot_revoke(&slot);reap_owned(child,20);}});
 return 1;
}
static void handle(xpc_connection_t peer,xpc_object_t message){
 if(xpc_get_type(message)!=XPC_TYPE_DICTIONARY){if(slot.peer==(uintptr_t)peer)axiom_origin_slot_revoke(&slot);return;}
 const char*operation=xpc_dictionary_get_string(message,"op");if(!operation||strlen(operation)>24){reply(message,"refused",0,NULL,NULL);return;}
 if(!strcmp(operation,"start")){
  if(xpc_dictionary_get_count(message)!=1||!message_matches(message,AXIOM_ISSUER_CONTROLLER_REQUIREMENT)||!fixed_start()){reply(message,"refused",0,NULL,NULL);return;}reply(message,"spawned_origin_only",slot.child,NULL,NULL);return;
 }
 if(!strcmp(operation,"observe")){
  if(xpc_dictionary_get_count(message)!=1||!message_matches(message,AXIOM_ISSUER_CONTROLLER_REQUIREMENT)){reply(message,"refused",0,NULL,NULL);return;}
  reply(message,slot.phase==AXIOM_ORIGIN_CONSUMED&&child_alive()&&axiom_origin_root_current(&resources)?"origin_observed_no_issuer_identity":"origin_pending_or_refused",0,NULL,NULL);return;
 }
 int authenticated=message_matches(message,AXIOM_ISSUER_NODE_REQUIREMENT);size_t client_size=0,broker_size=0;const unsigned char*client=xpc_dictionary_get_data(message,"client",&client_size);const unsigned char*broker=xpc_dictionary_get_data(message,"broker",&broker_size);
 if(!authenticated||!client||client_size!=32){reply(message,"refused",0,NULL,NULL);return;}
 int live=child_alive()&&axiom_origin_root_current(&resources);
 if(!strcmp(operation,"begin")&&xpc_dictionary_get_count(message)==2){unsigned char fresh[32];arc4random_buf(fresh,32);if(axiom_origin_slot_begin(&slot,authenticated,live,now_ns(),(uintptr_t)peer,client,fresh))reply(message,"challenge",slot.child,client,fresh);else reply(message,"refused",0,NULL,NULL);return;}
 if(!broker||broker_size!=32||xpc_dictionary_get_count(message)!=3){reply(message,"refused",0,NULL,NULL);return;}
 if(!strcmp(operation,"ack")&&axiom_origin_slot_ack(&slot,authenticated,live,now_ns(),(uintptr_t)peer,client,broker)){reply(message,"origin_startup_consumed",slot.child,client,broker);return;}
 if(!strcmp(operation,"live")&&axiom_origin_slot_live(&slot,authenticated,live,now_ns(),(uintptr_t)peer,client,broker)){reply(message,"origin_current",slot.child,client,broker);return;}
 reply(message,"refused",0,NULL,NULL);
}
int main(int argc,char**argv){
 (void)argv;if(argc!=1)return 69;
 if(!AXIOM_ISSUER_ORIGIN_SERVICE[0]||!AXIOM_ISSUER_NODE_REQUIREMENT[0]||!AXIOM_ISSUER_CONTROLLER_REQUIREMENT[0]||!AXIOM_ISSUER_CONTROL_APP[0]||!SecCodeCreateWithXPCMessage)return 70;
 char current[PATH_MAX],actual[PATH_MAX],expected[PATH_MAX];uint32_t length=sizeof(current);struct stat own;
 if(_NSGetExecutablePath(current,&length)||!realpath(current,actual)||snprintf(expected,sizeof(expected),"%s/Contents/MacOS/AxiomIssuerBroker",AXIOM_ISSUER_CONTROL_APP)>=(int)sizeof(expected)||strcmp(actual,expected)||stat(expected,&own)||!axiom_origin_loaded_file_matches((uintptr_t)&main,&own))return 71;
 queue=dispatch_queue_create("axiom.issuer.origin.serial",DISPATCH_QUEUE_SERIAL);if(!queue)return 72;
 if(snprintf(peer_requirement,sizeof(peer_requirement),"(%s) or (%s)",AXIOM_ISSUER_NODE_REQUIREMENT,AXIOM_ISSUER_CONTROLLER_REQUIREMENT)>=(int)sizeof(peer_requirement))return 73;
 xpc_connection_t listener=xpc_connection_create_mach_service(AXIOM_ISSUER_ORIGIN_SERVICE,queue,XPC_CONNECTION_MACH_SERVICE_LISTENER);if(!listener||xpc_connection_set_peer_code_signing_requirement(listener,peer_requirement))return 74;
 xpc_connection_set_event_handler(listener,^(xpc_object_t peer){
  if(xpc_get_type(peer)!=XPC_TYPE_CONNECTION)return;
  if(accepted_peers>=64){xpc_connection_set_event_handler(peer,^(xpc_object_t event){(void)event;});xpc_connection_activate(peer);xpc_connection_cancel(peer);return;}
  accepted_peers++;xpc_connection_set_target_queue(peer,queue);
  if(xpc_connection_set_peer_code_signing_requirement(peer,peer_requirement)){accepted_peers--;xpc_connection_set_event_handler(peer,^(xpc_object_t event){(void)event;});xpc_connection_activate(peer);xpc_connection_cancel(peer);return;}
  __block int ended=0;xpc_connection_set_event_handler(peer,^(xpc_object_t event){if(ended)return;if(xpc_get_type(event)!=XPC_TYPE_DICTIONARY){ended=1;if(accepted_peers)accepted_peers--;handle(peer,event);xpc_connection_cancel(peer);return;}handle(peer,event);});xpc_connection_activate(peer);
 });xpc_connection_activate(listener);
 signal(SIGTERM,SIG_IGN);signal(SIGINT,SIG_IGN);dispatch_source_t term=dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL,SIGTERM,0,queue),interrupt=dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL,SIGINT,0,queue);if(!term||!interrupt)return 75;
 void(^shutdown)(void)=^{stop_owned();axiom_origin_slot_revoke(&slot);if(slot.child>0)reap_owned(slot.child,20);dispatch_after(dispatch_time(DISPATCH_TIME_NOW,300000000LL),queue,^{_exit(0);});};
 dispatch_source_set_event_handler(term,shutdown);dispatch_source_set_event_handler(interrupt,shutdown);dispatch_resume(term);dispatch_resume(interrupt);dispatch_main();
}
