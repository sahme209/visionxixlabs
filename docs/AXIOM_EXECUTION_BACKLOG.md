# Axiom Execution Backlog — Persistent Ledger

Single source of truth for remaining work on `codex/workspace-integration-foundation`.
Update this file as work lands so a new session can resume without re-deriving state.
Evidence labels (never upgrade a row without the stated proof):

- **NOT STARTED**
- **IN PROGRESS**
- **IMPLEMENTED LOCALLY** — code exists, committed, not yet pushed/CI-run
- **CI VERIFIED** — real `tsc`+`vitest` executed it in GitHub Actions
- **REAL-SYSTEM VERIFIED** — exercised against a real device/account/provider
- **PRODUCTION VERIFIED** — deployed to `main`/production and smoke-tested
- **EXTERNALLY BLOCKED** — needs one of: production logs/Vercel dashboard access,
  physical device, real cloud test account, OAuth/IdP credentials, a clean
  Postgres test database, sanitized demo/recording tooling, or explicit
  production merge approval. State the exact one.

Current feature-branch CI baseline: **418/418 test files, 4439/4439 tests**
(commit `c688d24c`). `main` HEAD: `77784b0a` (Terraform kill-switch only).

---

## P0 Production

| # | Item | State | Next atomic unit |
|---|---|---|---|
| P0.1 | Terraform/IAM default-deny | CI VERIFIED | none — hold at current state until governed-execution prerequisites (§4) ship |
| P0.2 | Desktop pairing root-cause fix | EXTERNALLY BLOCKED — needs real Vercel production function logs for the failed `/api/desktop/access` request | none possible until logs arrive |
| P0.3 | `TERRAFORM_LEGACY_APPLY_ENABLED` Vercel value confirmed absent/not-"true" | EXTERNALLY BLOCKED — needs Vercel dashboard access (none in this sandbox) | none possible |
| P0.4 | `main` branch protection | EXTERNALLY BLOCKED — repo-settings API call is blocked by this session's own permission classifier; needs you to run the `gh api` command already given, or use the GitHub UI | none possible from here |
| P0.5 | Real-device pairing verification (install→launch→sign-in→approve→return; entitled/unentitled/expired/replayed/revoked/wrong-user/wrong-tenant/fingerprint-mismatch) | EXTERNALLY BLOCKED — needs physical hardware | none possible; all *logical* equivalents of these states are already CI VERIFIED via `app/api/desktop/pair/status/__tests__/route.test.ts` and `app/api/desktop/session/__tests__/route.test.ts` |

---

## 1. GitHub legacy shared-credential subsystem

| Sub-item | State | Next atomic unit |
|---|---|---|
| 1.1 Retire-vs-migrate decision | CI VERIFIED — decision made: **migrate via honest relabeling + admin-gating**, not retire outright (`1e9ff5dc`). Rationale: `/dashboard/github` ("GitHub demo scan") still has real, non-decorative callers in `lib/product/axiomProductModel.ts`, `lib/safety/automationBoundaryDetector.ts`, `lib/operatingLoop/operatingLoopBuilder.ts`, `lib/readiness/launchReadinessRunner.ts`, `lib/actions/actionRegistry.ts`, `lib/validation/platformValidationMatrix.ts`, `lib/releaseops/getReleaseOpsState.ts` — removing the route would break those surfaces for no safety gain once mislabeling is fixed. `/dashboard/github` no longer accepts a client-supplied org (closed exploit); `/api/github/deep-posture` is `requireAdmin`-gated. | None — decision closed. Re-open only if a caller list audit finds a NEW cross-tenant exposure. |
| 1.2 Full caller/credential-boundary map | CI VERIFIED (docs-only change, no logic risk) — caller list now lives as a code comment at the top of `lib/connectors/github/githubLiveClient.ts` itself, not just in this ledger | none — closed |
| 1.3 Tenant GitHub evidence path kept separate and clean | CI VERIFIED (`GitHubInstallation` model, `/dashboard/integrations/github`, confirmed clean by dedicated audit this session) | none |

---

## 2. GitHub real evidence (tenant-scoped)

| Sub-item | State |
|---|---|
| Install / selected-repo validation | CI VERIFIED |
| PR/check/workflow/environment/deployment evidence reads | CI VERIFIED |
| Revoke → cache purge → audit | CI VERIFIED (`githubAppAuthCachePurge.test.ts`, `github-installation-transition/__tests__/route.test.ts`) |
| Token expiry handling | CI VERIFIED (`githubAppAuthExpiry.test.ts`, added this session) |
| Release→Repository binding (persisted, immutable, tenant-scoped, no query-string) | CI VERIFIED (`evidenceRepositoryId` on `Release`, bound once at creation, validated against live installation coverage) |
| Real test-organization install end-to-end | EXTERNALLY BLOCKED — needs a real GitHub App installation on a test org |

**All sub-items closed except the one real-system row.**

---

## 3. Playbook lifecycle (Request → Closure)

| Sub-item | State |
|---|---|
| Honest unavailable/not-evaluated/not-required states at every stage | CI VERIFIED |
| Readiness overallScore/blockerCount fake-zero fix | CI VERIFIED |
| Approval `not_evaluated` vs genuinely-pending distinction | CI VERIFIED |
| `execution.startedAt` wired to real data | CI VERIFIED |
| Test coverage: unscored/pending/blocked/failed/rolled_back/incomplete/successful | CI VERIFIED (`release-playbook/[id]/__tests__/route.test.ts`) |
| Real-system validation against a live Postgres-backed release | EXTERNALLY BLOCKED — needs a clean Postgres test database |

**All logic sub-items closed; only the real-DB row remains, tracked, not re-attempted until a database exists.**

---

## 4. AI governance

| Sub-item | State |
|---|---|
| Live tenant-facing AI route inventory | CI VERIFIED (`aiRouteGovernanceInventory.test.ts` + this session's manual sweep of `lib/workforce/**`, which the automated inventory doesn't cover) |
| Workspace policy / provider allowlist / fallback / budget / attribution / audit enforced at every found route | CI VERIFIED — `codeProposeRealExecutor.ts` gap closed + tested; 6 fail-open budget checks fixed; `lib/ai/chat.ts` + `lib/chatbot/actionAgent.ts` (dead, ungoverned) deleted |
| `simulated` / `not_verified` / `applied` / `verified` kept structurally distinct, cannot fake a closed/healthy state | CI VERIFIED (`applyEngineSimulatedStatus.test.ts`, `verificationEngineNotVerified.test.ts`) |
| Real-system test: approved provider call, provider failure, policy failure, budget outage, attribution | EXTERNALLY BLOCKED — needs a real AI provider test credential (Anthropic/OpenAI) to exercise beyond mocks |

---

## 5. Cloud / integrations / execution

| Sub-item | State |
|---|---|
| AWS read-only health/evidence — logic honesty | CI VERIFIED (`awsAdapterValidateConnection.test.ts`, `awsAdapterApplyAction.test.ts`) |
| AWS real pilot-account run | EXTERNALLY BLOCKED — needs a real AWS test account |
| Azure/GCP/Slack/Teams/CI-CD/ticketing/observability/incident tools | SOURCE AUDITED — confirmed **NOT IMPLEMENTED FOR LIVE USE**, every connection-status surface already fails closed to "not connected"/"unavailable" honestly (dedicated audit this session found zero fake-connected states) | Next atomic unit: none code-side — these are correctly inert until real OAuth app registrations exist (external blocker) |
| Deployment rehearsal truthfulness (plans/policy/dependency/secrets-ref/rollback artifacts) | SOURCE AUDITED — confirmed honest (prechecks are real local validation, rollback is plan-only and labeled as such, `applyEngine.ts` messages fixed to say "not yet executed") |
| Governed-execution canonical contract — **design** | IMPLEMENTED LOCALLY (`docs/GOVERNED_EXECUTION_BOUNDARY.md`) |
| Governed-execution canonical contract — **enforceable interfaces/types** | CI VERIFIED (`lib/execution/governedExecutionContract.ts` + `__tests__`, commit `2fc972ef`/`d9eb7210`, 417/417 suite). **Internal-only — not wired into any route, not a feature, not "governed execution is live."** `evaluateGovernedExecutionPrerequisites()` runs all six checks in canonical order, short-circuits on first failure, treats a thrown error identically to an explicit failure; `defaultDenyPrerequisites()` is a safe all-deny default, not an enabled capability. No existing kill-switch (Terraform/IAM/applyEngine) calls this yet and none should until there's a deliberate, reviewed reason to — do not wire it in just because it exists. |

---

## 6. Incident response / access lifecycle

| Sub-item | State |
|---|---|
| `IncidentRecord` schema + pure lifecycle kernel | CI VERIFIED |
| IO boundary (tenant ownership, role auth, audit, no delete) | CI VERIFIED |
| Migration applied against a real database | EXTERNALLY BLOCKED — needs a clean Postgres test database |
| Route/UI surface | NOT STARTED — deliberately deferred; do not build until there's an actual reason to expose it (explicit instruction) |
| Organization membership lifecycle (invite/role-change/remove) | CI VERIFIED (tests added this session) |
| Admin access-review evidence (listing) | SOURCE AUDITED — `app/dashboard/team/page.tsx` does a real tenant-scoped `findMany`; not independently unit-tested because it's a React Server Component, which this repo's vitest setup doesn't render-test today (would need new test infrastructure, not just a new test file) |
| Session revocation | CI VERIFIED (`app/api/desktop/session/__tests__/route.test.ts`) |

---

## 7. Enterprise identity (SSO/OIDC/SAML/MFA/SCIM)

| Sub-item | State |
|---|---|
| Design (models, flows, principles) | IMPLEMENTED LOCALLY (`docs/ENTERPRISE_IDENTITY_DESIGN.md`) |
| Concrete TypeScript interface contracts for the design | CI VERIFIED (`lib/identity/enterpriseIdentityContract.ts` + `__tests__`, commit `2fc972ef`/`d9eb7210`, 417/417 suite). **Internal-only — not wired into any sign-in route, no `TenantIdentityProvider` row can exist (the schema isn't even added yet), and nothing about this makes SSO/MFA live.** `resolveIdentityProviderForEmail()` (domain-routing, never user-picked — proven to prevent IdP-mixing across tenants), `mapClaimsToRole()` (first-match-wins, no match is a hard denial, never a default role), `evaluateMfaClaim()` (fails closed when MFA is required and absent from `amr`/`acr`). Next atomic unit: `TenantIdentityProvider`/`ScimProvisionedIdentity` Prisma models from the design doc are not yet added to `schema.prisma` — deferred until this logic layer is reviewed, to avoid another un-applied migration piling up before §6's existing one is verified. |
| Real IdP registration / live SSO | EXTERNALLY BLOCKED — needs a real OIDC/SAML identity provider |

---

## 8. Compliance control mapping

| Sub-item | State |
|---|---|
| Practical mapping doc (control/evidence/owner/gap/non-cert language) | IMPLEMENTED LOCALLY (`docs/COMPLIANCE_CONTROL_MAPPING.md`) |
| Testing-cadence enforcement (scheduled job) | NOT STARTED — proposed only, no job exists |
| `lastVerifiedAt` populated on any control | NOT STARTED |

---

## 9. Website / companion / download / mobile / media

| Sub-item | State |
|---|---|
| Governance-vs-FinOps pricing narrative | CI VERIFIED (bridging copy added) |
| Download page aligned with real pairing state (not overpromising while P0.2 is open) | CI VERIFIED |
| Homepage demo honesty (`DeploymentLifecycleDemo`) | CI VERIFIED — already compliant, confirmed by audit |
| Footer link-by-link check | SOURCE AUDITED — all 17 footer links (`components/Footer.tsx`'s `columns` array) verified to resolve to a real `page.tsx` file; zero dead links found |
| `/capabilities`, `/integrations` overstated-claim scan | SOURCE AUDITED — grepped for certification/guarantee/100%/fully-automated/connected language; clean, nothing found |
| Accessibility/mobile/WCAG source-level pass | **IN PROGRESS, first batch CI VERIFIED**: Navigation.tsx mobile menu audited and confirmed already solid (real focus trap, Tab/Shift+Tab cycling, Escape-closes-and-returns-focus, `aria-expanded`/`aria-controls`/`role="dialog"`/`aria-modal`, body scroll lock, 44×44px touch target) — no defect, no change needed. Images sitewide confirmed to have real `alt` text (two false positives from a naive grep, verified by hand). Heading hierarchy on the homepage confirmed correct (h1→h2→h3, no skips). Sign-in/sign-up forms confirmed to have proper `<label htmlFor>`/`id` pairing already. **Real defects found and fixed**: (1) sign-in, sign-up, and the contact form's error messages had no `role="alert"`/`aria-live` — a screen-reader user got no announcement on a failed submission; fixed on all three, plus added `role="status"`/`aria-live="polite"` to the contact form's success confirmation. (2) 16+ files call framer-motion's `motion.*`/`AnimatePresence` directly without going through the reduced-motion-aware `Reveal`/`Stagger` wrappers — fixed sitewide in one place via `<MotionConfig reducedMotion="user">` in `components/Providers.tsx` (framer-motion's own documented fix for exactly this gap), rather than patching 16 files individually. (3) found and fixed a **second occurrence** of the `a3d1b2ce` vitest-include bug: `components/**/__tests__` was never in the include pattern either — fixed alongside adding the new regression test. **Not yet swept**: `/resources`, `/security` page content (beyond the earlier certification-claim grep), dashboard/signed-in companion pages, full mobile-breakpoint visual check (blocked by no running dev server in this sandbox — `node_modules` never installed here), color-contrast ratios (can't compute without a renderer), route-transition focus management beyond Navigation.tsx's own handling. |
| Real screenshots / 30-second video | **Capture tooling: CI-adjacent IMPLEMENTED LOCALLY** — `scripts/capture-homepage-media.mjs` (Playwright-driven, captures real desktop+mobile screenshots and a real ~30s video against a real local dev server, fails loudly rather than fabricating anything; usage documented in `docs/RELEASE_MEDIA_CHECKLIST.md`). **The actual capture run remains EXTERNALLY BLOCKED** — this sandbox has no npm registry access (confirmed via a real `npm install` attempt hanging with zero response), so `npm run dev` can't start here at all. Needs you to run the script locally where dependencies can install. |

---

## 10. Final validation / production promotion

| Sub-item | State |
|---|---|
| `tsc` + `vitest` on every push, real | CI VERIFIED (415/415) — **this itself was broken for most of the session** (`a3d1b2ce` fixed a vitest include-pattern bug that silently excluded 9 `app/**/__tests__` files, including the Terraform kill-switch's own test, from ever running) |
| Production build (`next build`) | SOURCE AUDITED only — Vercel preview builds have run green throughout, but that's `next build` compiling, not a release-readiness artifact in this repo |
| Desktop build/tests | NOT STARTED this session (desktop-side `cd desktop && npx tsc --noEmit && npm run build` not run) |
| Migration-verification strategy | IMPLEMENTED LOCALLY as a documented convention (hand-authored migrations + separate human-triggered `production-db-migrate.yml`); no automated migration test exists |
| Accessibility sweep | NOT STARTED (beyond the demo component's own reduced-motion handling, already confirmed) |
| Route/link checker | NOT STARTED |
| Responsive desktop/tablet/mobile checks | NOT STARTED (no running dev server in this sandbox — `node_modules` never installed here) |
| Clean-host desktop checks | EXTERNALLY BLOCKED — needs physical hardware |
| Real integration tests | EXTERNALLY BLOCKED — needs real credentials across every integration |
| Production smoke tests | EXTERNALLY BLOCKED — needs production access |

---

## Standing note on §5/§7 internal contract modules

`lib/execution/governedExecutionContract.ts` and
`lib/identity/enterpriseIdentityContract.ts` are CI-verified pure logic,
**not features**. Neither is imported by any route, page, or kill-switch
today. Do not describe governed execution or SSO/MFA as "live,"
"implemented," or "available" anywhere (code comments, docs, UI copy,
status reports) on the strength of these modules existing — that claim
requires real wiring into a live route plus the external credentials
each still needs (a real IdP for identity; a real cloud account plus a
human-approved rollout for execution). Keep them internal until a
specific, reviewed reason to wire one in exists; do not add further
unconnected abstraction layers on top of them without the same
justification.

## Resume protocol

This ledger is the resume point. When starting a new session on this
branch: read the tables above, find the first row that is not CI
VERIFIED/REAL-SYSTEM VERIFIED/PRODUCTION VERIFIED and is not
EXTERNALLY BLOCKED, and continue from its "next atomic unit." If an
external blocker listed above has become available (logs obtained,
Vercel access granted, a device in hand, a cloud/IdP credential issued,
a Postgres test database reachable, recording tooling available,
merge approval given), resume that row immediately.
