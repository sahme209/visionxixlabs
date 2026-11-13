# Generated-site deployment decisions — approved local timing integration

This is the next implementation slice under the existing owner-approved joined-time composition design. Code and simulated tests only; no actual SQL, credential/provider request, native build/sign/install, production change or spending. It does not authorize or establish native qualification.

## Actual gap

`actionStore.timely` currently returns after database ordering for every action without a growth effect. Therefore generated-site prepare/preview/source/review/claim/final-send decisions can ignore the captured interval clock and actual human session windows. `requestComposition` already carries one bearer-guarded clock and original signal, but that clock is not consumed by these deployment decisions. The source reader separately binds exact saved lead revision/package/files/configuration and current team.

## Connected change

Extend the original store's timely decision to every `deployment.vercel` effect as well as the existing growth effects. Keep one clock/signal captured at factory creation, require it for new deployment decisions, intersect requester/current reviewer/prospective phase actor session windows with action creation/expiry and each selected lead revision. For lead-backed effects, reconstruct the exact original source plan inside the SAME locked transaction; require its effect and (for the one-effect actual generated-site profile) source digest to match. Reconstruct and repeat current people after the clock await. A source revision is a data valid-from bound, not native profile freshness or credential proof.

Retain the same lifecycle distinction as growth: confirmed children remain immutable history while pending/claimed children need current source checks; unknown/refused children cannot progress. Preserve database ordering, current roles, native target admission/reservations and original one-attempt/commit-ack semantics. Historical metadata and original preparation-reference recovery do not require old source or a new clock. Never make a new database timestamp or local Date into the qualified interval source.

Generic immutable deployment effects without a lead still get action/person timing. They do not gain generated-site source or native qualification; the actual execution HTTP continues requiring one lead-backed effect and its unavailable-by-default native qualification. No new mounting or activation.

## Validation

Exercise actual prepare→preview→review→claim→child→original final authorization with serialized memory rows and synthetic qualified-time source; retained native-target checks stay real code with synthetic rows. Test expired/future requester and prospective reviewer, clock/DB disagreement, future/replaced lead source, role/source changes across the clock await, cancellation, missing clock/signal, final target-lock wait expiry, lost commit acknowledgement, and historical recovery after expiry. Keep original approval/version/source/negative assertions. Update opt-in SQL fixture definitions explicitly as synthetic timing only; do not execute them. Run focused cases, root strict types, full ordinary suite and independent source review.

The next remaining execution work must connect actual private credential acquisition and its explicit native lifetime/qualification to the same final owner, replacing the provider's environment-token path without fallback. This decision slice does not claim that work, real SQL/native/provider acceptance or full Governance completion.

## Implementation sequence

- [x] Add `deploymentJoinedTime.test.ts` with serialized memory ownership, actual lead-source/action/target kernels and failing session/interval/source/cancel cases; observe RED on the unchanged store.
- [x] Extend `actionStore.timely` to growth plus deployment effects; derive exact lead source windows and immutable action bounds, recheck source and people after interval reads. Preserve existing history and target reservation/ack behavior.
- [x] Exercise the actual bearer-guarded request composition, positive prepare/review/claim/source/send/observe, target-wait expiry and lost acknowledgments; preserve all original assertions.
- [x] Adapt only affected existing and opt-in SQL test definitions with explicit synthetic timing; never execute opt-in SQL under this grant.
- [x] Run focused cases, root types and full ordinary suite; obtain final source review. Update internal walkthrough, exact receipt and the five living documents with backups/preservation checks; commit branch only.
