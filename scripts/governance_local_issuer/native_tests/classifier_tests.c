#define _DARWIN_C_SOURCE 1
#include "capability_inventory.h"
#include <sys/proc_info.h>
#include <mach/vm_region.h>
#include <mach/vm_prot.h>
#include <fcntl.h>
#include <assert.h>
#include <stdio.h>
/* Synthetic metadata only; no OS profile, descriptors, mappings or process identity. */
int main(void){
 AxiomFdMetadata fd={0,PROX_FDTYPE_VNODE,O_RDONLY,1,1,0};
 assert(axiom_classify_fd(&fd)==AXIOM_META_ALLOWED);
 fd.access_mode=O_RDWR;assert(axiom_classify_fd(&fd)==AXIOM_META_REFUSED);
 fd=(AxiomFdMetadata){4,PROX_FDTYPE_VNODE,O_RDWR,1,0,1};assert(axiom_classify_fd(&fd)==AXIOM_META_REFUSED);
 fd.access_mode=O_WRONLY;assert(axiom_classify_fd(&fd)==AXIOM_META_REFUSED);
 fd.access_mode=O_RDONLY;assert(axiom_classify_fd(&fd)==AXIOM_META_ALLOWED);
 fd.stable=0;assert(axiom_classify_fd(&fd)==AXIOM_META_UNKNOWN);
 fd=(AxiomFdMetadata){1,PROX_FDTYPE_VNODE,O_RDONLY,1,0,1};assert(axiom_classify_fd(&fd)==AXIOM_META_REFUSED);
 fd=(AxiomFdMetadata){1,PROX_FDTYPE_PIPE,O_WRONLY,1,0,0};assert(axiom_classify_fd(&fd)==AXIOM_META_ALLOWED);
 fd=(AxiomFdMetadata){4,PROX_FDTYPE_SOCKET,O_RDWR,1,0,0};assert(axiom_classify_fd(&fd)==AXIOM_META_REFUSED);
 fd.kind=PROX_FDTYPE_PSHM;assert(axiom_classify_fd(&fd)==AXIOM_META_REFUSED);
 fd.kind=999;assert(axiom_classify_fd(&fd)==AXIOM_META_UNKNOWN);
 fd.access_mode=O_RDONLY;assert(axiom_classify_fd(&fd)==AXIOM_META_UNKNOWN); /* unknown kind retained */
 fd=(AxiomFdMetadata){1,PROX_FDTYPE_PIPE,O_RDONLY,1,0,0};assert(axiom_classify_fd(&fd)==AXIOM_META_REFUSED);
 fd.access_mode=O_RDWR;assert(axiom_classify_fd(&fd)==AXIOM_META_REFUSED);
 size_t count=99;assert(axiom_descriptor_count_from_bytes(0,&count)==AXIOM_META_UNKNOWN&&count==0);
 assert(axiom_descriptor_count_from_bytes(-1,&count)==AXIOM_META_UNKNOWN);
 assert(axiom_descriptor_count_from_bytes(1,&count)==AXIOM_META_UNKNOWN);
 assert(axiom_descriptor_count_from_bytes((AXIOM_MAX_FDS+1)*sizeof(struct proc_fdinfo),&count)==AXIOM_META_UNKNOWN);
 assert(axiom_descriptor_count_from_bytes(3*sizeof(struct proc_fdinfo),&count)==AXIOM_META_ALLOWED&&count==3);
 assert(axiom_vm_leaf_progress(0,0,0)==AXIOM_META_UNKNOWN);
 assert(axiom_vm_leaf_progress(UINT64_MAX,1,0)==AXIOM_META_UNKNOWN);
 assert(axiom_vm_leaf_progress(0,1,AXIOM_MAX_VM_REGIONS)==AXIOM_META_UNKNOWN);
 assert(axiom_vm_leaf_progress(4096,4096,0)==AXIOM_META_ALLOWED);
 AxiomVmMetadata vm={VM_PROT_READ|VM_PROT_WRITE,VM_PROT_READ|VM_PROT_WRITE,SM_PRIVATE,0,1};
 assert(axiom_classify_vm(&vm)==AXIOM_META_REFUSED);
 vm.share_mode=SM_COW;assert(axiom_classify_vm(&vm)==AXIOM_META_REFUSED);
 vm.share_mode=SM_SHARED;vm.external_pager=1;assert(axiom_classify_vm(&vm)==AXIOM_META_REFUSED);
 vm.protection=VM_PROT_READ;assert(axiom_classify_vm(&vm)==AXIOM_META_REFUSED); /* upgrade rights */
 vm.external_pager=0;assert(axiom_classify_vm(&vm)==AXIOM_META_REFUSED); /* no path != anonymous proof */
 vm.max_protection=VM_PROT_READ;assert(axiom_classify_vm(&vm)==AXIOM_META_ALLOWED);
 vm.complete=0;assert(axiom_classify_vm(&vm)==AXIOM_META_UNKNOWN);
 vm.complete=1;vm.share_mode=999;assert(axiom_classify_vm(&vm)==AXIOM_META_UNKNOWN);
 vm.share_mode=SM_PRIVATE;vm.protection=8;assert(axiom_classify_vm(&vm)==AXIOM_META_UNKNOWN);
 vm.protection=VM_PROT_WRITE;vm.max_protection=VM_PROT_READ;assert(axiom_classify_vm(&vm)==AXIOM_META_UNKNOWN);
 puts("classifier_assertions=33 metadata_only identity=unavailable");return 0;
}
