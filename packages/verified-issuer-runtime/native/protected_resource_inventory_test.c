#define _DARWIN_C_SOURCE 1
#include "protected_resource_inventory.h"
#include <assert.h>
#include <fcntl.h>
#include <mach/vm_prot.h>
#include <stdio.h>
int main(void){AxiomProtectedResources r={10,20,30,1};AxiomProtectedRegion m={0};m.max_protection=VM_PROT_READ|VM_PROT_WRITE;m.protection=VM_PROT_READ;m.vnode_present=1;m.device=20;m.inode=30;
 assert(axiom_classify_protected_descriptor(&r,20,30,O_RDWR)==AXIOM_RESOURCE_VIOLATION);
 assert(axiom_classify_protected_descriptor(&r,20,30,O_RDONLY)==AXIOM_RESOURCE_OBSERVED);
 assert(axiom_classify_protected_descriptor(&r,10,99,O_WRONLY)==AXIOM_RESOURCE_VIOLATION);
 assert(axiom_classify_protected_region(&r,&m)==AXIOM_RESOURCE_VIOLATION);
 m.device=10;m.inode=88;assert(axiom_classify_protected_region(&r,&m)==AXIOM_RESOURCE_OBSERVED);
 m.device=0;m.inode=0;m.vnode_present=0;assert(axiom_classify_protected_region(&r,&m)==AXIOM_RESOURCE_OBSERVED);
 r.root_readonly=0;assert(axiom_classify_protected_region(&r,&m)==AXIOM_RESOURCE_INCOMPLETE);
 puts("resource_classifier_cases=7 observations_not_origin");return 0;}
