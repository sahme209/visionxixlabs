#define _DARWIN_C_SOURCE 1
#ifndef AX_ACL_TEST_PLATFORM_STUBS
#define AX_ACL_TEST_PLATFORM_STUBS
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <sys/stat.h>
#include <mach-o/loader.h>
#include <sys/acl.h>
struct AxMockAcl {int empty;};
static struct AxMockAcl observed_acl={1},empty_acl={1};
static int input_frees,empty_frees,acquire_calls,entry_calls,effect_calls;
static int acquire_fail,init_fail,alloc_fail,copy_fail,copy_short,empty_free_fail,input_free_fail;
static ssize_t observed_size=8,empty_size=8;
static int copy_calls,fail_copy_at,short_copy_at;
static int fake_uid,fake_mode=0755,fake_link=1;
static int test_fstat(int fd,struct stat*s){assert(fd==100);memset(s,0,sizeof *s);s->st_mode=S_IFREG|fake_mode;s->st_uid=(uid_t)fake_uid;s->st_gid=0;s->st_nlink=(nlink_t)fake_link;s->st_size=128;return 0;}
acl_t test_acl_get_fd_np(int fd,acl_type_t t){assert(fd==100&&t==ACL_TYPE_EXTENDED);acquire_calls++;return acquire_fail?NULL:&observed_acl;}
int test_acl_get_entry(acl_t a,int entry,acl_entry_t*out){assert(a==&observed_acl&&entry==ACL_FIRST_ENTRY);entry_calls++;if(a->empty)return -1;*out=(void*)(uintptr_t)7;return 0;}
int test_acl_free(void*a){if(a==&observed_acl){input_frees++;return input_free_fail?-1:0;}assert(a==&empty_acl);empty_frees++;return empty_free_fail?-1:0;}
acl_t test_acl_init(int count){assert(count==0);return init_fail?NULL:&empty_acl;}
ssize_t test_acl_size(acl_t a){assert(a==&observed_acl||a==&empty_acl);return a==&observed_acl?observed_size:empty_size;}
ssize_t test_acl_copy_ext(void*out,acl_t a,ssize_t n){assert(n>0&&n<=65536);copy_calls++;if(copy_fail||copy_calls==fail_copy_at)return -1;memset(out,a->empty?0:1,(size_t)n);return (copy_short||copy_calls==short_copy_at)?n-1:n;}
static int allocations,buffer_frees,allocation_calls,fail_allocation_at,descriptor_open=1,close_calls;
static int test_close(int fd){assert(fd==100);close_calls++;descriptor_open=0;return 0;}
static void*test_malloc(size_t n){allocation_calls++;if(alloc_fail||allocation_calls==fail_allocation_at)return NULL;void*p=malloc(n);if(p)allocations++;return p;}
static void test_free(void*p){if(p)buffer_frees++;free(p);}
static void reset(void){observed_acl.empty=1;input_frees=empty_frees=acquire_calls=entry_calls=effect_calls=0;acquire_fail=init_fail=alloc_fail=copy_fail=copy_short=empty_free_fail=input_free_fail=0;observed_size=empty_size=8;fake_uid=0;fake_mode=0755;fake_link=1;allocations=buffer_frees=allocation_calls=copy_calls=fail_allocation_at=fail_copy_at=short_copy_at=close_calls=0;descriptor_open=1;}
#define close test_close
#define fstat test_fstat
#define malloc test_malloc
#define free test_free
#define AX_SYSTEM_PEER_MAX_BYTES (16U*1024U*1024U)
#endif
