# Native behavior fixture independent source review

Verdict: CLEAR within the approved fixed, role-free native behavior fixture scope. No important source finding remains in the reviewed fixture, harness or conditional parent instrumentation. This is a source review; no native code, test, child, clock, compiler, network or CI operation was executed for this review.

The success case retains the original held identity/bytes/device/inode/publication/marker, checks actual BigInt capture ordering, awaits the original completed promise, obtains final parent P2 without changing R/P0/P1, and checks native owned-wait normal exit. Release evidence comes from the actual original-source-FD close cutpoint: exactly one attempted close, return zero, zero operation references, closed set and no close_unknown. It is not reconstructed from JS success or a reused descriptor.

The replacement case changes the fixed publication by rename after acquisition. It requires currentness refusal, then either a synchronous start refusal or an actual rejected result with known owned reap/completion and termination before release. A pre-launch refusal does not fabricate a completed worker. The original held FD remains the release subject; there is no reopen/repair or repeat observation.

The cancellation case uses only the separately opened, generated-identity-bound stall ELF. Its sole normal path creates/closes the fixed readiness marker and stalls. The bounded native marker observer checks owner/group/mode/link count/size/content. The JS early cutoff precedes explicit termination; native cancellation-request time must be positive and before the original 500ms deadline. Actual same-child pidfd wait facts must be CLD_KILLED/SIGKILL, followed by completed/idempotent termination and successful original release. The timestamp witnesses the explicit request, not a separately measured signal-delivery instant; no stronger latency or deadline-delivery guarantee is established.

The foreign case exercises both a plain JS value and an authentic second-parent hold against the first parent's start/release/observe methods. Native type tags and exact parent/capture association reject them before resource operations. Each case has a distinct static observation sink bound through its private bootstrap; no JS-supplied FD, policy, signal, source generation or accepted-time authority is introduced.

All new parent observation fields and accesses are AXIOM_TIME_BEHAVIOR_TEST conditional. They record actual close, cancellation-request and original wait cutpoints with atomics; they do not authorize operations or change the production bootstrap. The unconditional close refactor preserves the single original close and retirement-on-error behavior. This fixture is explicitly instrumented and does not qualify a release binary, protected bootstrap, physical time bound, lifetime/model, credential, provider, fleet or full Governance. The synthetic Unknown record remains non-admitted raw data.

The controller's fixed generated root/worker/stall device/inode/size header and frozen output hashes provide the surrounding trusted-source identity binding. This review did not independently author or certify the runtime restriction profile; its separately recorded review and exact packet binding remain applicable. Native compile/runtime acceptance remains to be observed under the fresh approved attempt; source checks are not a substitute.

## Exact reviewed source hashes

- `packages/verified-issuer-runtime/linux/time_behavior_fixture.c`: `b644839b38e8c8ab4cce91e8d985f3afc7d25e37e660b0ed5d7cb07dc3f1a439`
- `packages/verified-issuer-runtime/linux/time_behavior_stall.c`: `199781d36971995f0cfcd070d8483a764daa9b3d62b35eba224f60e55c56e4fc`
- `scripts/linux-compile/native_time_behavior.mjs`: `34e3c6f6cb86a8fc173d0df29cc95e4a70fdbf0b60d529c527bbe6ada0977476`
- `packages/verified-issuer-runtime/linux/time_parent_binding.c`: `e09b71c4875b668896d5abf7c9e264b6582350ba38cc3aea189ca3252523fbc8`
- `packages/verified-issuer-runtime/linux/time_parent_binding.h`: `713e789519b14dcec854b02068e1438e5b1ec830c6d43ae7a6026fac787283b3`
