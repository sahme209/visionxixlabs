#ifndef AXIOM_CSSM_POLICY_ONCE_H
#define AXIOM_CSSM_POLICY_ONCE_H
#include <stdatomic.h>
/* A failed attempt remains consumed. Static callers initialize with
 * ATOMIC_FLAG_INIT; no reset operation is provided. */
static inline int ax_cssm_claim_once(atomic_flag *attempted) {
 return !atomic_flag_test_and_set_explicit(attempted,memory_order_relaxed);
}
#endif
