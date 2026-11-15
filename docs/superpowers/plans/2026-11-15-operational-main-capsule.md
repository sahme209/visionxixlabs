# Operational private-main capsule implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation. The owner has already directed continuous authorized execution; no routine approval checkpoint is required.

**Goal:** Produce the single closed JavaScript file required by the administrative owner's existing main-file hash, with reproducible source identity and no target runtime execution.

**Architecture:** Bundle exactly the reviewed installed main, native ports and operational source into one ESM file. Permit only the two fixed Node builtins externally; replace only the `server-only` deployment marker in this private installed artifact. The owner still hashes the resulting complete main file; native addon, daemon, worker, Node and profile retain their separate existing bindings.

**Tech stack:** Existing Node24, root rolldown1.2.19 and retained TypeScript5.9.3 API; no installation, dependency change or new native target execution.

**Spec:** `docs/recovery/2026-11-15/governance-operational-package/NEXT-PACKAGE-PLAN.md`, actual `time_operational_owner.c` six-member hash list, and reviewed `installedOperationalMain.ts`.

## Global constraints

- Governance remains disabled; this supplier checkpoint is not the complete credential/provider runtime.
- No private connection read, production mutation/promotion/build, cloud/resource/provider action, native addon/clock loading, installation, publication or spending.
- Preserve original runtime guards, 500ms observation/100ms cleanup budgets, original initializer identity, fixed addon path and unqualified receipt.
- Use the existing compiler only. Do not renew historical source/native/compiler qualification packets.
- Emit one main.mjs without source maps, sidecar modules, arbitrary externals or authoring paths. No source/program execution during bundling or syntax checking.
- Install ownership, target Node24.22.2 provenance/ABI, six-hash owner build, actual lifecycle and real provider/custody qualification remain separate open requirements.

## Review focus

- Unexpected runtime imports or dynamic imports must fail before producing an accepted artifact.
- Symlinked/replaced/changed source must not enter a source-bound result unnoticed.
- Extra generated chunks/assets/imports must not escape the one-file owner binding.
- An existing or replaced output directory/file must never be overwritten or accepted.
- Compiler outputs and reports must not imply native execution, administrative cleanup, production qualification or Governance enablement.

### Task 1: Closed compilation and output validation

**Files:** Create `scripts/build-operational-private-main.mjs`, `scripts/tests/test_operational_private_main_bundle.mjs`.

**Interfaces:** `compileOperationalPrivateMain({sourceRoot})` returns `{code, receipt}` in memory. It reads only the three fixed repository source files, compiles them with fixed plugins/options, verifies exact module closure and two builtin externals, rechecks source identity, and reports source/compiler/output hashes. `writeOperationalPrivateMain({sourceRoot, outputDirectory})` exclusively creates a new owned directory and two fixed files `main.mjs`/`SOURCE.json`; it never loads the result or addon.

- [x] Write tests that fail when the compiler module is absent: actual-source single-file compilation, unexpected import rejection, symlink refusal, unchanged-source binding, exclusive output refusal and no target-addon execution.
- [x] Implement the fixed resolver/load policy using existing rolldown. Read source into an immutable in-memory map before compilation; fixed virtual server-only marker only. Reject source/output policy violations with fixed value-free errors.
- [x] Validate exact compiled module IDs, output count/imports/exports/dynamic imports, source stability and size bounds. Record deterministic source/output hashes and actual local compiler identity without claiming a whole hostile build environment.
- [x] Run `node --test scripts/tests/test_operational_private_main_bundle.mjs` on pinned local Node24. Expected: all capsule checks pass, actual artifact never imported.

### Task 2: Actual artifact, living evidence and review

**Files:** Update this plan, package preparation docs, internal walkthrough and living status files; preserve existing history/backups.

**Interfaces:** Use Task1's exclusive writer to emit one fresh private temporary artifact directory. Record main.mjs SHA256/size, source receipt and syntax-only check; never install it at the fixed privileged path or run it.

- [x] Run the capsule producer once after its tests pass, then syntax-check the resulting ESM with `node --check`. Expected: one closed main and fixed receipt; no target code execution.
- [x] Run relevant installed-main/bridge/time/demo checks, strict root types, required ordinary suite and diff checks. Retain any genuine failures and correct source-supported regressions without loosening guards.
- [x] Obtain one independent whole-branch source review, including the prior entrypoint and new build/materialization seam. Resolve important findings with reproducing tests.
- [x] Update source evidence/demo/living records, preserve the full active goal mirror. Select only coherent source/docs/evidence for a later batched commit; do not stage private caches, historical packets or trigger a receipt-only PR/build.

## Self-review / execution ruling

The whole package spec additionally requires target provenance, native ABI/outputs, profile materialization and administrative lifecycle. This plan closes the actual JavaScript dependency/hash seam within that package; those other requirements remain explicit and are not replaced by this deliverable. Task2 consumes exactly Task1's writer/receipt. Owner's continuous-execution direction supersedes the generic skill handoff question; root implements inline and uses one independent final review.
