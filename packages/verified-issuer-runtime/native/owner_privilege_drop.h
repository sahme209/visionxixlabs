#ifndef AXIOM_OWNER_PRIVILEGE_DROP_H
#define AXIOM_OWNER_PRIVILEGE_DROP_H
#include <sys/types.h>
typedef struct {
 void *context;
 int (*prepare_io)(void *);
 int (*clear_groups)(void *);
 int (*set_gid)(void *,gid_t);
 int (*set_uid)(void *,uid_t);
 int (*verify_ids)(void *,uid_t,gid_t);
} AxOwnerDropOps;
/* Called only in the fixed owner-owned child; no IPC selector reaches it. */
int ax_owner_drop_privileges(const AxOwnerDropOps *,uid_t,gid_t);
#endif
