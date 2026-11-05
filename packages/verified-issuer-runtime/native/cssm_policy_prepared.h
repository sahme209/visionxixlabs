#ifndef AX_CSSM_POLICY_PREPARED_H
#define AX_CSSM_POLICY_PREPARED_H
#include "cssm_policy_copy.h"
#include <Security/Security.h>
/* Native maintenance-only process-local construction outputs. Not credentials,
 * installation evidence or an issuer. No addon/runtime registration exports. */
int ax_cssm_prepare_once(void);
SecAccessRef ax_cssm_prepared_access(void);
const ax_cssm_policy *ax_cssm_prepared_policy(void);
#endif
