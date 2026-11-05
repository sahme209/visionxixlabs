#ifndef AXIOM_OWNER_RESUME_H
#define AXIOM_OWNER_RESUME_H
#include <stdint.h>
#include <sys/types.h>
typedef struct {
 void *context;
 uint64_t (*now)(void *);
 int (*owned_stopped)(void *,pid_t);
 int (*select_peer)(void *);
 int (*configure_listener)(void *);
 int (*peer_current)(void *);
 int (*resume)(void *,pid_t);
} AxOwnerResumeOps;
typedef struct {int attempted,confirmed,effect_unknown;} AxOwnerResume;
/* Private fixed native lifecycle; callback results are not IPC authority. */
int ax_owner_resume_once(AxOwnerResume *,const AxOwnerResumeOps *,pid_t,uint64_t);
#endif
