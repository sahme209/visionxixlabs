# Generated-site deployment liability and receipts — owner review

Status: proposed local extension only. Not implementation, execution, production or provider permission. The existing generated-site execution route remains unsupported/unregistered. Preserve all original records and spending/owner-click rules.

## Verified source gap

- `effectExecution.ts` owns an action-bound opaque capability and prevents replay of that binding. It is not a target-wide reservation across different action IDs.
- `actionStore.ts` final authorization currently reserves cross-action native identities only for growth publish/delete. Deployment prepare accepts a fresh independently reviewed plan, but has no shared target-liability reservation. This is source-inspected, not a reproduced live duplicate incident.
- `provider.ts` receives an accepted deployment ID/state and returns it after recording a generic confirmed effect. The current dedicated platform effect/event storage does not retain that provider reference. Confirmed here means request acceptance, not READY service acceptance.
- An unknown action is never reusable, but a new plan is not an acceptable implicit recovery protocol. Full managed deployment support must resolve both gaps before enabling its execution surface.

## Alternatives and recommendation

1. Keep parent-only controls: inadequate cross-action uncertainty/accounting; reject as completion.
2. Lock a target permanently after any request: safe containment but prevents useful later releases; reject as final product.
3. **Recommended:** one durable target reservation plus immutable private-transport receipts; a separate exact read-only reconciliation process may qualify a release of that reservation only after verified terminal provider evidence and genuine independent review. This supplies a useful sequential workflow while retaining unknown liabilities.

No provider idempotency support, terminal-state vocabulary or undocumented destination behavior is assumed. Their eventual real API profiles require source qualification and separate external/live authority. Until those suppliers qualify, reservation release refuses.

## Proposed local contract

### Target reservation

- Canonical key is provider + exact configured team + exact reviewed project name + environment. It excludes action/request UUID, lead ID, source revision and file digest so creating a new proposal cannot evade liability on the same target. Production and preview remain distinguishable, and the exact scope/identity must match the eventual provider profile.
- Dedicated LOCAL reservation data references the original action/effect and a monotonically increasing generation. Unique target ownership and an atomic transaction admit one dispatch after current requester/reviewer/source/expiry checks. No caller-supplied reservation ID, owner, epoch, provider result or approval Boolean is authority.
- Record ownership before dispatch. A pending, claimed, unknown, ambiguous or unqualified old generation blocks every fresh action for that key, including different lead/source/action/reference IDs. Cancellation, expiry, process loss or lack of a response cannot release it.
- An actual new deployment always needs its own exact source plan, independent approval and original-requester one-attempt execution. Releasing a reservation never extends/reuses an old approval or resets an attempt.

### Immutable observation receipt

- Only the existing private claimed transport may originate an observation. Bind exact action/child, plan/source digest, target key/generation and request acceptance identity/state. Validated provider ID is metadata, not an external URL, credential, raw response or new execution capability.
- The provider reference and outcome become durable with the corresponding child event/terminal transition, or remain explicitly uncertain. If recording is ambiguous, never report a safely unused send or automatically repeat it. Preserve known transport evidence without rewriting unknown as confirmed by assumption.
- Accepted/BUILDING is not READY and does not release target liability. A request receipt remains immutable; subsequent observations are separate append-only records.
- Existing unknown/confirmed historical rows are not backfilled, reset, renewed or treated as having receipts they lack. Old untracked activity keeps qualification unavailable.

### Later qualification/release boundary

- Prepare a separately exact observation request bound to the original receipt/target/generation and expected current source/runtime profile. Real provider reads are excluded from this implementation grant.
- Missing/unreadable/mismatched/stale evidence, wrong identity, pending/unknown provider state or an unsupported profile refuses. A server-side qualified terminal supplier is required; caller text, screenshots, declared hashes, arbitrary URLs and a status string cannot create it.
- Genuine independent review authorizes the exact reservation-release observation, distinct from approving or executing a new deployment. Current authority is rechecked around awaits, including source/provider qualification and atomic release. Review never sends a write.
- Release compare-and-swaps only the observed original generation after proving no unqualified in-flight work remains under the accepted profile. Delayed/replayed observations cannot release a newer generation. Original action/outcome/receipt/history remain unchanged.
- Release is not deployment, rollback, settings mutation or spending authority. Unknown-without-reference recovery stays unavailable pending a separately approved authoritative discovery design; no new retry chain or "absence means unused" shortcut.

## Proposed validation

Local code/additive schema definitions and fresh owned isolated PostgreSQL/simulated-provider tests only. Prove one concurrent target admission across distinct independently approved actions; unknown/accepted-pending holds; different lead/files/UUID cannot bypass; missing/mismatched receipt refusal; atomic event/reservation/receipt rollback; current role/source revocation before final dispatch; later qualified synthetic terminal observations, genuine distinct reviewers, exact-generation release, delayed/replayed evidence refusal; original unknown histories remain intact. Clearly label synthetic provider/qualification fixtures. No real supplier or issuer qualification is implied.

## Excluded authority

No production schema/migration, recovery SQL/backfill, provider read/write, deployment, rollback, real credentials/key use, account/grant/service/runtime changes, spending, flags or activation. No modification of operational scripts/workflows under this request. No automatic old-history adoption. Keep the full P01 and master-plan gates, genuine ServiceNow review, existing UNKNOWN-note protections and owner production-click requirement intact.

## Approval requested

Local implementation/additive local schema and isolated tests of the reviewed reservation/receipt/reconciliation contract only. Production/live qualification and execution enablement remain separate. An independent builder check is required before this document is presented for that decision.

## Independent builder check

A fresh design-only builder read this proposal and existing store/repository/effect/provider source and reported nothing important left unanswered for local implementation. It confirmed that real provider terminal/identity profiles and unknown-without-reference discovery are explicit later unavailable gates. No file edits, test, provider or database operation occurred during the check. This is design review, not implementation or real-world qualification.
