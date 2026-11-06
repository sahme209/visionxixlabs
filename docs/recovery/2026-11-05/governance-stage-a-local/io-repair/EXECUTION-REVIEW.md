# Proposed one corrected Stage A execution — exact review

**Pending explicit execution authorization; do not run.**

- Source freeze: `6fccbe8c70e091a319b04896d4dd9f0d0bd12a42`, including reviewed routine I/O correction commit `56000285`.
- Prepared packet: `Lab/2026-11-05-stage-a-io-6fccbe8c/packet.json`.
- Packet SHA256: `19286eaafd8b9288ed00a5415df07d5c3a2ac87fb0a25b4e55692dddd2b1f45c`.
- Root reports fresh ordinary preparation complete and no attempt reserved. These coordinates are supplied by root; this document performs no packet execution or repeated full input scan.

The prior a1 packet's one approved attempt is **consumed/refused** and must remain unchanged. Its actual logs did not capture the precise prelaunch errno. Source inspection and pure mocked tests established two incompatible Python DEVNULL read/write opens: supervisor stdin and artifact Git stderr. The new source passes an owned read-only EOF input descriptor and uses a separate private artifact Git stderr spool; it preserves the existing sandbox policy, legacy Git behavior outside explicit scratch selection, one-attempt records, source/recipe/client joins and authority refusals. Close uncertainty retains owned-child stop/reap discipline and unknown status; launch diagnostics contain fixed phase/class/allowlisted errno only.

This is a **new separately authorized attempt**, not renewal/reset of the old one. Local mocked checks and independent source review pass; no live corrected outcome, whole descendant quiescence or vendor-internal I/O compatibility has been proved. Nested policy compatibility remains under source review before an authorization question.

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

Any final approval must name the prepared packet and exact hash above, cover every program/phase above, and authorize exactly one corrected bundle without automatic retry or spending. This document grants no execution permission. A failed or unknown result must stop with all receipts retained.
