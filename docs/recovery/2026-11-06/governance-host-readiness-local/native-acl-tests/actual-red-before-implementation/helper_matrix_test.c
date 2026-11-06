/* GREEN-phase only after meaningful caller RED and reviewed implementation. */
#include "platform_stubs.h"
#include "protected_acl_empty.h"
static void checked_refusal(void){assert(!ax_acl_is_empty(&observed_acl));assert(input_frees==0);assert(allocations==buffer_frees);}
int main(void){
 reset();assert(ax_acl_is_empty(&observed_acl));assert(input_frees==0&&empty_frees==1&&allocations==buffer_frees);
 reset();observed_acl.empty=0;checked_refusal();
 reset();observed_size=9;checked_refusal();
 reset();observed_size=0;checked_refusal();
 reset();observed_size=-1;checked_refusal();
 reset();observed_size=65537;checked_refusal();
 reset();empty_size=65537;checked_refusal();
 reset();init_fail=1;checked_refusal();
 reset();alloc_fail=1;checked_refusal();
 reset();copy_fail=1;checked_refusal();
 reset();copy_short=1;checked_refusal();
 reset();empty_free_fail=1;checked_refusal();
 reset();assert(!ax_acl_is_empty(NULL));assert(input_frees==0);
 puts("PASS shared helper opaque empty/present/error/cleanup matrix; borrowed input never freed");return 0;
}
