# Handoff

Last updated: 2026-09-28

## Current state

The product is Axiom Agent 0.1.8. Public release `desktop-v0.1.8` was built from `2b562da7776b85d5e50e513b6c2393797d181bad` and published on 2026-09-28. It uses a React/Vite desktop UI and a Tauri 2 Rust shell. The desktop now gates the workspace on verified authentication, supports system-browser approval and administrator workspace-key sign-in, routes installed-app API traffic through a native allow-listed transport, and repairs the Connector Setup URL/auth failure shown in the supplied screenshot. Request editing/diffs, provider reconciliation workers, the complete execution-to-closure journey, live pairing migration, and clean-host first-launch verification remain incomplete or unverified.

The answer to “Does the current downloadable application deliver everything required by the original vision?” is **no**. See `REQUIREMENTS_MATRIX.md` and `VERIFICATION_REPORT.md`.

## Changes in this pass

- Reproduced the first-launch contradiction shown by the customer: an old preview shell could display `connected`, `auth failed`, and a raw URL-pattern error at the same time.
- Changed startup from “credential bytes exist” to a server-verified auth gate; rejected credentials are cleared before the operational shell mounts.
- Added a visible first-launch workspace-key path with format validation, live `/api/v1/whoami` verification, OS-vault persistence, Enter-key submission, and honest failure state.
- Upgraded browser pairing to a persisted ten-minute, explicit-consent, policy-checked, one-time challenge; approval and actual desktop consumption are distinct states.
- Added a Rust `reqwest` transport restricted to the product `/api/*` origin so installed webviews do not resolve relative URLs against `tauri://localhost`; redirects and unsupported methods/headers are denied.
- Moved Connector Setup reads to the bearer-authenticated v1 API and replaced unsupported setup mutation with an explicit no-change message.
- Removed the broken desktop provider-enrollment form after tracing it to a starter-token-only browser API; the candidate no longer asks for Azure/GCP secrets or claims connection without a valid scoped desktop service.
- Removed legacy AGI, cloud posture, billing, simulation, connector health, synthetic audit, and cookie-auth dashboard modules from the compiled customer shell and navigation. Dormant source remains for requirements recovery only.
- Removed installed-app sample mode; demonstration remains a website-sandbox responsibility.
- Replaced the oversized intake form with a five-stage Window → Scope → Execution → Validation → Recovery flow with stage-specific validation.
- Fixed the contradictory identity badges by carrying the already verified desktop identity into the top bar; removed unverified ambient SSE/connector polling.
- Deployment request/playbook routes now accept either a verified browser-paired desktop session or an appropriately scoped workspace API key.
- Published 0.1.8 installers for macOS Apple Silicon/Intel, Windows x64, and Linux x64 after aligning the Tauri notification plugin and adding fail-closed release verification.
- Added per-platform signing attestations; macOS artifacts are Apple-signed, Gatekeeper-accepted, and notarization-ticket validated. Windows remains honestly marked unsigned.

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
- Rebuilt the desktop homepage above the fold around a calm, aligned 1400px composition: intentional three-line headline, simplified navigation, restrained lighting, stronger copy hierarchy, an installed-app walkthrough with visible playbook stages, and quieter support affordance.
- Replaced generic automation language on the home/download surfaces with the approved mission: a deployment request becomes a governed, versioned playbook.
- Verified the desktop-only delivery boundary at runtime: ordinary dashboard/operator/auth page requests redirect to `/download`, while explicit installed-app authentication return paths remain available.

## Last verified

- Release run `36456768604` passed from commit `2b562da7776b85d5e50e513b6c2393797d181bad`; all four platform builds and publication succeeded.
- The live website manifest returned `desktop-v0.1.8`; the macOS ARM download endpoint redirected to the exact v0.1.8 GitHub DMG.
- Downloaded Apple Silicon DMG SHA-256 is `4ecfda8058c2cd2411833ef668a481047e913d28790ffcbdc89506f81378606a`; disk-image integrity and container code-signature verification passed locally.
- Independent DMG mount/install/first launch remains blocked by this environment's disk-image device restriction. Do not equate CI signing checks with full clean-host acceptance.

- Desktop 0.1.8 release alignment passed.
- Desktop TypeScript + Vite production build passed (116 modules); existing mixed-import and >500 kB chunk warnings remain.
- Exact-current-tree desktop/auth/platform/web-boundary tests passed: 5 files / 32 tests, including customer-shell, no-sample-mode, guided-intake, webview-origin, and first-run contracts.
- Exact-current desktop frontend build passed at 55 transformed modules and about 265 kB main JS; legacy/customer-irrelevant strings were absent from the built output.
- Exact-current changed-file ESLint and `check:vercel-build` passed; `git diff --check` passed.
- `git diff --check` passed.
- Clean browser automation remained blocked because the documented `agent-browser` executable is absent.
- Native Rust compile/package remained blocked because `cargo` is absent.
- Xcode reported zero build schemes, so there is no alternate Xcode-native target for this React/Tauri package.
- Prisma schema generation/migration remained blocked because the sandbox cannot update the user Prisma engine cache; no database pairing journey is claimed.

Verified in this continuation:
- 9 focused deployment/desktop-client/capability-inventory test files: 66 tests passed, 0 failed.
- Strict focused TypeScript for changed domain/repository/schema code passed.
- Desktop TypeScript passed after client/view/navigation wiring.
- Clean temporary desktop TypeScript and production build passed: 115 modules transformed in 0.82s; existing large-chunk and mixed-import warnings remain.
- Ten distinct templates and 26 lifecycle states remain present.
- Original master source and labeled scenarios A–L remain unavailable.
- Full Vitest after the mobile and desktop presentation regression changes: 363 files and 4,147 tests passed in the isolated runner.
- Focused TypeScript and ESLint passed for all eight changed website files.
- Next.js 16.3.6 production build passed, including its TypeScript phase, and generated 283 static pages.
- 40 internal links from the changed marketing surfaces returned HTTP 200 from the production server.
- Desktop-only boundary regression tests passed 8/8; production redirects were also probed directly.
- Replaced the compressed desktop homepage on phones with a purpose-built mobile journey; shortened the phone menu, compacted the footer, removed competing floating controls, and tightened download/demo touch layouts.
- Final Next.js production build and TypeScript phase passed after the redesign; rendered home, download, and demo routes returned 200 with expected mobile content.
- Desktop presentation contract passed 5/5; focused website/mobile/boundary suite passed 19/19; focused ESLint passed with zero diagnostics. Automated desktop screenshots remain blocked because Chromium exits before opening a DevTools port in the Xcode sandbox.

The full root TypeScript run stalled on iCloud with no diagnostics and was terminated. Prisma CLI schema validation was blocked by sandbox access to the user Prisma engine cache. No database migration, packaged-app, or live provider journey was claimed.

## Blockers

| Blocker | Exact resolution |
| --- | --- |
| Original 36-section attachment unavailable | Reattach it and preserve unchanged at `docs/MASTER_BUILD_PROMPT_TAURI_DEPLOYMENT_OPERATIONS_PLATFORM.md` |
| Vitest dependency is an iCloud dataless placeholder and sandbox cannot restore `node_modules` | Hydrate the repository locally or run `npm install`/`npm ci` with normal filesystem permission, then rerun the focused and full suites |
| Independent clean-host install/first launch not run | Install v0.1.8 on clean supported macOS ARM/Intel, Windows x64, and Linux x64 hosts; record launch, login, restart, uninstall, and recovery results |
| Prisma pairing migration not applied | Run `prisma migrate deploy` with a writable Prisma engine cache against a safe development database, then exercise start → browser consent → one-time status consumption → restart hydration |
| Browser automation executable absent | Install/provide the approved browser harness and run clean first-launch, invalid credential, preview, reconnect, keyboard, and visual checks |
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
7. Compile the 0.1.8 Rust transport, apply the pairing migration, and test first launch/auth/restart before packaging.
8. Package, sign, checksum, install, launch, upgrade, and recovery-test the exact candidate after the last source change; only then update the public manifest.
## Website claims/customer-path pass — 2026-09-27

- Reconciled public AWS/Azure/GCP wording to the conservative capability coverage map; no provider is represented by a generic “live/full support” badge.
- Added digest and detached-signature metadata to the desktop release manifest. Every platform CTA now resolves through the server manifest before client hydration; final built-server probes returned exact v0.1.7 DMG/MSI/AppImage redirects. ARM DMG SHA-256 matched GitHub and `hdiutil verify` passed, but mount/install/first launch were blocked.
- Contact now separates durable database acceptance from email delivery, validates/bounds fields, adds a honeypot, checks Resend HTTP failures, and returns a reference ID. Four focused route tests pass.
- Removed fictional testimonials/logos and unsupported certification/auditor/BAA/DPA claims.
- Replaced the stale download-preview page that advertised a browser product and unverified CLI/signing/keychain behavior.
- Clarified sandbox reset/isolation, blast-radius kernel enforcement, outcome-memory storage/limitations, and connector availability.
- Added `docs/WEBSITE_CLAIMS_AUDIT_2026-09-27.md` and `docs/CLAIM_EVIDENCE_MAP.md`.
- Remaining external inputs: configured provider sandboxes, production email sender access, exact App Store developer-page URL, sanitized application account/artifact for screenshots, clean OS install hosts, and the missing 36-section master source.
