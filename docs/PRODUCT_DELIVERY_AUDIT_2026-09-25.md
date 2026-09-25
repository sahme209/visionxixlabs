# Product delivery audit — 2026-09-25

## Conclusion

**Not ready for release.** The repaired source candidate passes the full automated behavior suite and the desktop frontend release build, but it is not the same binary as the currently published download. Native Tauri packaging and installed-app journeys remain blocked by the missing Rust toolchain and unavailable Windows/Linux hosts; the macOS DMG verifies but cannot be attached in this environment. Root TypeScript, ESLint, and two transitive production advisories also remain open.

## Exact candidates and environments

| Item | Value |
| --- | --- |
| Product | Axiom Agent |
| Desktop version | 0.1.7 |
| Base commit | `453ba80d10d1de7e0cebbe3aac9cb5da5195fd65` |
| Repaired source | Dirty working tree based on the commit above; do not publish as an identified release until committed |
| Source diff SHA-256 before this report | `b638215ad0799783d592eabade9269a1ce9570e4af40f05c1cefc2045c6c53fc` |
| Verification host | macOS arm64; Node 25.2.1; npm 11.6.2; no Cargo/Rust |
| Isolated build copy | `/tmp/axiom-verify.7dNM90` |
| Published package checked | `Axiom.Agent_0.1.7_aarch64.dmg` |
| Published package SHA-256 | `5b4b9f2d6f1292758d5b40e3838393bea8251d34e7fe45f1061858bf616a153b` |
| Release | https://github.com/sahme209/axiom-releases/releases/tag/desktop-v0.1.7 |

The published DMG is the prior 0.1.7 release, not a package built from the repaired working tree in this report.

## Requirements-to-test matrix

| Requirement / expected behavior | Role and prerequisites | Entry point | Dependencies | Test cases | Actual result and evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Website explains and distributes the installed product; browser dashboard is not the product | Visitor; browser | Home, Download, Docs, Sandbox | Release manifest, middleware | CTA destinations; dashboard/auth redirect; sandbox exit | Delivery-boundary regression tests passed within 4,083-test suite; existing 9-case focused suite remains included | Passed |
| Correct platform and architecture download | Visitor | Download page / release manifest API | GitHub Release | macOS arm64/x64, Windows x64 MSI/EXE, Linux x64 AppImage/DEB/RPM | Live release metadata contains all listed artifacts; version 0.1.7 agrees with desktop metadata | Passed |
| Download integrity | Installer | Published release | GitHub CDN | Download and SHA-256; DMG structure | arm64 DMG digest matched GitHub metadata and `hdiutil verify` passed | Passed |
| Installation, first launch, onboarding | New desktop user | DMG/MSI/AppImage | OS installer, Tauri runtime | Install; launch; setup; dependency prompt | DMG attach failed with “Device not configured”; Windows/Linux unavailable | Blocked |
| Signing, notarization, OS prompts | Installer | Published installers | Apple/Windows credentials | codesign, Gatekeeper, SmartScreen | Detached GPG was previously verified; machine signing/notarization are not explicitly attested and app bundle could not be mounted | Blocked |
| Desktop authentication, callback and deep link | Authenticated user; backend account | Sign-in / pairing | Browser, backend auth, custom scheme | Success, denial, expiry, replay, cancellation | Pairing/auth source repaired and automated tests pass; real identity callback not exercised | Blocked |
| Window, menu, tray, keyboard, resize, scaling | Desktop user | Native shell | Tauri/AppKit/Windows/Linux shell | Close/reopen; tray; menu; bounds recovery; multi-display | Window/menu/tray recovery code repaired; native runtime not available | Blocked |
| Secure local state and persistence | Desktop user | Settings, auth, handoffs | OS keychain/store | Save/reopen; corrupt/legacy state; logout; unexpected close | Secure storage migration and fail-closed behavior implemented; frontend tests/build pass; packaged persistence journey unavailable | Blocked |
| Deployment intake and dynamic validation | Requester | Intake routes/forms | API, Prisma | valid/missing/invalid/duplicate/boundary submissions | Covered by passing full suite; real packaged UI-to-database journey unavailable | Passed (automated) |
| Versioned requests and playbook generation | Requester/operator | Requests/playbooks | Database, AI/provider where enabled | create/revise/generate; malformed provider response | Covered by passing full suite; live model use not performed | Passed (automated) |
| Repository/application/client/environment catalogs | Admin/operator | Catalog modules | Database/connectors | empty/populated/search/filter/tenant scoping | Catalog and tenant tests pass in full suite | Passed (automated) |
| Readiness, approval, rejection, separation of duties | Requester/approver | Readiness/approvals | Authorization, evidence | approve/deny/revise/resubmit; self-approval denial; stale decision | Authorization/readiness suites pass; packaged multi-user journey not run | Passed (automated) |
| Scheduling, execution, cancellation, retry, rollback | Operator/approver | Execution workflows | Scheduler, provider adapters | schedule boundaries; cancel; duplicate submit; retry; rollback | Pure/service suites pass; no real deployment was executed | Blocked (live) |
| Change management and knowledge transfer | Operator/reviewer | Change and handoff modules | Jira/ServiceNow/Git providers | sync, disconnected provider, duplicate/delayed events | Mocked automated coverage passes; real sandboxes unavailable | Blocked (integration) |
| Evidence extraction, runbooks, audit, reports | Auditor/operator | Evidence/audit/report views | Persistence/export storage | collect; missing source; export; audit chain | Automated suites pass; exported files were not opened from packaged app | Blocked |
| Validation, deferred validation, follow-up, closure | Operator/approver | Validation/readiness | Evidence/connectors | pass/fail/defer/follow-up/close | Validation matrix and lifecycle coverage pass | Passed (automated) |
| Communications and adapters | Operator/admin | Connector settings | Provider credentials | connect/revoke/timeout/rate-limit/retry/duplicate webhook/signature | Mocked suites pass; no safe provider sandbox credentials available | Blocked |
| AI attribution, uncertainty, human confirmation | Requester/approver | AI-assisted modules | Model/source data | missing source/model; malformed response; unsupported conclusion; approval gate | Automated validation passes; live provider and confirmation journey unavailable | Blocked |
| Authentication/authorization/tenant isolation | User/admin | API/service boundaries | Session, database | unauthenticated, wrong role, cross-tenant ID, revoked session | Boundary tests pass within full suite; no live multi-tenant environment used | Passed (automated) |
| Offline/outage/error honesty | Desktop user | Startup and connected views | Network/backend | offline startup; timeout; revoked credential; partial response | Desktop repairs remove false trusted/success defaults; native offline journey unavailable | Blocked |
| Imports, exports, file selection and malformed files | Operator | Import/export surfaces | OS file picker/storage | unsupported/malformed/oversized; unavailable storage; open exported file | Service tests pass; native picker/export-open journey unavailable | Blocked |
| Upgrade and data preservation | Existing desktop user | Installer/update docs | Prior install, OS | upgrade 0.1.6→0.1.7; retain auth/settings/data | Automatic updater absent; clean upgrade hosts unavailable | Blocked |
| Uninstall and retained data | Desktop user | OS uninstall | OS package manager | uninstall; retained keychain/store documentation | Not executable on available host | Blocked |
| Website → sandbox → return home | Visitor | Public sandbox | Browser | enter; sample labels; navigate; exit | Sandbox regression suite passes; prior focused suite 15/15 | Passed |
| Dependency/security posture | Maintainer | Package manifests | npm registry | production audit; CSP; secret persistence | Desktop audit 0; root reduced from critical/high findings to 2 moderate transitive uuid/gaxios findings; CSP and secure storage repaired | Failed |
| Final packaged release matches repaired source | Customer | Downloaded installer | Rust, CI, signing | build, checksum, install, full journeys | Published 0.1.7 predates this dirty repair set; no final native package was produced | Failed |

## Executable checks

| Check | Passed | Failed | Blocked | Skipped | Evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Vitest files | 354 | 0 | 0 | 0 | 4,083 tests passed |
| Vitest cases | 4,083 | 0 | 0 | 0 | Final isolated run completed without unhandled errors |
| Python CLI | 30 | 0 | 0 | 0 | `unittest` OK |
| Desktop TypeScript/frontend release build | 1 | 0 | 0 | 0 | release alignment, TypeScript, and Vite build passed |
| Root TypeScript | 0 | 1 | 0 | 0 | 31 test-code diagnostics |
| ESLint | 0 | 1 | 0 | 0 | 686 errors and 402 warnings across 440 files |
| Production dependency audits | 1 | 1 | 0 | 0 | desktop 0 vulnerabilities; root 2 moderate transitive findings |
| Native Tauri package/build | 0 | 0 | 1 | 0 | Cargo/Rust unavailable |
| macOS DMG integrity/attach | 1 | 0 | 1 | 0 | checksum/verify passed; attach blocked |
| Windows/Linux install journeys | 0 | 0 | 2 | 0 | platforms unavailable |
| Live provider/identity journeys | 0 | 0 | 1 | 0 | safe credentials/tenants unavailable |
| **Totals** | **4,470** | **3** | **5** | **0** | Counts combine cases and explicit executable checks; platform entries are environment blocks |

## Defect and repair log

| Defect | Repair | Retest |
| --- | --- | --- |
| Desktop production dependency used vulnerable React Router 7.15.1 | Upgraded `react-router-dom`/router to 7.18.4 and regenerated lockfile | Desktop production audit: 0; frontend release build passed |
| Root contained critical/high Next.js, PostCSS and Google client dependency findings | Upgraded Next/eslint-config-next to 16.3.6, PostCSS to 8.5.28, Google Container to 7.2.0, and Google Storage to 8.2.0; refreshed lockfile | 4,083 tests passed; remaining audit limited to 2 moderate transitive findings |
| ESLint configuration used legacy FlatCompat against native Next 16 flat configs and crashed | Replaced it with direct `eslint-config-next/core-web-vitals` and `typescript` flat-config imports | Linter now executes and exposes the existing 686-error backlog |
| Desktop build failed on unused `MouseEvent` import | Removed unused type import | Desktop TypeScript and Vite release build passed |
| Prior desktop state could imply trust/success without verification | Preserved current repair set: CSP, secure persistence, auth/pairing validation, truthful preview/offline states, and safer handoff/menu/window behavior | Automated suite and frontend build pass; packaged runtime verification blocked |

## Remaining requirements to reach “ready”

1. Fix the 31 root TypeScript diagnostics and 686 ESLint errors without weakening rules.
2. Resolve or formally risk-assess the two remaining transitive production advisories.
3. Install Rust/Cargo, build a new native 0.1.7+ candidate from a committed tree, and publish checksums/attestations.
4. Install and exercise that exact candidate on clean macOS arm64/x64, Windows x64, and Linux x64 hosts.
5. Complete real non-production identity, provider, notification, persistence, export, upgrade, accessibility, offline, and recovery journeys.
6. Verify machine signing/notarization and updater behavior, or keep updater absence explicitly documented.
7. Replace the currently published download with the tested candidate only after all required checks pass.

No production deployment, customer notification, destructive provider action, or private tenant access was used.
