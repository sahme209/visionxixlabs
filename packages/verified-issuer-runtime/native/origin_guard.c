#define _DARWIN_C_SOURCE 1
#define NAPI_VERSION 8
#include "origin_config.h"
#include "origin_session.h"
#include "origin_private_bootstrap.h"
#include <fcntl.h>
#include <unistd.h>
#include <libproc.h>
#include <sys/proc_info.h>
#include "origin_process_identity.h"
#include "protected_resource_inventory.h"
#include <node_api.h>
#include <mach-o/dyld.h>
#include <crt_externs.h>
#include <dlfcn.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <pthread.h>
#include <limits.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <stdatomic.h>
#include <dispatch/dispatch.h>
#include <time.h>
static atomic_flag constructor_attempted=ATOMIC_FLAG_INIT;
static napi_value initialize(napi_env env,napi_value exports);
static int same_file(const char*a,const char*b){struct stat x,y;return !stat(a,&x)&&!stat(b,&y)&&x.st_dev==y.st_dev&&x.st_ino==y.st_ino;}
static const char* fixed_process_failure(int main_thread){
 if(!AXIOM_ISSUER_PACKAGE_ROOT[0]||!AXIOM_ISSUER_IMAGE_BACKING[0])return "origin_package_unprepared";
 if(main_thread&&!pthread_main_np())return "origin_main_thread_required";
 char root[PATH_MAX],actual[PATH_MAX],expected[PATH_MAX],exe[PATH_MAX];struct stat st;struct statfs volume;
 if(!realpath(AXIOM_ISSUER_PACKAGE_ROOT,root)||strcmp(root,AXIOM_ISSUER_PACKAGE_ROOT)||lstat(root,&st)||!S_ISDIR(st.st_mode))return "origin_canonical_root_required";
 if(statfs(root,&volume)||!(volume.f_flags&MNT_RDONLY)||strcmp(volume.f_mntonname,root))return "origin_readonly_package_required";
 uint32_t length=sizeof(exe);if(_NSGetExecutablePath(exe,&length)||!realpath(exe,actual))return "origin_executable_unavailable";
 if(snprintf(expected,sizeof(expected),"%s/__axiom_runtime__/node",root)>=(int)sizeof(expected)||strcmp(actual,expected)||!same_file(actual,expected))return "origin_packaged_executable_required";
 int argc=*_NSGetArgc();char**argv=*_NSGetArgv();if(argc!=2||snprintf(expected,sizeof(expected),"%s/node_modules/@axiom/verified-issuer-runtime/index.cjs",root)>=(int)sizeof(expected)||strcmp(argv[1],expected))return "origin_fixed_main_required";
 Dl_info image;if(!dladdr((const void*)&initialize,&image)||!image.dli_fname||!realpath(image.dli_fname,actual))return "origin_native_image_unavailable";
 if(snprintf(expected,sizeof(expected),"%s/node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node",root)>=(int)sizeof(expected)||!realpath(expected,exe)||strcmp(actual,exe)||!same_file(actual,exe))return "origin_fixed_native_image_required";
 for(char**item=*_NSGetEnviron();*item;item++){if(!strcmp(*item,"NODE_ENV=production"))continue;if(!strncmp(*item,"NODE_",5)||!strncmp(*item,"DYLD_",5)||!strncmp(*item,"LD_",3)||!strncmp(*item,"TS_NODE_",8)||!strncmp(*item,"BABEL_",6)||!strncmp(*item,"AXIOM_ISSUER_",13)||!strncmp(*item,"V8_",3)||!strncmp(*item,"UV_",3))return "origin_clean_loader_required";}
 return NULL;
}
static napi_value refuse(napi_env env,const char*reason){napi_throw_error(env,"axiom_origin_unavailable",reason);return NULL;}
typedef struct {atomic_uint refs;atomic_int invalid;atomic_flag busy;atomic_flag bootstrap_attempted;int request_waiting,bootstrap_consumed;AxiomOriginSession*session;AxiomOriginProcessIdentity startup;dispatch_queue_t queue;} NativeOrigin;
typedef struct {atomic_uint refs;atomic_int cancelled;atomic_int success;NativeOrigin*origin;dispatch_semaphore_t done;uint64_t deadline;} NativeProbe;
static uint64_t monotonic_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static void release_origin(NativeOrigin*o){if(atomic_fetch_sub(&o->refs,1)==1){axiom_origin_session_destroy(o->session);dispatch_release(o->queue);free(o);}}
static void revoke_origin(void*value){NativeOrigin*o=value;if(!o)return;if(!atomic_exchange(&o->invalid,1))axiom_origin_session_revoke(o->session);}
static void cleanup_origin(void*value){NativeOrigin*o=value;revoke_origin(o);release_origin(o);}
static void release_probe(NativeProbe*p){if(atomic_fetch_sub(&p->refs,1)==1){release_origin(p->origin);dispatch_release(p->done);free(p);}}
static napi_value assert_current(napi_env env,napi_callback_info info){
 size_t argc=1;void*value=NULL;napi_value argument;
 if(napi_get_cb_info(env,info,&argc,&argument,NULL,&value)!=napi_ok||argc!=0||!value)return refuse(env,"origin_probe_zero_arguments_required");
 NativeOrigin*o=value;
 if(!pthread_main_np()||atomic_load(&o->invalid)||!axiom_origin_session_locally_valid(o->session))return refuse(env,"origin_current_unavailable");
 if(atomic_flag_test_and_set(&o->busy)){revoke_origin(o);return refuse(env,"origin_concurrent_probe_refused");}
 uint64_t start=monotonic_ns();if(start==UINT64_MAX||start>UINT64_MAX-AXIOM_ORIGIN_EXCHANGE_NS){atomic_flag_clear(&o->busy);revoke_origin(o);return refuse(env,"origin_clock_unavailable");}
 NativeProbe*p=calloc(1,sizeof(*p));if(!p){atomic_flag_clear(&o->busy);revoke_origin(o);return refuse(env,"origin_probe_allocation_unavailable");}
 p->done=dispatch_semaphore_create(0);if(!p->done){free(p);atomic_flag_clear(&o->busy);revoke_origin(o);return refuse(env,"origin_probe_allocation_unavailable");}
 atomic_init(&p->refs,2);atomic_init(&p->cancelled,0);atomic_init(&p->success,0);p->origin=o;atomic_fetch_add(&o->refs,1);p->deadline=start+AXIOM_ORIGIN_EXCHANGE_NS;
 /* Filesystem/VM inspection and XPC run on a private native queue. No JS
  * callback is needed, and one late/hung native job cannot authorize or grow
  * an unbounded queue: timeout permanently revokes the only session. */
 dispatch_async(o->queue,^{
  int ok=!atomic_load(&p->cancelled)&&!atomic_load(&o->invalid)&&!fixed_process_failure(0)&&axiom_origin_identity_current(&o->startup)&&monotonic_ns()<p->deadline;
  if(ok)ok=axiom_origin_session_assert(o->session)&&axiom_origin_identity_current(&o->startup)&&!fixed_process_failure(0)&&monotonic_ns()<p->deadline;
  if(ok&&!atomic_load(&p->cancelled)&&!atomic_load(&o->invalid))atomic_store(&p->success,1);else revoke_origin(o);
  atomic_flag_clear(&o->busy);dispatch_semaphore_signal(p->done);release_probe(p);
 });
 uint64_t now=monotonic_ns();int64_t remaining=now<p->deadline?(int64_t)(p->deadline-now):0;
 int timeout=dispatch_semaphore_wait(p->done,dispatch_time(DISPATCH_TIME_NOW,remaining))!=0;
 if(timeout){atomic_store(&p->cancelled,1);revoke_origin(o);}
 int ok=!timeout&&monotonic_ns()<p->deadline&&!atomic_load(&o->invalid)&&axiom_origin_session_locally_valid(o->session)&&atomic_load(&p->success);
 release_probe(p);if(!ok)return refuse(env,"origin_current_unavailable");
 napi_value result;if(napi_get_undefined(env,&result)!=napi_ok){revoke_origin(o);return refuse(env,"origin_result_unavailable");}return result;
}
static int close_bootstrap_input(void){
 int closed=close(STDIN_FILENO)==0;int fd=open("/dev/null",O_RDONLY|O_CLOEXEC);if(fd!=STDIN_FILENO){if(fd>=0)close(fd);return 0;}return closed;
}
static napi_value consume_bootstrap(napi_env env,napi_callback_info info){
 size_t argc=1;void*value=NULL;napi_value argument,result=NULL,dsn,vault,session;void*bytes=NULL,*vault_bytes=NULL,*session_bytes=NULL;size_t session_length=0;
 if(napi_get_cb_info(env,info,&argc,&argument,NULL,&value)!=napi_ok||!value)return refuse(env,"origin_bootstrap_unavailable");
 NativeOrigin*o=value;
 /* Reservation is irreversible, including invalid calls and Node allocation
  * failures. It precedes the first read and every material-bearing Node value. */
 if(atomic_flag_test_and_set(&o->bootstrap_attempted)){revoke_origin(o);return refuse(env,"origin_bootstrap_consumed");}
 struct pipe_fdinfo input_pipe;
 AxiomPrivateBinding binding={0};AxiomPrivateMaterial material={0};int ok=0;
 if(proc_pidfdinfo(getpid(),STDIN_FILENO,PROC_PIDFDPIPEINFO,&input_pipe,sizeof(input_pipe))!=(int)sizeof(input_pipe)||argc||!pthread_main_np()||atomic_load(&o->invalid)||fixed_process_failure(1)||!axiom_origin_identity_current(&o->startup)||!axiom_origin_session_locally_valid(o->session))goto done;
 if(atomic_flag_test_and_set(&o->busy))goto done;
 int current=axiom_origin_session_assert(o->session);atomic_flag_clear(&o->busy);if(!current)goto done;
 if(!axiom_origin_session_bootstrap_binding(o->session,&binding.epoch,&binding.deadline,binding.client,binding.broker)||!axiom_private_frame_read(STDIN_FILENO,&binding,&material))goto done;
 if(!axiom_origin_session_assert(o->session)||!axiom_origin_session_locally_valid(o->session)||monotonic_ns()>=binding.deadline||fixed_process_failure(1)||!axiom_origin_identity_current(&o->startup))goto done;
 if(!close_bootstrap_input())goto done;
 if(napi_create_object(env,&result)!=napi_ok||napi_create_string_utf8(env,(char*)material.datasource,material.datasource_length,&dsn)!=napi_ok||napi_create_arraybuffer(env,32,&bytes,&vault)!=napi_ok)goto done;
 vault_bytes=bytes;memcpy(bytes,material.vault,32);if(napi_create_typedarray(env,napi_uint8_array,32,vault,0,&vault)!=napi_ok||napi_create_arraybuffer(env,material.session_length,&bytes,&session)!=napi_ok)goto done;
 session_bytes=bytes;session_length=material.session_length;memcpy(bytes,material.session,material.session_length);if(napi_create_typedarray(env,napi_uint8_array,material.session_length,session,0,&session)!=napi_ok||napi_set_named_property(env,result,"datasource",dsn)!=napi_ok||napi_set_named_property(env,result,"vaultKey",vault)!=napi_ok||napi_set_named_property(env,result,"sessionSigningKey",session)!=napi_ok||napi_object_freeze(env,result)!=napi_ok)goto done;
 ok=1;o->bootstrap_consumed=1;
 done:axiom_private_material_wipe(&material);memset(&binding,0,sizeof(binding));
 if(!ok){if(vault_bytes)memset(vault_bytes,0,32);if(session_bytes)memset(session_bytes,0,session_length);close_bootstrap_input();revoke_origin(o);return refuse(env,"origin_bootstrap_unavailable");}return result;
}
typedef struct{NativeOrigin*origin;napi_async_work work;napi_deferred deferred;AxiomRequestEvent event;int ok;} RequestWait;
static void request_wait_execute(napi_env env,void*value){(void)env;RequestWait*w=value;w->ok=axiom_origin_session_next_request(w->origin->session,&w->event);}
static void request_wait_complete(napi_env env,napi_status status,void*value){
 RequestWait*w=value;NativeOrigin*o=w->origin;if(!env)revoke_origin(o);o->request_waiting=0;napi_value result=NULL,id=NULL,kind=NULL,bytes=NULL,buffer=NULL;void*data=NULL;
 int ok=status==napi_ok&&w->ok&&!atomic_load(&o->invalid)&&napi_create_object(env,&result)==napi_ok&&napi_create_string_utf8(env,w->event.id,64,&id)==napi_ok&&napi_create_string_utf8(env,w->event.cancelled?"cancel":"request",NAPI_AUTO_LENGTH,&kind)==napi_ok&&napi_set_named_property(env,result,"id",id)==napi_ok&&napi_set_named_property(env,result,"kind",kind)==napi_ok;
 if(ok&&!w->event.cancelled){ok=napi_create_arraybuffer(env,w->event.length,&data,&buffer)==napi_ok;if(ok){memcpy(data,w->event.bytes,w->event.length);ok=napi_create_typedarray(env,napi_uint8_array,w->event.length,buffer,0,&bytes)==napi_ok&&napi_set_named_property(env,result,"bytes",bytes)==napi_ok;}}
 if(ok)ok=napi_object_freeze(env,result)==napi_ok;
 if(ok&&env)napi_resolve_deferred(env,w->deferred,result);else if(env){napi_value message,error;if(napi_create_string_utf8(env,"origin_request_unavailable",NAPI_AUTO_LENGTH,&message)==napi_ok&&napi_create_error(env,NULL,message,&error)==napi_ok)napi_reject_deferred(env,w->deferred,error);revoke_origin(o);}
 memset(&w->event,0,sizeof(w->event));if(env)napi_delete_async_work(env,w->work);release_origin(o);free(w);
}
static napi_value next_request_event(napi_env env,napi_callback_info info){
 size_t argc=1;void*value=NULL;napi_value arg,promise,name;if(napi_get_cb_info(env,info,&argc,&arg,NULL,&value)!=napi_ok||argc||!value)return refuse(env,"origin_request_zero_arguments_required");NativeOrigin*o=value;
 if(!pthread_main_np()||atomic_load(&o->invalid)||o->request_waiting||!o->bootstrap_consumed||!axiom_origin_session_locally_valid(o->session))return refuse(env,"origin_request_wait_unavailable");
 RequestWait*w=calloc(1,sizeof(*w));if(!w)return refuse(env,"origin_request_allocation_unavailable");w->origin=o;
 if(napi_create_promise(env,&w->deferred,&promise)!=napi_ok||napi_create_string_utf8(env,"axiom owned request",NAPI_AUTO_LENGTH,&name)!=napi_ok||napi_create_async_work(env,NULL,name,request_wait_execute,request_wait_complete,w,&w->work)!=napi_ok){free(w);return refuse(env,"origin_request_wait_unavailable");}
 o->request_waiting=1;atomic_fetch_add(&o->refs,1);if(napi_queue_async_work(env,w->work)!=napi_ok){o->request_waiting=0;napi_delete_async_work(env,w->work);release_origin(o);free(w);return refuse(env,"origin_request_wait_unavailable");}return promise;
}
static int request_id_arg(napi_env env,napi_value arg,unsigned char id[32]){char text[65];size_t length=0;napi_valuetype type;if(napi_typeof(env,arg,&type)!=napi_ok||type!=napi_string||napi_get_value_string_utf8(env,arg,NULL,0,&length)!=napi_ok||length!=64||napi_get_value_string_utf8(env,arg,text,sizeof(text),&length)!=napi_ok||length!=64)return 0;return ax_request_id_parse(text,id);}
static napi_value assert_request_current(napi_env env,napi_callback_info info){
 size_t argc=2;void*value=NULL;napi_value args[2],result;unsigned char id[32];if(napi_get_cb_info(env,info,&argc,args,NULL,&value)!=napi_ok||argc!=1||!value||!request_id_arg(env,args[0],id))return refuse(env,"origin_request_id_required");NativeOrigin*o=value;
 uint64_t start=monotonic_ns();if(!pthread_main_np()||atomic_load(&o->invalid)||fixed_process_failure(1)||!axiom_origin_identity_current(&o->startup)||!axiom_origin_session_request_current(o->session,id)||!axiom_origin_identity_current(&o->startup)||fixed_process_failure(1)||monotonic_ns()<start||monotonic_ns()-start>AXIOM_ORIGIN_EXCHANGE_NS)return refuse(env,"origin_request_current_unavailable");
 if(napi_get_undefined(env,&result)!=napi_ok)return refuse(env,"origin_request_current_unavailable");return result;
}
static napi_value complete_request(napi_env env,napi_callback_info info){
 size_t argc=3;void*value=NULL;napi_value args[3],result;unsigned char id[32];napi_typedarray_type type;size_t length=0,offset=0;void*data=NULL;napi_value buffer;
 if(napi_get_cb_info(env,info,&argc,args,NULL,&value)!=napi_ok||argc!=2||!value||!request_id_arg(env,args[0],id)||napi_get_typedarray_info(env,args[1],&type,&length,&data,&buffer,&offset)!=napi_ok||type!=napi_uint8_array||!data||length>AX_REQUEST_FRAME_CAP)return refuse(env,"origin_request_response_invalid");NativeOrigin*o=value;
 if(!pthread_main_np()||atomic_load(&o->invalid)||!axiom_origin_session_complete_request(o->session,id,data,length))return refuse(env,"origin_request_completion_unavailable");if(napi_get_undefined(env,&result)!=napi_ok)return refuse(env,"origin_request_completion_unavailable");return result;
}
static napi_value close_runtime(napi_env env,napi_callback_info info){size_t argc=1;void*value=NULL;napi_value arg,result;if(napi_get_cb_info(env,info,&argc,&arg,NULL,&value)!=napi_ok||argc||!value)return refuse(env,"origin_close_zero_arguments_required");revoke_origin(value);if(napi_get_undefined(env,&result)!=napi_ok)return refuse(env,"origin_close_unavailable");return result;}
static napi_value initialize(napi_env env,napi_value exports){
 if(atomic_flag_test_and_set(&constructor_attempted))return refuse(env,"origin_fresh_constructor_required");
 const char*reason=fixed_process_failure(1);if(reason)return refuse(env,reason);
 /* Actual protected-resource inventory is required here before connection setup.
  * Only the new typed protected-resource collector is permitted; never the old
  * all-maxwrite classifier or the old in-Node profile initializer. */
 AxiomProtectedInventoryReport observed=axiom_protected_inventory_own(AXIOM_ISSUER_PACKAGE_ROOT,AXIOM_ISSUER_IMAGE_BACKING);
 if(observed.decision!=AXIOM_RESOURCE_OBSERVED||!observed.descriptor_scan_complete||!observed.region_scan_complete||!observed.stable)return refuse(env,"origin_protected_resources_unavailable");
 NativeOrigin*o=calloc(1,sizeof(*o));if(!o)return refuse(env,"origin_private_state_unavailable");
 o->queue=dispatch_queue_create("axiom.issuer.current-origin",DISPATCH_QUEUE_SERIAL);if(!o->queue){free(o);return refuse(env,"origin_private_queue_unavailable");}
 atomic_init(&o->refs,1);atomic_init(&o->invalid,0);atomic_flag_clear(&o->busy);atomic_flag_clear(&o->bootstrap_attempted);
 void*node_code=dlsym(RTLD_DEFAULT,"napi_get_version");
 if(!axiom_origin_identity_capture((uintptr_t)&initialize,(uintptr_t)node_code,&o->startup)){dispatch_release(o->queue);free(o);return refuse(env,"origin_loaded_artifact_identity_unavailable");}
 o->session=axiom_origin_session_open();if(!o->session){dispatch_release(o->queue);free(o);return refuse(env,"origin_startup_unavailable");}
 if(!axiom_origin_identity_current(&o->startup)){cleanup_origin(o);return refuse(env,"origin_startup_resource_changed");}
 napi_value consume,probe,next,complete,request_probe,close;if(napi_create_function(env,"consumeBootstrapResources",NAPI_AUTO_LENGTH,consume_bootstrap,o,&consume)!=napi_ok||napi_create_function(env,"assertCurrentOrigin",NAPI_AUTO_LENGTH,assert_current,o,&probe)!=napi_ok||napi_create_function(env,"nextRequestEvent",NAPI_AUTO_LENGTH,next_request_event,o,&next)!=napi_ok||napi_create_function(env,"completeRequest",NAPI_AUTO_LENGTH,complete_request,o,&complete)!=napi_ok||napi_create_function(env,"assertRequestCurrent",NAPI_AUTO_LENGTH,assert_request_current,o,&request_probe)!=napi_ok||napi_create_function(env,"closeRuntime",NAPI_AUTO_LENGTH,close_runtime,o,&close)!=napi_ok||napi_add_env_cleanup_hook(env,cleanup_origin,o)!=napi_ok){cleanup_origin(o);return refuse(env,"origin_private_session_unavailable");}
 if(napi_object_freeze(env,probe)!=napi_ok||napi_set_named_property(env,exports,"assertCurrentOrigin",probe)!=napi_ok||napi_object_freeze(env,consume)!=napi_ok||napi_set_named_property(env,exports,"consumeBootstrapResources",consume)!=napi_ok||napi_object_freeze(env,next)!=napi_ok||napi_set_named_property(env,exports,"nextRequestEvent",next)!=napi_ok||napi_object_freeze(env,complete)!=napi_ok||napi_set_named_property(env,exports,"completeRequest",complete)!=napi_ok||napi_object_freeze(env,request_probe)!=napi_ok||napi_set_named_property(env,exports,"assertRequestCurrent",request_probe)!=napi_ok||napi_object_freeze(env,close)!=napi_ok||napi_set_named_property(env,exports,"closeRuntime",close)!=napi_ok||napi_object_freeze(env,exports)!=napi_ok){revoke_origin(o);return refuse(env,"origin_exports_unavailable");}
 return exports;
}
NAPI_MODULE(axiom_origin_guard,initialize)
