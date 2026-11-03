/* Compile-only N-API component. DO NOT require/dlopen in local tests: successful
 * initialization would invoke the separately unapproved restriction experiment.
 * Current canonical CJS never loads it and still returns unavailable. */
#define _DARWIN_C_SOURCE 1
#define NAPI_VERSION 8
#include <node_api.h>
#include "capability_inventory.h"
#include <sandbox.h>
#include <dlfcn.h>
#include <mach-o/dyld.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <limits.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>
static napi_value initialize(napi_env env,napi_value exports);
static int canonical_readonly_root(char root[PATH_MAX]){
 static const char suffix[]="/node_modules/@axiom/verified-issuer-runtime/native/capability_guard.node";
 Dl_info image;if(!dladdr((const void*)&initialize,&image)||!image.dli_fname)return 0;
 char actual[PATH_MAX];if(!realpath(image.dli_fname,actual)||strcmp(actual,image.dli_fname))return 0;
 size_t n=strlen(actual),suffix_n=sizeof(suffix)-1;if(n<=suffix_n||strcmp(actual+n-suffix_n,suffix))return 0;
 size_t root_n=n-suffix_n;if(root_n>=PATH_MAX)return 0;memcpy(root,actual,root_n);root[root_n]=0;
 char canonical[PATH_MAX];struct stat s;struct statfs fs;
 if(!realpath(root,canonical)||strcmp(root,canonical)||lstat(root,&s)||!S_ISDIR(s.st_mode)||statfs(root,&fs)||!(fs.f_flags&MNT_RDONLY)||strcmp(fs.f_mntonname,root))return 0;
 char executable[PATH_MAX],resolved[PATH_MAX],expected[PATH_MAX];uint32_t size=sizeof(executable);
 if(_NSGetExecutablePath(executable,&size)||!realpath(executable,resolved)||snprintf(expected,sizeof(expected),"%s/__axiom_runtime__/node",root)>=(int)sizeof(expected)||strcmp(resolved,expected))return 0;
 return 1;
}
static napi_value unavailable(napi_env env,const char*reason){napi_throw_error(env,"axiom_native_capability_unavailable",reason);return NULL;}
static napi_value initialize(napi_env env,napi_value exports){
 char root[PATH_MAX];if(!canonical_readonly_root(root))return unavailable(env,"canonical_readonly_packaged_runtime_required");
 AxiomInventoryReport before=axiom_inventory_own_process(root);
 if(before.decision!=AXIOM_META_ALLOWED||!before.stable)return unavailable(env,before.reason);
 char*error=NULL;
 int installed=sandbox_init(kSBXProfileNoWrite,SANDBOX_NAMED,&error);
 if(error)sandbox_free_error(error);
 if(installed!=0)return unavailable(env,"fixed_nowrite_installation_unavailable");
 AxiomInventoryReport after=axiom_inventory_own_process(root);
 if(after.decision!=AXIOM_META_ALLOWED||!after.stable)return unavailable(env,after.reason);
 /* No callable methods, initializer token, authority boolean or digest. Actual
  * sealed-package/compiled-consumer qualification remains mandatory elsewhere.
  * The fixed CJS main must reverify closure after this component completes. */
 if(napi_object_freeze(env,exports)!=napi_ok)return unavailable(env,"native_exports_unavailable");
 return exports;
}
NAPI_MODULE(axiom_capability_guard,initialize)
