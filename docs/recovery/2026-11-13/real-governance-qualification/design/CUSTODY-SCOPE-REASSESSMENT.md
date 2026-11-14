# Custody scope reassessment — avoid an unsupported extra gate

## Evidence and correction
Three independent source inspections corrected the earlier assumption that every later currentness/result transaction requires another admission acknowledgement before key/crypto use. Under owner-accepted original authorization-at-commit semantics, the ORIGINAL admission already acknowledges before these effects:

- Settings settingsExecution.ts child claim/physical reservation commits before runPlatformEffect invokes the key-opening callback (67–68,83–87). Lost later opening/check acknowledgement withholds plaintext from transport; it does not erase original authorization or by itself prove unauthorized access.
- Image imageExecutionStore.ts initializer/PUT admit acknowledges original hold/claim before key/open/seal (112–130,142–155). Later recording failure preserves original consumed history; it must not become another provider attempt.
- Template templateExecutionStore.ts reserve acknowledges before material copy (77–81); original claimDelivery acknowledges before key/open (58–64). Later live/current checks are not a fresh approval being awaited for first admission.

The proposed new generic/per-family custody-attempt kernels, extra per-key ACKs and opaque HTTP output handles in work notes are OPTIONAL stronger designs, not demonstrated missing-authority defects or automatic completion gates. A timed-out diagnostic produced no assertion evidence and cannot justify them. No code was changed on that premise; no source scope, actual key safety requirement or master acceptance requirement is waived.

## Diagnostic limitation
One attempted narrow settings diagnostic used a Vite merged config that might concatenate include arrays; it hit its30second parent limit with no result/assertion evidence. The owned process group was terminated, no retry occurred and frozen tracked source remained exact. Partial logs and source hashes remain under work/settings-custody-diagnostic. This is a diagnostic harness failure, not a passing security test or demonstrated application defect. Do not repeat a full suite or request an unnecessary user boundary decision on this evidence.

## Actual remaining requirement
Qualify the real fixed key/custody/runtime/time/cancellation/currentness suppliers and actual output channel against original admitted bounds, with proper scoped real tests. Existing synthetic port functions do not prove that qualification. If a focused completed test shows key access before ORIGINAL acknowledgement, after a failing pre-key deadline/cancellation/currentness check, or on replay, reproduce and fix THAT exact invariant. Otherwise proceed to existing real qualification instead of inventing more code gates. No full Governance/native/provider acceptance is claimed by this clarification.
