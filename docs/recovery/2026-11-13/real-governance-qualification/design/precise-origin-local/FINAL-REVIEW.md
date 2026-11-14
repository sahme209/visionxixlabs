# Final precise-origin source review

Verdict: **no remaining important source finding in the reviewed local unit**. This is source acceptance only, not native qualification, rollout approval or completed Governance. No tests, native code, downloaded source, build, SQL, network or provider operation was executed during this final review. Hashing and exact in-memory text-hunk verification below do not compile or execute Rust.

## Scope and actual behavior

Reviewed the current nativeTime runtime TS/codec/publisher/arithmetic/supervisor/private graph, C header/parser/capture/publication source, Rust owned publisher, current precise-origin patch, exact licensed upstream fixture closure, source integration tests and README/demo claims. Earlier closed execution-owner reviews remain dependencies; this is not a new universal audit of every Governance family.

- Correlated TS version/layout union accepts only the exact V1/coarse and V2/precise pairs. V1 is decode-only historical inspection; live encoding, publishing, source and interval refuse it. Current C/Rust/TS share `AXIOM_TIME_V2 / clockbound-precise-origin-v1`, twelve canonical LF-terminated ASCII lines, bounded integer domains and4096bytes. Unknown/Disrupted refuse usable arithmetic. Native raw capture still carries no time authority.
- Exact precise CLOCK_MONOTONIC lower origin is inside each real NTP exchange/PHC blocking operation before its first TSC. Returned tuple and actual event retain the original pre/post pair plus closed Ntp/Phc source kind; event constructors reject mismatched kind/counters. Candidate feed captures origin before moving the event; rejected candidates do not refresh prior origin; selector clones whole parameters. Structured log reconstruction sets origin absent and Debug redacts its content. This association does not attest the actual network/PHC source configuration.
- Original stock coarse `create_shm_snapshot` calculation remains byte-identical. V3 stays separate. One closed Stock/Axiom writer owns its delegate/counter; private Axiom publication acknowledgement precedes that same operation's compatibility delegate. Axiom-only RTT domain/odd-half rounding does not introduce a Stock-domain panic. Mandatory startup/disruption/pre-correction invalidation remains.
- Checked exact rational conversion and outward ceiling cover the represented numeric input conversion; they do not prove physical drift or upstream numerical/model error. Precise interval premises must exactly match the record anchor/expiry, retain conservative bracket/projection and strict expiry, and widen to milliseconds. Actual clock/source/model/rate/quantization/lifetime evidence is still required.
- The Rust private accepted-policy type has **no production issuer**; constructor sets None and missing origin/policy/valid input leaves Unknown. Its finite max_age member is not evidence of model/rate/clock correctness. No guessed default lifetime, vendor1000seconds, profile boolean or no-op qualification establishes authority.
- Original supervisor owns result/completion rejection and termination immediately, retains a private immutable byte baseline across qualification, retains parent descriptor through final P2, bounds cleanup and retires uncertainty. Returned interval describes P2, not an arbitrary later return/commit or provider receipt. Actual native launcher/profile/lifecycle/disruption and later-use aging remain held. The same private source reaches the actual custodian→STS/delegation/identity→ECS graph; no public registration/default follows.

Only **clockbound-precise-origin.patch** is current: apply ONCE to original pinned371058f8 source. It incorporates the earlier constructor/invalidation work; do NOT stack it over clockbound-daemon-integration.patch or its pre-RED draft. Native module placement/linkage/entrypoint remain unimplemented qualification/build gates.

## Evidence limits and wording

Genuine untouched upstream RED preceded implementation (6source failures/1fixture pass). Source-kind absence separately reproduced1failure/12passes before correction. Final source-integration log reports13passes. The primary reports full ordinary19478pass/1expected failure/1144skipped, strict root types PASS, and subsequent demo-only15PASS; those are reported existing receipts, not reruns by this review. Downloaded website TS was moved outside the checkout rather than weakening compiler configuration.

README correction now names both local grants and exact precise point premises, retaining V1 historical-only semantics. Native README selects only the current patch, and demo wording labels the source/mock evidence and unavailable real supplier. Source-order tests are not Rust execution or native fatal/clock proof. All C/Rust remains uncompiled/unlinked/unexecuted; dependencies/ABI/OS/kernel/process/filesystem/publisher/lifecycle/source/custody/fleet/human/provider and production qualification remain separate.

## Exact reviewed code SHA256

These hashes bind the reviewed bytes, not permission to re-pin a later change.

| Repository-relative file | SHA256 |
| --- | --- |
| `lib/governance/platform/nativeTime/interval.ts` | `a63c8082fe671641f38c592d6623321ab05b536fbc2a1dad5390483734c71ab7` |
| `lib/governance/platform/nativeTime/linuxComposition.ts` | `ca0d4783368f5a831986f7facb9a01032de3c80e6c16789ad1c2b96fdc9b70ca` |
| `lib/governance/platform/nativeTime/publisher.ts` | `56a92b15d52f6ff184a9ed55049def7d49cd8c0fa01923543288804102dedecf` |
| `lib/governance/platform/nativeTime/record.ts` | `6d32149818045c3ddb1c2320b447112e03053617f2181f0f9eda061d0d80cbbe` |
| `lib/governance/platform/nativeTime/source.ts` | `aa77df502698c6b834ad5ec6bce199ddbc19ce50d41bf55b49c6efa74f31a73f` |
| `lib/governance/platform/nativeTime/__tests__/daemonIntegration.test.ts` | `f6f71bb059f45c5e3631dec8def1f28750d61918ab24e51bd806690d77af3b9a` |
| `lib/governance/platform/nativeTime/__tests__/interval.test.ts` | `8a1c5ab31782c58f21e3ef172f478de1afef61cb1645337f580586595980e52a` |
| `lib/governance/platform/nativeTime/__tests__/linuxComposition.test.ts` | `a95269fe895687e2a047a081535e67bea8df5d174dcf889fd1b3d0591ab4d1ee` |
| `lib/governance/platform/nativeTime/__tests__/preciseOriginIntegration.test.ts` | `ba7423445db8b4ea0a847f48d7837d62ce82e42c4a4577a1bc3ed63a61b6c393` |
| `lib/governance/platform/nativeTime/__tests__/preciseRecord.test.ts` | `122302abf2fd3f54a89ace6bd50f12ca418bbd586a1d11c2b62b08f5f2cbbe1e` |
| `lib/governance/platform/nativeTime/__tests__/publisher.test.ts` | `eb59e42d1231687a21a836bb9241ff783984b14f92813f67d3d109cb59d3a5de` |
| `lib/governance/platform/nativeTime/__tests__/record.test.ts` | `ac74e71041a7814777a22714303f56b0e0ff705246af1ded1b27e72d5ea54142` |
| `lib/governance/platform/nativeTime/__tests__/source.test.ts` | `39282bb4e0d3db6d81e4596bc8d536a94e5324d7de95e3dc180683d18e11bc75` |
| `lib/governance/platform/executionTime.ts` | `58138a5c40ed5f247dbe6b931d9db80cbd8e33c869a4120d20d10daace07f6ef` |
| `lib/governance/platform/operations/nativeCustodianSupplier.ts` | `eaf96c93b4e66a696404b0fda7e4a158517395a42f14f902c4e3c8b07f7c4237` |
| `lib/governance/platform/operations/privateStsIssuer.ts` | `ef7648cdd74c5976966d26be5a96b63a929b570f5201530c4a00f04fece6217e` |
| `lib/governance/platform/operations/workloadRunner.ts` | `810feebe8e91d281f7716c1eba8122900fc3811f03039a62fe40c8e633bb12fb` |
| `lib/governance/platform/operations/workloadOwnerTime.ts` | `ccb01ecb69ccfff04db648bd9f6819dccc6ff553d23f67a35d4ff9cc8467dc6d` |
| `lib/governance/platform/operations/ecsSdkTransport.ts` | `22c44608e207881cfc0c9e5aeb0396e557d3996a9bae6205aafaa034f3cb6554` |
| `packages/verified-issuer-runtime/linux/clockbound-precise-origin.patch` | `ce791c7fb9757d6d00ba754161364926dd422cce366c7813b5b0dc87f0906ab1` |
| `packages/verified-issuer-runtime/linux/time_publication.c` | `bf3fdd4b9fed5c5670f1965b291c8ecdec3846f0df0a0ec66db3511f1a8936d9` |
| `packages/verified-issuer-runtime/linux/time_publication.h` | `04997b0be3d56b6e0399e2e6a3a01236eb9995b2ffb3e8acbccccf1e1dda79c6` |
| `packages/verified-issuer-runtime/linux/time_publication_adapter.rs` | `903c2b33c8bec5969c4b3fd6040f8c5a965f70b91d02c0e2f6e50198e6eb7156` |
| `lib/governance/platform/nativeTime/README.md` | `d393baa0775e2afbb4677d087511253faef1fe33c377063b46ac3327227b9fdd` |
| `packages/verified-issuer-runtime/linux/README.md` | `47c8d788bab2750ce8de4ad1e19376dc5aba5d8e642cb35e98c14c3f5df66aab` |
| `lib/demo/demoScenarios.ts` | `567982e5da0fb753d27d1468c853b1c1fdfbac5eb9bdddb7d8d416674162cc04` |
| `docs/recovery/2026-11-13/real-governance-qualification/design/precise-origin-local/UPSTREAM-MANIFEST.json` | `905249c3f1cae23b8d84a844779bb7054142d989a39900ba701a47a1ef014473` |

## Design-to-upstream closure and exact patch text

Independently rechecked all22manifest entries (20Rust sources plus2license texts): byte size, SHA256 and Git blob SHA1 match. All19changed upstream files reconstruct from exact original hunk context with matching old/new line counts; no old patch is stacked. The remaining time/tsc.rs fixture is the unchanged numerical-reference source. The manifest's exact hashes bind the license text and all additional exhaustive struct-pattern/fixture sites.

| Design responsibility | Exact upstream paths under clock-bound/src/daemon/ |
| --- | --- |
| Owned constructor/control order | daemon.rs (one directory above daemon/), clock_state.rs |
| Precise read/type and numeric reference | time/clocks.rs; time/tsc.rs (unchanged reference) |
| Exact I/O tuple/event association | io/ntp.rs; io/phc.rs; event/ntp.rs; event/phc.rs |
| Candidate/selection propagation | clock_parameters.rs; clock_sync_algorithm/ff/ntp.rs; clock_sync_algorithm/ff/phc.rs; clock_sync_algorithm/selector.rs |
| Owned publication + stock/fixture closure | clock_state/shm_writer.rs; clock_state/shm_writer/shm0.rs; clock_sync_algorithm.rs; clock_state/system_clock_discipliner.rs; clock_state/system_clock_discipliner/state_machine.rs |
| Log exclusion/reconstruction closure | logging/ffevents/types.rs; logging/ffevents.rs; logging/synchronization.rs |

Exact reconstructed changed-source hashes (text only):

| Upstream source | Patched SHA256 |
| --- | --- |
| `clock-bound/src/daemon.rs` | `b7d81c766ccc6da89e05cd78bfc6562539f86ea9de4543d4a664250e759b330c` |
| `clock-bound/src/daemon/clock_parameters.rs` | `a80b84e64c57576db6e913dfccfc8e4fc4bc214d8c2e5af1a0ea6c2bda041763` |
| `clock-bound/src/daemon/clock_state.rs` | `d677d5d7904b57608c46b4b3d51f7b8554105beb52b74d73690110c56df972b2` |
| `clock-bound/src/daemon/clock_state/shm_writer.rs` | `ad5fc7ff4102261735fff7e637feaa2cb00a1e25b03c023f075cba1855e55f04` |
| `clock-bound/src/daemon/clock_state/shm_writer/shm0.rs` | `d2327f937279b1d3de3088422d3ba4625510de57ec2a375490482d6bb7929f2f` |
| `clock-bound/src/daemon/clock_state/system_clock_discipliner.rs` | `b24aab9c5bc175e469a0b5c10ed8d24818e67cedc602f2d010e0392cfcd378b0` |
| `clock-bound/src/daemon/clock_state/system_clock_discipliner/state_machine.rs` | `8819766415dd0d4f82bd0eb8786926485efede363f391b4d17f3e37adc1ee2d3` |
| `clock-bound/src/daemon/clock_sync_algorithm.rs` | `cb0eabd5c8080c1ffb9d095b6444fc35d7e42c6ccb3aa4ac92b9885b869c3b3f` |
| `clock-bound/src/daemon/clock_sync_algorithm/ff/ntp.rs` | `61455fe4faf3fcfce8579edd0699515d8e89e9a1de0ea7a0ee5e4ebf96480764` |
| `clock-bound/src/daemon/clock_sync_algorithm/ff/phc.rs` | `60bc9018ae437c161853dfee1632c9cf9223b3aab5bc33b6f903f4a141f8323f` |
| `clock-bound/src/daemon/clock_sync_algorithm/selector.rs` | `6be7c016c9b37bd6790c52d21680a3930a90b76024e1f5263f120d13818c9695` |
| `clock-bound/src/daemon/event/ntp.rs` | `3dd4e541cf172283701e5aa4c3a31c6c9763d64a6f0a1f16b7c640b718efc41c` |
| `clock-bound/src/daemon/event/phc.rs` | `ec991085122f902cd6cf856a9227564f69f38fcbdbed0f575517cf9d6cadec92` |
| `clock-bound/src/daemon/io/ntp.rs` | `9d37c923926ee784086b3c848e26c17ff4e4f978fa384b2f8d7b0d86e5fe14d5` |
| `clock-bound/src/daemon/io/phc.rs` | `08dc642de1971f3c6ee9c936deec16ad38e390c091ce4796919f3893635eba5b` |
| `clock-bound/src/daemon/logging/ffevents.rs` | `dbd016e99a937786ce10f53f124aff3690886073a66789dce8eb066e5ae43fde` |
| `clock-bound/src/daemon/logging/ffevents/types.rs` | `23bdeda049157e9868001705e72200303f9935f9e8384e9b1131dc521bfd619b` |
| `clock-bound/src/daemon/logging/synchronization.rs` | `13d556a5596babae44749afbda994a6f58f019be305b3a197b6cc6f6d9a0e641` |
| `clock-bound/src/daemon/time/clocks.rs` | `6ee3967a970795f408caea104cc0994fa1c428aa57c0dfcd2f5cca1767803422` |
