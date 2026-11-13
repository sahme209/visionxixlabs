# Joined execution-time composition — prepared design

November13. This is authorized local design preparation, not approval to implement a new authority boundary or evidence that a runtime is qualified. It applies to the complete existing platform flow; it does not shrink Governance to a clock adapter. Read together with CONNECTED-QUALIFICATION-DESIGN.md and EC2-ALTERNATIVE-SOURCE-ASSESSMENT.md. Exact ClockBound release/source, host contract and regional quote remain unresolved.

## What the current source establishes

TIME-CONSUMER-INVENTORY.json records exact hashes and matching lines for38platform files/123matching lines, excluding tests. The literal-pattern scan is a discovery aid, not a complete transitive caller or security-coverage proof. No source was changed or executed.

The operational path has three different notions of time today:

1. `nativeCustodianSupplier.ts` uses a qualified interval only inside source-credential checks; the port returns `{earliest, latest}` without an explicit observation-generation or use-lifetime contract.
2. `privateStsIssuer.ts`, `ecsSdkTransport.ts` and the retained `stsIssuer.ts` have direct process-clock expiration checks. `githubBootstrap.ts` also uses process-clock profile expiry. `workloadRunner.ts` wraps the private issuer but does not propagate an interval port into these consumers.
3. Workload-token authentication/consumption, action/session authority, reservations, intents, delegation and closure stores use database timestamps. `sqlRepository.ts` evaluates session liveness inside SQL against `clock_timestamp()`; a new process clock cannot silently replace or qualify that database clock.

The current public operational composition still refuses missing qualified sources. This is a qualification/composition gap, not an observed live exploit or reason to turn on a partial runtime.

## One private policy, distinct audit clocks

The eventual qualified runtime must carry one private, profile-bound time-policy instance through actual request/identity, issuer, final transport and closure composition. A request may not supply its own interval, clock callback, freshness constant or profile. Plain matching JSON is not trusted evidence. No default Date.now fallback, global monkey patch or test-supplier registration is permitted.

Keep database time for durable event ordering, existing row locks and transition history. Explicitly qualify its time authority or supplement every time-sensitive authorization decision with the protected runtime interval. A database timestamp must not masquerade as a hardware/daemon-backed interval. Do not replace all `tx.now()` values with the upper bound: that would change historical timestamps and still fail lower-bound checks. Do not repair historic rows or add a migration as part of this design.

The current point-time JOSE verification remains cryptographic verification, not proof that all times inside an uncertainty interval satisfy the claims. The composed validator must retain signature/key/issuer/audience/run/source checks and additionally prove both interval endpoints meet the relevant claim bounds, before and after awaited currentness checks.

## Required decision rules

| Decision | Conservative rule for a qualified current interval `[L,U]` |
| --- | --- |
| Not expired: approval, session, workload token, source/derived credential, profile, native grant or observation | Require `U < expiresAt`; equality refuses. Preserve any stricter existing bound. |
| Already valid: issued-at / not-before | Require `L >= validFrom`; do not use U to activate future authority early. |
| Closed native liability | Require `L > credentialNotAfter` plus the complete existing source/fleet/lifetime/cutoff evidence and current snapshot. A time interval alone cannot close an unknown acquisition. |
| Coherent interval | Exact accepted profile/generation, finite safe units, `0 <= L <= U`, supported current status and protected origin. A prior interval must not be reused after source restart/change, timeout, suspension or an awaited boundary beyond its documented use validity. |
| Signed request timing | The qualified profile must establish compatibility between actual SDK signing time and the provider's accepted time scale. A correct expiry interval does not establish the SDK's signing-clock behavior. A provider refusal stays refused/unknown; never retry automatically. |

These are policy requirements, not a claim that an inspected client implements them. Seconds-to-milliseconds conversion must round the lower endpoint outward/down and upper endpoint outward/up; overflow, precision loss or unknown epoch/time scale refuses. No arbitrary numerical tolerance or locally invented drift rate may supply missing source guarantees.

## Exact composition work needed

1. **Source adapter and lifetime:** specify the real host/daemon/channel and generation before defining an operational evidence issuer. Bind observation/use validity to the exact consuming runtime and supported source contract. If the source cannot cover observation-to-final-use scheduling, refuse; do not manufacture a zero-delay guarantee. Source restart or loss must invalidate existing in-memory evidence without restoring consumed ledger claims.
2. **Database and human authority:** inspect the actual session timestamp fields and all current authority readers, not only their `live` boolean. Keep revocation/membership/admin checks under existing locks; add interval-based validity checks without granting a new session or changing audit history. Cover genuine requester/reviewer expiry at review, claim, credential acquisition and final action. Missing timestamp provenance blocks the composed qualifier.
3. **Workload identity:** use the same profile-bound policy at signed JWT authentication and original one-use consumption, including iat/nbf/exp, action expiry and after every awaited profile/currentness operation. Do not weaken JOSE verification, raise clock tolerance, revive a deleted proof or reuse a JTI.
4. **Source and STS issuance:** retain source-intent admission before any source acquisition, original source observation before derived issuance and the exact900-second request. Apply current interval checks after the last awaited native/current-authority check before dispatch and validate the returned absolute expiration. A requested duration, response-time-plus900 or policy ceiling is not proof of every unknown credential's lifetime. If a sent request cannot yield acceptable metadata, preserve original uncertainty and source/derived liabilities.
5. **Final ECS write and read:** actual shared signed-request boundary must consume fresh evidence after `beforeRequest`, with the exact credential/action/source and original final authorization. Preserve one-send, bounded-response, cancellation, endpoint and serialized payload checks. Readback needs its own qualified read credential; never recycle an already-consumed write handle.
6. **Final closure and cached history:** current source/fleet/cutoff receipts plus a fresh interval must qualify new closure. Historical cached observations remain explicitly historical, never a new native check or execution grant. Preserve original barrier generation, snapshot, actual expiration and source/derived liabilities.
7. **All remaining platform families:** apply the same decision inventory to template credential/grant/signing/access, image initializer/PUT/readiness, post/schedule and manual release control. Do not present the ECS integration as complete family coverage. Calls outside this inventory (auth, SDK internals, transport signing, timer utilities and native code) require the transitive review before enrollment.
8. **Legacy paths:** the retained direct web-identity issuer must remain excluded from the private qualified deployment lane. Current local source search finds no production invocation of its factory outside its definition; this search is not universal call-graph proof. Do not re-enable it as a fallback or create an environment-selected credential chain.

## Coherent implementation/validation unit, after approval

Prepare the complete change against actual existing factories/stores and both typed client/server composition—not a detached policy kernel with no consumers. Keep all public/default qualifiers unavailable until the real supplier, complete coverage and acceptance evidence exist.

Required tests must exercise the original signed-workload/client→request→claim→source-intent→issuer→final transport→native-observation/closure path, with controlled synthetic source/provider behavior clearly labeled. Include: uncertainty overlapping expiry or not-before; exact equality; profile/daemon-generation change across await; delayed final callback; canceled read; role/session revocation; DB/process-clock disagreement; returned credential beyond the supported lifetime contract; lost source/STS/final reply; and historical closure reuse. Every uncertain send remains consumed, with no automatic second attempt. Full-family and transitive authority tests, actual isolated database journeys, types/build and independent review remain required under their applicable execution permissions.

Real host/time/custody/source acquisition, signed SDK behavior, fleet cutoff, genuine independent human review and actual provider result/closure must then be qualified against frozen artifacts in one finite owner-approved trial. Synthetic tests cannot substitute for that evidence. Production migrations, flags, deployment, resource creation and spending remain separate explicit decisions.

## What this preparation resolves

It identifies the joined change needed regardless of the chosen time library, rather than assuming a replacement clock callback will finish Governance. It does not select a library, define unverified freshness constants, issue trusted receipts, implement code, authorize new public reads or grant resources. Next: independent source/design review, exact supplier/profile completion and the owner's local implementation decision before authority-boundary changes. Full Governance remains incomplete and disabled.
