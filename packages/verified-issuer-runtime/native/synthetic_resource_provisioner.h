#ifndef AX_SYNTHETIC_RESOURCE_PROVISIONER_H
#define AX_SYNTHETIC_RESOURCE_PROVISIONER_H
#include "synthetic_resource_contract.h"
#include "cssm_policy_prepared.h"
/* Dormant maintenance composition only: not linked into any runtime target.
 * No main, command line, environment selection, registration, or launch. Trusted
 * installer input custody and pre-main installation identity remain unresolved. */
AxSyntheticProvisionResult ax_synthetic_native_provision(void);
#endif
