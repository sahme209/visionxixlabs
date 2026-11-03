#define _DARWIN_C_SOURCE 1
#include "protected_resource_inventory.h"
#include <assert.h>
#include <mach/vm_prot.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/mman.h>
#include <sys/mount.h>
#include <sys/stat.h>
#include <unistd.h>
static void observed(AxiomProtectedInventoryReport r){assert(r.decision==AXIOM_RESOURCE_OBSERVED&&r.descriptor_scan_complete&&r.region_scan_complete&&r.stable);assert(r.unattributed_region_count>0&&r.unattributed_maxwrite_count>0);}
int main(void){
 char directory[]="/private/tmp/axiom-resource-inventory-XXXXXX";assert(mkdtemp(directory));char backing[PATH_MAX],alias[PATH_MAX],other[PATH_MAX];assert(snprintf(backing,sizeof(backing),"%s/backing",directory)>0);assert(snprintf(alias,sizeof(alias),"%s/alias",directory)>0);assert(snprintf(other,sizeof(other),"%s/unrelated",directory)>0);
 int fd=open(backing,O_CREAT|O_EXCL|O_RDWR,0600);assert(fd>=0&&!ftruncate(fd,16384)&&!link(backing,alias));close(fd);
 struct statfs fs;assert(!statfs("/",&fs)&&(fs.f_flags&MNT_RDONLY));
 observed(axiom_protected_inventory_own("/",backing));
 AxiomProtectedInventoryReport r=axiom_protected_inventory_own(directory,backing);assert(r.decision==AXIOM_RESOURCE_INCOMPLETE&&!r.stable);
 fd=open(alias,O_RDWR);assert(fd>=0);r=axiom_protected_inventory_own("/",backing);assert(r.decision==AXIOM_RESOURCE_VIOLATION);close(fd);
 fd=open(alias,O_RDONLY);assert(fd>=0);observed(axiom_protected_inventory_own("/",backing));close(fd);
 fd=open(alias,O_RDWR);assert(fd>=0);void*map=mmap(NULL,16384,PROT_READ|PROT_WRITE,MAP_SHARED,fd,0);assert(map!=MAP_FAILED);close(fd);assert(!mprotect(map,16384,PROT_READ));
 AxiomProtectedRegion metadata;assert(axiom_collect_protected_region((uintptr_t)map,&metadata));struct stat sb;assert(!stat(backing,&sb));assert(metadata.vnode_present&&metadata.device==(uint64_t)(uint32_t)sb.st_dev&&metadata.inode==(uint64_t)sb.st_ino&&(metadata.max_protection&VM_PROT_WRITE));
 r=axiom_protected_inventory_own("/",backing);assert(r.decision==AXIOM_RESOURCE_VIOLATION);munmap(map,16384);
 fd=open(other,O_CREAT|O_EXCL|O_RDWR,0600);assert(fd>=0&&!ftruncate(fd,16384));map=mmap(NULL,16384,PROT_READ|PROT_WRITE,MAP_SHARED,fd,0);assert(map!=MAP_FAILED);close(fd);observed(axiom_protected_inventory_own("/",backing));munmap(map,16384);
 assert(!axiom_collect_protected_region(UINTPTR_MAX,&metadata));
 unlink(alias);unlink(backing);unlink(other);rmdir(directory);puts("owned_kernel_resource_cases=7 PASS; root=/ readonlyOSfixture NOT package; unattributed_lineage=UNPROVEN; restriction_or_identity=NOT_RUN");return 0;
}
