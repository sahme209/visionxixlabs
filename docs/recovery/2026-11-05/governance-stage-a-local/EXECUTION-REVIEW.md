# Exact principal-free StageA execution review

Status: prepared, NOT executed. Source revision `a1e6099a7c4797fbd218e2e79786e57b06d31bf5` (isolated tree over7ffaaf92), exact working master/view preservation verified. Packet: `/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-stage-a-a1e6099a/packet.json`. SHA256 `3dd616d26a29d83af24363120615b2208babbdd15dccf6b98b8e286c7e6c9224`. The Git archive SHA is a conditional A0 output, not a pre-existing observation.

This exact packet supersedes historical proposed e6f coordinates: all new outputs are under its fixed `work/`, including `work/offline/result.json`. It reuses the unchanged bound engine input data from the successful0b0 build; it does not adopt that historical runtime's authority. Current canonical generation proof replaces the obsolete raw-schema-equality/installed-sidecar assumptions.

Cache selection: `declared_optional`; details and original/copied coordinates are bound in prepared-packet.json. All source/tool/engine/recipe fingerprints are packet-bound. Ordinary file/cache preparation completed without a subprocess or vendor boundary. Earlier file-only preparation refused changing metadata before creating destination;53source and9recipe evidence files subsequently passed stable observations. No failed artifact execution was reset or replayed.

## Actual programs and invocations covered by the proposed bundle

- Parent Python calls the fixed `execute_stage_a_packet(packet)` once. It reserves exclusive attempt/result files before invoking `/usr/bin/sandbox-exec` → the bound Python → fixed `--driver-child packet`.
- A0 invokes `/usr/bin/sandbox-exec` → bound Python → fixed `--offline-child packet` once. Existing source inspection/archive helpers invoke fixed `/usr/bin/git` commands (including repeated source/show checks and one selected source archive, under their existing sandbox). They use the validated work-contained Git spool directory.
- A0's existing offline installer invokes sandboxed pinned Node `--version`, pinned Node + npm CLI `--version`, then **one** pinned Node + npm CLI offline `ci`, with lifecycle scripts disabled and audit/funding/update notifier disabled. No network fallback or second install.
- A1's existing `execute_generation` invokes sandboxed pinned Node four times: `--version`, Prisma `format` on an archive-schema scratch copy, Prisma `generate` on the staged source schema, and Prisma `format` on a generated-schema scratch copy. The pinned owned schema/query engines may be loaded/executed by those CLI operations. Repeated source/Git/SRI/native-header checks are part of the existing preparation before/after these commands. No database connection or SQL execution is requested.
- A2 invokes `/usr/bin/sandbox-exec` → pinned Node → the fixed staged `scripts/emit-synthetic-fixture-producer.cjs` once; this actually runs the local compiler and its finite reviewed NextRequest/Zod dependency closure. This is producer emission, **not** a full Next production build.
- Final reconciliation is file-only in the parent: exact phase/source/current generated-output/producer bindings. It does not repeat generation or invoke Git from the parent.

## Bounds and retained outcomes

Driver active budget: **360 seconds**, with a reserved 20-second cleanup margin when calculating remaining phase budgets. A0 ≤120 seconds; generation ≤120 seconds; emission ≤60 seconds, each also capped by remaining driver budget. Outer owned-child ceiling: **390 seconds**. These are existing supervisor/process bounds, not a claim that every synchronous observation or all descendants are universally time-bounded.

Outer and A0 hard per-file limit: **512 MiB**, required for the existing Git archive spool ceiling. Generation retains its existing **128 MiB** child limit; emission explicitly uses **128 MiB**. The existing supervisor separately monitors its captured log at **64 MiB**. These are per-file/observed-log limits, not a total disk quota. Parent logs are exclusive mode0600; fresh private directories and copied input/output evidence are retained.

A first error stops later phases. Known failure remains refused; uncertain timeout/cleanup remains **unknown**, with the attempt consumed and partial files/logs retained. No deletion/reset/adoption/replay, automatic retry, second archive/install/generation/emission attempt or cleanup-success fabrication. A later retry would need a separately reviewed fresh packet and authorization.

## Scope and qualifications

The selected sandbox denies network and constrains writes; default reads remain available where not explicitly denied. It is **not** universal secret/read isolation. The offline installer reconstructs its own existing clean environment; it does not inherit every outer HOME/XDG setting. Existing generation children own separate process groups: post-reap descendant quiescence remains unavailable, and an outer timeout does not prove every nested descendant stopped.

No root/service/account/Keychain/signing/image/mount/native-runtime/SQL/provider operation, paid CI, deployment, full Next build, System or fixture-delivery record, enrollment or Governance activation is included. Success means only source-bound generated client and quarantined producer artifacts observed. Runtime/loader compatibility, installation, custody, same-consumer operational validation and complete Governance remain unaccepted.

Final approval question must name the actual prepared packet path/hash and source revision, explicitly cover all programs above, and authorize exactly one bundle with no retry or spend. Until then: **do not execute**.
