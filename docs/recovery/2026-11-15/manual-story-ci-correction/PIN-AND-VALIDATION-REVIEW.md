# Manual story CI correction: source pins and validation review

Read-only inspection; no product/helper edits, tests, compiler/server/browser/native/cloud/Git action. The companion JSON records observed hashes during root editing, NOT final reviewed pins or renewed historical qualification.

## Active source bindings

`scripts/run-owned-website-visual.mjs:13` contains fifteen explicit script paths, including BOTH changed files `scripts/capture-owned-website.mjs` and `scripts/owned-website-ci.mjs`. `capture()` at lines26–29 generates their SHA256 values dynamically along with Node and Chromium identities, clean commit, managed selectors and framework identity. There is no hardcoded active expected digest for either changed script to replace. After the final correction is committed, CI must prepare a NEW manifest for that exact PR head; an old manifest must refuse. Do not edit a consumed manifest/receipt to accept new code.

`.github/workflows/website-visual.yml:51–65` prepares a fresh manifest, validates immutable PR head with owned-website-ci review, passes its digest to --execute-reviewed, then collects sanitized receipts. The script changes already match workflow scripts/** filters. No workflow/dependency/framework-pin change is required solely for the manual-control migration. `reviewManifest()` checks exact expected HEAD/root/clean source/schema/nonproduction flag and minimum closure cardinality; supervisor compares a newly captured identity with the supplied full manifest. Child, proxy and capture rehash config.hashes (ownedWebsiteChild:20, Proxy:19, capture:169 at observation).

`ownedWebsiteFramework.cjs` has separate STATIC source pins for package-lock.json, next.config.ts, tsconfig.json and tsconfig.next.json, plus locked Next internals/TypeScript dependency pins. These do NOT pin capture/collector bodies. All four static source pins currently match (companion JSON). Preserve them and all framework/transport/ownership/environment/cleanup behavior because those inputs are unchanged. Config verifies its own dynamically captured source digest.

Existing closure observation, outside this narrow behavioral correction: owned-website-ci imports isolatedNextStartupCategories.cjs and read-public-dependency-names.mjs, but neither is named in the fifteen-script sourceFiles list. The immutable clean source commit still identifies repository bytes, but do not describe that explicit list as a complete transitive module hash closure. This predates the present edit; expanding it requires separate deliberate review rather than incidental repinning.

## Active behavior/receipt contracts requiring coordinated review

The rejected capture still waited for Play story, then exercised pause/offscreen/hidden timers/replay and a disabled Play reduced-motion state. New capture must instead establish actual manual-story readiness and verify explicit step/branch/sample approval/rejection/held Terraform/navigation behavior plus mobile and reduced-motion manual operation. Removed player/timer controls should not be reintroduced solely to satisfy CI.

The collector in owned-website-ci.mjs has bounded allowlists/schema validation for interactionTokens, completedEvidence, homeCapturePhase, pre-image phase and publicDomSnapshot playPresent/playDisabled fields. Update those contracts deliberately in concert with capture; preserve strict primitive-key/accessor rejection, redaction, bounded data, screenshot checks, source/nonce/cleanup acceptance and nonproduction qualification. Keep historical player tokens only if intentionally supporting old receipts, and never claim old timer evidence was observed by the new run. A passing manual state must not depend on fabricated play booleans.

Tests directly importing or reading changed capture/collector: ownedWebsiteCi, DomDiagnostics, ClickProbe, OperationDiagnostics, InterceptionOrdering, PrivacyNavigation, StablePointer, PointerGeometry, PointerObservation and DocumentationTiming under lib/__tests__. The first two explicitly encode playback phase/Play diagnostic shape; pointer/privacy/operation tests enforce safe bounded source behavior and should stay strict while expectations follow real manual controls. All twenty ownedWebsite test files are the regression boundary for this fixture. No corresponding ownedWebsite tests exist in scripts/__tests__; their active tests are in lib/__tests__.

## Historical records to preserve

Keep docs/recovery/** frozen qualification/build/render packets and docs/marketing/workflow-story-publication-validation.json, workflow-story-final-source-validation.json, website-fourth-diagnostic-preparation.json unchanged. These are old source-head/result records, not active digest constants. owned-website-visual-protocol.md includes historical blocked attempts and earlier source-pin rebinds; do not rewrite those into a new success. Add the new PR CI result separately after actual execution. This correction is test-driver compatibility, not new Governance/native/production acceptance.

## Narrow validation commands for root (not executed here)

Use explicit supported Node24.21.0. In the recovery repo:

```sh
/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node --check scripts/capture-owned-website.mjs
/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node --check scripts/owned-website-ci.mjs
/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node node_modules/vitest/vitest.mjs run lib/__tests__/ownedWebsite*.test.ts
```

Then use the already-required full repository checks and fresh exact-head isolated website CI, including actual screenshots/interaction receipts and cleanup. The local unit command includes mocked/guarded child tests; it is not a browser acceptance run. Do not run the fixture --prepare/--execute-reviewed from this read-only review: prepare itself performs Git reads and actual execution launches services/browser. CI obtains a fresh exact-head manifest using its existing reviewed workflow.
