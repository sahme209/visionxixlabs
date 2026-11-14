# Clock authority reassessment — managed PostgreSQL versus qualified native time

Status: file-only architecture review. No code, SQL, provider reads, research, clock tests, implementation approval or enablement. Existing source/native/resource permissions are unchanged.

## Decision

Managed PostgreSQL is ALREADY trusted for durable state, ordering, row locks and some existing point-time session/JWT checks. It is NOT already accepted as a conservative UTC interval source for every platform execution and native credential closure. Replacing the required native source with database `clock_timestamp()` would therefore be an explicit clock-authority/security decision, not a missing adapter or an equivalent implementation of the current contract.

Do not undertake more coarse/precise source searches merely to avoid that decision. The legitimate choices are: retain the conservative interval requirement and leave the unsupported real lane unavailable pending actual evidence; or ask the owner to accept a precisely scoped managed-service clock authority with honest guarantees and residual risks. Neither choice permits fabricating an error bound or silently enabling existing qualifiers.

## What the actual contracts require

- `executionTime.ts:3–7/16–29`: fresh private origin/profile-qualified intervals; no process/database-clock fallback. For not-before, earliest must be at or after the original bound; for expiry, latest must be strictly before it. Returning the same database number twice proves only a zero-width representation, not zero UTC uncertainty.
- `sqlRepository.ts:113`: `tx.now()` reads floored milliseconds from actual `clock_timestamp()` after the transaction lock. It provides one scalar and no UTC error/status/lifetime/profile evidence. `:186` independently checks real session liveness against the DB clock. This existing extra check is not a native qualification receipt.
- `workloadIdentity.ts`: actual JOSE verification uses DB time but additionally calls the shared qualified interval source for the signed iat/nbf/exp intersection and current profile. Signature/key/issuer/run/JTI/transaction semantics must remain unchanged. Removing the interval supplement changes the accepted cross-authority clock assumption.
- `AUTHORIZATION-LINEARIZATION-DECISION.md`: the owner accepted original acknowledged-commit authorization plus one same-proof postcommit deadline/currentness check. That decision accepts a later scheduling race; it explicitly preserves native time qualification, original expirations and closure evidence. It did NOT accept arbitrary clock error, stale readings, replacing native suppliers with DB timestamps, or claiming credential closure from compute shutdown.
- `JOINED-TIME-COMPOSITION-DESIGN.md`, “One private policy, distinct audit clocks” and decision table: keep DB audit time; qualify its authority OR supplement authorization with the protected runtime interval. Closed credential liability requires the conservative lower bound past the actual native not-after plus complete source/fleet/cutoff evidence.

## Why the distinction matters

The DB controls Axiom-owned stored timestamps and can legitimately define a logical Axiom clock. However, GitHub JWT and AWS credential expiration are absolute timestamps issued by different authorities. A DB clock behind those authorities can admit an already-expired capability; ahead can admit a future not-before or incorrectly declare an external credential expired. Providers enforcing their own expiration may refuse execution, but that does not prove Axiom's conservative admission/closure rules. In particular, AWS accepting/rejecting one request does not prove every unknown credential is closed.

TLS, a confirmed database endpoint, managed hosting and a successful SELECT establish origin/availability, not a numerical UTC error bound. SQL floor/ceil fixes fractional-millisecond representation only. A network round-trip cap does not bound error already present at the server. A response may also arrive after a delay; it describes the server sampling event rather than an arbitrary later caller decision. Do not invent a duration pad or `[timestamp,timestamp]` to conceal those differences.

The DB need not be distrusted to require this distinction: trusting a service to serialize our records and trusting its wall clock within a stated UTC interval are separate assumptions. No live managed-clock defect is asserted here.

## Concrete legitimate managed-authority alternative (requires owner decision)

Define an ONLINE-only profile in which the exact existing production DB service is the authoritative logical time for Axiom approval/session/policy lifetimes and ledger ordering. Sample fresh DB `clock_timestamp()` through the original locked authority owner; bind action/transaction/target and retain no-replay, independent human review, revocation and the existing acknowledged-commit/same-proof boundary. Postcommit checks would use one fresh read from that same authenticated DB authority, without new approval, credential or deadline. A query failure, ambiguous result or stale/source mismatch refuses; original attempt liability remains consumed.

For externally issued JWT/credential expirations, explicitly choose one of:

1. Preserve current conservative UTC admission/closure: managed logical time cannot supply the missing external interval; those real operations and closure remain unavailable until independently qualified evidence exists. This preserves existing security but does NOT complete the real trial.
2. Accept managed DB wall-clock correctness as an operational assumption for external expiration checks, with no claim of quantified UTC enclosure or conservative closure guarantee. This is a different/weaker timing assurance and requires a precise owner-approved contract change, coverage/closure policy and tests before implementation. Keep provider-enforced expiration and unknown liability controls; never describe them as a mathematical substitute for the old proof.

The first option is a valid limited architecture under the current assurance. The second can be a reasonable product policy only when consciously chosen; it is not authorized by earlier deployment/database/local-code grants. Offline installations cannot rely on this online-only managed authority and require their separately accepted operator/local model/runtime policy.

## Recommendation

Ask for the security-boundary decision before implementing another time bridge. State plainly whether the product needs a quantified cross-provider UTC guarantee or an explicitly trusted managed-service clock policy. Existing source architecture does not supply an equally strong, already-qualified PostgreSQL shortcut. Preserve all implemented original approval, identity, STS one-attempt and native closure invariants during that decision; a clock-policy choice alone does not finish custody, fleet or real provider qualification.
