#ifndef AX_CSSM_POLICY_INSPECT_H
#define AX_CSSM_POLICY_INSPECT_H
#include "cssm_policy_copy.h"
/* Equality of one application-only serialization, never effective authority.
 * Synthetic ranges must be valid, disjoint caller metadata. Framework entrypoint
 * accepts only the seventh trusted framework export, never arbitrary pointers. */
int ax_cssm_inspect(const ax_cssm_policy *, const CSSM_ACL_OWNER_PROTOTYPE *, unsigned,
 const CSSM_ACL_ENTRY_INFO *, const ax_cssm_range *, size_t);
int ax_cssm_inspect_framework(const ax_cssm_policy *, const CSSM_ACL_OWNER_PROTOTYPE *, unsigned,
 const CSSM_ACL_ENTRY_INFO *);
#endif
