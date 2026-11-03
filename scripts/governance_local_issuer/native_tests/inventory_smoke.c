#define _DARWIN_C_SOURCE 1
#include "capability_inventory.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <limits.h>
/* Readonly metadata harness only: links NO initializer/profile code and takes no PID. */
int main(int argc,char**argv){if(argc!=2||strcmp(argv[1],"--own-metadata-only"))return 64;char root[PATH_MAX];if(!getcwd(root,sizeof(root)))return 74;AxiomInventoryReport r=axiom_inventory_own_process(root);printf("decision=%d reason=%s descriptors=%zu regions=%zu fd_complete=%d vm_complete=%d stable=%d refused_share=%u refused_prot=%u refused_max=%u refused_external=%u qualification=metadata_only identity=unavailable\n",r.decision,r.reason,r.descriptor_count,r.region_count,r.descriptor_scan_complete,r.region_scan_complete,r.stable,r.refused_share_mode,r.refused_protection,r.refused_max_protection,r.refused_external_pager);return 0;}
