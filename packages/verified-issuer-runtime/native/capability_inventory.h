#ifndef AXIOM_CAPABILITY_INVENTORY_H
#define AXIOM_CAPABILITY_INVENTORY_H
#include <stddef.h>
#include <stdint.h>
#define AXIOM_MAX_FDS 4096
#define AXIOM_MAX_VM_REGIONS 16384
/* Allowed means metadata shape only, never runtime/issuer qualification. */
typedef enum { AXIOM_META_ALLOWED=0, AXIOM_META_REFUSED=1, AXIOM_META_UNKNOWN=2 } AxiomMetadataDecision;
typedef struct { int fd; unsigned kind; int access_mode; int stable; int devnull; int readonly_path_allowed; } AxiomFdMetadata;
typedef struct { unsigned protection,max_protection,share_mode,external_pager; int complete; } AxiomVmMetadata;
typedef struct {
 AxiomMetadataDecision decision;
 const char *reason;
 size_t descriptor_count,region_count;
 int descriptor_scan_complete,region_scan_complete,stable;
 unsigned refused_share_mode,refused_protection,refused_max_protection,refused_external_pager;
} AxiomInventoryReport;
AxiomMetadataDecision axiom_descriptor_count_from_bytes(int bytes,size_t *count);
AxiomMetadataDecision axiom_vm_leaf_progress(uint64_t address,uint64_t size,size_t count);
AxiomMetadataDecision axiom_classify_fd(const AxiomFdMetadata *metadata);
AxiomMetadataDecision axiom_classify_vm(const AxiomVmMetadata *metadata);
/* Fixed own PID/task only. Caller path is inspection scope, not authority. The
 * unexecuted initializer derives it from its actual image; no JS/ENV setter. */
AxiomInventoryReport axiom_inventory_own_process(const char *canonical_package_root);
#endif
