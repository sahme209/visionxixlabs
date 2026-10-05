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

Current feature-branch CI baseline: **415/415 test files, 4411/4411 tests**
(commit `d2e431c9`). `main` HEAD: `77784b0a` (Terraform kill-switch only).

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
| 1.2 Full caller/credential-boundary map | SOURCE AUDITED (list above) | **Next atomic unit**: write this exact caller list into a code comment at the top of `lib/connectors/github/githubLiveClient.ts` so the next person touching this file sees the full blast radius without re-grepping. (small, safe, do next) |
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
| Governed-execution canonical contract — **enforceable interfaces/types** | IMPLEMENTED LOCALLY → CI VERIFIED once pushed (`lib/execution/governedExecutionContract.ts` + tests): `evaluateGovernedExecutionPrerequisites()` runs all six in canonical order, short-circuits on first failure, treats a thrown error identically to an explicit failure, and `defaultDenyPrerequisites()` gives any future execution path a safe all-deny starting point instead of a fourth bespoke kill-switch. Next atomic unit: wire one of the three existing kill-switches (Terraform/IAM/applyEngine) to actually call this shared contract instead of its own standalone boolean check — not done yet, deliberately deferred to avoid touching already-hardened, tested production code in the same batch as new scaffolding. |

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
| Concrete TypeScript interface contracts for the design | IMPLEMENTED LOCALLY → CI VERIFIED once pushed (`lib/identity/enterpriseIdentityContract.ts` + tests): `resolveIdentityProviderForEmail()` (domain-routing, never user-picked, proven to prevent IdP-mixing across tenants), `mapClaimsToRole()` (first-match-wins, no match is a hard denial — never a default role), `evaluateMfaClaim()` (fails closed when MFA is required and absent from `amr`/`acr`). Next atomic unit: `TenantIdentityProvider`/`ScimProvisionedIdentity` Prisma models from the design doc are not yet added to `schema.prisma` — deferred until this logic layer is reviewed, to avoid another un-applied migration piling up before §6's existing one is verified. |
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
| Remaining page sweep: footer/CTA/nav/security/capabilities/pricing claims/mobile/accessibility | SOURCE AUDITED for the pages explicitly checked this session (home, product, pricing, download, changelog, architecture docs); **not yet swept**: `/capabilities`, `/resources`, `/security` (beyond a skim), footer link-by-link, full mobile-breakpoint pass, full WCAG pass |
| Real screenshots / 30-second video | EXTERNALLY BLOCKED — needs sanitized live demo session + recording tooling |

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

## Active work this turn

Starting **§5 governed-execution canonical contract (enforceable interfaces)** and
**§7 enterprise-identity concrete interface contracts** as the two next atomic
units — both are pure TypeScript type/interface work with no cloud or IdP
credentials required, directly unblockable, and explicitly requested.
