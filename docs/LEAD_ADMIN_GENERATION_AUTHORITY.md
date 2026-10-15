# Lead administrator generation authority

Reviewed 2026-10-15. No production actions or commercial policy change.

The lead administrator UI already uses an email allowlist through the admin
layout. Direct API calls do not inherit that page guard. The generation route
previously required only a lead ID, while the administrator tier-change route
required any signed-in user, irrespective of administrator authority.

Both `POST /api/leads/[id]/generate` and
`POST /api/leads/[id]/upgrade-tier` now use the existing `requireAdmin` server
boundary before resolving the lead, parsing mutation input, invoking AI or
writing data. It returns 401 for an unauthenticated identity and 403 for a
non-allowlisted identity or absent administrator allowlist. The existing admin
UI calls, administrator generation result, tier mapping and payload preservation
remain unchanged. Public lead generation uses its separate signed-token trigger.

`app/api/leads/__tests__/adminGenerationAuthority.test.ts` invokes the actual
routes and actual allowlist helper with simulated identity/storage/AI boundaries.
It covers unauthenticated, ordinary-user and absent-allowlist denials with zero
lookup/write/AI side effects, and successful existing administrator behavior.
These tests are local regression evidence, not production authorization tests.

## Explicit remaining dependency

This change establishes administrator authority for two management APIs; it
**does not establish verified paid entitlement**. Public lead intake still
records the requested tier from the caller, and signed-token revision handling
uses that tier for revision limits. Distinguishing requested plan from verified
commercial entitlement remains an unresolved design/implementation requirement.
No Stripe verification, pricing, revision limits, requested-tier intake, signed
public token routes, infrastructure selection, or public starter-generation
policy is changed by this fix.
