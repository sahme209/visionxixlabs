#include "synthetic_resource_contract.h"
#include <stdio.h>
int main(void){
 const char *fixed="/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations/c3b7bf334ce56a64575183b7a66e5109/Axiom Synthetic Custodian.app";
 const char *wrong[]={NULL,"","/private/tmp/Axiom.app","/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations/c3b7bf334ce56a64575183b7a66e5109/Axiom Synthetic Custodian.app/","/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations/c3b7bf334ce56a64575183b7a66e5108/Axiom Synthetic Custodian.app"};
 int failures=!ax_synthetic_control_app_matches(fixed);
 for(unsigned i=0;i<sizeof wrong/sizeof wrong[0];i++)if(ax_synthetic_control_app_matches(wrong[i]))failures++;
 printf("%d fixed installation identity failures\n",failures);return failures?1:0;
}
