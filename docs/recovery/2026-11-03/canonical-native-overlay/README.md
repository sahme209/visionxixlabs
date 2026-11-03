# Explicit native runtime distribution and prebuild overlay — local only

Source base `4c6a46a2`. This adds local preparation code, not a completed runtime packet. No full application/native production compilation, image, profile, mount, service, issuer, provider or deployment run occurred. Python syntax compilation and owned ordinary packaging fixtures only. The actual compiled-consumer qualification remains unverified; no copied metadata becomes identity.

## Distribution and acyclic order

`package.json.files` explicitly lists index, types, README, internal full verifier and generated `native/origin_guard.node`. The overlay-aware materializer copies only those exact runtime files plus package.json, refusing a traced excluded source rather than silently dropping required support. Diagnostic origin-unit files, old unsafe guard/classifier and tests are not the runtime distribution. Default older unqualified materialization behavior remains unchanged when no native overlay was recorded.

The bootstrap is generated at `packages/verified-issuer-runtime/native/origin-bootstrap` before the build and copied to `__axiom_runtime__/origin-bootstrap` during materialization. Node is copied byte-for-byte from the same pinned Node used in the build; do not resign it and silently invalidate its build binding. Broker/controller are separate control-app inner tools.

Fixed recipe order: compile/sign controller → derive its exact cdhash requirement → compile/sign broker with controller and unchanged Node requirements → compile guard with broker requirement. Bootstrap compilation is independent. The module returns only fixed compile command arrays; it does not execute compiler/signing commands, any compiled host, broker or bootstrap. The frozen recipe can be inspected with `--print-compile-recipe`; requirements must be derived from actual signed files, never guessed. Overlay recording verifies those three file signature requirements read-only through codesign.

The completed package manifest is calculated only after materialization. A separate later assembler must put that digest/source into the outer control resource binding and seal the image/binding. No broker contains its own package digest. The outer registration main/seal is not misrepresented as an unchanged prebuild executable input: only separately signed controller and broker are bound in this overlay. Their inner bytes must remain unchanged through outer sealing. No image/binding/seal assembler is implemented or run by this task.

## Before a fresh build, never after a sealed receipt

`native_overlay.record_overlay(stage, revision, unchangedNode, layout, requirements, plannedBuildRun)`:

- requires canonical owned private stage/planned-build directories and an **empty** planned build run, no `.next`/completed-stage markers, no prior overlay receipt;
- validates exact fixed layout relationships: one service name, exact control image path and private-parent startup claim;
- hashes fixed source files, generated guard/bootstrap, pinned unchanged Node, its actual N-API header tree and signed control tools with bounded stable single-link reads; parent symlink escapes refuse;
- records fixed compiler macros/commands and exact file allowlist in a canonical exclusive fsynced receipt, with all issuer/runtime qualifications unavailable and execution false.

The source builder verifies the overlay in both phases, requires its source revision to match the actual archive, permits only its two generated file exceptions and receipt, and binds it into the build-input record. Generated native outputs may not be smuggled into the source archive. `execute_build` requires the exact predeclared empty build-run path before creating its attempt receipt. Changes after compilation/build make current rechecks refuse; there is no repair, resign, re-record or postreceipt patch path.

The materializer rechecks the original overlay against current stage bytes before creating its new output, records explicit exclusions/relocation in its audit, and emits only the existing unqualified file-set manifest. It never mutates the stage or original build receipt. The positive fixed source→native compiler→actual build→actual materialized package is still pending; a recorded recipe/output hash is not proof of compiler authenticity, command execution or the final runtime security boundary. Compiler/SDK authenticity remains explicitly unavailable.

## Focused evidence and limitations

`test_native_overlay.py`:13 ordinary synthetic cases PASS. They exercise real owned-filesystem snapshots, source-archive hook, materializer copying/manifest, exact exclusions, bootstrap relocation, mutated source/output/header/Node/control rejection, prior receipt/build-run refusal and symlink/expanded-allowlist refusal. Native output bytes, source, Node, signature checks and native-linkage observations are **fixtures/mocked**, not native/signing qualification. Initial RED was the absent new Python module; a later compile-recipe assertion initially compared escaped Python repr rather than decoded compiler macro text and was corrected. Neither is a reproduced old security exploit.

Three existing source-archive mechanics tests PASS (exact bytes/modes, links/phase, unexpected source). Eleven existing materializer tests PASS preserve default legacy copying, secret/alias refusal and unqualified outputs. They are separate test scopes, not a claimed runtime/Governance total. No actual Next/Prisma compiler, native program, restriction or service was run. Full final-artifact qualification and independent review remain required.
