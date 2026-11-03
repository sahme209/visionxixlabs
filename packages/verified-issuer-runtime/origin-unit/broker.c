#define _DARWIN_C_SOURCE 1
#include "config.h"
#include "protocol.h"
#include "peer.h"
#include <dispatch/dispatch.h>
#include <spawn.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <signal.h>
#include <stdio.h>
static OriginSlot slot;
static int spawned_once;
static int component_observed;
static int child_exit_observed;
static int child_exit_ok;
static dispatch_queue_t queue;
static unsigned accepted_peers;
static uint64_t now_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static int alive(void){if(slot.child<=0)return 0;siginfo_t info;memset(&info,0,sizeof(info));if(waitid(P_PID,(id_t)slot.child,&info,WEXITED|WNOHANG|WNOWAIT))return 0;return info.si_pid==0;}
static void reply(xpc_object_t message,const char*status,pid_t pid,const unsigned char*a,const unsigned char*b){
 xpc_object_t r=xpc_dictionary_create_reply(message);if(!r)return;xpc_dictionary_set_string(r,"status",status);xpc_dictionary_set_int64(r,"child",pid);if(a)xpc_dictionary_set_data(r,"client",a,32);if(b)xpc_dictionary_set_data(r,"broker",b,32);
 xpc_connection_t remote=xpc_dictionary_get_remote_connection(message);if(remote)xpc_connection_send_message(remote,r);xpc_release(r);
}
static void reap_failed_child(pid_t child,unsigned remaining){int status;pid_t r=waitpid(child,&status,WNOHANG);if(r==child){child_exit_observed=1;child_exit_ok=WIFEXITED(status)&&WEXITSTATUS(status)==0;return;}if(r<0)return;if(!remaining){fputs("origin_unit_owned_child_cleanup_unknown\n",stderr);return;}dispatch_after(dispatch_time(DISPATCH_TIME_NOW,10000000LL),queue,^{reap_failed_child(child,remaining-1);});}
static void stop_owned_child(void){if(slot.child>0&&alive())kill(slot.child,SIGKILL);}
static void drain_pipe(int fd){
 dispatch_source_t source=dispatch_source_create(DISPATCH_SOURCE_TYPE_READ,(uintptr_t)fd,0,queue);if(!source){close(fd);stop_owned_child();origin_revoke(&slot);return;}
 __block size_t total=0;dispatch_source_set_event_handler(source,^{char bytes[1024];ssize_t n=read(fd,bytes,sizeof(bytes));if(n<=0){dispatch_source_cancel(source);return;}total+=(size_t)n;if(total>8192){stop_owned_child();origin_revoke(&slot);dispatch_source_cancel(source);}});
 dispatch_source_set_cancel_handler(source,^{close(fd);dispatch_release(source);});dispatch_resume(source);
}
static int spawn_fixed(void){
 if(spawned_once)return 0;spawned_once=1;
 struct stat root;if(lstat(UNIT_ROOT,&root)||!S_ISDIR(root.st_mode)||root.st_uid!=getuid()||(root.st_mode&0777)!=0700)return 0;
 int claim=open(UNIT_ROOT "/unit-spawn-claim.json",O_CREAT|O_EXCL|O_NOFOLLOW|O_WRONLY|O_CLOEXEC,0600);if(claim<0)return 0;
 const char text[]="{\"status\":\"diagnostic_spawn_claimed_unknown_no_retry\"}\n";int claimed=write(claim,text,sizeof(text)-1)==(ssize_t)sizeof(text)-1&&fsync(claim)==0;if(close(claim)||!claimed)return 0;
 posix_spawnattr_t attr;posix_spawn_file_actions_t actions;int outputs[2]={-1,-1},errors[2]={-1,-1};
 if(posix_spawnattr_init(&attr))return 0;if(posix_spawn_file_actions_init(&actions)){posix_spawnattr_destroy(&attr);return 0;}
 int error=pipe(outputs)||pipe(errors);if(!error){for(int i=0;i<2;i++){if(fcntl(outputs[i],F_SETFD,FD_CLOEXEC)||fcntl(errors[i],F_SETFD,FD_CLOEXEC))error=1;}}
 error=error||posix_spawnattr_setflags(&attr,POSIX_SPAWN_CLOEXEC_DEFAULT)||posix_spawn_file_actions_addopen(&actions,0,"/dev/null",O_RDONLY,0)||posix_spawn_file_actions_adddup2(&actions,outputs[1],1)||posix_spawn_file_actions_adddup2(&actions,errors[1],2);
 char *args[]={UNIT_NODE,UNIT_MAIN,NULL};char *env[]={"PATH=/usr/bin:/bin","LANG=C","LC_ALL=C",NULL};pid_t child=-1;
 if(!error)error=posix_spawn(&child,UNIT_NODE,&actions,&attr,args,env);
 if(outputs[1]>=0)close(outputs[1]);if(errors[1]>=0)close(errors[1]);posix_spawn_file_actions_destroy(&actions);posix_spawnattr_destroy(&attr);
 if(error||!origin_spawn(&slot,child,now_ns())){if(child>0){kill(child,SIGKILL);reap_failed_child(child,20);}if(outputs[0]>=0)close(outputs[0]);if(errors[0]>=0)close(errors[0]);return 0;}
 drain_pipe(outputs[0]);drain_pipe(errors[0]);
 dispatch_source_t exit_source=dispatch_source_create(DISPATCH_SOURCE_TYPE_PROC,(uintptr_t)child,DISPATCH_PROC_EXIT,queue);if(!exit_source){origin_revoke(&slot);stop_owned_child();reap_failed_child(child,20);return 0;}
 dispatch_source_set_event_handler(exit_source,^{origin_revoke(&slot);int status;pid_t reaped=waitpid(child,&status,WNOHANG);if(reaped==child){child_exit_observed=1;child_exit_ok=WIFEXITED(status)&&WEXITSTATUS(status)==0;}dispatch_source_cancel(exit_source);});dispatch_source_set_cancel_handler(exit_source,^{dispatch_release(exit_source);});dispatch_resume(exit_source);
 dispatch_after(dispatch_time(DISPATCH_TIME_NOW,30000000000LL),queue,^{stop_owned_child();origin_revoke(&slot);reap_failed_child(child,20);});
 return 1;
}
static void handle(xpc_connection_t peer,xpc_object_t m){
 if(xpc_get_type(m)!=XPC_TYPE_DICTIONARY){if(slot.peer==(uintptr_t)peer)origin_revoke(&slot);return;}
 const char*op=xpc_dictionary_get_string(m,"op");if(!op){reply(m,"refused",0,NULL,NULL);return;}
 if(!strcmp(op,"start")){
  if(xpc_dictionary_get_count(m)!=1){reply(m,"refused",0,NULL,NULL);return;}
  if(!origin_message_matches(m,CONTROLLER_REQUIREMENT)||!spawn_fixed()){reply(m,"refused",0,NULL,NULL);return;}reply(m,"spawned_component_only",slot.child,NULL,NULL);return;
 }
 if(!strcmp(op,"observe_component")){if(xpc_dictionary_get_count(m)!=1){reply(m,"refused",0,NULL,NULL);return;}if(!origin_message_matches(m,CONTROLLER_REQUIREMENT)){reply(m,"refused",0,NULL,NULL);return;}reply(m,component_observed&&child_exit_observed&&child_exit_ok?"component_observed_no_identity":child_exit_observed?"component_failed_no_identity":"pending_component_only",0,NULL,NULL);return;}
 int authenticated=origin_message_matches(m,NODE_REQUIREMENT);size_t na=0,nb=0;const unsigned char*a=xpc_dictionary_get_data(m,"client",&na);const unsigned char*b=xpc_dictionary_get_data(m,"broker",&nb);
 if(!authenticated||!a||na!=32){reply(m,"refused",0,NULL,NULL);return;}
 if(!strcmp(op,"begin")){
  if(xpc_dictionary_get_count(m)!=2){reply(m,"refused",0,NULL,NULL);return;}
  unsigned char challenge[32];arc4random_buf(challenge,32);
  if(origin_begin(&slot,authenticated,alive(),now_ns(),(uintptr_t)peer,a,challenge))reply(m,"challenge",slot.child,a,challenge);else reply(m,"refused",0,NULL,NULL);return;
 }
 if(!strcmp(op,"ack")&&xpc_dictionary_get_count(m)==3&&b&&nb==32&&origin_ack(&slot,authenticated,alive(),now_ns(),(uintptr_t)peer,a,b)){component_observed=1;reply(m,"component_only_no_identity",slot.child,a,b);return;}
 reply(m,"refused",0,NULL,NULL);
}
int main(void){
 queue=dispatch_queue_create("axiom.origin.unit.serial",DISPATCH_QUEUE_SERIAL);
 xpc_connection_t listener=xpc_connection_create_mach_service(UNIT_SERVICE,queue,XPC_CONNECTION_MACH_SERVICE_LISTENER);if(!listener)return 70;
 if(xpc_connection_set_peer_code_signing_requirement(listener,PEER_REQUIREMENT))return 71;
 xpc_connection_set_event_handler(listener,^(xpc_object_t peer){if(xpc_get_type(peer)!=XPC_TYPE_CONNECTION)return;if(accepted_peers++>=8){xpc_connection_set_event_handler(peer,^(xpc_object_t event){(void)event;});xpc_connection_activate(peer);xpc_connection_cancel(peer);return;}
  xpc_connection_set_target_queue(peer,queue);
  if(xpc_connection_set_peer_code_signing_requirement(peer,PEER_REQUIREMENT)){xpc_connection_cancel(peer);xpc_release(peer);return;}
  __block int ended=0;__block unsigned messages=0;xpc_connection_set_event_handler(peer,^(xpc_object_t event){if(ended)return;if(++messages>32){ended=1;if(slot.peer==(uintptr_t)peer)origin_revoke(&slot);xpc_connection_cancel(peer);return;}if(xpc_get_type(event)!=XPC_TYPE_DICTIONARY){ended=1;handle(peer,event);xpc_connection_cancel(peer);return;}handle(peer,event);});xpc_connection_activate(peer);
 });xpc_connection_activate(listener);
 signal(SIGTERM,SIG_IGN);signal(SIGINT,SIG_IGN);
 dispatch_source_t term=dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL,SIGTERM,0,queue);dispatch_source_t interrupt=dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL,SIGINT,0,queue);if(!term||!interrupt)return 72;
 void (^shutdown)(void)=^{stop_owned_child();origin_revoke(&slot);if(slot.child>0)reap_failed_child(slot.child,20);dispatch_after(dispatch_time(DISPATCH_TIME_NOW,300000000LL),queue,^{_exit(0);});};
 dispatch_source_set_event_handler(term,shutdown);dispatch_source_set_event_handler(interrupt,shutdown);dispatch_resume(term);dispatch_resume(interrupt);dispatch_main();
}
