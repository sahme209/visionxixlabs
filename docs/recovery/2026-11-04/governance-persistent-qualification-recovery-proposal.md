# Recover the missing Governance qualification preparation

**Design for review. No implementation or experiment is authorized by this document.**

## What changed

All four temporary files bound by packet909 are missing: the helper, runtime packet, prepared controller copy and immutable fixture. The original instruction says, “Any changed binding stops pending review.” Recreating their names would not restore their file identities or approval.

The old experiment remains **never executed**. Preserve its source, hashes and receipts as history. [The assessment](governance-qualification-artifact-loss/assessment.json) records existence checks only; no helper or controller was invoked. The [original execution instruction](../2026-11-03/compiled-consumer-authority-bridge/in-memory-policy-qualification-execution-instruction.md) remains historical evidence.

## Recommended design

Use one fixed persistent lab directory outside temporary storage and managed Documents:

`/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-04-v2`

This is my proposed local test location, not a production installation path. Reject an existing, unowned or symlinked destination instead of adopting or overwriting it.

Keep exactly two fixed builder profiles. Profile0 retains its existing unallocated canonical path and closed supplier gate. Profile1 changes to the explicit new lab fixture, `.../2026-11-04-v2/pure-test`. Preserve the old profile1 source at its frozen Git revision and keep the old909 receipt unexecuted. Add no third profile, runtime path argument, environment override, arbitrary path macro or fallback search.

Reusing temporary names would leave the same loss risk and different inode/ctime values. A caller-selectable path would broaden the trust boundary. A fixed persistent lab preserves the finite configuration while leaving canonical execution unavailable. Changing the previously reviewed fixed test path and fixture identity requires review before implementation.

## Requested scope: local preparation only

1. Change only the test literal and versioned lab provenance. Keep the canonical default, supplier gate, unmounted business channel and production enrollment refusal unchanged.
2. Compile a fresh fixture from the reviewed pure copier source and a helper from the reviewed builder/copier/inspector/qualification sources, using existing Clang and SDK tools. Use a private0700 directory, umask0177 and0600 outputs. **Do not execute the designated fixture or helper.** Do not sign them, grant access or invoke Security/Keychain APIs.
3. Bind the new resolved paths, owners, modes, device/inode, sizes, timestamps and hashes. A fresh Mach-O may have a different code identity; never call it the oldd136 fixture or claim OS acceptance from source equality. Record the compiler, SDK and source freeze.
4. Prepare a separate fixed controller copy with fresh packet/helper/fixture paths and digest. Retain the10-second deadline,2048-byte output limit, one child, zero retries and owned-process cleanup. Only separate pure buffer tests and mocked controller tests are allowed; no helper loading or controller RUN/preflight/--help invocation.
5. Retain the acyclic binding chain: source/helper/fixture metadata → packet → controller → external review receipt. Exclude the packet itself, controller and external receipt from packet payload records. Capture any future chmod ctime during an authorized run; never predict it. The helper and fixture remain0600 after preparation.
6. Independently review the exact compiled package and prohibited symbol surface. Preserve the seven-Security-call/two-CFArray trace and serialization inspector. No installer, privileged service, mount, supplier delivery, real database/vault/session/provider access or activation is included.

## Separate execution gate

After preparation produces a concrete reviewed packet, obtain a new specific one-attempt execution decision. Preparation approval does not permit the experiment. Its scope would remain in-memory construction/export/reconstruction/inspection only: no Keychain item operation, installed policy or real credential access. Changed bindings, failure or uncertainty stop the attempt without an automatic retry or signing fallback.

Even a successful component result would not complete installed-policy enforcement, custody, the executing issuer/compiled consumer, real resource compatibility, legacy/fleet/mutation coverage, independent human review or enrollment. Full Governance remains open.

Preparation acceptance requires fresh artifact/source identities, proof that canonical execution stays closed, correctly scoped pure-test results, preserved old history and an external instruction with exact hashes and exclusions. The [ten-point packet](governance-qualification-artifact-loss/EXECUTION-PACKET.md) authorizes only this documentation and assessment step.
