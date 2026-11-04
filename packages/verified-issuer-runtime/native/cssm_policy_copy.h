#ifndef AXIOM_CSSM_POLICY_COPY_H
#define AXIOM_CSSM_POLICY_COPY_H
#include <Security/cssmtype.h>
#include <Security/cssmapple.h>
#include <stddef.h>
/* Unbound policy preparation only. No identity or effective-policy assertion. */
typedef struct { const void *base; size_t size; } ax_cssm_range;
typedef struct {
 CSSM_ACL_OWNER_PROTOTYPE owner;
 CSSM_ACL_ENTRY_INFO entry;
 CSSM_LIST_ELEMENT nodes[256];
 unsigned char data[65536];
 CSSM_ACL_AUTHORIZATION_TAG rights[16];
 size_t node_count, data_count;
} ax_cssm_policy;
/* Synthetic inputs must supply disjoint ranges; out must be separate storage.
 * Failure zeros output. Range metadata itself must be a valid caller array. */
int ax_cssm_copy(const CSSM_ACL_OWNER_PROTOTYPE *, unsigned,
 const CSSM_ACL_ENTRY_INFO *, const ax_cssm_range *, size_t, ax_cssm_policy *);
/* Only the once-exported trusted framework graph; not arbitrary caller pointers. */
int ax_cssm_copy_framework(const CSSM_ACL_OWNER_PROTOTYPE *, unsigned,
 const CSSM_ACL_ENTRY_INFO *, ax_cssm_policy *);
#endif
