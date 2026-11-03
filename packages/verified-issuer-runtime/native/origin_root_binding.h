#ifndef AXIOM_ORIGIN_ROOT_BINDING_H
#define AXIOM_ORIGIN_ROOT_BINDING_H
#include <sys/stat.h>
#include <sys/mount.h>
#include <limits.h>
#define AXIOM_ORIGIN_ANCHORS 5
/* Broker-private observations from the actual sealed control bundle and mounted
 * root. This type is never decoded from requests or exported as authority. */
typedef struct {char path[PATH_MAX];struct stat identity;} AxiomOriginAnchor;
typedef struct {struct stat root,backing,control_binding;char control_binding_path[PATH_MAX];struct statfs volume;AxiomOriginAnchor anchors[AXIOM_ORIGIN_ANCHORS];int bound;} AxiomOriginRootBinding;
int axiom_origin_bind_root(AxiomOriginRootBinding *out);
int axiom_origin_root_current(const AxiomOriginRootBinding *startup);
#endif
