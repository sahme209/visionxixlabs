/* DORMANT / UNCOMPILED. Only the later protected C bootstrap can create this
 * raw resource bridge. It does NOT qualify time, producer lifecycle or policy. */
#define _GNU_SOURCE
#include "time_parent_binding.h"
#include "time_worker_protocol.h"
#include <linux/sched.h>
#include <sys/syscall.h>
#include <sys/eventfd.h>
#include <sys/wait.h>
#include <sys/stat.h>
#include <sys/xattr.h>
#include <poll.h>
#include <pthread.h>
#include <fcntl.h>
#include <unistd.h>
#include <signal.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <limits.h>
#include <stdbool.h>
#if !defined(__linux__)
#error Linux-only private worker bridge
#endif
#ifndef P_PIDFD
#define P_PIDFD 3
#endif
struct parent;
struct held;
struct child;
enum worker_state { PREPARED, QUEUED, OWNED_RUNNING, REAPED, RETIRED_UNKNOWN };
struct parent {
 napi_env env;pthread_mutex_t lock;unsigned refs;
 int retired,active_hold,directory_fd,worker_fd;char generation[129];
 struct axiom_time_context context;
#ifdef AXIOM_TIME_BEHAVIOR_TEST
 struct axiom_time_test_observation *test_observation;
#endif
};
struct held {
 struct parent *parent;unsigned refs,operation_refs;int release_requested,closed,close_unknown,started;
 int original_source_fd;struct axiom_time_capture original;
};
struct child {
 struct held *hold;unsigned refs;enum worker_state state;
 int pidfd,cancel_fd,result_fd,bootstrap_fd,cancelled,normal_exit,reaped,frame_eof;
 int io_done,success;pid_t pid;uint64_t deadline;
 unsigned char wire[4609];size_t wire_length;
 unsigned char bootstrap[512];size_t bootstrap_length;
 struct axiom_time_capture capture;
 napi_async_work work;napi_deferred result,completed;
 napi_ref held_ref,termination_ref;
};
enum operation { HOLD, CURRENT, OBSERVE, RELEASE };
struct job {
 struct parent *parent;struct held *hold;enum operation operation;
 napi_async_work work;napi_deferred deferred;napi_ref argument,capture_argument;struct child *capture_child;
 int success;uint64_t p2;
};
static const napi_type_tag held_tag={0xc96e705e42aa69c1ULL,0xa8616a2c95cced02ULL};
static const napi_type_tag capture_tag={0x90a1807538317d4eULL,0xd466440a62d52ff1ULL};
static int tagged(napi_env e,napi_value v,const napi_type_tag *tag){bool yes=false;return napi_check_object_type_tag(e,v,tag,&yes)==napi_ok&&yes;}
static int bigint_property(napi_env,napi_value,const char *,uint64_t);
static napi_value undefined(napi_env e){napi_value v=NULL;if(napi_get_undefined(e,&v)!=napi_ok)return NULL;return v;}
static napi_value error(napi_env e){napi_value s=NULL,v=NULL;if(napi_create_string_utf8(e,"native_time_resource_unavailable",NAPI_AUTO_LENGTH,&s)!=napi_ok||napi_create_error(e,NULL,s,&v)!=napi_ok)return NULL;return v;}
static napi_value reject_sync(napi_env e){napi_value failure=error(e);if(failure)napi_throw(e,failure);else napi_throw_error(e,NULL,"native_time_resource_unavailable");return NULL;}
static void retire_locked(struct parent *p){p->retired=1;}
static void parent_ref(struct parent *p){p->refs++;}
static void parent_unref(struct parent *p){
 int destroy=0;pthread_mutex_lock(&p->lock);if(!--p->refs)destroy=1;pthread_mutex_unlock(&p->lock);
 if(destroy){close(p->directory_fd);close(p->worker_fd);pthread_mutex_destroy(&p->lock);free(p);}
}
static void hold_close_locked(struct held *h){
 if(h->release_requested&&!h->operation_refs&&!h->closed){
  h->closed=1;h->parent->active_hold=0;
#ifdef AXIOM_TIME_BEHAVIOR_TEST
  if(h->parent->test_observation){atomic_fetch_add(&h->parent->test_observation->close_attempts,1);atomic_store(&h->parent->test_observation->close_operation_refs,h->operation_refs);}
#endif
  int close_result=close(h->original_source_fd);
  if(close_result){h->close_unknown=1;retire_locked(h->parent);}h->original_source_fd=-1;
#ifdef AXIOM_TIME_BEHAVIOR_TEST
  if(h->parent->test_observation){atomic_store(&h->parent->test_observation->close_result,close_result?1:0);atomic_store(&h->parent->test_observation->closed,h->closed);atomic_store(&h->parent->test_observation->close_unknown,h->close_unknown);}
#endif
 }
}
static void hold_unref(struct held *h){
 struct parent *p=h->parent;int destroy=0;pthread_mutex_lock(&p->lock);
 if(!--h->refs){h->release_requested=1;hold_close_locked(h);destroy=1;}
 pthread_mutex_unlock(&p->lock);if(destroy){free(h);parent_unref(p);}
}
static int begin_operation(struct held *h){
 struct parent *p=h->parent;int ok;pthread_mutex_lock(&p->lock);
 ok=!p->retired&&!h->closed&&!h->release_requested;
 if(ok){h->refs++;h->operation_refs++;}pthread_mutex_unlock(&p->lock);return ok;
}
static void end_operation(struct held *h){
 pthread_mutex_lock(&h->parent->lock);h->operation_refs--;hold_close_locked(h);pthread_mutex_unlock(&h->parent->lock);hold_unref(h);
}
static int monotonic(uint64_t *v){
 struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0||t.tv_nsec>=1000000000)return 0;
 if((uint64_t)t.tv_sec>((uint64_t)INT64_MAX-(uint64_t)t.tv_nsec)/1000000000)return 0;
 *v=(uint64_t)t.tv_sec*1000000000+(uint64_t)t.tv_nsec;return 1;
}
static struct axiom_time_context context(struct held *h){struct axiom_time_context c=h->parent->context;c.source_fd=h->original_source_fd;return c;}
static int current(struct held *h){struct axiom_time_context c=context(h);return !axiom_time_capture_current(&c,&h->original);}
static int no_acl(int fd){errno=0;return fgetxattr(fd,"system.posix_acl_access",NULL,0)<0&&errno==ENODATA;}
static struct held *acquire(struct parent *p){
 int fd=openat(p->directory_fd,"current",O_RDONLY|O_NOFOLLOW|O_CLOEXEC);if(fd<0)return NULL;
 struct stat s;if(fstat(fd,&s)||!S_ISREG(s.st_mode)||s.st_nlink!=1||(s.st_mode&07777)!=0440||s.st_uid!=p->context.publisher_uid||s.st_gid!=p->context.reader_gid||s.st_size<1||s.st_size>4096||!no_acl(fd)){close(fd);return NULL;}
 struct held *h=calloc(1,sizeof(*h));if(!h){close(fd);return NULL;}
 h->parent=p;h->refs=1;h->original_source_fd=fd;h->original.held_fd=-1;h->original.bytes=(size_t)s.st_size;
 h->original.device=(uint64_t)s.st_dev;h->original.inode=(uint64_t)s.st_ino;
 size_t offset=0;while(offset<h->original.bytes){ssize_t n=pread(fd,h->original.record+offset,h->original.bytes-offset,(off_t)offset);if(n<=0)goto bad;offset+=(size_t)n;}
 unsigned char extra;if(pread(fd,&extra,1,(off_t)offset)!=0)goto bad;
 /* The exact publication codec is reused, not a caller-supplied marker. */
 if(axiom_worker_record_identity(h->original.record,h->original.bytes,p->generation,&h->original.publication,&h->original.disruption_marker)!=0||!current(h))goto bad;
 pthread_mutex_lock(&p->lock);parent_ref(p);pthread_mutex_unlock(&p->lock);return h;
 bad:close(fd);free(h);return NULL;
}
static void held_finalizer(napi_env e,void *data,void *hint){(void)e;(void)hint;struct held *h=data;pthread_mutex_lock(&h->parent->lock);h->release_requested=1;hold_close_locked(h);pthread_mutex_unlock(&h->parent->lock);hold_unref(h);}
static int hold_object(napi_env e,struct held *h,napi_value *v){
 napi_value buffer,typed,generation;void *bytes;
 if(napi_create_object(e,v)!=napi_ok||napi_create_arraybuffer(e,h->original.bytes,&bytes,&buffer)!=napi_ok)return 0;
 memcpy(bytes,h->original.record,h->original.bytes);
 if(napi_create_typedarray(e,napi_uint8_array,h->original.bytes,buffer,0,&typed)!=napi_ok||napi_set_named_property(e,*v,"bytes",typed)!=napi_ok||napi_create_string_utf8(e,h->parent->generation,NAPI_AUTO_LENGTH,&generation)!=napi_ok||napi_set_named_property(e,*v,"sourceGeneration",generation)!=napi_ok)return 0;
 if(!bigint_property(e,*v,"device",h->original.device)||!bigint_property(e,*v,"inode",h->original.inode)||!bigint_property(e,*v,"publication",h->original.publication)||!bigint_property(e,*v,"disruptionMarker",h->original.disruption_marker))return 0;
 return napi_type_tag_object(e,*v,&held_tag)==napi_ok&&napi_wrap(e,*v,h,held_finalizer,NULL,NULL)==napi_ok;
}
static void execute_job(napi_env e,void *data){
 (void)e;struct job *j=data;struct parent *p=j->parent;
 if(j->operation==HOLD){pthread_mutex_lock(&p->lock);int ok=!p->retired;pthread_mutex_unlock(&p->lock);if(ok)j->hold=acquire(p);j->success=j->hold!=NULL;if(!j->success){pthread_mutex_lock(&p->lock);p->active_hold=0;pthread_mutex_unlock(&p->lock);}return;}
 struct held *h=j->hold;
 if(j->operation==RELEASE){
  uint64_t start,now;if(!monotonic(&start))return;
  do{pthread_mutex_lock(&p->lock);h->release_requested=1;hold_close_locked(h);int unknown=h->close_unknown;j->success=h->closed&&!unknown;pthread_mutex_unlock(&p->lock);
   if(j->success||unknown)return;struct timespec nap={0,1000000};nanosleep(&nap,NULL);
  }while(monotonic(&now)&&now-start<100000000);
  pthread_mutex_lock(&p->lock);retire_locked(p);pthread_mutex_unlock(&p->lock);return;
 }
 j->success=current(h);
 if(j->success&&j->operation==OBSERVE)j->success=monotonic(&j->p2)&&j->p2>=j->capture_child->capture.p2_ns&&current(h);
 pthread_mutex_lock(&p->lock);if(p->retired||h->release_requested)j->success=0;pthread_mutex_unlock(&p->lock);
}
static void complete_job(napi_env e,napi_status status,void *data){
 struct job *j=data;napi_value value=undefined(e);
 if(status!=napi_ok)j->success=0;
 if(j->operation==HOLD&&j->hold){pthread_mutex_lock(&j->parent->lock);if(j->parent->retired)j->success=0;pthread_mutex_unlock(&j->parent->lock);if(j->success&&!hold_object(e,j->hold,&value))j->success=0;if(!j->success)hold_unref(j->hold);}
 if(j->success&&j->operation==OBSERVE){napi_value v=NULL;if(napi_create_object(e,&value)!=napi_ok||napi_create_bigint_uint64(e,j->p2,&v)!=napi_ok||napi_set_named_property(e,value,"p2",v)!=napi_ok)j->success=0;}
 if(j->success)napi_resolve_deferred(e,j->deferred,value);else napi_reject_deferred(e,j->deferred,error(e));
 if(j->argument)napi_delete_reference(e,j->argument);if(j->capture_argument)napi_delete_reference(e,j->capture_argument);
 if(j->operation!=HOLD){if(j->operation==RELEASE)hold_unref(j->hold);else end_operation(j->hold);}
 napi_delete_async_work(e,j->work);parent_unref(j->parent);free(j);
}
static napi_value queue_operation(napi_env e,napi_callback_info info,enum operation op){
 size_t argc=2;napi_value argv[2],self,promise;void *data;
 if(napi_get_cb_info(e,info,&argc,argv,&self,&data)!=napi_ok)return reject_sync(e);
 struct parent *p=data;struct held *h=NULL;
 if(op==HOLD){pthread_mutex_lock(&p->lock);int busy=p->retired||p->active_hold;if(!busy)p->active_hold=1;pthread_mutex_unlock(&p->lock);if(busy)return reject_sync(e);}
 if(op!=HOLD&&(argc<1||!tagged(e,argv[0],&held_tag)||napi_unwrap(e,argv[0],(void**)&h)!=napi_ok||!h||h->parent!=p))return reject_sync(e);
 struct child *captured=NULL;
 if(op==OBSERVE&&(argc<2||!tagged(e,argv[1],&capture_tag)||napi_unwrap(e,argv[1],(void**)&captured)!=napi_ok||!captured||captured->hold!=h||!captured->success||!captured->reaped))return reject_sync(e);
 if(op!=HOLD&&op!=RELEASE&&!begin_operation(h))return reject_sync(e);
 if(op==RELEASE){pthread_mutex_lock(&p->lock);h->refs++;h->release_requested=1;pthread_mutex_unlock(&p->lock);}
 struct job *j=calloc(1,sizeof(*j));if(!j){if(op==HOLD){pthread_mutex_lock(&p->lock);p->active_hold=0;pthread_mutex_unlock(&p->lock);}if(h){if(op==RELEASE)hold_unref(h);else end_operation(h);}return reject_sync(e);}
 j->parent=p;j->hold=h;j->operation=op;j->capture_child=captured;pthread_mutex_lock(&p->lock);parent_ref(p);pthread_mutex_unlock(&p->lock);
 napi_value name=NULL;if(napi_create_string_utf8(e,"axiom-time-resource",NAPI_AUTO_LENGTH,&name)!=napi_ok)goto bad;
 if(napi_create_promise(e,&j->deferred,&promise)!=napi_ok||napi_create_async_work(e,NULL,name,execute_job,complete_job,j,&j->work)!=napi_ok)goto bad;
 if(h&&napi_create_reference(e,argv[0],1,&j->argument)!=napi_ok)goto bad;
 if(captured&&napi_create_reference(e,argv[1],1,&j->capture_argument)!=napi_ok)goto bad;
 if(napi_queue_async_work(e,j->work)!=napi_ok)goto bad;
 return promise;
 bad:if(op==HOLD){pthread_mutex_lock(&p->lock);p->active_hold=0;pthread_mutex_unlock(&p->lock);}if(j->argument)napi_delete_reference(e,j->argument);if(j->capture_argument)napi_delete_reference(e,j->capture_argument);if(j->work)napi_delete_async_work(e,j->work);if(h){if(op==RELEASE)hold_unref(h);else end_operation(h);}parent_unref(p);free(j);return reject_sync(e);
}
static napi_value hold_cb(napi_env e,napi_callback_info i){return queue_operation(e,i,HOLD);}
static napi_value release_cb(napi_env e,napi_callback_info i){return queue_operation(e,i,RELEASE);}
static napi_value current_cb(napi_env e,napi_callback_info i){return queue_operation(e,i,CURRENT);}
static napi_value observe_cb(napi_env e,napi_callback_info i){return queue_operation(e,i,OBSERVE);}
static void signal_cancel(struct child *c){
 struct parent *p=c->hold->parent;pthread_mutex_lock(&p->lock);
#ifdef AXIOM_TIME_BEHAVIOR_TEST
 if(!c->cancelled&&p->test_observation){uint64_t at;if(monotonic(&at))atomic_store(&p->test_observation->cancel_at,at);}
#endif
 c->cancelled=1;uint64_t one=1;if(c->cancel_fd>=0)(void)write(c->cancel_fd,&one,sizeof(one));pthread_mutex_unlock(&p->lock);
}
static void child_unref(struct child *c){
 struct parent *p=c->hold->parent;int done;pthread_mutex_lock(&p->lock);done=!--c->refs;pthread_mutex_unlock(&p->lock);
 if(done){if(c->termination_ref)napi_delete_reference(p->env,c->termination_ref);if(c->pidfd>=0)close(c->pidfd);if(c->cancel_fd>=0)close(c->cancel_fd);hold_unref(c->hold);free(c);}
}
static void worker_finalizer(napi_env e,void *data,void *hint){(void)e;(void)hint;struct child *c=data;signal_cancel(c);child_unref(c);}
static void child_reference_finalizer(napi_env e,void *data,void *hint){(void)e;(void)hint;child_unref(data);}
static napi_value terminate_cb(napi_env e,napi_callback_info info){
 void *data=NULL;napi_value self=NULL,v=NULL;size_t argc=0;if(napi_get_cb_info(e,info,&argc,NULL,&self,&data)!=napi_ok||!data)return reject_sync(e);struct child *c=data;
 pthread_mutex_lock(&c->hold->parent->lock);int finished=c->state==REAPED&&c->io_done;pthread_mutex_unlock(&c->hold->parent->lock);if(!finished)signal_cancel(c);if(napi_get_reference_value(e,c->termination_ref,&v)!=napi_ok)return reject_sync(e);return v;
}
/* Prepared child branch: raw descriptor/exec syscalls only, no libc allocation,
 * mutexes, V8 or Node callbacks after clone from the multithreaded parent. */
static _Noreturn void child_exec_only(const int source[8]){
 for(int fd=0;fd<8;fd++)if(syscall(SYS_dup3,source[fd],fd,fd==7?O_CLOEXEC:0)<0)_exit(70);
 if(syscall(SYS_close_range,8u,UINT_MAX,0u)<0)_exit(70);
 char *const argv[]={"axiom-time-worker",NULL};char *const env[]={NULL};
 syscall(SYS_execveat,7,"",argv,env,AT_EMPTY_PATH);_exit(70);
}
static ssize_t bootstrap_write(int fd,const unsigned char *bytes,size_t length){
 sigset_t blocked,old,pending;sigemptyset(&blocked);sigaddset(&blocked,SIGPIPE);
 if(pthread_sigmask(SIG_BLOCK,&blocked,&old))return -1;
 int existed=sigpending(&pending)==0&&sigismember(&pending,SIGPIPE);
 ssize_t n=write(fd,bytes,length);int saved=errno;
 if(n<0&&saved==EPIPE&&!existed){struct timespec zero={0,0};(void)sigtimedwait(&blocked,NULL,&zero);}
 if(pthread_sigmask(SIG_SETMASK,&old,NULL))return -1;errno=saved;return n;
}
static int deadline_poll(struct child *c,uint64_t until){
 uint64_t now;if(!monotonic(&now)||now>=until)return 0;
 struct pollfd fds[3]={{c->result_fd,POLLIN|POLLHUP,0},{c->pidfd,POLLIN,0},{c->cancel_fd,POLLIN,0}};
 uint64_t ms=(until-now+999999)/1000000;if(ms>20)ms=20;
 int n=poll(fds,3,(int)ms);return n>=0||errno==EINTR;
}
static void execute_child(napi_env e,void *data){
 (void)e;struct child *c=data;struct parent *p=c->hold->parent;
 /* Work is queued first; initial state is published synchronously by start. */
 enum worker_state initial_state;
 for(;;){pthread_mutex_lock(&p->lock);initial_state=c->state;pthread_mutex_unlock(&p->lock);if(initial_state!=QUEUED)break;struct timespec nap={0,1000000};nanosleep(&nap,NULL);}
 if(initial_state!=OWNED_RUNNING){if(c->result_fd>=0){close(c->result_fd);c->result_fd=-1;}if(c->bootstrap_fd>=0){close(c->bootstrap_fd);c->bootstrap_fd=-1;}pthread_mutex_lock(&p->lock);c->io_done=1;pthread_mutex_unlock(&p->lock);return;}
 size_t written=0;int failed=0,killed=0;uint64_t cleanup_deadline=0;
 while(!c->reaped||!c->frame_eof){
  uint64_t now;pthread_mutex_lock(&p->lock);int cancel=c->cancelled||p->retired;pthread_mutex_unlock(&p->lock);
  if(!monotonic(&now)){failed=1;cancel=1;now=c->deadline;}
  if(now>=c->deadline)cancel=1;
  if((cancel||failed)&&!killed){failed=1;killed=1;cleanup_deadline=now+100000000;
   if(syscall(SYS_pidfd_send_signal,c->pidfd,SIGKILL,NULL,0)<0&&errno!=ESRCH)break;
  }
  if(killed&&now>=cleanup_deadline)break;
  if(!killed&&written<c->bootstrap_length){ssize_t n=bootstrap_write(c->bootstrap_fd,c->bootstrap+written,c->bootstrap_length-written);if(n>0)written+=(size_t)n;else if(n<0&&errno!=EINTR&&errno!=EAGAIN)failed=1;
   if(written==c->bootstrap_length){close(c->bootstrap_fd);c->bootstrap_fd=-1;}
  }
  if(!c->frame_eof){ssize_t n=read(c->result_fd,c->wire+c->wire_length,sizeof(c->wire)-c->wire_length);
   if(n>0){c->wire_length+=(size_t)n;if(c->wire_length>4608)failed=1;}
   else if(n==0)c->frame_eof=1;else if(errno!=EAGAIN&&errno!=EINTR)failed=1;
  }
  if(!c->reaped){siginfo_t info;memset(&info,0,sizeof(info));
   if(waitid(P_PIDFD,(id_t)c->pidfd,&info,WEXITED|WNOHANG)<0){if(errno==ECHILD)failed=1;break;}
   if(info.si_pid){c->reaped=1;c->normal_exit=info.si_code==CLD_EXITED&&info.si_status==0;
#ifdef AXIOM_TIME_BEHAVIOR_TEST
    if(p->test_observation){atomic_store(&p->test_observation->reap_code,(uint64_t)info.si_code);atomic_store(&p->test_observation->reap_status,(uint64_t)info.si_status);atomic_store(&p->test_observation->owned_reap,1);}
#endif
   }
  }
  if(c->reaped&&c->frame_eof)break;
  if(!deadline_poll(c,killed?cleanup_deadline:c->deadline)){failed=1;}
 }
 c->success=!failed&&c->reaped&&c->normal_exit&&c->frame_eof;
 struct axiom_worker_context wire_context;memset(&wire_context,0,sizeof(wire_context));memcpy(wire_context.generation,p->generation,strlen(p->generation)+1);
 if(c->success)c->success=axiom_worker_capture_decode(c->wire,c->wire_length,1,&wire_context,&c->capture)==0;
 struct axiom_time_capture *a=&c->capture,*b=&c->hold->original;
 if(c->success)c->success=a->device==b->device&&a->inode==b->inode&&a->bytes==b->bytes&&a->publication==b->publication&&a->disruption_marker==b->disruption_marker&&!memcmp(a->record,b->record,a->bytes)&&current(c->hold);
 pthread_mutex_lock(&p->lock);if(c->cancelled||p->retired||c->hold->release_requested)c->success=0;
 c->state=c->reaped?REAPED:RETIRED_UNKNOWN;c->io_done=c->reaped;if(!c->reaped)retire_locked(p);pthread_mutex_unlock(&p->lock);
 if(c->reaped){close(c->result_fd);c->result_fd=-1;if(c->bootstrap_fd>=0){close(c->bootstrap_fd);c->bootstrap_fd=-1;}}
 /* Unknown resources are quarantined, not closed while an owned child can use
  * them. This retained ownership is deliberately not reported as completion. */

}
static int bigint_property(napi_env e,napi_value object,const char *name,uint64_t number){napi_value v;return napi_create_bigint_uint64(e,number,&v)==napi_ok&&napi_set_named_property(e,object,name,v)==napi_ok;}
static void complete_child(napi_env e,napi_status status,void *data){
 struct child *c=data;struct parent *p=c->hold->parent;napi_value v=undefined(e);
 pthread_mutex_lock(&p->lock);if(status!=napi_ok||p->retired||c->cancelled||c->hold->release_requested)c->success=0;pthread_mutex_unlock(&p->lock);
 if(c->success){napi_value identity,bytes;void *copy;
  if(napi_create_object(e,&v)!=napi_ok||napi_get_reference_value(e,c->held_ref,&identity)!=napi_ok||napi_create_arraybuffer(e,c->capture.bytes,&copy,&bytes)!=napi_ok)c->success=0;
  else {memcpy(copy,c->capture.record,c->capture.bytes);napi_value typed;if(napi_create_typedarray(e,napi_uint8_array,c->capture.bytes,bytes,0,&typed)!=napi_ok)c->success=0;
   else if(napi_set_named_property(e,v,"bytes",typed)!=napi_ok||napi_set_named_property(e,v,"identity",identity)!=napi_ok)c->success=0;
   napi_value generation;
   if(napi_create_string_utf8(e,p->generation,NAPI_AUTO_LENGTH,&generation)!=napi_ok||napi_set_named_property(e,v,"sourceGeneration",generation)!=napi_ok)c->success=0;
   c->success=c->success&&bigint_property(e,v,"device",c->capture.device)&&bigint_property(e,v,"inode",c->capture.inode)&&bigint_property(e,v,"publication",c->capture.publication)&&bigint_property(e,v,"disruptionMarker",c->capture.disruption_marker)&&bigint_property(e,v,"realtimeNs",c->capture.realtime_ns)&&bigint_property(e,v,"p0Ns",c->capture.p0_ns)&&bigint_property(e,v,"p1Ns",c->capture.p1_ns)&&bigint_property(e,v,"p2Ns",c->capture.p2_ns);
  }
 }
 if(c->success){if(napi_type_tag_object(e,v,&capture_tag)!=napi_ok)c->success=0;
  else {pthread_mutex_lock(&p->lock);c->refs++;pthread_mutex_unlock(&p->lock);
   if(napi_wrap(e,v,c,child_reference_finalizer,NULL,NULL)!=napi_ok){child_unref(c);c->success=0;}}}
 if(c->success)napi_resolve_deferred(e,c->result,v);else napi_reject_deferred(e,c->result,error(e));
 if(c->reaped&&c->io_done)napi_resolve_deferred(e,c->completed,undefined(e));else napi_reject_deferred(e,c->completed,error(e));
 napi_delete_async_work(e,c->work);
 if(c->reaped){napi_delete_reference(e,c->held_ref);end_operation(c->hold);child_unref(c);} /* otherwise quarantine all references */
 (void)p;
}
static napi_value start_cb(napi_env e,napi_callback_info info){
 size_t argc=1;napi_value argv[1],self,object=NULL,result,completed,terminate_function=NULL;int method_owned=0;void *data;struct held *h=NULL;
 if(napi_get_cb_info(e,info,&argc,argv,&self,&data)!=napi_ok||argc<1||!tagged(e,argv[0],&held_tag)||napi_unwrap(e,argv[0],(void**)&h)!=napi_ok||!h||h->parent!=data)return reject_sync(e);
 struct parent *p=data;if(!begin_operation(h))return reject_sync(e);
 pthread_mutex_lock(&p->lock);int used=h->started;h->started=1;pthread_mutex_unlock(&p->lock);if(used){end_operation(h);return reject_sync(e);}
 struct child *c=calloc(1,sizeof(*c));int descriptors[8],pipes[4]={-1,-1,-1,-1};
 for(int i=0;i<8;i++)descriptors[i]=-1;
 if(!c){end_operation(h);return reject_sync(e);}c->hold=h;c->refs=2;pthread_mutex_lock(&p->lock);h->refs++;pthread_mutex_unlock(&p->lock);c->pidfd=-1;c->cancel_fd=-1;c->result_fd=-1;c->bootstrap_fd=-1;c->state=PREPARED;
 struct axiom_worker_context wire_context;memset(&wire_context,0,sizeof(wire_context));
 memcpy(wire_context.generation,p->generation,strlen(p->generation)+1);wire_context.publisher_uid=p->context.publisher_uid;wire_context.reader_gid=p->context.reader_gid;wire_context.directory_device=p->context.directory_device;wire_context.directory_inode=p->context.directory_inode;
 if(axiom_worker_context_encode(&wire_context,c->bootstrap,sizeof(c->bootstrap),&c->bootstrap_length)!=0)goto before_queue_fail;
 uint64_t now;if(!c->bootstrap_length||!monotonic(&now))goto before_queue_fail;c->deadline=now+500000000;
#ifdef AXIOM_TIME_BEHAVIOR_TEST
 if(p->test_observation)atomic_store(&p->test_observation->deadline,c->deadline);
#endif
 c->cancel_fd=eventfd(0,EFD_CLOEXEC|EFD_NONBLOCK);
 if(c->cancel_fd<0||pipe2(pipes,O_CLOEXEC)||pipe2(pipes+2,O_CLOEXEC))goto before_queue_fail;
 c->result_fd=pipes[0];c->bootstrap_fd=pipes[3];
 if(fcntl(c->result_fd,F_SETFL,O_NONBLOCK)||fcntl(c->bootstrap_fd,F_SETFL,O_NONBLOCK))goto before_queue_fail;
 int sink=open("/dev/null",O_RDWR|O_CLOEXEC);if(sink<0)goto before_queue_fail;
 int originals[8]={sink,sink,sink,p->directory_fd,h->original_source_fd,pipes[1],pipes[2],p->worker_fd};
 for(int i=0;i<8;i++){descriptors[i]=fcntl(originals[i],F_DUPFD_CLOEXEC,8);if(descriptors[i]<0){close(sink);goto before_queue_fail;}}close(sink);
 if(napi_create_object(e,&object)!=napi_ok||napi_create_promise(e,&c->result,&result)!=napi_ok||napi_create_promise(e,&c->completed,&completed)!=napi_ok||napi_create_reference(e,argv[0],1,&c->held_ref)!=napi_ok||napi_create_reference(e,completed,1,&c->termination_ref)!=napi_ok)goto before_queue_fail;
 napi_value name=NULL;if(napi_create_string_utf8(e,"axiom-time-owned-child",NAPI_AUTO_LENGTH,&name)!=napi_ok)goto before_queue_fail;
 if(napi_create_async_work(e,NULL,name,execute_child,complete_child,c,&c->work)!=napi_ok)goto before_queue_fail;
 napi_property_descriptor methods[]={{"terminate",NULL,terminate_cb,NULL,NULL,NULL,napi_default,c}};
 if(napi_set_named_property(e,object,"result",result)!=napi_ok||napi_set_named_property(e,object,"completed",completed)!=napi_ok||napi_define_properties(e,object,1,methods)!=napi_ok||napi_wrap(e,object,c,worker_finalizer,NULL,NULL)!=napi_ok)goto before_queue_fail;
 if(napi_get_named_property(e,object,"terminate",&terminate_function)!=napi_ok)goto before_queue_fail;
 pthread_mutex_lock(&p->lock);c->refs++;pthread_mutex_unlock(&p->lock);
 if(napi_add_finalizer(e,terminate_function,c,child_reference_finalizer,NULL,NULL)!=napi_ok){child_unref(c);goto before_queue_fail;}method_owned=1;
 c->state=QUEUED;if(napi_queue_async_work(e,c->work)!=napi_ok){c->state=PREPARED;goto before_queue_fail;}
 struct clone_args args;memset(&args,0,sizeof(args));args.flags=CLONE_PIDFD;args.pidfd=(uint64_t)(uintptr_t)&c->pidfd;args.exit_signal=SIGCHLD;
 c->pid=(pid_t)syscall(SYS_clone3,&args,sizeof(args));if(c->pid==0)child_exec_only(descriptors);
 for(int i=0;i<8;i++){close(descriptors[i]);descriptors[i]=-1;}close(pipes[1]);pipes[1]=-1;close(pipes[2]);pipes[2]=-1;
 pthread_mutex_lock(&p->lock);c->state=c->pid>0?OWNED_RUNNING:REAPED;if(c->pid<=0)c->reaped=1;pthread_mutex_unlock(&p->lock);
 return object;
 before_queue_fail:
 for(int i=0;i<8;i++)if(descriptors[i]>=0)close(descriptors[i]);
 for(int i=0;i<4;i++)if(pipes[i]>=0)close(pipes[i]);
 if(c->cancel_fd>=0)close(c->cancel_fd);if(c->held_ref)napi_delete_reference(e,c->held_ref);if(c->termination_ref)napi_delete_reference(e,c->termination_ref);if(c->work)napi_delete_async_work(e,c->work);
 /* If wrapped before a queue error, detach finalizer before freeing. */
 if(object){void *removed;napi_remove_wrap(e,object,&removed);}
 if(method_owned){c->termination_ref=NULL;c->held_ref=NULL;c->pidfd=-1;c->cancel_fd=-1;child_unref(c);child_unref(c);}else{free(c);hold_unref(h);}
 end_operation(h);return reject_sync(e);
}
static napi_value retire_cb(napi_env e,napi_callback_info info){size_t argc=0;void *data=NULL;napi_value self=NULL;if(napi_get_cb_info(e,info,&argc,NULL,&self,&data)!=napi_ok||!data)return reject_sync(e);struct parent *p=data;pthread_mutex_lock(&p->lock);retire_locked(p);pthread_mutex_unlock(&p->lock);return undefined(e);}
static void method_finalizer(napi_env e,void *data,void *hint){(void)e;(void)hint;parent_unref(data);}
static void parent_finalizer(napi_env e,void *data,void *hint){(void)e;(void)hint;struct parent *p=data;pthread_mutex_lock(&p->lock);retire_locked(p);pthread_mutex_unlock(&p->lock);parent_unref(p);}
napi_status axiom_time_parent_create_private(napi_env e,const struct axiom_time_parent_bootstrap *b,napi_value *out){
 if(!b||!b->generation||!out||strnlen(b->generation,129)>128||!b->generation[0])return napi_invalid_arg;
 for(const char *g=b->generation;*g;g++)if(!((*g>='A'&&*g<='Z')||(*g>='a'&&*g<='z')||(*g>='0'&&*g<='9')||*g=='_'||*g=='-'))return napi_invalid_arg;
 int directory_flags=fcntl(b->directory_fd,F_GETFL);if(directory_flags<0||(directory_flags&O_ACCMODE)!=O_RDONLY)return napi_invalid_arg;
 int flags=fcntl(b->worker_elf_fd,F_GETFL);struct stat st;
 if(flags<0||(flags&O_ACCMODE)!=O_RDONLY||fstat(b->worker_elf_fd,&st)||!S_ISREG(st.st_mode))return napi_invalid_arg;
 unsigned char magic[4];if(pread(b->worker_elf_fd,magic,4,0)!=4||memcmp(magic,"\177ELF",4))return napi_invalid_arg;
 struct parent *p=calloc(1,sizeof(*p));if(!p)return napi_generic_failure;
 #ifdef AXIOM_TIME_BEHAVIOR_TEST
 p->test_observation=b->test_observation;
#endif
 p->env=e;p->refs=1;p->directory_fd=-1;p->worker_fd=-1;if(pthread_mutex_init(&p->lock,NULL)){free(p);return napi_generic_failure;}
 p->directory_fd=fcntl(b->directory_fd,F_DUPFD_CLOEXEC,8);p->worker_fd=fcntl(b->worker_elf_fd,F_DUPFD_CLOEXEC,8);
 if(p->directory_fd<0||p->worker_fd<0){parent_unref(p);return napi_generic_failure;}
 memcpy(p->generation,b->generation,strlen(b->generation)+1);p->context=(struct axiom_time_context){p->directory_fd,-1,b->publisher_uid,b->reader_gid,b->directory_device,b->directory_inode};
 napi_property_descriptor properties[]={
  {"hold",NULL,hold_cb,NULL,NULL,NULL,napi_default,p},{"release",NULL,release_cb,NULL,NULL,NULL,napi_default,p},
  {"assertResourceCurrent",NULL,current_cb,NULL,NULL,NULL,napi_default,p},{"start",NULL,start_cb,NULL,NULL,NULL,napi_default,p},
  {"observeResourceCurrent",NULL,observe_cb,NULL,NULL,NULL,napi_default,p},{"retire",NULL,retire_cb,NULL,NULL,NULL,napi_default,p}};
 napi_status s=napi_create_object(e,out);if(s==napi_ok)s=napi_define_properties(e,*out,6,properties);if(s==napi_ok)s=napi_wrap(e,*out,p,parent_finalizer,NULL,NULL);if(s==napi_ok){const char *names[]={"hold","release","assertResourceCurrent","start","observeResourceCurrent","retire"};
 for(size_t i=0;i<6;i++){napi_value fn;if(napi_get_named_property(e,*out,names[i],&fn)!=napi_ok){s=napi_generic_failure;break;}
 pthread_mutex_lock(&p->lock);parent_ref(p);pthread_mutex_unlock(&p->lock);
 if(napi_add_finalizer(e,fn,p,method_finalizer,NULL,NULL)!=napi_ok){parent_unref(p);s=napi_generic_failure;break;}}
 }else parent_unref(p);return s;
}

/* Operational source private seam. Runtime JS never receives this pointer. */
struct axiom_time_original { struct held *hold; struct child *capture; };
int axiom_time_parent_pin_original(napi_env e,napi_value bridge,napi_value held,
 napi_value capture,struct axiom_time_original **out,uint64_t *publication,uint64_t *marker,uint64_t *deadline){
 struct parent *p=NULL;struct held *h=NULL;struct child *c=NULL;
 if(!out||!publication||!marker||!deadline||napi_unwrap(e,bridge,(void**)&p)!=napi_ok||!p||
 !tagged(e,held,&held_tag)||!tagged(e,capture,&capture_tag)||
 napi_unwrap(e,held,(void**)&h)!=napi_ok||!h||h->parent!=p||
 napi_unwrap(e,capture,(void**)&c)!=napi_ok||!c||c->hold!=h)return -1;
 struct axiom_time_original *v=calloc(1,sizeof *v);if(!v)return -1;
 pthread_mutex_lock(&p->lock);
 int ok=!p->retired&&!h->closed&&!h->release_requested&&h->started&&
 c->success&&c->state==REAPED&&c->reaped&&c->io_done;
 if(ok){h->refs++;h->operation_refs++;c->refs++;}
 pthread_mutex_unlock(&p->lock);
 if(!ok){free(v);return -1;}v->hold=h;v->capture=c;
 if(!current(h)){child_unref(c);end_operation(h);free(v);return -1;}
 *publication=h->original.publication;*marker=h->original.disruption_marker;*deadline=c->deadline;*out=v;return 0;
}
int axiom_time_parent_original_current(struct axiom_time_original *v){
 if(!v)return -1;struct parent *p=v->hold->parent;
 pthread_mutex_lock(&p->lock);int ok=!p->retired&&!v->hold->closed&&
 !v->hold->release_requested&&v->capture->success&&v->capture->state==REAPED&&v->capture->io_done;
 pthread_mutex_unlock(&p->lock);return ok&&current(v->hold)?0:-1;
}
void axiom_time_parent_unpin_original(struct axiom_time_original *v){
 if(!v)return;child_unref(v->capture);end_operation(v->hold);free(v);
}
