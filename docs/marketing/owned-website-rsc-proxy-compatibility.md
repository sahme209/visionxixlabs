# Owned website proxy RSC compatibility correction

The fixed loopback fixture proxy now preserves every present member of Next's
four cache-hash inputs: router-state-tree, router-prefetch, router-segment-prefetch
and next-url, together with the existing RSC marker. Each value must be an own
enumerable scalar data property. Arrays, accessors, control characters, empty or
oversized values refuse the whole request before upstream delegation; no fallback
silently drops one input. State tree is capped at the installed parser's 40,000
characters, segment selection at 4096, and prefetch at the fixed 0/1/2/3 enum.
Next-Url is restricted to the same three public page paths already admitted by
the fixture. Cookies, authorization, incoming Host and arbitrary headers are
not forwarded. Existing method, route, origin, transport, cancellation and
30-second upstream timeout boundaries are unchanged.

The installed-code regression now uses the actual new header projector in its
preserved case: 1 synthetic fetch/no redirect, compared with 2 fetches/one redirect
when all routing inputs are stripped and 21 when only Next-Url is preserved.
The exact extracted server/client branches and actual hash helpers run with fake
fetch/response/redirect boundaries and disabled decoding. This is a protocol
compatibility correction, not proof of the recorded browser timeout's cause.
No RSC validation, guard, assertion, deadline or application code is weakened.

Before waiting for documentation navigation, the driver now attempts the existing
three-boolean DOM observation while the session is active. Its separate
`documentationPreWaitSnapshot` cannot be mistaken for the timeout-only snapshot.
Observation failure stays unknown and does not replace the navigation assertion.
At an absolute deadline the pre-wait values can remain available while timeout
observation remains null. Neither snapshot contains raw paths, text or payloads.

TDD: 10 new proxy cases failed before correction; final 69 tests across six focused
files pass, including geometry, proxy lifecycle, privacy/navigation, receipt
projection, operation bounds and actual installed hash behavior. Scoped lint,
syntax and whitespace checks pass. No actual HTTP, proxy/server/browser launch,
provider, database or production operation ran. A fresh integrated browser result
is still required before claiming documentation navigation recovered.
