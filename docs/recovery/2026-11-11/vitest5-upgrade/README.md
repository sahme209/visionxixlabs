# Vitest 5.1.0 source migration — in progress

## Scope and plan

After Prisma #321 merged, standard public runner workflow `43129017665` generated the exact Vitest 5.1.0 lock from merged main `54c0f1c5`. No hand-edited lock. Review dependency delta and pinned preload; run unchanged tests/types, desktop build and Python CLI; fresh independent review; then PR CI and normal exact-head merge only when all applicable checks pass. No production change, live provider, paid workflow or historical issuer renewal.

## Reviewed boundaries

- Node 24.21.0 meets the installed engine constraint; installed Vite 8.3.8 meets its peer. Root test include/aliases/isolation and workflow gates unchanged.
- Official migration reference: https://vitest.dev/guide/migration/ . Retain the new clear-mocks and awaited-assertion defaults; fix actual failures, not by disabling them. Existing JSON reports specify explicit output files; no removed sequential/entrypoint calls found in the current test/config/script scope.
- `suppress-warnings.cjs`: compare installed 4.1.12 against exact 5.1.0 jsDelivr bytes and new installed file. Only `eslint-disable-next-line` becomes `oxlint-disable-next-line`; runtime warning set and forwarding remain byte-identical. SHA256 old `a5012da3d2027007781baecda154d343d8c7ad2327b79bec65b1b60a41f42dd1`, new `3f415a8b5d53b4262580a8fe99158722cfe0f1514a000a457d1379c96da90f9f`. Version/locked-version/source/extra-preload refusal tests retained.
- Dependency delta: Vitest family 4.1.12→5.1.0; Vite 8.3.7→8.3.8, Rolldown 1.2.18→1.2.19, supporting test utilities and hoisted magic-string. Production direct package versions unchanged. Workflow updates the reviewed lock hash only.
- Remove Prisma major Dependabot holds only now that #321 is merged; retain Vitest hold until its merge. TypeScript API/ESLint/Stripe/Next holds remain deliberate.
- `.vitest` generated output ignored, no snapshot acceptance/regeneration. No UI/API/docs-guide/ModuleIntro/demo/SDK change; guide count remains 31. Living plan/handoff refreshed without deleting historical evidence.

## Observed validation

Initial unchanged-suite run: 1,569 files/17,845 tests passed; two files/six tests failed; 101 files/897 tests skipped; one expected failure. Three failures are the exact old Vitest provenance pin, three are missing local schema-engine bytes after ignore-scripts install. Matching previously cached engine SHA6032ea1b… was restored nonexecutable, no fetch/run or source repin. Reviewed new preload pin and existing mock fixture updated. Focused rerun: two files/32 tests pass. Initial native types pass. Full final tests, builds, independent review and PR CI pending.

Pre-flight interfaces: new dependency version→existing child preload gate (reviewed comment-only delta); workflow lock→framework source hash (workflow generated); cached engine→recipe fixture (identical existing pin). No changed production authority.

## Final local validation

Full suite: 1,571 files and 17,851 tests passed; unchanged 101 files/897 tests skipped, one expected failure, no unexpected failures. Root native types, desktop native types/frontend production build and Python CLI 36 tests pass. No test configuration/default/assertion relaxation. New Vite reports the existing TypeScript config's CommonJS/ESM fallback warning; it is not suppressed. Desktop's existing chunk/dynamic-import warnings remain. Exact production build and independent review pending.

Ruling: use the explicitly authorized handoff migration sequence as the implementation plan; no new product capability or authority design is added. Existing test negative cases establish the version-pin RED→GREEN. Missing engine restoration changes local dependencies only and cannot renew old qualification.

## Independent review / build environment

Fresh read-only whole-branch review found no actionable findings. It independently verified installed/downloaded preload bytes and the comment-only old→new hash transition; test refusal guards remain intact. Production `magic-string@1.4.5` is relocated, not upgraded; no production package-version change found. Workflow provenance and test results were verified by the implementer, not rerun by the reviewer.

First local production build compiled but Next's type worker exhausted its default heap; the invocation omitted CI's existing `--max-old-space-size=8192`. Failure remains recorded at `/private/tmp/axiom-vitest5-production-build.log`. A justified rerun uses the existing CI 8 GiB allowance, appending to inherited Node options rather than removing any guard. No timeout/check/config source change; final build result pending.

## Candidate ready for mandatory PR CI

The justified 8 GiB build completed successfully, including strict production-source checking, Next type checking and all 299 static pages. Full test/types/desktop/Python results above are final for this source; no passing suite repeated without a change. `npm ls vitest vite --all` exits zero. Fresh independent whole-branch source review found no actionable findings; `SOURCE-REVIEW.json` binds the generated lock/preload/dependency delta. Mandatory CI remains pending; do not merge red/pending. No live application launch, SQL/provider acceptance or deploy was performed locally for this batch.
