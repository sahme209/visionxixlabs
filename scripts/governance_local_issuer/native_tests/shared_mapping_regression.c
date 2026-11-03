#include "capability_inventory.h"
#include <mach/vm_region.h>
#include <mach/vm_prot.h>
#include <stdio.h>
int main(void){
 AxiomVmMetadata file={VM_PROT_READ,7,SM_PRIVATE,1,1};
 AxiomVmMetadata shm={VM_PROT_READ,3,SM_PRIVATE,0,1};
 int bad=axiom_classify_vm(&file)==AXIOM_META_ALLOWED||axiom_classify_vm(&shm)==AXIOM_META_ALLOWED;
 printf("recorded_shared_mapping_false_allow=%d identity=unavailable\n",bad);return bad?1:0;
}
