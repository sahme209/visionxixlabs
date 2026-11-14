#ifndef AXIOM_TIME_PARENT_BINDING_H
#define AXIOM_TIME_PARENT_BINDING_H
#include <node_api.h>
#include "time_publication.h"
/* PRIVATE C bootstrap only. No addon registration, JS constructor, accepted
 * policy or artifact qualification is supplied by this source unit.
 * Bootstrap must independently qualify the ELF, directory and producer. */
#ifdef AXIOM_TIME_BEHAVIOR_TEST
#include <stdatomic.h>
struct axiom_time_test_observation {
 _Atomic uint64_t close_attempts,close_result,close_operation_refs,closed,close_unknown;
 _Atomic uint64_t cancel_at,deadline,reap_code,reap_status,owned_reap;
};
#endif
struct axiom_time_parent_bootstrap {
 int directory_fd;
 int worker_elf_fd; /* verified read-only ELF, never a script or pathname */
 uint32_t publisher_uid,reader_gid;
 uint64_t directory_device,directory_inode;
 const char *generation;
#ifdef AXIOM_TIME_BEHAVIOR_TEST
 struct axiom_time_test_observation *test_observation;
#endif
};
napi_status axiom_time_parent_create_private(napi_env,
 const struct axiom_time_parent_bootstrap *,napi_value *);
/* Private native-only lease: authenticated original held/capture pair, after
 * actual owned REAPED+I/O completion. No JS-exported pointer or constructor. */
struct axiom_time_original;
int axiom_time_parent_pin_original(napi_env,napi_value,napi_value,napi_value,
 struct axiom_time_original **,uint64_t *,uint64_t *,uint64_t *);
int axiom_time_parent_original_current(struct axiom_time_original *);
void axiom_time_parent_unpin_original(struct axiom_time_original *);
#endif
