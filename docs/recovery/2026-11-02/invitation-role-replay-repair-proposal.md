# Invite acceptance: reproduced defects and narrow repair proposal

**Pending user validation-first approval. Local code/tests only are proposed; no invitation, real membership change, migration or deployment is authorized by this document.**

Source inspected at `442ef5b84b92fcfeb0a80ade30816d6c09d14736`, 2026-11-02. Design/evidence only; no production changes, protocol, new grant, provider, invitation delivery or live database. Reproductions explicitly simulate database, browser authentication, audit and billing entitlement; they invoke the actual acceptance page, real HMAC invitation implementation, and actual seat helper. No real credentials are used.

## Reproduction receipt

`/private/tmp/axiom-invite-authority-reproduction-focused-red.log`: exactly one new work-only suite, **3 failed / 2 passed**. Run with Node24.21.0 and work-only Vitest include. Failures are desired post-repair security assertions against current source, not a claim of repair.

1. Actual `AcceptInvitePage` with a still-valid signed admin invite, authenticated matching invitee, and already accepted membership currently demoted to read_only: legacy seat branch updates persisted role to admin. Desired invitation-specific invariant is no accepted-member role mutation.
2. Same actual page with public billing policy and usable full verified entitlement simulated: public branch also restores admin on accepted read_only membership.
3. Actual `claimOrganizationSeat` with an existing pending (`acceptedAt:null`) member and two accepted seats already occupying Free's two seats: legacy branch accepts the pending member anyway, skipping billing lookup/cap check and returning success. This is a seat-admission bug; it does **not** mean pending invitations must reserve paid seats.
4. Passing compatibility control: existing SSO-style call without invitedBy refreshes accepted membership to current mapped operator role. A global never-update role change would break the actual `lib/auth.ts` contract.
5. Passing source observation: repeat validation of one signed invite returns the same valid payload; validation contains no database/nonce/inviter lookup. This test does not pretend an inviter was actually revoked in a real database.

An initial work-config `mergeConfig` unexpectedly concatenated default test includes, starting broader tests; interrupted immediately (exit130), log `/private/tmp/axiom-invite-authority-reproduction-red.log`. It showed unrelated `ownedWebsiteVisualPolicy.test.ts` package-lock/Next-config pin mismatches during the concurrent packaging increment. No broad passing claim. Work config now explicitly replaces include; focused receipt above is authoritative. No broad rerun or PG instance was needed for these deterministic branch defects.

## Actual callers and identity

- `app/api/team/invite/route.ts`: requireContext's current selected organization and user; persisted same-org accepted owner/admin; ASSIGNABLE_ROLES excludes owner; signed payload organization/email/role/inviter/expiry/random nonce. Default seven days (helper supports1–30). Required audit after mint before URL is returned. No durable invite record, consumed nonce or current-org drain/enrollment guard.
- `app/accept-invite/[token]/page.tsx`: signature+expiry validate before currentContext; authenticated email must match token email. Membership target organization comes from the **signed invitation**, not selected workspace; invitee user comes from currentContext. SessionUserId is not explicitly required at this page. No current inviter lookup, durable nonce or original-expiry recheck inside/after seat transaction. Page render itself mutates membership and describes existing-member success as “role refreshed”.
- `lib/billing/organizationSeatClaim.ts`: Serializable transaction. Public entitlement path obtains its billing lock and DB clock and correctly treats pending membership as a new seat; legacy path short-circuits for *any* membership row and therefore skips pending-seat quota checks. Both branches write role on accepted existing membership. Seat helper accepts trusted caller role; it is not an invitation validator.
- `lib/auth.ts:239`: actual Cognito sign-in path first performs current configured IdP/domain/claim/role mapping and passes `gate.organizationId`, persisted `dbUser.id`, mapped role **without invitedBy**. It intentionally synchronizes membership role. Existing helper tests explicitly require role refresh. Invite replay repair must not silently remove SSO synchronization or change auth.ts authority.
- `OrgMembership` schema has unique(userId,organizationId), nullable acceptedAt, role, invitedBy; no invitation/nonce generation or tombstone. `app/api/team/role/route.ts` has explicit current accepted owner/admin checks and protected self/owner conditions for role changes/removal; old accepted invite replay bypasses this intended current management path.

## Smallest reviewable local repair

Two separable changes, no schema or durable invitation protocol:

A. **Unambiguous existing seat bug:** distinguish accepted existing membership (finite valid Date) from pending null. Only accepted rows qualify for no-additional-seat branch. Pending acceptance must use the same plan/accepted-seat quota admission as new row, then update existing row rather than create. Count accepted rows, add exactly one on transition; do not count every pending invite as a paid reservation. Preserve Serializable and public entitlement behavior; missing/invalid acceptedAt/count/entitlement refuses rather than guessing accepted. Existing legacy mocks omitting acceptedAt need correction to model actual selected database fields. Both invitation and SSO pending transitions use this rule.

B. **Invitation-specific role replay containment:** introduce a clearly separate invitation-acceptance entry point (e.g. `claimInvitedOrganizationSeat`) sharing private seat transition logic. Existing `claimOrganizationSeat` signature/default role-refresh semantics remain compatible with auth.ts. Invitation entry takes the already validated signed invitation facts, matching authenticated user/email from actual caller, and uses *no role update* for accepted existing membership. Preserve its acceptedAt, role and other fields, including owner; result is idempotent already-member. Do not use a caller-supplied “authorized”/permission flag, infer membership authority from token.role, or choose role policy based on unvalidated optional data. New/pending member still receives the existing signed invite role subject to actual seat admission. Acceptance UI must say already a member and avoid displaying the invite's role as actual current role. No widening of assignable roles.

This second change is a security restriction to invitation acceptance, but it corrects **documented current behavior** (“role refreshed” UI + existing role-refresh test). The user must explicitly approve that narrowed invitation contract before local runtime implementation; do not call it a semantics-preserving helper refactor. It does not require a new durable invitation protocol and must not silently alter SSO role mapping.

## Policy decisions kept separate

A seven-day signed invitation can intentionally delegate acceptance authority for its lifetime. Current source does not promise inviter must stay admin at redemption or single-use redemption. Therefore adding current-inviter-admin checks, invalidating on demotion/removal, converting GET acceptance to explicit POST/consent, changing TTL, or enforcing durable nonce consumption are **additional lifecycle/consent policy decisions**, not proven corrections to current token contract. A current inviter lookup alone cannot make a stateless invite single use or distinguish a valid re-invitation from an old token after membership removal. No invented nonce store/tombstone is proposed here.

The invitation-only no-role-update repair makes accepted-member replay harmless for role mutation. It does not stop a still-valid old invitation recreating a removed membership, accepting a pending row, or restoring access after deletion; no revocation/one-use claim is justified. Requiring current inviter can be considered separately, preserving minimum existing owner/admin role checks and distinguishing delegated lifetime explicitly. Outstanding tokens remain an activation blocker until an accepted lifecycle/barrier design covers mint and redemption together.

Browser freshness/current canonical session, same-origin mutation/explicit consent, original invitation expiry across transaction delivery, tenant governance org-lock/drain absence, removal semantics, required acceptance audit, and concurrent inviter/target management need their own reviewed acceptance boundaries. Current signed target tenant is deliberate: selecting another tenant in the browser must not change the invite target. This draft does not turn currentContext email/roles into persisted management authority or propose accepting invalid owner tokens.

## Post-approval test additions (not run / not fabricated)

- Existing accepted owner/admin/read_only members retain exact role+acceptedAt through invite replay under public and legacy billing; actual page never says a stale token role is the user's current role.
- Pending/new seat at cap refuses without write, below cap accepts once, replay adds no seat; public and legacy branches and malformed acceptedAt/count fail closed.
- Existing actual SSO mapped-role refresh remains intact and pending SSO transition enforces quota.
- If runtime fix is approved, isolated real PostgreSQL two-connection final-seat race proves one acceptance and no over-allocation; Serializable conflict stays explicit unavailable/retry, never a grant. No PG needed to prove today's branch bypass.
- Separate future policy tests only after lifecycle choice: revoked inviter, removed/reinvited member, expired token during transaction/result delivery, selected-other-tenant, current actual session, org barrier/drain race, consent and audit failure. Do not label mocked pairing or invitation-policy callbacks as real authority/activation evidence.
