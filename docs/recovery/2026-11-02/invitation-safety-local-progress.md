# Invitation role replay and pending-seat local repair

User approved the narrow local implementation in approval call `c98f76fab51441dbb9bebfea5b235edf`. This receipt records local source and validation only: no real invitation, membership/role change, production SQL, schema migration, provider action or deployment. Root owns commits and backup.

## Implemented boundary

`lib/billing/organizationSeatClaim.ts` now has a separately named `claimInvitedOrganizationSeat` entry point. For an already accepted member, invitation acceptance performs no membership write and returns the persisted role, preserving exact acceptedAt, owner role and all other fields. It rejects invitation roles outside the existing assignable set; owner is not newly assignable. The existing `claimOrganizationSeat` interface retains SSO mapped-role synchronization; `lib/auth.ts` is unchanged. The internal purpose selector is private, not a caller-supplied authority flag.

A pending row is not an already accepted seat. Legacy and public billing acceptance require available capacity before a pending-to-accepted transition, using accepted-member counts. Pending invitations do not themselves reserve seats. Unknown/invalid acceptance metadata, counts or capacity refuse. Existing Serializable transactions remain; no retry automatically grants a seat after a serialization failure.

The actual `/accept-invite/[token]` page calls the invitation entry point, retains signed target organization and authenticated matching-email semantics, and displays the persisted current role and already-member state. A newly accepted pending member receives the welcome state. It no longer presents a replayed token's role as the accepted member's current role.

## Genuine RED and focused GREEN

- Original work-only evidence: `/private/tmp/axiom-invite-authority-reproduction-focused-red.log`: **3 desired failures / 2 passing controls**, before runtime repair. Actual page/helper showed accepted-member role restoration under legacy and public billing, and legacy pending-seat admission at full capacity. Controls retained SSO mapped-role refresh and observed repeat stateless token validation. Signed-token/HMAC code was actual; database, browser authentication, audit and public entitlement fixtures were explicitly SIMULATED.
- Promoted tracked regression before repair: `/private/tmp/axiom-invitation-repair-tracked-red.log`: the same **3 failures / 2 passing controls** against the original runtime. Tests live in `app/accept-invite/[token]/__tests__/invitationRoleReplay.test.ts`.
- Final focused regression: `/private/tmp/axiom-invitation-repair-green.log`: **23 tests passed across 3 files**. Actual acceptance-page/helper assertions cover role replay, owner/timestamp/field preservation, current-role UI and signed tenant, pending acceptance/replay under both billing branches, invalid metadata, invitation role limits and retained SSO refresh. Existing seat tests were included; their fixtures now supply actual acceptedAt/role fields rather than an ambiguous membership ID alone.
- Scoped TypeScript check: `/private/tmp/axiom-invitation-repair-types.log`: **exit 0, empty output**. Configuration `work/invite-authority-repair/tsconfig.json` includes changed production helper/page and all owned test files plus their actual dependency closure, including the auth caller. No broad production build is claimed.

The earlier exploratory config accidentally concatenated default test includes; it was interrupted with exit130 after noticing unrelated owned-website source-pin failures during concurrent packaging. That run is not a passing or focused receipt. The focused run above replaces its evidentiary role; the source-pin requalification was independently handled by root.

## Real isolated PostgreSQL qualification

`/private/tmp/axiom-invitation-seat-pg.log`: **2 actual PostgreSQL tests passed** in `lib/billing/__tests__/invitationSeatClaim.pg.test.ts`. The tracked reproduction harness `scripts/run-invitation-seat-postgres.py` is a byte-for-byte copy of the tested work harness; copying it did not trigger a rerun.

The fixture uses a generated minimal schema and private socket under `/private/tmp/axiom-invitation-seat-pg-panvukb9`, local trust only, TCP disabled and socket permissions0700. No production connection settings or database are used. It exercises actual helper code and PostgreSQL Serializable transactions; public billing is disabled to test the defective legacy quota branch directly. It is a seat-bookkeeping qualification, not authenticated invitation, billing-provider, current-inviter or policy authority evidence.

Both transactions are deliberately synchronized after actual accepted-seat count reads, so they observe the same one remaining Free seat before updating distinct pending members. One case races two invitation acceptances; the second races invitation acceptance with existing SSO-style seat claim. Exactly one succeeds; the other transaction refuses through the helper's catch path after PostgreSQL serialization abort. SQL readback confirms exactly two accepted seats (including the original owner), the loser remains pending, retry at full capacity refuses, replay neither changes the winner's role/timestamp nor consumes a further seat, and the owner remains unchanged. The barrier is test orchestration only, not a production lock or permission mock.

Harness finally stopped the owned server; an independent `pg_ctl ... status` returned **no server running**. No fixture remains active and no repeated race/build run is claimed.

## Review and remaining policy gates

Independent A source review and root helper/page review reported no material findings before this receipt. No runtime files changed while writing the receipt/harness/proposal header.

The signed invite still delegates authority for its existing lifetime and can recreate a removed membership while valid. There is no durable consumed nonce, current-inviter revocation protocol, new TTL, explicit POST-consent flow, new canonical browser-session/expiry boundary or governance enrollment/drain admission integration. Those are separate policy/design gates, deliberately unchanged. Accepted-member replay containment is not a fully safe invitation MVP, universal M01 coverage, revocation guarantee or activation qualification. Public entitlement/authentication in focused page tests are simulated; real SQL race validation does not upgrade them into production authority.
