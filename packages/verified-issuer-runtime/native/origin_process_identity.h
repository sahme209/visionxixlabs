#ifndef AXIOM_ORIGIN_PROCESS_IDENTITY_H
#define AXIOM_ORIGIN_PROCESS_IDENTITY_H
#include <sys/stat.h>
#include <sys/mount.h>
#include <stdint.h>
#include <limits.h>
/* Private native retained actual-kernel observations. Never serialized to JS or
 * accepted from a caller as proof. Actual origin/preexec qualification is separate. */
typedef struct {
 char root[PATH_MAX],backing[PATH_MAX],node[PATH_MAX],main[PATH_MAX],addon[PATH_MAX];
 struct stat root_stat,backing_stat,node_stat,main_stat,addon_stat;
 struct statfs volume;
 uintptr_t node_code,addon_code;
 int captured;
} AxiomOriginProcessIdentity;
/* Typed observations for ordinary tests; these do not establish origin. */
int axiom_origin_same_file_metadata(const struct stat *first,const struct stat *second);
int axiom_origin_loaded_file_matches(uintptr_t address,const struct stat *expected);
int axiom_origin_identity_capture(uintptr_t addon_code,uintptr_t node_code,AxiomOriginProcessIdentity *out);
int axiom_origin_identity_current(const AxiomOriginProcessIdentity *startup);
#endif
