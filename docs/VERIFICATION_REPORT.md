# Verification Report

Last updated: 2026-09-29

## Current-pass conclusion

**The current downloadable application does not yet deliver everything required by the original vision.** It now contains a first-class desktop deployment-request intake, authenticated request and playbook APIs, an immutable version-1 request snapshot, persisted versioned playbook generation with content hashes and audit events, ten distinct templates, and a durable consequential-operation ledger/coordinator. Request editing/revision diffs, complete execution/validation/closure, native packaging, real identity/provider, recovery, update, and exact-build acceptance remain partial, unverified, or blocked.

The 2026-09-27 website pass also verified that public provider, security, social-proof, contact, and download claims had drifted beyond released evidence. Those claims were corrected. Before the later desktop-auth changes, that website tree passed 365 Vitest files / 4,153 tests, changed-file ESLint, the Next.js 16.3.6 production build and TypeScript phase, 283-page generation, 40/40 prominent internal links, direct route/redirect checks, and the desktop release alignment check. Exact-current-tree evidence for the later desktop changes is recorded separately below.

## Build identity

### Browser-auth, settings, and consent continuation — 2026-09-29

- Implemented distinct native Log in and Create account entry points. The intent is validated by the pairing API, preserved through browser authentication, and returned to the same device-authorization page.
- Registered `axiom-agent://` through the desktop deep-link plugin and single-instance handler. Browser approval attempts the native return and retains a visible fallback button. No bearer token, challenge token, or customer data is carried in the deep link; the installed app continues polling the one-time pairing status endpoint.
- Replaced legacy customer Settings with account/session, plan/billing, workflow behavior, repository/trigger, and integration sections. Operational permission distinctions are explanatory and locked; unverified connector state is not presented as connected.
- Added explicit website privacy choices and moved optional analytics behind consent. Essential-only leaves analytics unmounted.
- Passed on exact 0.1.10 source: 369 test files / 4,186 tests; Next.js compile, TypeScript, and 284-page generation; changed-file ESLint; desktop production frontend build; Rust `cargo check --locked`; release-app compilation; whitespace check.
- Local release-app evidence: arm64 `Axiom Agent.app`, version 0.1.10, identifier `com.visionxixlabs.axiom`, `axiom-agent` URL scheme, executable SHA-256 `e0368e52c783f26eec69887a73fdc3773ac22930c86850f634c25f1077f22a2a`. It is ad-hoc signed; local DMG creation failed at the disk-image script in the restricted environment. Launch Services rejected the temporary-container bundle with `-10822`; direct execution aborted in macOS `_RegisterApplication` before Tauri setup. This is recorded as a harness/clean-host blocker, not a successful launch.
- Billing path evidence: Settings and the access wall call a bearer-authenticated desktop endpoint; only a browser-paired desktop session can create a portal; missing Stripe customer/configuration returns an honest error; the desktop permits only HTTPS Stripe destinations; the return page invokes the registered native scheme and focus triggers entitlement verification. Live Stripe creation remains unverified.
- Post-release visual/flow pass: simplified public navigation to verified customer destinations, lowered decorative grid/noise/glow density, removed download-page beams and ambient animation, and calmed native welcome/loading surfaces. All 369 Vitest files / 4,186 tests passed; changed-file ESLint passed; the 0.1.11 desktop production build passed; Next.js compiled, type-checked, and generated 284 pages. Release run `36653889931` then passed every platform build and publication job. Visual acceptance on physical phone and clean installed-app hosts remains outstanding.
- Published 0.1.11 artifact evidence: Apple Silicon DMG size 6,234,710 bytes and SHA-256 `551e5c3f4dfaa009120479032d31aa43415ff7a1d2cb2af156274305d6901ec9`; independently downloaded digest matched GitHub and `hdiutil verify` passed. Intel DMG, Windows MSI/EXE, and Linux AppImage/DEB/RPM were also published with detached signatures.
- Website release-path verification failed after desktop publication: Vercel deployment `9pswSS12jDNwnGTQBrtNy1qw1aix` remained pending, the live manifest still returned 0.1.9, and `/api/desktop/billing/portal` still returned 404. No 0.1.11 website-download claim is made.
- Release-CI verified and published the signed/notarized 0.1.11 artifacts. Not yet verified: browser-to-app focus on installed clean hosts, OAuth-provider account creation, live Stripe portal/checkout for a real tenant, and physical mobile-browser consent layout.

| Item | Value |
| --- | --- |
| Product observed | Axiom Agent |
| Desktop package/version | `axiom-desktop` 0.1.11; published as `desktop-v0.1.11` |
| Framework | Tauri 2 + React 19 + Vite + Rust |
| Released source commit | `c14eb00e872ca7dcd89dfbcd3a48e673f3ed14c9` |
| Published native artifact | 0.1.11 Apple Silicon DMG SHA-256 `551e5c3f4dfaa009120479032d31aa43415ff7a1d2cb2af156274305d6901ec9`; Intel DMG, Windows MSI/EXE, Linux AppImage/DEB/RPM also published with detached signatures |
| Current test environment | macOS; repository in iCloud; isolated Vitest/TypeScript runner under `/private/tmp` because repository Rollup metadata is dataless |
| Master-spec identity | Attachment requested again; not present in repository during audit |

## Evidence captured in this pass

- `desktop/src/App.tsx` contains the Axiom Agent shell and many release/cloud/AI views.
- `lib/tauri/deploymentOperations.ts` contains dynamic intake validation, 26 lifecycle statuses, transition checks, versioned playbook generation, and secret redaction.
- `lib/tauri/templates.ts` contains ten distinct template definitions corresponding to sections 11–20.
- `lib/product/tauriCapabilityInventory.ts` now labels intake as implemented but unverified and states that the migration and packaged database journey remain unverified.
- No labeled section-27 scenario A–L suite or master specification was found.
- Desktop architecture wording now identifies shared services—not a customer browser dashboard—as the governance authority.
- Generated rollback steps are conditional `on_failure` actions before success-only closure; final execution now rechecks access.
- The reliability kernel, coordinator, Prisma ledger repository/schema/migration, and tests distinguish certain failure from unknown outcome, atomically claim idempotency keys, enforce tenant scope, and reject non-write adapters as live success.
- `DeploymentRequestsView`, `/api/desktop/deployments`, and `/api/desktop/deployments/[id]/playbooks` create tenant-scoped request snapshots and versioned, hashed playbooks with audit events without performing deployment actions. Request refresh returns the latest persisted playbook identity/hash so restart does not erase the user-visible service state.
- A duplicated `TauriDeploymentOperation` Prisma model was found and removed; malformed desktop bearer tokens now fail closed as unauthenticated instead of surfacing as server errors.
- Desktop request submission now carries a stable retry identity. Same-content retries return the original record without duplicate request-version/audit writes; conflicting reuse is rejected and database uniqueness races surface as retryable conflicts.
- The public marketing home, download, demo, navigation, footer, and mobile CTA now use phone-first layouts, 44-point controls, safe-area spacing, a scrollable focus-trapped mobile menu, lighter phone rendering, and mission-aligned request-to-playbook wording.
- The desktop homepage hero now uses intentional word-level headline lines, a shared 1400px alignment grid with navigation, a calmer light field in place of the split-screen beam, a less crowded navigation action cluster, and a complete installed-workspace walkthrough frame with explicit control/state/evidence and playbook progress cues.
- The production route manifest contains dashboard/operator/auth implementation, but runtime edge enforcement redirects ordinary browser operations and unsolicited sign-in/signup visits to `/download`; an explicit `/desktop/...` return path remains available for installed-app authentication.

## Checks executed in this pass

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Project inventory and targeted source inspection | Passed | Xcode project tools returned source and documentation |
| Master specification search | Blocked | No master file in repository; no connected document session |
| Section 11–20 template inventory | Passed (static) | Ten distinct entries found |
| Section 27 A–L search | Failed to find evidence | No labeled suite/source located |
| Focused deployment/desktop-client Vitest | Passed | 9 files, 66 tests, 0 failures in isolated Vitest 4.0.18 runner; source copied from this working tree |
| Focused deployment-domain TypeScript | Passed | Strict TypeScript 5.9.3 compile of kernels, repositories, schemas, and tests exited 0 |
| Desktop TypeScript | Passed | `desktop/node_modules/.bin/tsc --noEmit` exited 0 after the new view/client wiring |
| Desktop frontend production build | Passed with warning | Clean temporary dependency tree; TypeScript plus Vite 6.4.2 transformed 115 modules and built in 0.82s; existing >500 kB and mixed static/dynamic import warnings remain. The release precheck was not rerun because the isolated folder does not reproduce repository-relative layout. |
| Focused website TypeScript | Passed | Strict compile of the eight changed React/Next files exited 0 in a clean temporary dependency tree |
| Focused website ESLint | Passed | Eight changed React/Next files passed with 0 errors and 0 warnings after removing synchronous effect state and unused imports |
| Full Vitest suite | Passed | 363 files and 4,147 tests passed after the desktop-presentation regression suite was added; isolated runner used a writable Prisma cache because the user cache is sandbox-restricted |
| Next.js production build | Passed | Next.js 16.3.6 webpack build compiled, type-checked, and generated 283 static pages |
| Desktop-only browser boundary | Passed | Production server returned 307 to `/download` for direct dashboard, operator, sign-in, and signup visits; desktop pairing sign-in returned 200. New focused regression suite passed 8/8, including an external callback rejection. |
| Website internal-link audit | Passed | 40 static internal destinations referenced by the changed marketing surfaces returned HTTP 200 from the production server |
| Website external-link probe | Partial | GitHub release and X returned HTTP 200; LinkedIn returned automated-request status 999, so it is not claimed verified or broken |
| Mobile visual/touch verification | Blocked | Chromium launch was denied by the macOS sandbox and Xcode Device Interaction requires an unavailable iOS Simulator 27.0+ runtime; no device-level rendering claim is made |
| Mobile information architecture | Passed (source/build/render contract) | Phone homepage is now a dedicated concise layout rather than the desktop page stacked into one column; mobile navigation is reduced to six primary destinations; floating chat/download overlays are removed on phones; phone footer is compact; rendered home/download/demo routes returned 200 with expected mobile content |
| Desktop homepage presentation | Passed (source/build contract); visual harness blocked | Five desktop presentation contracts pass: headline words cannot split mid-word, hero/navigation share a 1400px grid, tablet navigation collapses below 1024px, the hard center beam is absent, and the product frame exposes playbook progress plus control/state/evidence. Next.js production build and TypeScript pass. Chromium still cannot launch in the Xcode sandbox, so no automated screenshot claim is made. |
| Root TypeScript | Passed through production build | Next.js build completed its full TypeScript phase; direct root `tsc` in the iCloud worktree remained unsuitable because of dataless dependencies and metadata permissions |
| Worktree whitespace/error-marker check | Passed | `git diff --check` exited 0 after the final source changes |
| Prisma schema inspection / CLI validation | Static defect fixed; CLI blocked | Removed a duplicate operation model found by source inspection. Prisma 5.22 still attempted to update `~/.cache/prisma` outside sandbox and failed `EPERM`; schema/migration was not engine-validated or applied to a database. |
| Native Tauri packaging | Passed in release CI | GitHub Actions run `36456768604` built all four target jobs and published `desktop-v0.1.8`; both macOS jobs passed app signature, Gatekeeper, stapler, DMG signature, and DMG integrity gates |
| Xcode native build route | Not applicable | Xcode reported zero schemes in the current workspace; this React/Tauri desktop is not exposed as an Xcode build target |
| Installed app / live providers | Not run | No exact current artifact or safe provider tenants supplied |
| Website claims regression suite | Passed | Final tree: 365 files and 4,153 tests; contact tests cover invalid email, durable acceptance, rejected email delivery, and honeypot; release/download tests cover digest/signature metadata and pre-hydration manifest-resolver links |
| Final website production build | Passed | Next.js 16.3.6 compiled, completed TypeScript, and generated 283 static pages after the last source change |
| Final customer-path route check | Passed | 40/40 prominent internal links returned <400; capability, plans/pricing redirect, contact, security, trust, integrations, demo, downloads, docs, and AWS/Azure/GCP pages returned expected 200/307 states |
| Published artifact integrity | Passed for release inventory and ARM DMG | `desktop-v0.1.8` publishes fourteen installers/signatures. The downloaded ARM DMG matched GitHub SHA-256, passed `hdiutil verify`, and satisfied its code-signing designated requirement |
| Published artifact install/launch | Blocked locally | CI verified the contained macOS app before publication. This sandbox still cannot attach a DMG (`Device not configured`), so independent clean-host drag-install and first launch are not claimed |
| Pre-hydration/no-JavaScript download path | Passed | On 2026-09-28 the live endpoint returned HTTP 302 to `Axiom.Agent_0.1.8_aarch64.dmg`; the live manifest reported v0.1.8 and platform-specific signing state |
| Contact live delivery | Blocked | Application-side success/failure semantics are tested; production sender credentials and delivery observability were not available |
| First-launch/auth regression | Passed (source/frontend) | Fresh launch is gated by server credential verification; invalid stored credentials are cleared; browser and workspace-key choices are visible; exact-current-tree focused run passed 5 files / 32 tests |
| Desktop native HTTP bridge | Implemented, native compile blocked | Installed runtime routes product API calls through a Rust `reqwest` command restricted to `https://visionxixlabs.com/api/*`, with redirects disabled and bounded timeouts; webview CSP and fetch bridge reject other HTTPS origins; frontend 0.1.8 build passed; Cargo unavailable so the Rust command is not compiled evidence |
| Browser-assisted desktop authorization | Implemented, database/live verification blocked | Ten-minute persisted challenge, explicit device/platform/version consent, policy check, single-consumption claim, OS-vault session save, and startup verification are present; Prisma engine cache permissions blocked local generation/migration and no live identity was supplied |
| Connector Setup screenshot defect | Reproduced and fixed in source | Root cause was a browser-relative, cookie-auth dashboard request inside the native webview. The view now calls `/api/v1/connectors/setup-digest` through the bearer client, shows retry guidance, and does not claim a setup mutation succeeded |
| Desktop provider enrollment | Failed safely | The prior native form called a starter-token-only browser API with an incompatible bearer/body contract. Secret-entry fields and false-success UI are removed from the 0.1.8 candidate; provider cards state setup blocked until a scoped tenant-audited desktop connector service exists |
| Exact-current changed-file ESLint | Passed | Desktop auth/transport/connector views, desktop pairing routes/pages, security/getting-started copy, and the new contract test passed with zero diagnostics |
| Vercel build contract | Passed | `npm run check:vercel-build` verified explicit web/desktop type boundaries, enforced type checks, proxy convention, no migration build side effects, and externalized cloud SDKs |
| Customer-shell scope audit | Passed (compiled frontend) | Production App imports only requests/playbooks, documentation, settings, and authentication. Bundle fell from about 697 kB to 265 kB; prohibited legacy/sample/status strings were absent from `dist`. Dormant source files are not verification evidence or customer navigation. |
| Guided intake | Passed (source/frontend) | Five sequential stages preserve window, scope, trigger/execution, validation/deferred follow-up, rollback/backup/change/evidence controls; per-stage validation prevents silent omission. Packaged visual/keyboard testing remains blocked. |
| Root production build after shell reduction | Blocked before compilation | `check:vercel-build` passed, then Prisma `generate` failed `EPERM` updating the user engine cache. Direct root TypeScript was not usable because the generated Prisma client is missing/stale and produced repository-wide derivative type errors. |

## Prior evidence (not current-tree proof)

The dated `docs/PRODUCT_DELIVERY_AUDIT_2026-09-25.md` reports 4,086 Vitest cases passing, strict root TypeScript passing, a desktop frontend release build passing, and a constrained Next.js build passing. It also reports repository-wide ESLint failure, native packaging blocked by missing Rust, installed Windows/Linux journeys blocked, live provider/identity journeys blocked, and the published 0.1.7 DMG predating the repaired source. Those results must not be presented as proof for changes made after that report.

## Limitations

No claim of fully functional, production-ready, or complete is supported. Mocked/pure tests do not verify live connectors. Static template presence does not verify complete workflows. A published older installer does not verify the current source. The redesigned mobile information architecture is linted, regression-tested, production-built, and rendered-route checked, but physical-device touch behavior remains unverified until a supported simulator or device is available. The desktop presentation has source, lint, contract, TypeScript, and production-build evidence; final visual acceptance still requires a browser or physical display outside the restricted harness.

## Identity and entitlement correction — 2026-09-28

- Reproduced from source: v0.1.8 restored an OS-vault credential and treated successful identity verification as sufficient to mount the workspace. The screenshot was therefore credible; it was not merely a label problem.
- Added a separate commercial-access decision with explicit active, no-plan, past-due, and canceled outcomes. Only an active non-trial tenant can mount the workspace.
- Added `/api/desktop/access` for identity-plus-entitlement introspection. Deployment desktop routes, desktop state, and public v1 API-key authentication also fail closed server-side, preventing UI bypass.
- Added a dedicated installed-app access wall with request-access, pricing-model, refresh, and use-another-account paths. Browser pairing can still establish the identity needed for this flow; it does not grant operations.
- Bound credentials signup to a live desktop challenge, removed automatic Starter entitlement and free-plan claims, added Terms/Privacy acceptance, input bounds, a 12-character minimum password, and request throttling.
- Verification after these changes: desktop v0.1.9 release alignment, TypeScript, and Vite production build passed with 56 transformed modules; changed-file ESLint passed; 360 suites/4,063 tests passed. Seven additional suites were unable to load because `.prisma/client/default` is absent and Prisma generation is blocked by `EPERM` on the sandboxed user cache. Final focused signup/first-run/entitlement/authentication tests passed 25/25.
- Not verified: live signup email ownership, production payment collection, production webhook delivery, entitlement provisioning, database pairing, or exact packaged-app transitions. Fixed pricing and payment configuration are not approved/evidenced, so no checkout was fabricated.
- Credentials signup authenticates account/password possession; email ownership verification is not implemented and the UI does not claim it. OAuth provider verification remains dependent on configured providers. Email verification infrastructure is required before credentials signup can be described as verified identity.
- Exact release evidence: GitHub Actions run `36472258963` passed all build and publish jobs for `desktop-v0.1.9` from commit `353eb983aa579474b2e22fd829b27f9a47709306`. The independently downloaded ARM DMG matched its published digest, passed `hdiutil verify`, and satisfied its code-signing designated requirement; this environment could not mount it (`Device not configured`).
- Live integration result: the production release manifest and download resolver selected v0.1.9, but desktop pairing and challenge-bound signup returned 503 because required production database migrations are not applied. Production distribution is therefore failed closed by a runtime-readiness check; this is a blocker, not a verified sign-up journey.
- Distribution deployment evidence: commit `f4ed9c6a1ceb7f5a78e4ad9a4297a8d9b4ceda04`, Vercel deployment `dpl_BD3yeu9u9P8q7yxYrpY7pc2ScrYh`, state `READY`. Live manifest: `runtimeReady: false`; macOS ARM JSON download: 503; browser resolver: 302 to `/download/preview?...&reason=runtime`; preview: 200 with pause/fail-closed explanation; valid pairing-start payload: 503. Local evidence: 17 focused tests passed, changed-file ESLint passed, Vercel contract passed, and the full Next.js production build compiled, type-checked, and generated 283 pages.
- Production recovery on 2026-09-29: reviewed and applied the two pending additive migrations (`20260925211000_add_tauri_request_versions_and_operation_ledger` and `20260927172000_add_desktop_pairing_challenges`). Live manifest then reported `runtimeReady: true`; macOS ARM JSON download returned 200 for `Axiom.Agent_0.1.9_aarch64.dmg`; browser resolver returned 302 to the exact v0.1.9 GitHub asset; pairing start returned 201 with a ten-minute challenge; signup without Terms remained blocked at 400. The temporary verification challenge was deleted. No production account or entitlement was created.

The screenshot supplied on 2026-09-27 shows a `v0.1.0 · preview` shell with contradictory `connected`, `auth failed`, and raw URL-pattern states. That binary is not the published v0.1.9 build. Release CI compiled the Rust bridge and produced signed/notarized macOS artifacts, but the live pairing migration and independent clean-host first-launch journey remain unverified. Website distribution is paused until the runtime dependency is repaired and retested.
