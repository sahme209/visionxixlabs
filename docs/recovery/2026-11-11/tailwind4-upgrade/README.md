# Tailwind 4 source migration — November 11, 2026

Implementation candidate; merge requires every applicable CI check green.
Production stays build 4 (`a344f4f6`). No schema, feature flag, provider action,
credential, native app restart, signing, installer publication or deployment.

## Sequence and source provenance

AWS PR #315 and AI SDK 7 PR #317 merged green first. ESLint 10 installs but has
an invalid peer graph with three latest plugins. The owner explicitly chose to
keep ESLint 9 and continue here; see `eslint10-hold.json`. No forced peers or
rules disabled. The 37-file lint comparison has identical diagnostics on 9/10.

`dependency-fix.yml` runs 43092374356 and 43092773452 generated exact Tailwind
and PostCSS 4.3.5 for root/desktop, plus the root lock hash. Project lockfiles
were never hand-edited or copied from the migration fixture.

The official upgrade tool ran in a disposable exported source copy with separate
local dependency copies. Only reviewed CSS, PostCSS and templates came back;
its manifests, locks and installed modules did not. Initial tool invocations
stopped at version/config association checks before source conversion. No claim
that the tool's final Git message proves a clean repository: the disposable copy
has no Git repository; actual source differences were independently inspected.

533 TypeScript/JSX templates change only literal class strings in the automated
phase; executable AST structure, identifiers and visible JSX text are unchanged.
All changed JSX attributes are className. Two false-positive prose test titles
and the broad negative backdrop-blur substring guard were restored. Two later exact regex spelling updates retain all accessibility
and scroll-state assertions (23 tests pass). No handler, permission or approval
logic is changed. See `source-review.json` for the explicitly reviewed exceptions.

## CSS and browser behavior

CSS-first @theme/@utility definitions replace both obsolete JS/TS config files.
Explicit source(none)/@source entries preserve previous scan boundaries; archived
evidence, fixtures and arbitrary library strings are not newly scanned.

A real Chrome probe found a migration regression: standard layered utilities
lost to the existing unlayered universal reset, giving p-4 zero padding. Split
imports keep theme/preflight layered and utilities unlayered, preserving the
legacy cascade. Browser output now gives 16px padding. Actual generated CSS
hashes still match the CSS used by `browser-comparison.json`.

Desktop dark/light probes preserve padding, radius, text, background and border
colors exactly. Web brand/text colors and spacing match; default Tailwind gray
is now represented by the v4 OKLCH palette (not a pixel-identical palette claim).
The installed compiler supports both --backdrop-blur and --blur theme keys;
existing custom backdrop tokens remain valid.

Local homepage and Docs were inspected at 1440x1000 and 390x844. Their document
widths were 1434 and 384 respectively (no horizontal overflow); the mobile menu
opened correctly. Screenshots are local development proof, not production or
native-app acceptance. The development auth-session fetch reports unavailable
because no production credentials were supplied; sign-in was not tested.

## Living docs and validation

Eight guide-source hashes, the Ask Axiom corpus, three existing ModuleIntro
review dates, the internal Desktop Pairing scenario, CLAUDE table, handoff and
remaining-work records are updated. No guide added (count 31), public API or
webhook changed. No SDK-method changes apply.

- Root and desktop TypeScript PASS.
- Shared FileDiff four-column CSS compiles through the actual PostCSS4 pipeline.
- Desktop Vite build PASS (existing chunk/dynamic-import warnings).
- Python CLI: 36 PASS.
- Final full Vitest: 17,806 PASS, 893 skipped, one expected failure, two unchanged
  macOS-only stale-schema-pin failures. See `../aws-sdk-upgrade/README.md`.
- Focused accessibility/scroll checks: 27 PASS, including the restored broad negative blur guard.
- Independent final review found and resolved one narrowed negative blur guard; no important findings remain. Final CI is required.

## Not established

Tailwind 4 requires Safari16.4+, Chrome111+, Firefox128+ (official upgrade guide:
https://tailwindcss.com/docs/upgrade-guide). Minimum supported macOS/Windows/Linux
webviews, Firefox/Safari, native app visuals, installer upgrades, full accessibility
and production acceptance are unverified. The install guide now states this engine
qualification requirement. No installer support or release acceptance is invented.
