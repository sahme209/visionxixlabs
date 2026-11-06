/* Actual closed main and actual fixed FD guard; every effect API is inert. */
#define fstat maintenance_mock_fstat
#define acl_get_fd_np maintenance_mock_acl
#define acl_init maintenance_mock_acl_init
#define acl_size maintenance_mock_acl_size
#define acl_copy_ext maintenance_mock_acl_copy_ext
#define acl_free maintenance_mock_free
/* Closed admission is inert; every dormant operational edge is also trapped. */
#define ax_fixture_maintenance_current maintenance_mock_current
#define getuid maintenance_mock_getuid
#define geteuid maintenance_mock_geteuid
#define _NSGetExecutablePath maintenance_mock_executable
#define realpath maintenance_mock_realpath
#define lstat maintenance_mock_lstat
#define open maintenance_mock_open
#define openat maintenance_mock_openat
#define close maintenance_mock_close
#define axiom_origin_loaded_file_matches maintenance_mock_loaded
#define ax_synthetic_native_provision maintenance_mock_provision
#define ax_fixture_commit_and_run_controller maintenance_mock_controller
#define ax_fixture_discard_authorization maintenance_mock_discard
#define printf maintenance_mock_printf
#define main ax_maintenance_entry
#ifndef AX_MAINTENANCE_TEST_SOURCE
#define AX_MAINTENANCE_TEST_SOURCE "../synthetic_resource_maintenance_main.c"
#endif
#include AX_MAINTENANCE_TEST_SOURCE
#undef main
#include <assert.h>
int maintenance_mock_current(void){return 0;}
uid_t maintenance_mock_getuid(void){assert(0);return 0;}
uid_t maintenance_mock_geteuid(void){assert(0);return 0;}
int maintenance_mock_executable(char*p,uint32_t*n){(void)p;(void)n;assert(0);return -1;}
char*maintenance_mock_realpath(const char*p,char*out){(void)p;(void)out;assert(0);return NULL;}
int maintenance_mock_lstat(const char*p,struct stat*out){(void)p;(void)out;assert(0);return -1;}
int maintenance_mock_open(const char*p,int flags,...){(void)p;(void)flags;assert(0);return -1;}
int maintenance_mock_openat(int fd,const char*p,int flags,...){(void)fd;(void)p;(void)flags;assert(0);return -1;}
int maintenance_mock_close(int fd){(void)fd;assert(0);return -1;}
int maintenance_mock_loaded(uintptr_t address,const struct stat*s){(void)address;(void)s;assert(0);return 0;}
AxSyntheticProvisionResult maintenance_mock_provision(void){assert(0);return (AxSyntheticProvisionResult){0};}
int maintenance_mock_controller(void){assert(0);return 0;}
void maintenance_mock_discard(void){assert(0);}
int maintenance_mock_printf(const char*format,...){(void)format;assert(0);return -1;}
static struct stat fixture;
static int absent_acl,copy_result,free_result,reference_free_result;
int maintenance_mock_fstat(int fd,struct stat*out){assert(fd==11);*out=fixture;return 0;}
acl_t maintenance_mock_acl(int fd,acl_type_t type){assert(fd==11&&type==ACL_TYPE_EXTENDED);return absent_acl?NULL:(acl_t)(uintptr_t)0x100;}
acl_t maintenance_mock_acl_init(int n){assert(n==0);return (acl_t)(uintptr_t)0x200;}
ssize_t maintenance_mock_acl_size(acl_t a){assert((uintptr_t)a==0x100||(uintptr_t)a==0x200);return 8;}
ssize_t maintenance_mock_acl_copy_ext(void*p,acl_t a,ssize_t n){assert(((uintptr_t)a==0x100||(uintptr_t)a==0x200)&&n==8);if(copy_result<0)return -1;memset(p,copy_result&&(uintptr_t)a==0x100?1:0,8);return 8;}
int maintenance_mock_free(void*acl){assert((uintptr_t)acl==0x100||(uintptr_t)acl==0x200);return (uintptr_t)acl==0x100?free_result:reference_free_result;}
int main(void){
 char*argv[]={"not-an-installed-program",0};assert(ax_maintenance_entry(1,argv)==69);assert(ax_maintenance_entry(2,argv)==69);
 memset(&fixture,0,sizeof(fixture));fixture.st_mode=S_IFDIR|0755;fixture.st_nlink=2;assert(protected_fd(11,1));
 fixture.st_uid=501;assert(!protected_fd(11,1));fixture.st_uid=0;
 fixture.st_mode=S_IFDIR|0775;assert(!protected_fd(11,1));fixture.st_mode=S_IFDIR|0755;
 absent_acl=1;assert(!protected_fd(11,1));absent_acl=0;
 copy_result=1;assert(!protected_fd(11,1));copy_result=-1;assert(!protected_fd(11,1));copy_result=0;
 free_result=-1;assert(!protected_fd(11,1));free_result=0;
 reference_free_result=-1;assert(!protected_fd(11,1));reference_free_result=0;
 fixture.st_mode=S_IFREG|0755;fixture.st_nlink=1;assert(protected_fd(11,0));fixture.st_nlink=2;assert(!protected_fd(11,0));
 fixture.st_nlink=1;assert(!protected_fd(11,1));puts("maintenance actual closed main and FD guard with inert platform mocks: PASS");return 0;
}
