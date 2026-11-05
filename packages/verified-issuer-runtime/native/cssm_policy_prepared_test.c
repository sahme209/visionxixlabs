/* Pure publication guard test. Builder/OS call code is dead stripped; verify
 * binary imports before running. No constructor/framework function is invoked.
 * Test-private static state is simulated; it is not construction acceptance. */
#include "cssm_policy_builder.c"
#include <stdio.h>
int main(void){
 int failed=0;
 prepared=(SecAccessRef)(void*)&arena;
 if(ax_cssm_prepared_access()||ax_cssm_prepared_policy())failed++;
 atomic_store_explicit(&ax_cssm_prepared_ready,1,memory_order_release);
 if(ax_cssm_prepared_access()!=prepared||ax_cssm_prepared_policy()!=&arena)failed++;
 atomic_store_explicit(&ax_cssm_prepared_ready,0,memory_order_release);
 if(ax_cssm_prepared_access()||ax_cssm_prepared_policy())failed++;
 printf("%d publication guard failures; simulated state only, no OS constructor\n",failed);
 return failed?1:0;
}
