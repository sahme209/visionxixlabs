#define _DARWIN_C_SOURCE 1
#define NAPI_VERSION 8
#include "origin_config.h"
#include "origin_session.h"
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
typedef struct {atomic_uint refs;atomic_int invalid;atomic_flag busy;AxiomOriginSession*session;AxiomOriginProcessIdentity startup;dispatch_queue_t queue;} NativeOrigin;
typedef struct {atomic_uint refs;atomic_int cancelled;atomic_int success;NativeOrigin*origin;dispatch_semaphore_t done;uint64_t deadline;} NativeProbe;
static uint64_t monotonic_ns(void){struct timespec t;if(clock_gettime(CLOCK_MONOTONIC,&t)||t.tv_sec<0||t.tv_nsec<0)return UINT64_MAX;return(uint64_t)t.tv_sec*1000000000ULL+(uint64_t)t.tv_nsec;}
static void release_origin(NativeOrigin*o){if(atomic_fetch_sub(&o->refs,1)==1){axiom_origin_session_destroy(o->session);dispatch_release(o->queue);free(o);}}
static void revoke_origin(void*value){NativeOrigin*o=value;if(!o)return;atomic_store(&o->invalid,1);axiom_origin_session_revoke(o->session);}
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
 atomic_init(&o->refs,1);atomic_init(&o->invalid,0);atomic_flag_clear(&o->busy);
 void*node_code=dlsym(RTLD_DEFAULT,"napi_get_version");
 if(!axiom_origin_identity_capture((uintptr_t)&initialize,(uintptr_t)node_code,&o->startup)){dispatch_release(o->queue);free(o);return refuse(env,"origin_loaded_artifact_identity_unavailable");}
 o->session=axiom_origin_session_open();if(!o->session){dispatch_release(o->queue);free(o);return refuse(env,"origin_startup_unavailable");}
 if(!axiom_origin_identity_current(&o->startup)){cleanup_origin(o);return refuse(env,"origin_startup_resource_changed");}
 napi_value probe;if(napi_create_function(env,"assertCurrentOrigin",NAPI_AUTO_LENGTH,assert_current,o,&probe)!=napi_ok||napi_add_env_cleanup_hook(env,cleanup_origin,o)!=napi_ok){cleanup_origin(o);return refuse(env,"origin_private_session_unavailable");}
 if(napi_object_freeze(env,probe)!=napi_ok||napi_set_named_property(env,exports,"assertCurrentOrigin",probe)!=napi_ok||napi_object_freeze(env,exports)!=napi_ok){revoke_origin(o);return refuse(env,"origin_exports_unavailable");}
 return exports;
}
NAPI_MODULE(axiom_origin_guard,initialize)
