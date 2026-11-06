/* Actual closed main and actual fixed FD guard; every effect API is inert. */
#define fstat maintenance_mock_fstat
#define acl_get_fd_np maintenance_mock_acl
#define acl_init maintenance_mock_acl_init
#define acl_size maintenance_mock_acl_size
#define acl_copy_ext maintenance_mock_acl_copy_ext
#define acl_free maintenance_mock_free
#define main ax_maintenance_entry
#ifndef AX_MAINTENANCE_TEST_SOURCE
#define AX_MAINTENANCE_TEST_SOURCE "../synthetic_resource_maintenance_main.c"
#endif
#include AX_MAINTENANCE_TEST_SOURCE
#undef main
#include <assert.h>
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
 fixture.st_nlink=1;assert(!protected_fd(11,1));return 0;
}
