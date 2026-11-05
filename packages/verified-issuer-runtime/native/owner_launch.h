#ifndef AXIOM_OWNER_LAUNCH_H
#define AXIOM_OWNER_LAUNCH_H
#include "owner_journal.h"
#include <sys/types.h>
/* Private native composition. Callback tables are not accepted over IPC. */
typedef struct {
 void *context;
 int (*fixed_environment)(void *);
 pid_t (*spawn_fixed)(void *);
 int (*child_alive)(void *,pid_t);
 int (*kill_and_reap)(void *,pid_t);
} AxOwnerLaunchOps;
typedef struct {
 int attempted,active,stopped,cleanup_unknown;
 pid_t child;
 AxOwnerJournal journal;
 AxOwnerLaunchOps ops;
} AxOwnerLaunch;
int ax_owner_launch_start(AxOwnerLaunch *,const AxOwnerLaunchOps *,const AxOwnerJournalOps *);
void ax_owner_launch_stop(AxOwnerLaunch *);
#endif
