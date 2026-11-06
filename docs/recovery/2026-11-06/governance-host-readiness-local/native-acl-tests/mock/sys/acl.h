#ifndef AX_TEST_MOCK_ACL_H
#define AX_TEST_MOCK_ACL_H
#include <sys/types.h>
typedef struct AxMockAcl *acl_t;
typedef void *acl_entry_t;
typedef int acl_type_t;
#define ACL_TYPE_EXTENDED 0x100
#define ACL_FIRST_ENTRY 0
acl_t test_acl_get_fd_np(int,acl_type_t);
int test_acl_get_entry(acl_t,int,acl_entry_t*);
int test_acl_free(void*);
acl_t test_acl_init(int);
ssize_t test_acl_size(acl_t);
ssize_t test_acl_copy_ext(void*,acl_t,ssize_t);
#define acl_get_fd_np test_acl_get_fd_np
#define acl_get_entry test_acl_get_entry
#define acl_free test_acl_free
#define acl_init test_acl_init
#define acl_size test_acl_size
#define acl_copy_ext test_acl_copy_ext
#endif
