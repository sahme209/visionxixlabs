#ifndef AXIOM_TIME_PARENT_BINDING_H
#define AXIOM_TIME_PARENT_BINDING_H
#include <node_api.h>
#include "time_publication.h"
/* PRIVATE C bootstrap only. No addon registration, JS constructor, accepted
 * policy or artifact qualification is supplied by this source unit.
 * Bootstrap must independently qualify the ELF, directory and producer. */
struct axiom_time_parent_bootstrap {
 int directory_fd;
 int worker_elf_fd; /* verified read-only ELF, never a script or pathname */
 uint32_t publisher_uid,reader_gid;
 uint64_t directory_device,directory_inode;
 const char *generation;
};
napi_status axiom_time_parent_create_private(napi_env,
 const struct axiom_time_parent_bootstrap *,napi_value *);
#endif
