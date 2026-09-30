# Handoff

Last updated: 2026-09-29

## Current state

The product is Axiom Agent. Public release `desktop-v0.1.10` was built from `d0c074a21a4014e18d848cbc9d53385f1d65baae` and published on 2026-09-29. It uses a React/Vite desktop UI and a Tauri 2 Rust shell. The desktop separates verified identity from paid production access, supports desktop-initiated system-browser login and account creation with a registered native return, and routes installed-app API traffic through a native allow-listed transport. The production pairing and operation-ledger migrations were applied on 2026-09-29. The release exists, but the website deployment for its source commit failed and production still resolves 0.1.9; do not describe 0.1.10 as the live website download until a succeeding Vercel deployment is verified. Request editing/diffs, provider reconciliation workers, the complete execution-to-closure journey, entitlement provisioning, and clean-host first-launch verification remain incomplete or unverified.

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

- 2026-09-29 current working tree: the installed app now presents separate Log in and Create account actions, preserves the intent through the system-browser flow, and returns through the registered `axiom-agent://` desktop scheme after explicit device authorization. The credential still arrives only through the one-time server exchange.
- Customer Settings were rebuilt around verified identity, paid access, hosted billing, local notification behavior, immutable safety controls, repository/trigger separation, and honestly labeled tenant-admin integrations. Legacy API-key paste, pairing JSON, scan-on-launch, and arbitrary default-provider controls are no longer customer-facing.
- Website optional analytics is consent-gated; essential-only remains available and the choice can be reopened. Base typography and reduced-motion behavior were tightened without replacing the approved visual system.
- Exact 0.1.10 source evidence: 369 test files / 4,186 tests passed after the final billing-path change; Next.js compiled, type-checked, and generated 284 pages; changed-file ESLint passed; desktop TypeScript/Vite production build passed; Rust `cargo check --locked` passed with one pre-existing shell-plugin deprecation warning.
- A local arm64 release build produced `Axiom Agent.app` with version 0.1.10, bundle identifier `com.visionxixlabs.axiom`, and registered `axiom-agent` URL scheme. Its executable SHA-256 is `e0368e52c783f26eec69887a73fdc3773ac22930c86850f634c25f1077f22a2a`. The local app is ad-hoc signed; disk-image creation failed in the restricted environment. Launch Services also rejected registration from the Xcode/Codex temporary container (`-10822`), and direct launch aborted inside macOS `_RegisterApplication` before Tauri setup. Signed/notarized multi-platform artifacts and a clean-host installed deep-link round trip remain required; no successful local launch is claimed.
- Desktop billing no longer opens the browser-only `/dashboard/billing` route. A browser-paired desktop session requests a short-lived Stripe portal URL through `/api/desktop/billing/portal`; API keys are rejected, missing customer/configuration states fail visibly, Stripe hosts are allow-listed by the client, and `/desktop/billing/return` returns focus to the app so entitlement is re-read.
- Release run `36625741154` passed all four platform builds and publication for `desktop-v0.1.10` from commit `d0c074a21a4014e18d848cbc9d53385f1d65baae`. Both macOS builds passed Developer ID signature, Gatekeeper, notarization-ticket, DMG-signature, and DMG-integrity checks. Windows remains explicitly unsigned; every published installer has a detached GPG signature.
- The independently downloaded Apple Silicon 0.1.10 DMG is 6,234,709 bytes with SHA-256 `30291e113f65b6ada70ee7dcf65c73b184efd8edca96707bfee98ed923ec64b3`; it matches GitHub's release digest and passed `hdiutil verify`.
- The Git-linked Vercel deployment for `d0c074a2` failed (`dpl_1CThyYTtkJpbUTcocesbG7PoaKDS`). Consequently, the live manifest still reported `desktop-v0.1.9` and `/api/desktop/billing/portal` returned 404 at verification time. This is a separate website-deployment blocker, not a desktop release success claim.

- Release run `36472258963` passed from commit `353eb983aa579474b2e22fd829b27f9a47709306`; macOS Apple Silicon/Intel, Windows x64, Linux x64, and publication jobs succeeded for `desktop-v0.1.9`.
- The downloaded Apple Silicon v0.1.9 DMG is 6,165,434 bytes with SHA-256 `c44e241489a1ad7cc0a1fc061ed62b4f6b4b4635d196b3aae25a4a553cd15bb6`; `hdiutil verify` and code-signature designated-requirement verification passed. Local mounting remains blocked by `Device not configured`.
- Before migration, live pairing returned 503 and distribution correctly failed closed. Production deployment `dpl_BD3yeu9u9P8q7yxYrpY7pc2ScrYh` verified that unavailable state without sending customers to a broken onboarding path.
- On 2026-09-29 the two pending additive production migrations were reviewed and applied. The live manifest now reports `runtimeReady: true`, downloads resolve to the v0.1.9 artifacts, and pairing start returns 201. The stale runtime-pause URL now rechecks service readiness and redirects recovered visitors back to downloads instead of continuing to show an obsolete outage.

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
- Prisma generation initially hit the sandboxed user cache; explicit repository engine paths allowed generation, status inspection, and deployment. Pairing start is live-verified; approval, consumption, entitlement transition, and packaged restart remain unverified.

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

Earlier root TypeScript and Prisma attempts were blocked by the sandboxed user engine cache. The later explicit-engine run completed the full production build and deployed both pending migrations. No packaged-app approval/consumption journey or live provider journey is claimed.

## Blockers

| Blocker | Exact resolution |
| --- | --- |
| Original 36-section attachment unavailable | Reattach it and preserve unchanged at `docs/MASTER_BUILD_PROMPT_TAURI_DEPLOYMENT_OPERATIONS_PLATFORM.md` |
| Independent clean-host install/first launch not run | Install the published 0.1.10 artifacts on clean supported macOS ARM/Intel, Windows x64, and Linux x64 hosts; record launch, login, signup, native return, restart, uninstall, and recovery results |
| Website production deployment failed for the 0.1.10 source commit | Inspect/redeploy Vercel deployment `dpl_1CThyYTtkJpbUTcocesbG7PoaKDS`, then verify the live manifest resolves 0.1.10 and the unauthenticated desktop billing endpoint fails with 401 rather than 404 |
| Pairing approval/consumption and entitlement transition not live-tested | Use an authorized non-production customer identity and entitlement fixture to exercise start → signup/sign-in → browser consent → one-time consumption → access block/grant → restart/revocation without creating fictional production customers |
| Browser automation executable absent | Install/provide the approved browser harness and run clean first-launch, invalid credential, preview, reconnect, keyboard, and visual checks |
| Live identity/provider journeys unavailable | Supply safe non-production tenants and least-privilege test identities/credentials |
| Naming discrepancy | Product owner confirms Axiom Agent versus TAURI; record decision without casual rename |
| Supported platform acceptance hosts unavailable | Provide clean macOS arm64/x64, Windows x64, and Linux x64 hosts for claimed targets |
| Phone visual/touch verification unavailable | Install an iOS Simulator 27.0+ runtime for Xcode Device Interaction or run the supplied viewport/device checks outside the restricted browser sandbox; cover iPhone and Android widths |

## Next concrete steps

1. Ingest the reattached master specification and expand the matrix to every subsection and scenarios A–L.
2. Run the desktop intake UI→API→database→audit journey against an authorized safe tenant now that the production schema is current.
3. Implement request editing as immutable revisions with diffs and authorship; add playbook blocker/detail retrieval rather than only post-generation display.
4. Route one real non-production workflow-dispatch adapter through the operation coordinator and implement startup reconciliation.
5. Complete evidence, technical/functional validation, deferred follow-up, rollback, and closure.
6. Run the website on real iPhone/Android browsers or supported simulators at 320, 390, 430, and 768 CSS pixels, including menu focus, safe areas, scrolling, CTA overlap, and link behavior.
7. Test 0.1.10 first launch, browser approval/native return, cancellation, one-time consumption, entitlement transition, revocation, and restart on clean hosts.
8. Install, launch, upgrade, and recovery-test the exact 0.1.10 release artifacts on clean supported hosts; keep public availability failed closed if a required runtime path regresses.
## Website claims/customer-path pass — 2026-09-27

- Reconciled public AWS/Azure/GCP wording to the conservative capability coverage map; no provider is represented by a generic “live/full support” badge.
- Added digest and detached-signature metadata to the desktop release manifest. Every platform CTA now resolves through the server manifest before client hydration; final built-server probes returned exact v0.1.7 DMG/MSI/AppImage redirects. ARM DMG SHA-256 matched GitHub and `hdiutil verify` passed, but mount/install/first launch were blocked.
- Contact now separates durable database acceptance from email delivery, validates/bounds fields, adds a honeypot, checks Resend HTTP failures, and returns a reference ID. Four focused route tests pass.
- Removed fictional testimonials/logos and unsupported certification/auditor/BAA/DPA claims.
- Replaced the stale download-preview page that advertised a browser product and unverified CLI/signing/keychain behavior.
- Clarified sandbox reset/isolation, blast-radius kernel enforcement, outcome-memory storage/limitations, and connector availability.
- Added `docs/WEBSITE_CLAIMS_AUDIT_2026-09-27.md` and `docs/CLAIM_EVIDENCE_MAP.md`.
- Remaining external inputs: configured provider sandboxes, production email sender access, exact App Store developer-page URL, sanitized application account/artifact for screenshots, clean OS install hosts, and the missing 36-section master source.

## Identity versus paid access correction — 2026-09-28

- Root cause of the reported automatic login: the desktop restored a valid credential from the OS vault and verified identity, but did not independently require an active tenant entitlement before mounting the workspace.
- Current source now restores identity separately, calls `/api/desktop/access`, and routes unentitled/no-plan, past-due, and canceled tenants to `DesktopAccessRequiredView`. Only active non-trial plans enter the workspace.
- Server enforcement is not cosmetic: desktop deployment resolution, desktop state, and public v1 API-key authentication now fail closed on missing commercial access. The introspection route alone may authenticate without entitlement so it can explain the block.
- Signup no longer assigns `plan: "starter"` or advertises a free plan. It requires a live desktop challenge, Terms/Privacy acceptance, bounded fields, a 12–128 character password, and request throttling.
- The current commercial path is intentionally requirements-based because no approved public prices or verified production payment configuration were found. The desktop access wall links to a prefilled, durably persisted production-access request and to `/plans`.
- Last local evidence: desktop v0.1.9 release-alignment/TypeScript/Vite build passed (56 modules); changed-file ESLint passed; final signup/entitlement/first-run/auth focused suite passed 25/25; full Vitest ran 360 passing suites/4,063 tests with seven module-load failures caused by the missing generated Prisma client. Root Prisma generation remains blocked by sandbox cache permissions.
- The source was published as v0.1.9 and release CI passed. The production migration is now applied and downloads are open; do not treat that as proof of the still-unverified full packaged entitlement journey.
- The distribution-readiness continuation passed 17 focused tests, changed-file ESLint, the Vercel build contract, and a complete local Next.js production build with Prisma generation, TypeScript, and 283 static pages. The first deployment exposed a billing-model key type error and failed safely before promotion; the corrected deployment reached `READY` and its fail-closed behavior was verified on the public hostname.
