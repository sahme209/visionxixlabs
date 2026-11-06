/* GREEN-phase shared helper matrix; all ACL/memory effects are inert fixtures. */
#include "platform_stubs.h"
#include "protected_acl_empty.h"
static void checked_refusal(void){assert(!ax_acl_is_empty(&observed_acl));assert(input_frees==0);assert(allocations==buffer_frees);assert(descriptor_open&&close_calls==0);}
int main(void){
 reset();assert(ax_acl_is_empty(&observed_acl));assert(input_frees==0&&empty_frees==1&&allocations==buffer_frees&&descriptor_open&&close_calls==0);
 reset();observed_acl.empty=0;checked_refusal();
 reset();observed_size=9;checked_refusal();
 for(int which=0;which<2;which++)for(int shape=0;shape<3;shape++){
  reset();ssize_t bad=shape==0?0:shape==1?-1:65537;if(which)empty_size=bad;else observed_size=bad;checked_refusal();
 }
 reset();init_fail=1;checked_refusal();
 for(int index=1;index<=2;index++){
  reset();fail_allocation_at=index;checked_refusal();assert(allocation_calls==index);
  reset();fail_copy_at=index;checked_refusal();assert(copy_calls==index);
  reset();short_copy_at=index;checked_refusal();assert(copy_calls==index);
 }
 reset();empty_free_fail=1;checked_refusal();
 reset();assert(!ax_acl_is_empty(NULL));assert(input_frees==0&&empty_frees==0&&allocations==0&&descriptor_open&&close_calls==0);
 puts("PASS shared helper opaque empty/present/both-size/both-allocation/both-copy/cleanup matrix");return 0;
}
