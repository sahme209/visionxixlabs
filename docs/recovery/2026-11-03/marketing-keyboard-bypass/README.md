# Marketing keyboard bypass implementation receipt

Review base: `4de6191a889ef0f22c8781984200aefd1531722e`.
Binding plan: canonical `docs/superpowers/plans/2026-11-03-marketing-keyboard-bypass.md` and `work/marketing-keyboard-bypass/brief.md` in the original ticket-install-completion checkout. Only Navigation runtime and its focused behavior tests changed. No master/status documents changed.

Frozen source SHA-256:
- `components/Navigation.tsx`: `774a41199cb4cf06119f6a547ecff1fa34748a84dabfffc79d3dff3dc00c97fc`
- `components/__tests__/navigationKeyboardBypass.test.ts`: `fcc6179f9140eac1c0ee5189bfa8c0706510ceed8ec77a6b5d24ea57f623cf45`

Observed TDD sequence: wrote all five behavior tests while Navigation remained exact base source; ran focused suite and observed five missing-control failures (`red.log`), then changed production source. New native button is first focusable inside the preserved backdrop wrapper; Tailwind hides it until focus with explicit high-contrast focus styles. Activation closes disclosures, focuses current main, adds tabindex=-1 only when absent, preserves ID and existing tabindex, and tolerates missing main. No hash, route, animation, or backend operation.

Runtime for all checks: `/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node` (Node 24). Dependencies were the existing verified `/private/tmp/axiom-bootstrap-preparation-build-4087adb5-l0z31yy2/stage/node_modules`, linked locally. No install/download.

RED command (kernel network denial):
```
/usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)' /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node scripts/run-vitest.mjs components/__tests__/navigationKeyboardBypass.test.ts
```
Result: 1 failed file, 5 failed tests, missing Skip to content button, before any production edit.

Ruling/deviation: the first RED invocation used standard Vitest config before receiving the explicit cache-routing follow-up. Vitest wrote its results JSON through the dependency symlink (`node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json`, timestamp Nov 3 22:33). This violated the no-cache-mutation constraint for generated test metadata; library sources were not intentionally edited. Did not delete/restore shared cache metadata. All subsequent runs route cache to owned worktree temp and deny dependency-tree writes in the kernel. Root notified immediately. A recursive metadata scan after completion found exactly one dependency-tree file with mtime at or after first RED start: that 136-byte Vitest results JSON (see `cache-incident-inventory.json`). No dependency-code files appeared in this mtime scan; absent a pre-run hash baseline this does not prove source immutability. No evidence of `.next` build asset changes was observed or asserted. This is a limitation of the evidence, not a claim that the first run was cache-read-only.

GREEN command (existing Navigation suites run once after runtime change):
```
/usr/bin/sandbox-exec -p '(version 1)(allow default)(deny network*)(deny file-write* (subpath "/private/tmp/axiom-bootstrap-preparation-build-4087adb5-l0z31yy2/stage/node_modules"))' /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node scripts/run-vitest.mjs --config .keyboard-vitest.mjs --configLoader native components/__tests__/navigationKeyboardBypass.test.ts components/__tests__/navigationInformationArchitecture.test.ts components/__tests__/navigationResponsiveMenu.test.ts components/__tests__/navigationScrollElevation.test.ts
```
Result: four passed files, 17 passed tests (`green.log`). The exact owned temporary config is included as `vitest-owned-config.mjs` in this receipt; copied to worktree root as `.keyboard-vitest.mjs` for the command, with native config loader to avoid dependency-tree config bundling writes.

Scoped types command under the same GREEN sandbox prefix:
```
/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node node_modules/typescript/bin/tsc --noEmit --skipLibCheck --jsx react-jsx --esModuleInterop --moduleResolution bundler --module esnext --target es2022 --lib es2022,dom components/Navigation.tsx components/__tests__/navigationKeyboardBypass.test.ts
```
Result: exit 0, no diagnostics (`types.log` is empty by design). `git diff --check` for runtime/test source: exit 0. Staged receipt logs retain exact raw output, including Vitest trailing blank lines reported by the whitespace checker; those raw evidence bytes were preserved.

Limits: jsdom behavior and scoped types only; no actual browser, screen-reader, visual or WCAG compliance acceptance. Mobile test invokes the retained control reference programmatically while header is inert; it proves handler cleanup/focus retention, not keyboard reachability through an open modal. Browser acceptance remains separate. No full build here; root owns one changed-source build after independent frozen-source review and guarded local preview. No external/provider/customer/OAuth/DB/Security/native operations, app restarts, credentials/grants/flags, paid CI, production, push, or publication. Pending Govpacket909cbd48 untouched. WorkflowEvidenceMap and dormant DeploymentLifecycleDemo untouched.
