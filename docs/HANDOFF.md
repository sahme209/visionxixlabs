# Handoff

Last updated: 2026-09-26

## Current state

The product is Axiom Agent 0.1.7 in current repository metadata. It uses a React/Vite desktop UI and a Tauri 2 Rust shell. The desktop now has a governed Deployment Requests entry, authenticated request/playbook APIs, strict intake parsing, immutable version-1 request snapshots, persisted hashed playbook versions, append-only audit evidence, and a durable operation-ledger/coordinator foundation. Request editing/diffs, provider reconciliation workers, and the complete execution-to-closure journey remain incomplete or unverified. The capability inventory now describes intake as implemented but not live-verified.

The answer to “Does the current downloadable application deliver everything required by the original vision?” is **no**. See `REQUIREMENTS_MATRIX.md` and `VERIFICATION_REPORT.md`.

## Changes in this pass

- Added durable continuity documents: Product Vision, Decisions, Requirements Matrix, Verification Report, Roadmap, and this Handoff.
- Added reliability kernel, execution coordinator, tenant-bound Prisma operation ledger, schema migration, and regression tests for durable IDs, reconcile-before-retry, atomic claims, duplicate prevention, adapter-mode truthfulness, and app-close semantics.
- Added strict deployment intake wire validation and tenant-scoped request/audit repository.
- Added authenticated `GET/POST /api/desktop/deployments`.
- Added the desktop Deployment Requests workspace with dynamic emergency, deferred-validation, backup, PR, manual-step, validation, change, and rollback fields.
- Corrected playbooks so rollback is failure-conditional and success-only closure follows it; execution rechecks access immediately before production.
- Added immutable request snapshot hashing, versioned playbook persistence, generation audit events, a tenant-scoped playbook API, and desktop step/hash presentation.
- Centralized desktop request authentication so malformed tokens fail closed; removed a duplicated Prisma operation model found during verification.
- Added stable request-submission idempotency across desktop/API/repository boundaries, including replay and conflicting-reuse regression tests.
- Added latest persisted playbook version/hash to request refresh responses and the desktop card, preserving visible service state across reloads.
- Split technical and optional application-functional validation intake into separately owned, evidence-required playbook steps.
- Made manual-step validation explicit: owner, exact instruction, evidence, and a validation instruction are now required and preserved in the playbook/UI.
- Reworked the public website for phones: accessible full-screen navigation, focus trapping and scroll locking, route-aware safe-area CTA spacing, stacked CTAs, responsive footer/demo/download layouts, and reduced mobile animation load.
- Replaced generic automation language on the home/download surfaces with the approved mission: a deployment request becomes a governed, versioned playbook.
- Verified the desktop-only delivery boundary at runtime: ordinary dashboard/operator/auth page requests redirect to `/download`, while explicit installed-app authentication return paths remain available.

## Last verified

Verified in this continuation:
- 9 focused deployment/desktop-client/capability-inventory test files: 66 tests passed, 0 failed.
- Strict focused TypeScript for changed domain/repository/schema code passed.
- Desktop TypeScript passed after client/view/navigation wiring.
- Clean temporary desktop TypeScript and production build passed: 115 modules transformed in 0.82s; existing large-chunk and mixed-import warnings remain.
- Ten distinct templates and 26 lifecycle states remain present.
- Original master source and labeled scenarios A–L remain unavailable.
- Full Vitest after the final test change: 361 files and 4,136 tests passed in the isolated runner.
- Focused TypeScript and ESLint passed for all eight changed website files.
- Next.js 16.3.6 production build passed, including its TypeScript phase, and generated 283 static pages.
- 40 internal links from the changed marketing surfaces returned HTTP 200 from the production server.
- Desktop-only boundary regression tests passed 8/8; production redirects were also probed directly.

The full root TypeScript run stalled on iCloud with no diagnostics and was terminated. Prisma CLI schema validation was blocked by sandbox access to the user Prisma engine cache. No database migration, packaged-app, or live provider journey was claimed.

## Blockers

| Blocker | Exact resolution |
| --- | --- |
| Original 36-section attachment unavailable | Reattach it and preserve unchanged at `docs/MASTER_BUILD_PROMPT_TAURI_DEPLOYMENT_OPERATIONS_PLATFORM.md` |
| Vitest dependency is an iCloud dataless placeholder and sandbox cannot restore `node_modules` | Hydrate the repository locally or run `npm install`/`npm ci` with normal filesystem permission, then rerun the focused and full suites |
| No exact current native artifact | Install Rust/Cargo and platform packaging/signing prerequisites; build after final code change |
| Live identity/provider journeys unavailable | Supply safe non-production tenants and least-privilege test identities/credentials |
| Naming discrepancy | Product owner confirms Axiom Agent versus TAURI; record decision without casual rename |
| Supported platform acceptance hosts unavailable | Provide clean macOS arm64/x64, Windows x64, and Linux x64 hosts for claimed targets |
| Phone visual/touch verification unavailable | Install an iOS Simulator 27.0+ runtime for Xcode Device Interaction or run the supplied viewport/device checks outside the restricted browser sandbox; cover iPhone and Android widths |

## Next concrete steps

1. Ingest the reattached master specification and expand the matrix to every subsection and scenarios A–L.
2. Apply the new Prisma migration in a safe development database and run the desktop intake UI→API→database→audit journey.
3. Implement request editing as immutable revisions with diffs and authorship; add playbook blocker/detail retrieval rather than only post-generation display.
4. Route one real non-production workflow-dispatch adapter through the operation coordinator and implement startup reconciliation.
5. Complete evidence, technical/functional validation, deferred follow-up, rollback, and closure.
6. Run the website on real iPhone/Android browsers or supported simulators at 320, 390, 430, and 768 CSS pixels, including menu focus, safe areas, scrolling, CTA overlap, and link behavior.
7. Package and test the exact candidate after the last source change.
