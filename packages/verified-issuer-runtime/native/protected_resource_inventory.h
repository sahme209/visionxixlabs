#ifndef AXIOM_PROTECTED_RESOURCE_INVENTORY_H
#define AXIOM_PROTECTED_RESOURCE_INVENTORY_H
#include <stddef.h>
#include <stdint.h>
#include <limits.h>
#define AXIOM_RESOURCE_MAX_FDS 4096
#define AXIOM_RESOURCE_MAX_REGIONS 16384
/* OBSERVED is a bounded resource observation, NEVER identity or provenance. */
typedef enum { AXIOM_RESOURCE_OBSERVED=0,AXIOM_RESOURCE_VIOLATION=1,AXIOM_RESOURCE_INCOMPLETE=2 } AxiomResourceDecision;
typedef struct {uint64_t address,size,device,inode;unsigned external_pager,share_mode,protection,max_protection,basic_shared,region_flags;int vnode_present,vnode_exact;char path[PATH_MAX];} AxiomProtectedRegion;
typedef struct {uint64_t root_device,backing_device,backing_inode;int root_readonly;} AxiomProtectedResources;
typedef struct {AxiomResourceDecision decision;const char *reason;size_t descriptor_count,region_count,unattributed_region_count,unattributed_maxwrite_count;int descriptor_scan_complete,region_scan_complete,stable; } AxiomProtectedInventoryReport;
int axiom_collect_protected_region(uintptr_t address,AxiomProtectedRegion *out);
AxiomResourceDecision axiom_classify_protected_descriptor(const AxiomProtectedResources*,uint64_t device,uint64_t inode,int access_mode);
AxiomResourceDecision axiom_classify_protected_region(const AxiomProtectedResources*,const AxiomProtectedRegion*);
/* Caller scope is inspection input, not authority. Actual fixed caller must
 * authenticate preexec closure/origin and derive paths from its native image.
 * Unattributed mappings remain explicitly UNPROVEN; OBSERVED does not bless them. */
AxiomProtectedInventoryReport axiom_protected_inventory_own(const char *root,const char *backing);
#endif
