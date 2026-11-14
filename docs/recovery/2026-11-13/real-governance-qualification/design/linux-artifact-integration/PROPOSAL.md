# Connected Linux time artifact — minimal implementation proposal

Status: proposal only. No compilation, native execution, installation, launch, dependency acquisition, resource change or qualification is authorized or demonstrated here. This assessment reads repository source only. It does not replace the existing protected-runtime, credential custody or clock-premise requirements.

## What exists and what is actually missing

- `packages/verified-issuer-runtime/linux/time_publication.h` declares the producer ABI (`axiom_time_publish_or_die`) and raw reader ABI (`capture_v2`, `capture_current`, `capture_release`). There is no executable main, Node binding or process-output codec. A C struct containing `size_t`, an FD and compiler padding is not an IPC format.
- `time_publication_adapter.rs` owns one publisher directory FD and encodes the exact twelve-line record. Its native extern has no linked C object/build recipe yet. `clockbound-daemon-integration.patch` has actual daemon/ClockState/Shm0 hooks, but no qualified executable invokes `Daemon::construct_axiom`; the original executable can still invoke the unqualified stock constructor.
- `lib/governance/platform/nativeTime/source.ts` implements the bounded supervisor, but all six real ports (`hold`, `release`, `assertCurrent`, `start`, `observeCurrent`, plus worker termination/completion) lack a connected native supplier. The held identity is intentionally opaque; matching a JSON object is not a replacement.
- `linuxComposition.ts` already passes the same resulting clock to the private custodian, workload identity, ECS transport and runner. It is dormant, and must receive the actual supplier from a protected initializer, not another publicly constructible qualification callback.
- `scripts/governance_local_issuer/system_build_inputs.py` binds macOS identifiers, app/DMG layout and signed `origin_guard.node`; `materialize.py` preserves those profiles. `packages/verified-issuer-runtime/package.json` exports only that existing runtime. These cannot honestly certify Linux by adding the C filenames to their macOS inventories.

## One connected implementation unit

Prepare a separate, closed Linux artifact recipe and initializer; leave the accepted macOS profile unchanged. The recipe must enumerate exact source/tool/dependency inputs, output hashes and Linux target ABI. It must refuse actual launch/activation by default. No automatic download or `cargo update` belongs in it.

### Producer linkage and entrypoint

1. Reconstruct the pinned ClockBound source from exact approved inputs and apply ONLY the final patch, never the historical draft. Place the Rust module at `clock-bound/src/daemon/time_publication_adapter.rs`.
2. Compile `time_publication.c` into a static object/archive with its exact header; link that into the daemon crate through an explicit reviewed build/link recipe. Preserve `repr(C)` context correspondence and verify target widths/offsets, not Rust compiler assumptions. The existing C `uid_t`/`gid_t` assertions alone do not verify the complete cross-language ABI.
3. Add a private fixed executable initialization path that receives the inherited protected generation-directory descriptor and its authenticated native bootstrap metadata; owns them once; calls `NativeTimePublisherContext::from_protected_resource`; and invokes `Daemon::construct_axiom`. No environment, CLI JSON, fallback stock constructor or request-controlled generation selects the qualified path. The stock executable remains unqualified.
4. Keep producer credential/resource scope separate from provider credentials. The producer receives no AWS/DB secret. Directory construction, ownership/group setup and lifecycle supervisor remain separately authorized real setup; source preparation cannot assert those happened.

### Reader bridge: parent-owned hold, one disposable child

Use a private Linux Node native addon for descriptor ownership/currentness and synchronous worker spawn; use one fixed reader executable per observation. Do not export raw FD constructors or `qualify(true)` through the public runtime package.

- `hold`: the addon, operating on the initializer-owned directory, opens `current` read-only/no-follow, captures native metadata, retains the original FD, and creates an opaque per-observation handle. Opening a new latest file is allowed ONLY here, not as repair of a changed hold. Source generation/lifecycle/disruption come from the original authenticated initializer/supervisor relationship, never merely the file payload.
- `assertCurrent`: operate on that original handle; verify original producer generation/lifecycle and actual disruption observation plus held-file/path identity. Reuse C identity checking where applicable, without relabeling it process attestation.
- `start`: synchronous native spawn registration owns the child before returning. Give it only a read-only duplicate of the held source FD, read-only directory access and fixed generation data through a bounded private bootstrap channel. Prevent accidental inheritance of provider/database descriptors. No environment/path-selected binary. Connect the exact `capture_v2` call to a versioned explicit ASCII output envelope containing raw record length/bytes and decimal uint64 metadata/R/P0/P1/P2; never dump `struct axiom_time_capture` or an FD number as authority. Total envelope cap must account for 4096 record bytes plus fixed metadata rather than pretending the entire output fits 4096. Refuse extra bytes/frames and nonzero or signaled exits.
- `completed`: resolves only after the native wait/reap event, not stdout close. `terminate` is idempotent and waits only for the owned child's termination; no PID-only kill of a recycled process. The source.ts 500 ms observation/100 ms cleanup limits stay intact. Native implementation must stop capture on abort and refuse if cleanup is uncertain; JS timers alone do not prove native termination.
- Child release: call `capture_release` before exit. Parent retains the original source FD throughout. The duplicate's close cannot invalidate that parent hold.
- `observeCurrent`: after child cleanup, use the parent's original FD and captured identity, repeat lifecycle/disruption/path checks, and obtain a fresh native monotonic P2. Preserve the original R/P0/P1. The current C `capture_current` does NOT sample a new P2 and does NOT establish liveness/disruption, so a real addon entrypoint must explicitly perform those operations. Attach only previously qualified fixed clock/rate/coarse-projection premises from the protected profile; absence refuses. Do not construct guessed narrow intervals from raw timestamps.
- `release`: close the original native handle only after its in-flight operations quiesce; retire on uncertainty. Native worker and parent lifetimes must match source.ts's late-hold release and one-observation-at-a-time rules.

### Private application connection

The fixed Linux initializer constructs the native addon instance privately, captures its bound methods as the actual `NativeTimeSourcePorts`, then calls `createPrivateLinuxTimeComposition` with those ports and the existing real private authorities. No public route, feature flag, production default or cloud credential supplier becomes enabled in this unit. The same clock instance must remain used at identity, claim and final transport boundaries.

## Source inputs not yet available/verified for a real build

Finite missing inputs, not a request for another broad source search:

1. Complete exact pinned daemon Cargo manifests/lockfile/build configuration, its executable main and full required dependency closure. The four/five approved text excerpts are sufficient for the reviewed patch, not a buildable crate inventory.
2. Exact Linux architecture, libc/toolchain/sysroot and Node executable/headers/addon ABI, plus target query-engine/runtime dependencies if the complete private executor is packaged. Existing macOS binaries/signing receipts do not establish these.
3. Actual fixed protected Linux launcher/bootstrap descriptor contract and supervisor/lifecycle/disruption implementation. Choose the artifact paths and descriptor map in its reviewed recipe; do not infer them from service names or JSON.
4. Concrete bounded native IPC envelope and addon source/entrypoint implementation described above, with actual input/output byte caps and close/reap ownership.
5. Qualified clock premise supplier (precise/coarse relation, quantization/rates/age and disruption/currentness); raw C timestamps and `time_authority=0` intentionally do not supply these.

## Next local acceptance and later real gate

After implementation approval, ordinary mocked/text tests can prove recipe inventory rejection, exact patch application, private entrypoint call graph, ABI/header field correspondence, envelope size/parser rules, synchronous child ownership, late hold/abort/termination/reap ordering, original-FD retention and same-clock composition. They must not label mocked native methods as native qualification.

A later separately approved exact Linux build must compile/link both sides and inspect actual artifacts. A separately approved isolated launch must establish descriptor inheritance/isolation, Linux ACL/filesystem/publication behavior, actual clock/daemon/disruption/lifecycle behavior and bounded child termination. Provider credentials/actions and resource provisioning remain separate existing gates. Do not add more generic qualification interfaces in lieu of these concrete connections.
