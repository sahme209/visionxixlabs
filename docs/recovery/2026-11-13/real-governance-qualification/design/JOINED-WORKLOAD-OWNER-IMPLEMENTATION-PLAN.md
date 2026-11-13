# Connected workload lifetime correction

November 13. Implements the already approved JOINED-TIME-COMPOSITION-DESIGN locally; no new live authority. Read with JOINED-TIME-WHOLE-SOURCE-AUDIT.md. Source-only independent design review confirmed the following sequence. Full Governance remains incomplete and disabled.

## Preserve the actual owners

1. Add a private `readConsumedTimeWindow` to the existing workload-identity instance. Resolve only its consumed WeakMap entry, validate exact action/workload binding and current profile, return immutable verified JWT/action bounds. No clock call, new proof, reservation, renewal, token export or durable-format change. Freeze the complete binding passed to profile suppliers so they cannot rewrite the expected comparison. Existing standalone authenticate/consume/current checks retain their own clock behavior.
2. Add explicit fact/currentness versus validity-window contracts to the actual workload composition. Collect BOTH current locked human-session windows, the private consumed JWT window, original action/source window, current native source/custody profile bounds and any source/derived credential expiry. Unsupported bounds refuse. Never relabel a time-dependent qualifier as a fact-only check; its implementation and actual consumers must be separated and reviewed.
3. Keep `beforeSource` as ONE durable source-intent admission. Pass a separate final native-read authorization through the private issuer and custodian supplier. After capture/profile preparation, the original locked owner must validate the same pending action/intent and the complete intersection immediately before native acquisition. No second reservation or unknown-acquisition replay. Enforce callback completion and commit acknowledgment.
4. The original role-issuance and ECS final-send transactions consume the same joined restrictions through their existing one-use native time callback. After the interval check, recheck exact windows, people, source, identity, held generations, original cancellation and database ordering without a later independently scoped clock. Native windows may tighten but never replace owner restrictions. Preserve final callback retirement, known issued liabilities, durable unknowns and all current no-replay rules.
5. Validate the actual composed paths with synthetic signed JWTs, original stores and intercepted native transports. Independently expire every shorter lifetime; include final-await profile/window mutation, cancellation, lost source/role/send acknowledgement and callback omission/repetition/pending completion. Cover source acquisition, not only STS/ECS sends. Whole source review, current types/ordinary suite, and a separately authorized fresh isolated SQL/build checkpoint follow.

## Scope and acceptance

Step 1 is necessary private plumbing, not a fix of the final source-read/STS/ECS gap by itself. Do not mark finding 1 closed until steps 2–5 are connected and verified. Actual native clock/custody/source/fleet/use validity and real human/provider acceptance still require the separate finite qualified trial; no simulated return can qualify them.

Growth's pre-decrypt authority and original-cancellation gap remains separate. Its existing acquisition attachment is explicitly Vercel-deployment-only; a concrete scoped growth design must be reviewed before widening that boundary. No new credential source, refresh, grant or real publication is included here.

No provider read, credential, actual SQL, native/helper launch, signing/install, account/resource/configuration change, push/workflow/deploy, enablement or spending is authorized by this plan.
