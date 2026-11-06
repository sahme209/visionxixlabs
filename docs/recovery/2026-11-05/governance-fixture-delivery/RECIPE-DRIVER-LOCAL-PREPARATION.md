# Recipe driver local preparation — not an executed export

Prepared `scripts/synthetic-fixture-recipe-driver.cjs` and tests `scripts/tests/test_recipe_packet_driver.cjs`. The module's main entry has not been invoked. Node unit tests import its function with completely mocked recipe/child boundaries and owned temporary inert files only; no Prisma CLI, engine, sandbox or SQL execution occurred.

The fixed driver uses the existing recipe function/ports.run seam, source-bound original Node/helper/engine and one exact invocation. It retains the actual prepared datasource-only scratch bytes before helper cleanup; captures raw stdout/stderr as bounded prefixes (8MiB each); refuses overflow before SQL decoding; records bounded allowlisted child error codes/names and fixed-phase terminal failure evidence; preserves all existing outputs by O_EXCL; and rechecks input hashes/optional modes before/after. Normal raw stdout remains the exact SQL bytes emitted by the actual future child, not reconstructed table names. No key/identity/provider/grant or retry path is introduced.

Root's source-only engine-input amendment was recorded and independently reviewed BEFORE the optional helper seam: default `ports.schemaEnginePath` absence preserves the old derived engine path, while a selected path retains the same hardcoded57b090 checksum. Accepted dependencies and separately pinned original executable engine have explicit dual provenance. Current checkout dependency inventory mismatches the accepted manifest; it was not silently adopted.

Evidence:
- `axiom-recipe-overflow-red.log` → `axiom-recipe-overflow-green.log` in /private/tmp: genuine missing bounded raw/terminal evidence regression → PASS.
- `axiom-recipe-diagnostic-red.log` → `axiom-recipe-diagnostic-green.log`: genuine absent error code/fixed failure phase → PASS.
- `axiom-recipe-engine-seam-red.log` → `axiom-recipe-engine-seam-green.log`: selected original engine with engine-free view initially refused; selected/default/wrong-engine tests now2 PASS using mocked child only.
- `axiom-recipe-driver-four.log`:4 Node mock tests PASS before the later diagnostic correction. Final combined selection is pending source review/freeze; do not add passing counts from overlapping selections.

TDD precision: initial wrapper construction and routine integration guards were written before their tests; no test-first claim is made for those portions. The overflow, diagnostic and selected-engine changes have preserved genuine behavioral RED→GREEN evidence. The existing recipe algorithm was reused, not reimplemented.

The Python packet/profile/supervisor adapter is a disjoint owner task. No actual input view, accepted-cache copy/installation/modification, complete dependency rehash, target Node/CLI/engine/sandbox process, generated SQL or issuer/runtime qualification was performed here. A final reviewed exact packet and explicit one-run authorization remain necessary before real export.

## Final reviewed selection

Root independently re-read the frozen CJS/helper source and reported no important remaining finding. Then exactly one final combined selection was run:

- `node --test scripts/tests/test_recipe_packet_driver.cjs`: **5 PASS, exit0**, `/private/tmp/axiom-recipe-driver-final.log`.
- `vitest run lib/governance/qualification/__tests__/syntheticFixtureRecipe.test.ts`: **2 PASS, exit0**, `/private/tmp/axiom-recipe-helper-final.log`.

These counts overlap earlier targeted selections and must not be added to them. CJS actual main, target pinned Node/CLI/engine, sandbox/restriction or SQL was not run; unit tests import the function with mocked recipe/spawn or invoke the existing helper with a mocked `ports.run` only. Source bytes are now frozen pending the separate Python adapter review and exact inert packet preparation. No execution authorization is inferred.
