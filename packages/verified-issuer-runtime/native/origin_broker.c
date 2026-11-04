/* Compile-only fixed origin broker. No issuer/action authority is granted.
 * Slow signature/filesystem/claim/spawn work never runs on the control queue.
 * Kernel calls are not preemptible wall-clock guarantees: a late created child
 * starts SUSPENDED and can only be killed/reaped, never resumed by late work. */
#define _DARWIN_C_SOURCE 1
#include "origin_config.h"
#include "origin_runtime_protocol.h"
#include "origin_root_binding.h"
#include "origin_process_identity.h"
#include "origin_private_bootstrap.h"
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
#include <stdatomic.h>
#define MAX_JOBS 8
#define REQUEST_NS 250000000ULL
extern OSStatus SecCodeCreateWithXPCMessage(xpc_object_t,SecCSFlags,SecCodeRef*) __attribute__((weak_import));
typedef struct Peer {atomic_uint refs;atomic_int ended;int busy;xpc_connection_t connection;} Peer;
typedef enum {JOB_START,JOB_OBSERVE,JOB_BEGIN,JOB_ACK,JOB_LIVE} JobKind;
typedef struct Job {atomic_uint refs;atomic_int cancelled;Peer*peer;xpc_object_t message;dispatch_source_t timer;JobKind kind;uint64_t deadline,epoch;int replied,authenticated,live,prepared;pid_t expected_child,child;int output,error,input;AxiomOriginRootBinding binding;unsigned char client[32],broker[32];} Job;
static AxiomOriginSlot slot;
static AxiomOriginRootBinding resources;
static int started_once,shutting_down,epoch_revoked;
static pid_t owned_child;
static uint64_t epoch;
static uintptr_t startup_peer;
static dispatch_queue_t control,workers;
static unsigned accepted_peers;
static Job*jobs[MAX_JOBS];
static char peer_requirement[4096];
typedef enum {DELIVERY_EMPTY,DELIVERY_RESERVED,DELIVERY_SUPPLYING,DELIVERY_CONSUMED,DELIVERY_REVOKED} DeliveryPhase;
/* One startup ever: storage survives a logically cancelled blocking OS call. */
static struct {DeliveryPhase phase;atomic_int cancelled;int worker_active,fd;pid_t child;AxiomPrivateBinding binding;AxiomOriginRootBinding root;unsigned char frame[AXIOM_PRIVATE_FRAME_CAP];size_t length,offset;dispatch_source_t writer;} delivery={.fd=-1};
static void wipe_frame(void){volatile unsigned char*p=delivery.frame;for(size_t i=0;i<sizeof(delivery.frame);i++)p[i]=0;delivery.length=delivery.offset=0;}
static void close_delivery(void){
 atomic_store(&delivery.cancelled,1);
 if(delivery.phase!=DELIVERY_CONSUMED)delivery.phase=DELIVERY_REVOKED;
 if(delivery.writer){dispatch_source_t source=delivery.writer;delivery.writer=NULL;dispatch_source_cancel(source);}
 if(delivery.fd>=0){close(delivery.fd);delivery.fd=-1;}
 if(!delivery.worker_active)wipe_frame();
}
static uint64_t now_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static dispatch_time_t at_deadline(uint64_t deadline){uint64_t now=now_ns();return dispatch_time(DISPATCH_TIME_NOW,now<deadline?(int64_t)(deadline-now):0);}
static int message_matches(xpc_object_t message,const char*requirement){
 if(!SecCodeCreateWithXPCMessage||!message||xpc_get_type(message)!=XPC_TYPE_DICTIONARY||!requirement||!requirement[0])return 0;
 SecCodeRef code=NULL;SecRequirementRef req=NULL;CFStringRef text=CFStringCreateWithCString(NULL,requirement,kCFStringEncodingUTF8);if(!text)return 0;
 OSStatus status=SecRequirementCreateWithString(text,kSecCSDefaultFlags,&req);CFRelease(text);if(status!=errSecSuccess||!req)return 0;
 status=SecCodeCreateWithXPCMessage(message,kSecCSDefaultFlags,&code);int ok=status==errSecSuccess&&code&&SecCodeCheckValidity(code,kSecCSDefaultFlags,req)==errSecSuccess;
 if(code)CFRelease(code);CFRelease(req);return ok;
}
static int alive_pid(pid_t child){if(child<=0)return 0;siginfo_t info;memset(&info,0,sizeof(info));if(waitid(P_PID,(id_t)child,&info,WEXITED|WNOHANG|WNOWAIT))return 0;return info.si_pid==0;}
static void kill_owned(pid_t child){if(alive_pid(child))kill(child,SIGKILL);}
static void maybe_exit(void){if(!shutting_down||owned_child>0||delivery.worker_active)return;for(size_t i=0;i<MAX_JOBS;i++)if(jobs[i])return;_exit(0);}
static void reap_owned(pid_t child,unsigned remaining){int status;pid_t result=waitpid(child,&status,WNOHANG);if(result==child||(result<0&&errno==ECHILD)){if(owned_child==child)owned_child=0;maybe_exit();return;}if(result<0&&errno!=EINTR){fputs("verified_issuer_child_cleanup_unknown\n",stderr);return;}if(!remaining){fputs("verified_issuer_child_cleanup_unknown\n",stderr);return;}dispatch_after(dispatch_time(DISPATCH_TIME_NOW,10000000LL),control,^{reap_owned(child,remaining-1);});}
static void revoke_slot(void){close_delivery();if(!epoch_revoked){uint64_t old_epoch=epoch;epoch++;epoch_revoked=1;axiom_origin_slot_revoke(&slot);for(size_t i=0;i<MAX_JOBS;i++)if(jobs[i]&&jobs[i]->epoch==old_epoch)atomic_store(&jobs[i]->cancelled,1);}kill_owned(slot.child);if(slot.child>0)reap_owned(slot.child,20);}
static void reply(xpc_object_t message,const char*status,pid_t child,const unsigned char*a,const unsigned char*b){xpc_object_t value=xpc_dictionary_create_reply(message);if(!value)return;xpc_dictionary_set_string(value,"status",status);xpc_dictionary_set_int64(value,"child",child);if(a)xpc_dictionary_set_data(value,"client",a,32);if(b)xpc_dictionary_set_data(value,"broker",b,32);if(a&&b){xpc_dictionary_set_uint64(value,"epoch",epoch);xpc_dictionary_set_uint64(value,"deadline",slot.deadline);}xpc_connection_t peer=xpc_dictionary_get_remote_connection(message);if(peer)xpc_connection_send_message(peer,value);xpc_release(value);}
static int claim_startup(void){
 if(!AXIOM_ISSUER_SPAWN_CLAIM[0])return 0;char parent[PATH_MAX];if(strlen(AXIOM_ISSUER_SPAWN_CLAIM)>=sizeof(parent))return 0;strcpy(parent,AXIOM_ISSUER_SPAWN_CLAIM);char*end=strrchr(parent,'/');if(!end||end==parent||strcmp(end+1,"issuer-startup-claim.json"))return 0;*end=0;
 char canonical[PATH_MAX];struct stat dir;if(!realpath(parent,canonical)||strcmp(parent,canonical)||lstat(parent,&dir)||!S_ISDIR(dir.st_mode)||dir.st_uid!=getuid()||(dir.st_mode&0777)!=0700)return 0;
 int fd=open(AXIOM_ISSUER_SPAWN_CLAIM,O_CREAT|O_EXCL|O_NOFOLLOW|O_WRONLY|O_CLOEXEC,0600);if(fd<0)return 0;const char bytes[]="{\"status\":\"startup_consumed_unknown_no_retry\"}\n";int ok=write(fd,bytes,sizeof(bytes)-1)==(ssize_t)sizeof(bytes)-1&&fsync(fd)==0;int closed=close(fd);return ok&&!closed;
}
static void drain(int fd){
 dispatch_source_t source=dispatch_source_create(DISPATCH_SOURCE_TYPE_READ,(uintptr_t)fd,0,control);if(!source){close(fd);revoke_slot();return;}
 __block uint64_t window=now_ns();__block size_t bytes=0;
 dispatch_source_set_event_handler(source,^{char buffer[4096];ssize_t count=read(fd,buffer,sizeof(buffer));if(count==0){dispatch_source_cancel(source);return;}if(count<0){if(errno!=EAGAIN&&errno!=EINTR)dispatch_source_cancel(source);return;}uint64_t now=now_ns();if(now<window||now==UINT64_MAX){revoke_slot();dispatch_source_cancel(source);return;}if(now-window>=1000000000ULL){window=now;bytes=0;}bytes+=(size_t)count;if(bytes>1024U*1024U){revoke_slot();dispatch_source_cancel(source);}});
 dispatch_source_set_cancel_handler(source,^{close(fd);dispatch_release(source);});dispatch_resume(source);
}
static void retain_peer(Peer*p){atomic_fetch_add(&p->refs,1);}
static void release_peer(void*value){Peer*p=value;if(atomic_fetch_sub(&p->refs,1)==1)free(p);}
static void retain_job(Job*j){atomic_fetch_add(&j->refs,1);}
static void release_job(Job*j){if(atomic_fetch_sub(&j->refs,1)==1){xpc_release(j->message);xpc_release(j->peer->connection);release_peer(j->peer);free(j);}}
static int work_current(Job*j){return !atomic_load(&j->cancelled)&&!atomic_load(&j->peer->ended)&&now_ns()<j->deadline;}
static void cancel_timer(Job*j){if(j->timer){dispatch_source_t timer=j->timer;j->timer=NULL;dispatch_source_cancel(timer);}}
static void job_reply(Job*j,const char*status,pid_t child,const unsigned char*a,const unsigned char*b){if(j->replied)return;j->replied=1;reply(j->message,status,child,a,b);}
static void discard_spawn(Job*j){if(j->input>=0){close(j->input);j->input=-1;}if(j->output>=0){close(j->output);j->output=-1;}if(j->error>=0){close(j->error);j->error=-1;}if(j->child>0){kill_owned(j->child);reap_owned(j->child,20);j->child=0;}}
/* Worker owns every blocking prerequisite and the returned suspended child until
 * the control queue adopts it. No worker ever sends SIGCONT. */
static void prepare_start(Job*j){
 if(!work_current(j)||!claim_startup()||!work_current(j)||!axiom_origin_bind_root(&j->binding)||!work_current(j)||!axiom_origin_root_current(&j->binding)||!work_current(j))return;
 char bootstrap[PATH_MAX];if(snprintf(bootstrap,sizeof(bootstrap),"%s/__axiom_runtime__/origin-bootstrap",AXIOM_ISSUER_PACKAGE_ROOT)>=(int)sizeof(bootstrap))return;
 posix_spawnattr_t attr;posix_spawn_file_actions_t actions;int output[2]={-1,-1},error[2]={-1,-1},input[2]={-1,-1};if(posix_spawnattr_init(&attr))return;if(posix_spawn_file_actions_init(&actions)){posix_spawnattr_destroy(&attr);return;}
 int failed=0;for(int fd=0;fd<3;fd++)if(fcntl(fd,F_GETFD)<0)failed=1;failed=failed||pipe(output)||pipe(error)||pipe(input);if(!failed)for(int i=0;i<2;i++)if(fcntl(output[i],F_SETFD,FD_CLOEXEC)||fcntl(error[i],F_SETFD,FD_CLOEXEC)||fcntl(input[i],F_SETFD,FD_CLOEXEC))failed=1;
 if(!failed&&(fcntl(output[0],F_SETFL,O_NONBLOCK)||fcntl(error[0],F_SETFL,O_NONBLOCK)||fcntl(input[1],F_SETFL,O_NONBLOCK)))failed=1;
 failed=failed||posix_spawnattr_setflags(&attr,POSIX_SPAWN_CLOEXEC_DEFAULT|POSIX_SPAWN_START_SUSPENDED)||posix_spawn_file_actions_adddup2(&actions,input[0],0)||posix_spawn_file_actions_addclose(&actions,input[0])||posix_spawn_file_actions_addclose(&actions,input[1])||posix_spawn_file_actions_adddup2(&actions,output[1],1)||posix_spawn_file_actions_adddup2(&actions,error[1],2);
 char*argv[]={bootstrap,NULL};char*environment[]={"PATH=/usr/bin:/bin:/usr/sbin:/sbin","LANG=C","LC_ALL=C","TZ=UTC",NULL};pid_t child=-1;
 if(!failed&&work_current(j))failed=posix_spawn(&child,bootstrap,&actions,&attr,argv,environment);else failed=1;
 if(input[0]>=0)close(input[0]);if(output[1]>=0)close(output[1]);if(error[1]>=0)close(error[1]);posix_spawn_file_actions_destroy(&actions);posix_spawnattr_destroy(&attr);
 j->child=!failed&&child>0?child:0;j->output=output[0];j->error=error[0];j->input=input[1];
 /* posix_spawn/kernel inspection may return arbitrarily late. The child remains
  * stopped; failed/expired results go to control cleanup, never bootstrap exec. */
 if(failed||!work_current(j)||!alive_pid(child)||!axiom_origin_root_current(&j->binding)||!work_current(j))return;
 j->prepared=1;
}
static int delivery_current(void){return !atomic_load(&delivery.cancelled)&&!shutting_down&&!epoch_revoked&&delivery.binding.epoch==epoch&&delivery.child==owned_child&&delivery.child==slot.child&&delivery.fd>=0&&slot.phase==AXIOM_ORIGIN_CONSUMED&&now_ns()<delivery.binding.deadline&&!memcmp(delivery.binding.client,slot.client,32)&&!memcmp(delivery.binding.broker,slot.broker,32)&&alive_pid(owned_child);}
static void drain_delivery(void){
 if(!delivery_current()){revoke_slot();return;}
 /* Reserved history becomes consumed before any write that may expose bytes.
  * Every partial/uncertain outcome remains consumed, never retransmitted. */
 if(delivery.phase==DELIVERY_SUPPLYING)delivery.phase=DELIVERY_CONSUMED;
 while(delivery.offset<delivery.length){
  if(!delivery_current()){revoke_slot();return;}
  ssize_t n=write(delivery.fd,delivery.frame+delivery.offset,delivery.length-delivery.offset);
  if(n>0){delivery.offset+=(size_t)n;continue;}
  if(n<0&&errno==EINTR)continue;
  if(n<0&&(errno==EAGAIN||errno==EWOULDBLOCK))return;
  revoke_slot();return;
 }
 if(delivery.writer){dispatch_source_t source=delivery.writer;delivery.writer=NULL;dispatch_source_cancel(source);}
 close(delivery.fd);delivery.fd=-1;wipe_frame();
}
static void start_delivery(void){
 if(delivery.phase!=DELIVERY_RESERVED||delivery.binding.epoch!=epoch||delivery.child!=owned_child||now_ns()>=delivery.binding.deadline){revoke_slot();return;}
 memcpy(delivery.binding.client,slot.client,32);memcpy(delivery.binding.broker,slot.broker,32);
 if(!delivery_current()){revoke_slot();return;}
 delivery.phase=DELIVERY_SUPPLYING;delivery.worker_active=1;
 dispatch_async(workers,^{
  AxiomPrivateMaterial material;memset(&material,0,sizeof(material));int ok=0;
  /* Control exclusively owns descriptor and child. Worker never resumes, writes
   * or kills; cancellation cannot free its bounded storage before API return. */
  if(!atomic_load(&delivery.cancelled)&&now_ns()<delivery.binding.deadline&&axiom_origin_root_current(&delivery.root)&&!atomic_load(&delivery.cancelled)&&axiom_private_supplier_read(&material,&delivery.cancelled,delivery.binding.deadline)&&!atomic_load(&delivery.cancelled)&&now_ns()<delivery.binding.deadline&&axiom_origin_root_current(&delivery.root))ok=axiom_private_frame_encode(delivery.frame,&delivery.length,&delivery.binding,&material);
  axiom_private_material_wipe(&material);
  dispatch_async(control,^{
   delivery.worker_active=0;
   if(!ok||!delivery_current()){wipe_frame();revoke_slot();maybe_exit();return;}
   delivery.writer=dispatch_source_create(DISPATCH_SOURCE_TYPE_WRITE,(uintptr_t)delivery.fd,0,control);
   if(!delivery.writer){wipe_frame();revoke_slot();maybe_exit();return;}
   dispatch_source_t source=delivery.writer;dispatch_source_set_event_handler(source,^{drain_delivery();});dispatch_source_set_cancel_handler(source,^{dispatch_release(source);});dispatch_resume(source);
  });
 });
}
static void finish_job(Job*j){
 int current=work_current(j)&&j->epoch==epoch;
 if(j->kind==JOB_START){
  startup_peer=0;int watched=0;
  if(j->child>0){
   /* Returned POSIX child remains unreaped and stopped, including late results.
    * Track cleanup before adoption, so graceful shutdown cannot abandon it. */
   pid_t child=j->child;owned_child=child;
   dispatch_source_t exited=dispatch_source_create(DISPATCH_SOURCE_TYPE_PROC,(uintptr_t)child,DISPATCH_PROC_EXIT,control);
   if(exited){dispatch_source_set_event_handler(exited,^{revoke_slot();reap_owned(child,20);dispatch_source_cancel(exited);});dispatch_source_set_cancel_handler(exited,^{dispatch_release(exited);});dispatch_resume(exited);watched=1;}
  }
  if(current&&j->authenticated&&j->prepared&&watched&&axiom_origin_slot_spawn(&slot,j->child,now_ns())){
   resources=j->binding;pid_t child=j->child;j->child=0;delivery.fd=j->input;j->input=-1;delivery.child=child;delivery.root=j->binding;
   drain(j->output);j->output=-1;drain(j->error);j->error=-1;
   if(axiom_origin_slot_may_resume(&slot,child,now_ns())&&alive_pid(child)&&axiom_origin_slot_may_resume(&slot,child,now_ns())&&!kill(child,SIGCONT))job_reply(j,"spawned_origin_only",child,NULL,NULL);else{revoke_slot();job_reply(j,"refused",0,NULL,NULL);}
  }else{if(j->epoch==epoch)revoke_slot();job_reply(j,"refused",0,NULL,NULL);}
  discard_spawn(j);
 }else if(current&&j->authenticated){
  int live=j->live&&slot.child==j->expected_child&&alive_pid(slot.child);
  if(j->kind==JOB_OBSERVE)job_reply(j,slot.phase==AXIOM_ORIGIN_CONSUMED&&live?"origin_observed_no_issuer_identity":"origin_pending_or_refused",0,NULL,NULL);
  else if(j->kind==JOB_BEGIN){unsigned char fresh[32];arc4random_buf(fresh,32);if(axiom_origin_slot_begin(&slot,1,live,now_ns(),(uintptr_t)j->peer->connection,j->client,fresh))job_reply(j,"challenge",slot.child,j->client,fresh);else job_reply(j,"refused",0,NULL,NULL);}
  else if(j->kind==JOB_ACK&&axiom_origin_slot_ack(&slot,1,live,now_ns(),(uintptr_t)j->peer->connection,j->client,j->broker)){job_reply(j,"origin_startup_consumed",slot.child,j->client,j->broker);start_delivery();}
  else if(j->kind==JOB_LIVE&&axiom_origin_slot_live(&slot,1,live,now_ns(),(uintptr_t)j->peer->connection,j->client,j->broker))job_reply(j,"origin_current",slot.child,j->client,j->broker);
  else job_reply(j,"refused",0,NULL,NULL);
 }else{if(j->epoch==epoch&&(slot.peer==(uintptr_t)j->peer->connection||(j->authenticated&&j->kind==JOB_BEGIN)))revoke_slot();job_reply(j,"refused",0,NULL,NULL);}
 if(slot.phase==AXIOM_ORIGIN_REVOKED&&!epoch_revoked)revoke_slot();
 for(size_t i=0;i<MAX_JOBS;i++)if(jobs[i]==j){jobs[i]=NULL;break;}j->peer->busy=0;cancel_timer(j);release_job(j); /* control ownership */
 maybe_exit();
}
static void run_job(Job*j){
 if(work_current(j))j->authenticated=message_matches(j->message,(j->kind==JOB_START||j->kind==JOB_OBSERVE)?AXIOM_ISSUER_CONTROLLER_REQUIREMENT:AXIOM_ISSUER_NODE_REQUIREMENT);
 if(j->authenticated&&work_current(j)){
  if(j->kind==JOB_START)prepare_start(j);
  else if(j->expected_child>0&&j->binding.bound)j->live=alive_pid(j->expected_child)&&axiom_origin_root_current(&j->binding)&&work_current(j);
 }
 retain_job(j);dispatch_async(control,^{finish_job(j);release_job(j);});release_job(j); /* worker ownership */
}
static void handle(Peer*p,xpc_object_t message){
 if(shutting_down){reply(message,"refused",0,NULL,NULL);return;}
 if(xpc_get_type(message)!=XPC_TYPE_DICTIONARY)return;
 const char*op=xpc_dictionary_get_string(message,"op");if(!op||strnlen(op,25)>24){reply(message,"refused",0,NULL,NULL);return;}
 JobKind kind;if(!strcmp(op,"start"))kind=JOB_START;else if(!strcmp(op,"observe"))kind=JOB_OBSERVE;else if(!strcmp(op,"begin"))kind=JOB_BEGIN;else if(!strcmp(op,"ack"))kind=JOB_ACK;else if(!strcmp(op,"live"))kind=JOB_LIVE;else{reply(message,"refused",0,NULL,NULL);return;}
 size_t ca=0,cb=0;const void*a=NULL,*b=NULL;size_t keys=xpc_dictionary_get_count(message);
 if(kind==JOB_START||kind==JOB_OBSERVE){if(keys!=1){reply(message,"refused",0,NULL,NULL);return;}}
 else{a=xpc_dictionary_get_data(message,"client",&ca);if(!a||ca!=32||keys!=(kind==JOB_BEGIN?2U:3U)){reply(message,"refused",0,NULL,NULL);return;}if(kind!=JOB_BEGIN){b=xpc_dictionary_get_data(message,"broker",&cb);if(!b||cb!=32){reply(message,"refused",0,NULL,NULL);return;}}}
 size_t available=MAX_JOBS;for(size_t i=0;i<MAX_JOBS;i++)if(!jobs[i]){available=i;break;}
 if(p->busy||available==MAX_JOBS||atomic_load(&p->ended)){reply(message,"refused",0,NULL,NULL);return;}
 uint64_t now=now_ns(),deadline;if(now==UINT64_MAX||now>UINT64_MAX-REQUEST_NS){reply(message,"refused",0,NULL,NULL);return;}
 if(kind==JOB_START){
  if(started_once){reply(message,"refused",0,NULL,NULL);return;}started_once=1;
  if(!axiom_origin_slot_reserve(&slot,now)){revoke_slot();reply(message,"refused",0,NULL,NULL);return;}epoch++;epoch_revoked=0;deadline=slot.deadline;delivery.phase=DELIVERY_RESERVED;atomic_store(&delivery.cancelled,0);delivery.binding.epoch=epoch;delivery.binding.deadline=deadline;startup_peer=(uintptr_t)p;
  uint64_t startup_epoch=epoch;
  dispatch_after(at_deadline(deadline),control,^{if(epoch==startup_epoch&&(slot.phase!=AXIOM_ORIGIN_CONSUMED||delivery.phase!=DELIVERY_CONSUMED||delivery.fd>=0))revoke_slot();});
 }else deadline=now+REQUEST_NS;
 Job*j=calloc(1,sizeof(*j));if(!j){if(kind==JOB_START)revoke_slot();reply(message,"refused",0,NULL,NULL);return;}
 atomic_init(&j->refs,1);atomic_init(&j->cancelled,0);j->peer=p;retain_peer(p);xpc_retain(p->connection);j->message=xpc_retain(message);j->kind=kind;j->deadline=deadline;j->epoch=epoch;j->expected_child=slot.child;j->binding=resources;j->output=-1;j->error=-1;j->input=-1;if(a)memcpy(j->client,a,32);if(b)memcpy(j->broker,b,32);
 jobs[available]=j;p->busy=1;
 dispatch_source_t timer=dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER,0,0,control);if(!timer){jobs[available]=NULL;p->busy=0;if(kind==JOB_START)revoke_slot();reply(message,"refused",0,NULL,NULL);release_job(j);return;}
 j->timer=timer;retain_job(j);dispatch_source_set_timer(timer,at_deadline(deadline),DISPATCH_TIME_FOREVER,0);
 dispatch_source_set_event_handler(timer,^{atomic_store(&j->cancelled,1);if(j->epoch==epoch&&(j->kind==JOB_START||slot.peer==(uintptr_t)p->connection))revoke_slot();job_reply(j,"refused",0,NULL,NULL);cancel_timer(j);});
 dispatch_source_set_cancel_handler(timer,^{dispatch_release(timer);release_job(j);});dispatch_resume(timer);
 retain_job(j);dispatch_async(workers,^{run_job(j);});
}
static void end_peer(Peer*p){
 if(atomic_exchange(&p->ended,1))return;if(accepted_peers)accepted_peers--;
 for(size_t i=0;i<MAX_JOBS;i++)if(jobs[i]&&jobs[i]->peer==p)atomic_store(&jobs[i]->cancelled,1);
 if(slot.peer==(uintptr_t)p->connection||startup_peer==(uintptr_t)p)revoke_slot();
 xpc_connection_cancel(p->connection);xpc_release(p->connection); /* active peer ownership */
}
int main(int argc,char**argv){
 (void)argv;if(argc!=1)return 69;
 if(!AXIOM_ISSUER_ORIGIN_SERVICE[0]||!AXIOM_ISSUER_NODE_REQUIREMENT[0]||!AXIOM_ISSUER_CONTROLLER_REQUIREMENT[0]||!AXIOM_ISSUER_CONTROL_APP[0]||!SecCodeCreateWithXPCMessage)return 70;
 char current[PATH_MAX],actual[PATH_MAX],expected[PATH_MAX];uint32_t length=sizeof(current);struct stat own;
 if(_NSGetExecutablePath(current,&length)||!realpath(current,actual)||snprintf(expected,sizeof(expected),"%s/Contents/MacOS/AxiomIssuerBroker",AXIOM_ISSUER_CONTROL_APP)>=(int)sizeof(expected)||strcmp(actual,expected)||stat(expected,&own)||!axiom_origin_loaded_file_matches((uintptr_t)&main,&own))return 71;
 /* Dedicated custodian only; no constructor/import invokes these APIs. */
 if(!axiom_private_supplier_startup())return 76;
 signal(SIGPIPE,SIG_IGN);
 control=dispatch_queue_create("axiom.issuer.origin.control",DISPATCH_QUEUE_SERIAL);workers=dispatch_queue_create("axiom.issuer.origin.inspection",DISPATCH_QUEUE_CONCURRENT);if(!control||!workers)return 72;
 if(snprintf(peer_requirement,sizeof(peer_requirement),"(%s) or (%s)",AXIOM_ISSUER_NODE_REQUIREMENT,AXIOM_ISSUER_CONTROLLER_REQUIREMENT)>=(int)sizeof(peer_requirement))return 73;
 xpc_connection_t listener=xpc_connection_create_mach_service(AXIOM_ISSUER_ORIGIN_SERVICE,control,XPC_CONNECTION_MACH_SERVICE_LISTENER);if(!listener||xpc_connection_set_peer_code_signing_requirement(listener,peer_requirement))return 74;
 xpc_connection_set_event_handler(listener,^(xpc_object_t peer){
  if(xpc_get_type(peer)!=XPC_TYPE_CONNECTION)return;
  if(shutting_down||accepted_peers>=64){xpc_connection_set_event_handler(peer,^(xpc_object_t event){(void)event;});xpc_connection_activate(peer);xpc_connection_cancel(peer);return;}
  Peer*p=calloc(1,sizeof(*p));if(!p){xpc_connection_set_event_handler(peer,^(xpc_object_t event){(void)event;});xpc_connection_activate(peer);xpc_connection_cancel(peer);return;}
  atomic_init(&p->refs,1);atomic_init(&p->ended,0);p->connection=xpc_retain(peer);xpc_connection_set_context(peer,p);xpc_connection_set_finalizer_f(peer,release_peer);accepted_peers++;xpc_connection_set_target_queue(peer,control);
  int configured=xpc_connection_set_peer_code_signing_requirement(peer,peer_requirement)==0;
  xpc_connection_set_event_handler(peer,^(xpc_object_t event){if(atomic_load(&p->ended))return;if(xpc_get_type(event)!=XPC_TYPE_DICTIONARY){end_peer(p);return;}handle(p,event);});xpc_connection_activate(peer);if(!configured)end_peer(p);
 });xpc_connection_activate(listener);
 signal(SIGTERM,SIG_IGN);signal(SIGINT,SIG_IGN);dispatch_source_t term=dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL,SIGTERM,0,control),interrupt=dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL,SIGINT,0,control);if(!term||!interrupt)return 75;
 /* Graceful shutdown waits for all creation jobs and tracked child reaping.
  * SIGKILL/OS forced termination while kernel creation is blocked cannot offer
  * a reaping guarantee; any such result remains unknown in qualification. */
 void(^shutdown)(void)=^{shutting_down=1;for(size_t i=0;i<MAX_JOBS;i++)if(jobs[i])atomic_store(&jobs[i]->cancelled,1);revoke_slot();maybe_exit();};
 dispatch_source_set_event_handler(term,shutdown);dispatch_source_set_event_handler(interrupt,shutdown);dispatch_resume(term);dispatch_resume(interrupt);dispatch_main();
}
