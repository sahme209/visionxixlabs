/* Actual closed main and actual fixed FD guard; every effect API is inert. */
#define fstat maintenance_mock_fstat
#define acl_get_fd_np maintenance_mock_acl
#define acl_get_entry maintenance_mock_entry
#define acl_free maintenance_mock_free
#define main ax_maintenance_entry
#ifndef AX_MAINTENANCE_TEST_SOURCE
#define AX_MAINTENANCE_TEST_SOURCE "../synthetic_resource_maintenance_main.c"
#endif
#include AX_MAINTENANCE_TEST_SOURCE
#undef main
#include <assert.h>
static struct stat fixture;
static int absent_acl,entry_result,free_result;
int maintenance_mock_fstat(int fd,struct stat*out){assert(fd==11);*out=fixture;return 0;}
acl_t maintenance_mock_acl(int fd,acl_type_t type){assert(fd==11&&type==ACL_TYPE_EXTENDED);return absent_acl?NULL:(acl_t)(uintptr_t)0x100;}
int maintenance_mock_entry(acl_t acl,int entry_id,acl_entry_t*out){assert(acl==(acl_t)(uintptr_t)0x100&&entry_id==ACL_FIRST_ENTRY);(void)out;return entry_result;}
int maintenance_mock_free(void*acl){assert(acl==(acl_t)(uintptr_t)0x100);return free_result;}
int main(void){
 char*argv[]={"not-an-installed-program",0};assert(ax_maintenance_entry(1,argv)==69);assert(ax_maintenance_entry(2,argv)==69);
 memset(&fixture,0,sizeof(fixture));fixture.st_mode=S_IFDIR|0755;fixture.st_nlink=2;assert(protected_fd(11,1));
 fixture.st_uid=501;assert(!protected_fd(11,1));fixture.st_uid=0;
 fixture.st_mode=S_IFDIR|0775;assert(!protected_fd(11,1));fixture.st_mode=S_IFDIR|0755;
 absent_acl=1;assert(!protected_fd(11,1));absent_acl=0;
 entry_result=1;assert(!protected_fd(11,1));entry_result=-1;assert(!protected_fd(11,1));entry_result=0;
 free_result=-1;assert(!protected_fd(11,1));free_result=0;
 fixture.st_mode=S_IFREG|0755;fixture.st_nlink=1;assert(protected_fd(11,0));fixture.st_nlink=2;assert(!protected_fd(11,0));
 fixture.st_nlink=1;assert(!protected_fd(11,1));return 0;
}
