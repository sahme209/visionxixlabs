# Website transformation report

Status: in progress on `codex/product-led-website`. This document is an audit ledger, not a completion claim. Last audited: 2026-10-12.

## Route inventory

The repository currently contains 336 App Router `page.tsx` entries. The production build generates 288 route entries after dynamic and generated paths are resolved; these are different measurements. The latest guided integration setup from `main` is included in both counts.

| Route family | Pages | Browser role | Transformation treatment |
|---|---:|---|---|
| Marketing route group | 11 | Public acquisition | Shared neutral/orange system; obsolete `changelog`, `disciplines`, and `team-of-one` narratives now redirect to the verified product story |
| Documentation | 28 | Public self-service | Shared calm documentation shell applied; unsupported scan, Terraform, browser-surface, and execution-plan narratives retired behind canonical redirects |
| Authentication | 3 | Desktop pairing identity flow | Palette migrated; pairing and fail-closed behavior preserved |
| Account and help | 4 | Authenticated web companion | Palette migrated; usability review in progress |
| Administration | 20 | Restricted browser operations | Functionality preserved; not part of the public acquisition journey |
| Dashboard | 227 | Redirected legacy browser surfaces | Excluded from visual redesign: `proxy.ts` redirects every browser request to `/download`, so these files are not a customer-facing product surface |
| Operator | 2 | Redirected legacy browser surfaces | Same redirect boundary as dashboard |
| Demonstrations | 3 | Public isolated simulation | Landing rebuilt around the five-chapter cinematic tour; scenario pages under review |
| Other public/companion routes | 38 | Public, legal, support, download, and pairing | Palette migrated; legacy consulting funnels now resolve to the canonical product, integration, security, and demonstration journeys |
| **Total** | **336** |  |  |

## Public journey review

| Journey stage | Primary routes | Current state |
|---|---|---|
| Discover | `/`, `/product`, `/capabilities`, `/how-it-works` | Shared system applied; homepage/product demo already present |
| Understand | `/demo`, `/demo/[id]`, `/demo/reference`, `/integrations`, `/security`, `/enterprise-readiness` | Cinematic verified workflow and precise availability language applied; legacy scenario/reference URLs now redirect to the single reviewed tour instead of exposing stale internal claims |
| Learn | `/docs/**`, `/faq`, `/resources`, `/insights/**` | Unified docs shell applied; canonical docs now cover GitHub, approvals, AWS ECS OIDC, rollback, permissions, and released-product boundaries |
| Start | `/download`, `/docs/desktop-install`, `/desktop/connect` | Desktop-first pairing preserved; public CTAs now lead to download instead of an invalid unpaired signup |
| Buy | `/plans`, `/pricing`, `/operator/pricing` | Public Free/Pro/Enterprise proposal added; checkout remains disabled until legacy registries, organization authority, and Stripe test-mode mappings are reconciled |
| Operate | Desktop app + `/api/desktop/**` | Intentionally not moved into the browser |
| Support | `/account/help/**`, `/docs/integration-setup`, `/status`, `/contact` | Self-service first; obsolete troubleshooting redirects to the setup guide, while `/contact` is a minimal escalation path for genuine unresolved issues rather than a sales funnel |
| Trust | `/security`, `/privacy`, `/terms`, `/trust`, `/docs/permissions-model` | Available; legal and security behavior preserved |

## Design-system controls

- Canonical canvas: `#141414`; elevated surface: `#1A1A1A`.
- Canonical emphasis: Axiom orange `#F54E00` and warm orange `#FF783D`.
- Purple, violet, lavender, fuchsia, indigo names and known legacy purple RGB/hex values are prohibited in website source.
- Semantic success, warning, and danger colors remain allowed where they communicate state.
- Motion must explain state or progression and respect `prefers-reduced-motion`.
- Operational claims must map to verified desktop/API behavior; simulated website interactions are labeled.
- Legacy `dashboard` and `operator` source is not a design target while the unconditional browser redirect remains in force.

## Canonical route decisions

| Former route | Canonical destination | Reason |
|---|---|---|
| `/axiom/operations`, `/axiom/releaseops`, `/team-of-one` | `/product` | Removed unsupported autonomous-operations and browser-product claims |
| `/changelog`, `/disciplines` | `/product` | Retired stale service-led narratives from the product journey |
| `/docs/desktop-architecture`, `/docs/surfaces` | `/docs/desktop-install`, `/docs` | The desktop app is the operational UI; browser dashboard pages are unreachable |
| `/docs/scanning`, `/docs/terraform-export` | `/docs/releaseops` | AWS scanning and Terraform execution are not released desktop capabilities |
| `/docs/execution-plans`, `/docs/audit-logs` | `/docs/approval-workflow`, `/docs/security-model` | Consolidated on the real proposal, approval, execution, and audit model |
| `/docs/best-practices`, `/docs/troubleshooting` | `/docs/quickstart-checklist`, `/docs/integration-setup` | Replaced generic guidance with supported click-first setup and recovery |
| `/docs/source-modes` | `/docs/security-model` | Removed legacy product vocabulary that did not map to the desktop app |
| `/services` | `/product` | Retired the legacy consulting engagement catalog in favor of the self-service product |
| `/cloud-security` | `/security` | Replaced a sales-led audit offer with the verified product security boundary |
| `/cloud-solutions/**` | `/integrations` | Removed unverified multi-cloud service packages; the integration page now states each provider's real availability |
| `/case-studies` | `/demo` | Replaced representative consulting claims with clearly labeled, interactive product simulations |

## Billing reconciliation boundary

The proposed public catalog is centralized in `lib/billing/publicPlanCatalog.ts`. Both checkout URLs now execute one organization-scoped implementation and are fail-closed unless `AXIOM_SELF_SERVICE_BILLING_ENABLED=true`. Owner/admin authority, server-counted accepted seats, explicit monthly/annual price mappings, test/live key matching, and a separate live-billing approval lock are implemented. Real charges remain disabled while legacy entitlements, existing subscriptions, transactional quotas, and Stripe test-mode journeys are reconciled. `docs/BILLING_RECONCILIATION.md` records the exact boundary and activation sequence.

## Reference assets reviewed

The supplied archive contains 25 Axiom product screenshots. Representative Agent, Plugins & Skills, Airflow, and integration-settings screens were reviewed to preserve the desktop mental model: selected repository, branch, and deployment environment remain visible; Airflow is a first-class dependency; writes pause for approval; and advanced detail is progressively disclosed. Website demonstrations use reconstructed UI and scripted data rather than presenting screenshots as live operations.

## Verification ledger

| Check | Result |
|---|---|
| TypeScript (`npx tsc --noEmit`) | Passing after the current migration |
| Public plan catalog tests | 4 passing |
| Live public source purple/cyan-name scan | Passing; redirected dashboard/admin source is explicitly excluded from this customer-facing gate |
| Known legacy purple RGB/hex scan | Passing across public pages, shared public components, diagrams, manifest, and Tailwind configuration |
| Full Vitest suite | 496 files and 4,976 tests passing |
| Production build | Passing after merging current `main`, with `next build --webpack` (288 generated route entries); the wrapper's Prisma generate step cannot update the sandboxed user cache |
| Representative public route smoke test | `/`, `/product`, `/demo`, `/integrations`, `/plans`, `/download`, `/docs`, `/docs/getting-started`, `/security`, `/privacy`, `/terms`, and `/auth/signin` returned 200 from the local production server |
| Authenticated companion route smoke test | `/account/help` requires a production `NEXTAUTH_SECRET`; the local server returned 500 because that secret is intentionally unavailable in this sandbox |
| Representative product-reference review | Complete for supplied Agent, integration, and Airflow screens |
| New website desktop/mobile captures | Pending; local Chromium cannot create Mach ports in the current sandbox |
| Vercel deployment health | Latest preview `dpl_9sSJf28Bs2jeR5btwCc21cAjtxgi` received commit `6e6af4e2` but fails before build with `BUILD_FAILED: Resource provisioning failed` and emits zero build events. All nine recent deployments for this branch show the same platform-level error, while GitHub typecheck/tests pass. No retry, redeploy, configuration mutation, or production action was taken. |

## Completion rule

Do not mark this transformation complete until every public, account, authentication, support, documentation, and legal route has an explicit reviewed result; representative visual captures exist; production build and critical journeys pass; the Stripe test-mode contract is reconciled; and any remaining redirected legacy pages are documented rather than misrepresented as live product surfaces.
