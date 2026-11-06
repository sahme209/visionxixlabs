#define _DARWIN_C_SOURCE 1
#define AX_OWNER_PROFILE 2
#define AX_OWNER_FIXED_UID 501
#define AX_OWNER_FIXED_GID 20
#define AX_FIXTURE_FIXED_UID 502
#define AX_FIXTURE_FIXED_GID 20
#include <sys/stat.h>
#include <sys/acl.h>
#include <mach-o/dyld.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <stdio.h>
static int bad,bad_acl,free_input_failure,free_reference_failure,owner_live=1;static uid_t identity=501;
#define getuid fake_getuid
#define geteuid fake_geteuid
#define getgid fake_getgid
#define getegid fake_getegid
#define realpath fake_realpath
#define lstat fake_lstat
#define stat(...) fake_stat(__VA_ARGS__)
#define acl_get_file fake_acl_get_file
#define acl_init fake_acl_init
#define acl_size fake_acl_size
#define acl_copy_ext fake_acl_copy_ext
#define acl_free fake_acl_free
#define _NSGetExecutablePath fake_NSGetExecutablePath
uid_t fake_getuid(void);uid_t fake_geteuid(void);gid_t fake_getgid(void);gid_t fake_getegid(void);char*fake_realpath(const char*,char*);int fake_lstat(const char*,struct stat*);int fake_stat(const char*,struct stat*);acl_t fake_acl_get_file(const char*,acl_type_t);acl_t fake_acl_init(int);ssize_t fake_acl_size(acl_t);ssize_t fake_acl_copy_ext(void*,acl_t,ssize_t);int fake_acl_free(void*);int fake_NSGetExecutablePath(char*,uint32_t*);
#include "synthetic_fixture_readiness.c"
#include "synthetic_fixture_supplier_context.c"
uid_t fake_getuid(void){return identity;}uid_t fake_geteuid(void){return identity;}gid_t fake_getgid(void){return 20;}gid_t fake_getegid(void){return 20;}
char*fake_realpath(const char*p,char*out){strcpy(out,p);return out;}int fake_lstat(const char*p,struct stat*out){memset(out,0,sizeof *out);out->st_mode=(strstr(p,"AxiomIssuerBroker")||strstr(p,"bootstrap-locators")||strstr(p,"AxiomSyntheticProvisioner"))?S_IFREG|0755:S_IFDIR|0755;out->st_nlink=1;out->st_uid=bad?501:0;return 0;}int fake_stat(const char*p,struct stat*out){return fake_lstat(p,out);}acl_t fake_acl_get_file(const char*p,acl_type_t t){(void)p;(void)t;return(acl_t)1;}acl_t fake_acl_init(int n){assert(n==0);return (acl_t)2;}ssize_t fake_acl_size(acl_t a){assert(a==(acl_t)1||a==(acl_t)2);return 8;}ssize_t fake_acl_copy_ext(void*p,acl_t a,ssize_t n){assert((a==(acl_t)1||a==(acl_t)2)&&n==8);memset(p,bad_acl&&a==(acl_t)1?1:0,8);return 8;}int fake_acl_free(void*p){assert(p==(void*)1||p==(void*)2);return p==(void*)1?free_input_failure:free_reference_failure;}int fake_NSGetExecutablePath(char*p,uint32_t*n){(void)n;strcpy(p,AX_SYNTH_APP "/Contents/Helpers/AxiomSyntheticProvisioner");return 0;}int axiom_owner_binding_current(void){return owner_live;}int axiom_origin_loaded_file_matches(uintptr_t a,const struct stat*s){(void)a;(void)s;return 1;}
int main(void){assert(ax_fixture_selected_principals());assert(ax_fixture_supplier_context_current());bad_acl=1;assert(!ax_fixture_supplier_context_current());bad_acl=0;free_input_failure=-1;assert(!ax_fixture_supplier_context_current());free_input_failure=0;free_reference_failure=-1;assert(!ax_fixture_supplier_context_current());free_reference_failure=0;bad=1;assert(!ax_fixture_supplier_context_current());bad=0;owner_live=0;assert(!ax_fixture_supplier_context_current());owner_live=1;identity=0;assert(ax_fixture_maintenance_current());bad_acl=1;assert(!ax_fixture_maintenance_current());bad_acl=0;free_input_failure=-1;assert(!ax_fixture_maintenance_current());free_input_failure=0;free_reference_failure=-1;assert(!ax_fixture_maintenance_current());free_reference_failure=0;assert(!ax_fixture_supplier_context_current());identity=501;assert(!ax_fixture_maintenance_current());puts("readiness and supplier context actual callers with inert platform mocks: PASS");return 0;}
