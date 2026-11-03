#define _DARWIN_C_SOURCE 1
#define NAPI_VERSION 8
#include "origin_config.h"
#include "origin_session.h"
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
static atomic_flag constructor_attempted=ATOMIC_FLAG_INIT;
static napi_value initialize(napi_env env,napi_value exports);
static int same_file(const char*a,const char*b){struct stat x,y;return !stat(a,&x)&&!stat(b,&y)&&x.st_dev==y.st_dev&&x.st_ino==y.st_ino;}
static const char* fixed_process_failure(void){
 if(!AXIOM_ISSUER_PACKAGE_ROOT[0]||!AXIOM_ISSUER_IMAGE_BACKING[0])return "origin_package_unprepared";
 if(!pthread_main_np())return "origin_main_thread_required";
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
static napi_value assert_current(napi_env env,napi_callback_info info){
 size_t argc=1;void*value=NULL;napi_value argument;
 if(napi_get_cb_info(env,info,&argc,&argument,NULL,&value)!=napi_ok||argc!=0||!value)return refuse(env,"origin_probe_zero_arguments_required");
 const char*reason=fixed_process_failure();if(reason){axiom_origin_session_revoke(value);return refuse(env,reason);}
 if(!axiom_origin_session_assert(value))return refuse(env,"origin_current_unavailable");
 napi_value result;if(napi_get_undefined(env,&result)!=napi_ok)return refuse(env,"origin_result_unavailable");return result;
}
static napi_value initialize(napi_env env,napi_value exports){
 if(atomic_flag_test_and_set(&constructor_attempted))return refuse(env,"origin_fresh_constructor_required");
 const char*reason=fixed_process_failure();if(reason)return refuse(env,reason);
 /* Actual protected-resource inventory is required here before connection setup.
  * Only the new typed protected-resource collector is permitted; never the old
  * all-maxwrite classifier or the old in-Node profile initializer. */
 AxiomProtectedInventoryReport observed=axiom_protected_inventory_own(AXIOM_ISSUER_PACKAGE_ROOT,AXIOM_ISSUER_IMAGE_BACKING);
 if(observed.decision!=AXIOM_RESOURCE_OBSERVED||!observed.descriptor_scan_complete||!observed.region_scan_complete||!observed.stable)return refuse(env,"origin_protected_resources_unavailable");
 AxiomOriginSession*session=axiom_origin_session_open();if(!session)return refuse(env,"origin_startup_unavailable");
 napi_value probe;if(napi_create_function(env,"assertCurrentOrigin",NAPI_AUTO_LENGTH,assert_current,session,&probe)!=napi_ok||napi_add_env_cleanup_hook(env,axiom_origin_session_destroy,session)!=napi_ok){axiom_origin_session_destroy(session);return refuse(env,"origin_private_session_unavailable");}
 if(napi_object_freeze(env,probe)!=napi_ok||napi_set_named_property(env,exports,"assertCurrentOrigin",probe)!=napi_ok||napi_object_freeze(env,exports)!=napi_ok){axiom_origin_session_revoke(session);return refuse(env,"origin_exports_unavailable");}
 return exports;
}
NAPI_MODULE(axiom_origin_guard,initialize)
