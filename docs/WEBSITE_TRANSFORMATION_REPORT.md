# Website transformation report

Status: in progress on `codex/product-led-website`. This document is an audit ledger, not a completion claim.

## Route inventory

The repository currently contains 336 App Router `page.tsx` entries. The production build generates 288 route entries after dynamic and generated paths are resolved; these are different measurements. The latest guided integration setup from `main` is included in both counts.

| Route family | Pages | Browser role | Transformation treatment |
|---|---:|---|---|
| Marketing route group | 11 | Public acquisition | Shared neutral/orange system; individual composition review in progress |
| Documentation | 28 | Public self-service | Shared calm documentation shell applied; guided integration setup merged; individual content review in progress |
| Authentication | 3 | Desktop pairing identity flow | Palette migrated; pairing and fail-closed behavior preserved |
| Account and help | 4 | Authenticated web companion | Palette migrated; usability review in progress |
| Administration | 20 | Restricted browser operations | Palette migrated; functionality preserved |
| Dashboard | 227 | Redirected legacy browser surfaces | Source palette migrated, but these routes are not advertised as product UI because `proxy.ts` redirects every browser request to `/download` |
| Operator | 2 | Redirected legacy browser surfaces | Same redirect boundary as dashboard |
| Demonstrations | 3 | Public isolated simulation | Landing rebuilt around the five-chapter cinematic tour; scenario pages under review |
| Other public/companion routes | 38 | Public, legal, support, download, and pairing | Palette migrated; page-by-page composition review in progress |
| **Total** | **336** |  |  |

## Public journey review

| Journey stage | Primary routes | Current state |
|---|---|---|
| Discover | `/`, `/product`, `/capabilities`, `/how-it-works` | Shared system applied; homepage/product demo already present |
| Understand | `/demo`, `/demo/[id]`, `/integrations`, `/security`, `/enterprise-readiness` | Cinematic workflow and precise availability language applied; scenario detail review remains |
| Learn | `/docs/**`, `/faq`, `/resources`, `/insights/**` | Unified docs shell applied; dense legacy content review remains |
| Start | `/download`, `/docs/desktop-install`, `/desktop/connect` | Desktop-first pairing preserved; public CTAs now lead to download instead of an invalid unpaired signup |
| Buy | `/plans`, `/pricing`, `/operator/pricing` | Public Free/Pro/Business proposal added; legacy pricing aliases and internal registries still require reconciliation |
| Operate | Desktop app + `/api/desktop/**` | Intentionally not moved into the browser |
| Support | `/account/help/**`, `/docs/troubleshooting`, `/status`, `/contact` | Available; visual/content review remains |
| Trust | `/security`, `/privacy`, `/terms`, `/trust`, `/docs/permissions-model` | Available; legal and security behavior preserved |

## Design-system controls

- Canonical canvas: `#141414`; elevated surface: `#1A1A1A`.
- Canonical emphasis: Axiom orange `#F54E00` and warm orange `#FF783D`.
- Purple, violet, lavender, fuchsia, indigo names and known legacy purple RGB/hex values are prohibited in website source.
- Semantic success, warning, and danger colors remain allowed where they communicate state.
- Motion must explain state or progression and respect `prefers-reduced-motion`.
- Operational claims must map to verified desktop/API behavior; simulated website interactions are labeled.

## Billing reconciliation boundary

The proposed public catalog is centralized in `lib/billing/publicPlanCatalog.ts`. Both existing checkout entry points are fail-closed unless `AXIOM_SELF_SERVICE_BILLING_ENABLED=true`. Real charges remain disabled while the legacy plan registry, tier catalog, entitlement mapping, organization billing authority, and Stripe webhook model are reconciled and tested. `docs/BILLING_RECONCILIATION.md` records the current authorities, proposed contract, migration boundary, and approval-gated activation sequence.

## Reference assets reviewed

The supplied archive contains 25 Axiom product screenshots. Representative Agent, Plugins & Skills, Airflow, and integration-settings screens were reviewed to preserve the desktop mental model: selected repository, branch, and deployment environment remain visible; Airflow is a first-class dependency; writes pause for approval; and advanced detail is progressively disclosed. Website demonstrations use reconstructed UI and scripted data rather than presenting screenshots as live operations.

## Verification ledger

| Check | Result |
|---|---|
| TypeScript (`npx tsc --noEmit`) | Passing after the current migration |
| Public plan catalog tests | 4 passing |
| Source purple-name scan | Passing |
| Known legacy purple RGB/hex scan | Passing across `app`, `components`, `styles`, and Tailwind configuration |
| Production build | Passing after merging current `main`, with `next build --webpack` (288 generated route entries); the wrapper's Prisma generate step cannot update the sandboxed user cache |
| Representative public route smoke test | `/`, `/product`, `/demo`, `/integrations`, `/plans`, `/download`, `/docs`, `/docs/getting-started`, `/security`, `/privacy`, `/terms`, and `/auth/signin` returned 200 from the local production server |
| Authenticated companion route smoke test | `/account/help` requires a production `NEXTAUTH_SECRET`; the local server returned 500 because that secret is intentionally unavailable in this sandbox |
| Representative product-reference review | Complete for supplied Agent, integration, and Airflow screens |
| New website desktop/mobile captures | Pending; local Chromium cannot create Mach ports in the current sandbox |
| Vercel deployment health | Preview deployment `dpl_7rKaTYXcMbGWVRcfANEHrKKaZUtx` fails before build with `BUILD_FAILED: Resource provisioning failed` and emits no build events. The same pattern affects recent feature-branch previews while their merged `main` commits deploy successfully, so this is isolated to Vercel preview provisioning rather than the application build. No redeploy or production action was taken. |

## Completion rule

Do not mark this transformation complete until every public, account, authentication, support, documentation, and legal route has an explicit reviewed result; representative visual captures exist; production build and critical journeys pass; and any remaining redirected legacy pages are documented rather than misrepresented as live product surfaces.
