/* Pure stub executable: exact production predicate, no protected operation. */
#include "platform_stubs.h"
#if __has_include("protected_acl_empty.h")
#include "protected_acl_empty.h"
#endif
#include "subject_protected_fd.inc"
static void guarded_effect(void){if(protected_fd(100,0,NULL))effect_calls++;}
int main(void){
 reset();observed_acl.empty=0;guarded_effect();
 /* Meaningful old-code RED: documented successful nonempty entry returns0. */
 if(effect_calls!=0){puts("FAIL nonempty ACL reached guarded effect");return 1;}
 assert(input_frees==1);
 reset();guarded_effect();assert(effect_calls==1&&input_frees==1);
 reset();acquire_fail=1;guarded_effect();assert(effect_calls==0&&input_frees==0);
 reset();input_free_fail=1;guarded_effect();assert(effect_calls==0&&input_frees==1);
 reset();fake_uid=501;guarded_effect();assert(effect_calls==0&&acquire_calls==0);
 reset();fake_mode=0775;guarded_effect();assert(effect_calls==0&&acquire_calls==0);
 reset();fake_link=2;guarded_effect();assert(effect_calls==0&&acquire_calls==0);
 puts("PASS actual protected_fd predicate with inert fstat/ACL and guarded effect");return 0;
}
