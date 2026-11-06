#ifndef AX_PROTECTED_ACL_EMPTY_H
#define AX_PROTECTED_ACL_EMPTY_H
#include <sys/acl.h>
#include <stdlib.h>
#include <string.h>
/* Borrowed input: caller retains/frees its acquired ACL and descriptor.
 * Only an exact bounded opaque copy of a freshly allocated empty ACL accepts.
 * Never infer emptiness from acl_get_entry return values or parse ACL layout. */
static inline int ax_acl_is_empty(acl_t input){
 if(!input)return 0;
 acl_t empty=acl_init(0);if(!empty)return 0;
 void*actual_bytes=NULL;void*empty_bytes=NULL;int ok=0;
 ssize_t actual_size=acl_size(input),empty_size=acl_size(empty);
 if(actual_size<=0||empty_size<=0||actual_size>65536||empty_size>65536||actual_size!=empty_size)goto done;
 actual_bytes=malloc((size_t)actual_size);if(!actual_bytes)goto done;
 empty_bytes=malloc((size_t)empty_size);if(!empty_bytes)goto done;
 if(acl_copy_ext(actual_bytes,input,actual_size)!=actual_size||acl_copy_ext(empty_bytes,empty,empty_size)!=empty_size)goto done;
 ok=memcmp(actual_bytes,empty_bytes,(size_t)actual_size)==0;
 done:free(actual_bytes);free(empty_bytes);if(acl_free(empty)!=0)ok=0;return ok;
}
#endif
