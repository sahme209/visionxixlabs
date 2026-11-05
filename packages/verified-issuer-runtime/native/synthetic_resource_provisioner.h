#ifndef AX_SYNTHETIC_RESOURCE_PROVISIONER_H
#define AX_SYNTHETIC_RESOURCE_PROVISIONER_H
#include "synthetic_resource_contract.h"
#include "cssm_policy_prepared.h"
/* Dormant maintenance composition only: not linked into any runtime target.
 * A separate closed standalone main is prepared; this module itself accepts no
 * command line, environment selection, registration, or launch. Trusted
 * installer material is prepared only by the fixed owned fixture producer;
 * installed/effective-policy qualification remains a separate operational gate. */
AxSyntheticProvisionResult ax_synthetic_native_provision(void);
#endif
