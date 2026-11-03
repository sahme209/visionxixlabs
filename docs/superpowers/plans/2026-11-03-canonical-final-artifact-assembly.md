# Canonical Final Artifact Assembly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing prebuild native overlay and verified materializer to one inspectable unqualified control-app/resource packet, without substituting packaging for executing-consumer authority.

**Architecture:** Preserve the current fixed role order and unchanged Node. Calculate the package manifest after materialization; place its raw-file hash in the external control resource binding, then seal only the outer registration app and recheck all inner roles. No runtime reader is enabled by this assembly.

**Tech Stack:** Existing Python packaging/manifest/native-linkage tools; local macOS compiler/codesign/hdiutil operators only when separately authorized; registration-only Foundation/SMAppService source.

**Spec:** `docs/recovery/2026-11-03/xpc-origin-local-unit/canonical-integrated-next-unit.md`; exact reconciled source map `docs/recovery/2026-11-03/canonical-final-assembly/source-map.md` (479ac14a).

## Global Constraints

- Plan/source inventory only in this task. No implementation, actual compile/sign/build/image/mount/profile/service/identity/provider effects now.
- **Qualification blocked:** actual compiled consumer→private canonical/native authority at durable claim/final send has no completed reviewed contract/evidence. Do not generate the blocked test, wire a verified variant or claim assembly resolves it.
- No mutation of completed build stages/receipts or old066/2fa packages/claims; one new exact-source packet.
- Manifest binding is outside the package; no self-referential compiled digest. Node/inner role bytes and requirements never change after capture; no `--deep` signing.
- Every output says runtime/issuer qualification unavailable and executionfalse. Production/fleet/legacy/enrollment remain unavailable.

## Review Focus

- Do not confuse raw manifest-file SHA256 with canonical JSON packageDigest (newline differs).
- No placeholder future cdhash can stand in for the controller→broker→guard dependency order.
- Outer resource sealing must not resign or alter inner pinned tools/package native bytes.
- Unknown image/registration/cleanup outcomes must retain consumed history, never retry/adopt/delete evidence.
- Control app must use its actual own main bundle/executable and fixed service; copied diagnostic hosts or caller-selected services refuse.

---

### Task1: Exact source/operator handoff and production-named registration source

**Files:** Modify `scripts/governance_local_issuer/native_overlay.py`; create `scripts/governance_local_issuer/origin_registration.m`, `scripts/governance_local_issuer/control_artifact.py`; tests `scripts/governance_local_issuer/tests/test_control_artifact.py`.

**Interfaces:** `compile_role_command(role, stage, node, layout, available_requirements) -> fixed argv` requires only that role's already-derived requirements. `prepare_control_layout(layout) -> nonauthorizing plist/compile instructions`. `record_overlay` remains the original complete prebuild input snapshot; do not change its meaning or fabricate missing hashes.

- [ ] Write ordinary fixture tests for controller-first command construction, missing required predecessor rejection, exact fixed service/app/executable plists and no registration invocation during preparation.
- [ ] Run the new ordinary test file to observe missing-operator RED.
- [ ] Implement the bounded source-only operators; registration main derives exact actual app/declaration/process identity and returns inspect before SM. Preserve established first-registration/ownership semantics.
- [ ] Run ordinary fixture/source/compile-only checks after local scope is authorized; no service API or compiled runtime invocation. Review root's fixed app/main name choices from source map.
- [ ] Commit source/evidence for independent review. This task does not authorize actual signing or a fresh build.

### Task2: Immutable materialized package to external resource-binding assembly

**Files:** Create `scripts/governance_local_issuer/control_assembly.py`; reuse existing `materialize.py`, `manifest.py`, `native_linkage.py`, overlay verifiers; tests `scripts/governance_local_issuer/tests/test_control_assembly.py`.

**Interfaces:** `prepare_control_assembly(materialization_receipt, completed_package, original_overlay) -> AssemblyPlan` rechecks original inputs and produces exact bounded image/seal commands, output paths and expected existing five-field binding. `execute_reviewed_control_assembly(expected_plan_sha)` is a separately gated future effectful entry, never invoked by import/preparation; it grants no identity. No generic arbitrary-command executor.

- [ ] Pin ordinary metadata fixtures proving exact original source/overlay/materialization handoff, raw-file manifest hash including newline, critical anchor/allowlist agreement and stale source/output rejection. No compiled-consumer harness is generated.
- [ ] Observe RED for the missing assembler, then implement minimum existing-mechanism source. Reuse already-reviewed bounded subprocess pattern without repointing or modifying old consumed drivers.
- [ ] Binding output is exactly `format/packageRoot/imageBacking/manifestSha256/sourceRevision`; exclusively create owned new outputs/claim before any later effect; reject partial/prior artifacts.
- [ ] Model future effect failures with ordinary mocked subprocess responses only: no retry, no output adoption, unknown remains unknown. Stream image metadata under8GiB rather than using package-file2GiB limit.
- [ ] Independently review source before any real image/sign operation. Preserve original package/build receipts byte-for-byte; no outer-seal implementation is inferred complete from tests.

### Task3: Final packet read-only verification and exact-run handoff

**Files:** Create `scripts/governance_local_issuer/control_packet.py`; tests `scripts/governance_local_issuer/tests/test_control_packet.py`; receipt under `docs/recovery/2026-11-03/canonical-final-assembly/`.

**Interfaces:** `verify_control_packet(packet_root, expected_plan_sha) -> UnqualifiedPacketObservation` rechecks all actual app/binding/image/package/overlay/native closure bytes and inner cdhash requirements after outer sealing; no ready/verified-issuer type or authority setter. A later exact reviewed runtime harness consumes its hashes only as artifact binding.

- [ ] Write ordinary fixtures for changed inner role, wrong binding/source/raw manifest hash, wrong own-app identity and incomplete cleanup receipt rejection; expected fields remain unavailable/executionfalse.
- [ ] Implement read-only packet observation without service status/registration, image attachment, profile execution or provider/credential I/O.
- [ ] Require post-seal byte equality for unchanged Node, broker/controller and package native outputs; strict outer signature verification is integrity evidence only. No deep-sign fallback or patched helper.
- [ ] Save source/ordinary fixture results and exact remaining core-authority dependency. Request a new exact actual-run decision only after that contract and permitted final-artifact acceptance are resolved; do not perform a package experiment as a substitute.

## Scope audit

This plan fills named missing operators only. It does not implement the consumer-authority contract, lift an unavailable runtime type, qualify a real artifact, install a service, alter any approval, enable Governance or satisfy the full master plan. If a proposed operator would change any of those trust boundaries, stop for the smallest explicit design review rather than silently treating it as assembly.
