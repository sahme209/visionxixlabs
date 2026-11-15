# Original external attempt gate implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task only after the explicit owner authority decision.

**Goal:** Add the real private local attempt-consumption primitive needed before the future external supervisor may create a host or start its original owner.

**Architecture:** One effect-free-on-import Python module owns exclusive journal creation, sync-before-grant and single-use in-memory phase claims. It contains no provider/host launcher and cannot reconstruct an execution grant from disk. All real authenticity/controller/storage/native/provider qualification stays unavailable.

**Tech Stack:** Existing Python standard library and unittest; no dependencies or SDKs.

**Spec:** docs/recovery/2026-11-15/governance-original-attempt/DESIGN.md

## Global constraints

- Local implementation/test approval must exist first; do not infer it from the semantic policy split approval.
- No real journal, native/clock/service/host, account/credential/provider/SQL/cloud/deployment/resource/spending effect.
- No public qualifier/CLI, synthetic live receipt, new package or automatic retry/reset/reissue.
- Missing authentic manifest, original controller/storage or receipt supplier stays unavailable; no JSON shape qualifies it.

## Review focus

1. An interrupted/ambiguous marker write must never return a grant or imply durability.
2. A copied/reloaded/foreign grant must never authorize create/start; process restart intentionally loses execution authority.
3. The original fsync/identity ordering must not be replaced by a named-path existence check.
4. Synthetic receipt identity must remain test-only and cannot become provider authority.
5. Cancellation/watchdog/reboot/cleanup must never reopen a consumed namespace or claim unobserved power-loss persistence.

### Task1: Closed original manifest and durable local marker

- [ ] Add actual tests first in scripts/tests/test_governance_original_attempt.py for invalid/duplicate/extra/oversize/noncanonical input and original digest/identity/protected ancestor binding mismatch, missing original deadline and expired deadline; observe RED from missing implementation.
- [ ] Implement scripts/governance_original_attempt.py with closed record/manifest validation, held directory/file identity, exclusive marker, bounded write and file→directory sync order. No production controller/root path is chosen.
- [ ] Invoke actual fixture filesystem code and injected failures: full/short/zero/error write, existing valid/partial/corrupt marker, wrong/link/replaced original, file/directory sync failure, cancellation; observe GREEN with zero grant on uncertainty and no unlink/repair.
- [ ] Preserve initial failures and exact source/log hashes; do not execute host/native/provider behavior.

### Task2: Original opaque grant and phase consumption

- [ ] RED tests for foreign/reloaded/copied/retired/repeated grants, competing threads, close-versus-claim, simulated post-fork PID change before lock, original deadline equality/expiry, cancellation, missing original creation receipt and simulated restart. Keep authentic receipt production supplier absent.
- [ ] Implement once-only creation claim/retirement private to the original PID/instance, atomically under its original lock with PID-before-lock refusal and original deadline/currentness/cancellation checks; consume before returning. Production owner-start stays negative-only. Any positive owner-start example is a separate test-only specification model, never a runtime constructor/import path. No callback execution or generic effect factory.
- [ ] GREEN actual module tests, existing bootstrap/source tests, relevant ordinary contracts and strict types as affected. Ordinary tests do not qualify provider or target host.

### Task3: Independent source review and coherent savepoint

- [ ] One independent whole-change review of original manifest provenance, file/directory sync ordering, crash/refusal and test-only receipt seam. Reproduce material findings RED→GREEN; retain evidence, no fabricated final CLEAR.
- [ ] Update package/host gap map and complete living goal with timestamped preservation backups. Mark external controller/storage/authenticity/provider/native/runtime/cleanup qualification OPEN; Governance DISABLED.
- [ ] Save one coherent local commit; no extra PR/CI/deployment or real journal run follows automatically.
