# Controlled local issuer launch — exact remaining gates

November 3, 2026 · source/evidence audit only. No code, build, launch, native
experiment, provider request, database action or executing identity was produced.

The [original artifact proposal](../2026-11-02/governance-issuer-artifact-binding-proposal.md)
is **USER-APPROVED LOCAL IMPLEMENTATION**, call
`e3d8994aa36e4a64b7293ece87346e14`. Its scope is a closed package followed by a
controlled pre-import launch and private same-module identity under a trusted-local-host
model. The [additional native proposal](../2026-11-02/governance-native-bootstrap-proposal.md)
remains pending specific approval. This audit adds no new acceptance gates.

## Requirements mapped to current evidence

| Original requirement | Current evidence | Remaining gap |
| --- | --- | --- |
| Exact successful source/build and closed observed package | [Actual private-copy receipt](private-package-fat-progress.md) and [result](private-package-fat-result.json): application source `066d821a82d9317f90a2127fe20a2773d252f168`; Python and updated **external** CJS agree on 95,306 regular files, 53 internal links and package digest `2a377866179b4096a5c809a847ac861770aebdecdff0f459fc4b0f9a8a335685`. | This is file-set observation, not executable/process identity or proof of complete dynamic resolution. |
| Actual native/runtime prerequisites and no source fallback | [Typed native inspection](../../../scripts/governance_local_issuer/native_linkage.py) retains whole-binary hashes, typed LOAD/ID distinction, contained exact dependencies, declared system-library host prerequisites, unused search contexts and FAT descriptors/selected arm64 metadata. The materializer retains actual Node, dependencies, generated inputs and traced support files. | Inherited search, dynamic loading and runtime qualification remain unavailable. Other FAT architectures are explicitly uninspected. No actual compiled Next/issuer process has demonstrated operation without source-workspace fallback. |
| Immutable root before import | The actual copied package remains mutable trusted-host data. [Earlier seal/control receipt](../2026-11-02/governance-local-package-progress.md) records a small readonly data fixture and separate child control. | Those controls are not capabilities for a different process. Actual executable-root and backing-file protection must hold before this issuer imports application code. Permissions alone or a parent's JSON cannot establish it. |
| Controlled packaged Node/main and loader isolation | [Python launcher](../../../scripts/governance_local_issuer/launcher.py) rejects overrides and performs preflight; `launch_verified_next` deliberately refuses without starting Next. [CJS controls](../../../packages/verified-issuer-runtime/internal/inspect-launch-controls.cjs) observe current executable/module/readonly details only. | No actual fixed-entry, clean-environment, pre-import controlled issuer launch exists. Current-process observations cannot undo prior preloads or qualify already-loaded modules. |
| Private same-module capability and one exact identity | [Canonical main/reader](../../../packages/verified-issuer-runtime/index.cjs) always returns unavailable and refuses as main. The [server adapter](../../../lib/governance/intelligence/issuerArtifactIdentity.ts) delegates to that reader. | No initializer, digest or identity is emitted. The copied source066d canonical module is the old `/1` verifier, while external tooling supports `/2`; external parity does not update copied code or prove same-compiled-consumer acceptance. Never patch the copied module or substitute a workspace import. |
| Same-artifact actual compiled issuer/store/transport acceptance | The original proposal requires this composition with clearly simulated auth/provider ports, together with tamper, partial, loader/cache, pre/post-import replacement, duplicate resolution and restart cases. | These positive controlled-launch and actual compiled-consumer cases remain missing. A toy fixture, source test or package observer cannot replace them. A future exact build must contain the reviewed bootstrap and actual compiled consumer together. |
| Runtime-derived outbound digest, with qualifications separate | [Drain contracts](../../../lib/governance/intelligence/drainContracts.ts) still require an actual `issuerArtifactDigest`; the server reader remains unavailable. | No real outbound identity wiring may substitute a package/source/BUILD_ID/environment digest. Local identity, if later accepted, still supplies no action permission, fleet/legacy qualification, provider quiescence or activation. No active worker or fleet inventory is asserted here. |

## Precise pending boundary and next sequence

The pending additional experiment is exactly
`sandbox_init(kSBXProfileNoWrite, SANDBOX_NAMED, &error)`, using the inspected public
SDK contract and proper error cleanup. It accepts no literal profile, private ABI,
caller flags, policy text or mutable-data exception. It cannot be chained with an
already-installed profile. The public API is deprecated/no-longer-supported; actual
installation and required denial behavior must be tested rather than assumed.

After explicit approval, the smallest sequence is:

1. Implement the fixed native feasibility probe and owned positive/negative write
   controls. Demonstrate the required package/backing-file operations and retained
   descriptor cases; report unsupported behavior honestly. This first probe emits
   no identity and authorizes no provider traffic.
2. If that mechanism is viable, complete the actual main-only, same-module private
   bootstrap and controlled launcher within the reviewed topology. Verify package,
   runtime, canonical native component and clean loader state before application
   imports. Direct imports/duplicates/restarts cannot initialize or replay state.
3. Batch the genuinely changed bootstrap/runtime/consumer source into a new exact
   build and package. Exercise the actual compiled issuer/store/transport composition
   from that same sealed package, with simulated external ports clearly labeled and
   every original acceptance gate preserved. Do not retrofit source066d.
4. Only after that evidence is reviewed may the actual provider expose the local
   executing package digest for outbound binding. Current role/source/approval/
   claim/credential/drain authority remains independently mandatory.

Until the native decision, source-level design and documentation work remain
available; no alternative weaker identity, another observer, source harness or new
build is being implemented here. The pending boundary does not globally block B1,
customer workflow or factual documentation work.

## Limits that are not additional identity gates

The original design does **not** require vendor endorsement/attestation of trusted
local engine bytes, network/process-execution denial from NoWrite, hostile-host
resistance, or universal descendant quiescence. NoWrite is credited only for actual
qualified write restrictions. Existing task restrictions still prohibit provider
traffic, and existing independent action controls remain mandatory. Fleet absence,
legacy bearer lifetime and asynchronous provider quiescence stay separate missing
activation qualifications; a local package/launch result cannot manufacture them.

No positive `local_verified_launch`, executing `issuerArtifactDigest`, production
availability, enrollment or activation is claimed by this audit.
