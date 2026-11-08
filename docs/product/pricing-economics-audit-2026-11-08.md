# Pricing and economics audit (read-only), 2026-11-08

Required by `docs/product/axiom-master-action-plan.md` ("Mandatory source and economics audit before implementation", ~L274) before any pricing implementation. Direction per `docs/product/execution-strategy-2026-11.md` decision log (2026-11-08 rows): Axiom free to explore; the only paid part is optional, transparent, **prepaid** AI usage (cost shown first, never charged beyond prepaid); enterprise is a scoped evaluation with no public seat price; Stripe stays donations-only (Founding Supporters) until an explicit payment decision; AI-credit and subscription code stays test-mode; not a token reseller.

Preserved A7 gates: locally verified synthetic request-cost accounting is **not** real qualified billable pricing; canonical quote eligibility is unavailable (`lib/ai/codingRequestQuote.ts:109` throws `coding_quote_qualification_unavailable`). 2x is a test hypothesis only.

Method: source read with grep and sed only. No npm, no git writes, no provider calls. The web rate cards were fetched 2026-11-08. Line numbers are as of commit `138219e2`.

---

## 1. Inventory

### 1.1 AI SDK, Gateway, providers, BYOK, routing
| Item | Source |
|---|---|
| Provider chain and fallback order (`only`, `allowedProviders`, `fallbackOrder`) | `lib/ai/AIProviderManager.ts:74`, `:139-173` |
| Governed single attempt: no second provider or fallback under a consumed admission | `lib/ai/AIProviderManager.ts:202-204`, `:249`, `:276` |
| Providers: Vercel Gateway, Anthropic, OpenAI, xAI, Gemini, OpenRouter, GitHub Models, Groq, HuggingFace, Cloudflare, Ollama, LM Studio, Mock | `lib/ai/providers/*.ts` |
| Model registry and defaults (`defaultModelFor`) | `lib/ai/AIModelRegistry.ts:27-45`, `:81-120`, `:107` |
| Gateway live model catalog fetch (`https://ai-gateway.vercel.sh/v1/models`, 900 s revalidation) | `lib/ai/gatewayModelCatalog.ts:22` |
| Workspace provider policy (provider allow-list per workspace) | `lib/ai/workspaceProviderPolicy.ts` |
| Direct provider call: a header comment says it "never selects or contacts a direct provider" | `lib/ai/directProviderCall.ts:2-10` |
| Paid-lane model pinned to `anthropic/claude-sonnet-5.5` | `lib/billing/smallSonnet55Request.ts:9`, `:72` |
| Cost-aware model pick, effective gateway model | `lib/ai/pickCostAwareModel.ts`, `lib/ai/effectiveGatewayModel.ts` |
| BYOK | The audit found no customer-key storage path for billing. Local and free providers (Ollama, LM Studio, GitHub Models, Cloudflare) run on operator or user env keys. **Gap: there is no tenant BYOK contract.** |

### 1.2 Quote → admission → reservation → claim → settle → release
| Stage | Source |
|---|---|
| Per-request output ceiling of 4096 tokens; default reservation of 1000 cents (env `AXIOM_AI_MAX_REQUEST_CREDITS_CENTS`, 1–10,000) | `lib/billing/requestReservationCents.ts:2`, `:17-20` |
| Coding quote: `provider = ceil(in*inRate + 4096*outRate)`; `reserved = ceil(1.5*ceil(1.5*provider))`, which is about 2.25x | `lib/ai/codingRequestQuote.ts:61-63` |
| Canonical quote unavailable; isolated protocol works in tests only | `lib/ai/codingRequestQuote.ts:107`, `:109` |
| Coding run budget unavailable (fail closed) | `lib/workforce/pipelines/codingRunReservation.ts:11` |
| Admission (extract, text, quoted text, consume, discard) | `lib/billing/governedExtractAdmission.ts:31-127` |
| Reserve, claim, release, settle, and attach usage | `lib/billing/aiCreditReservation.ts:42`, `:64`, `:161`, `:182`, `:192`, `:210` |
| Preflight credit check, refusal reasons | `lib/billing/preflightAICreditCheck.ts`, `lib/billing/aiCreditAdmissionRefusal.ts`, `lib/billing/checkWorkspaceAICredits.ts` |
| Gateway generation reconciliation | `lib/billing/reconcileGatewayUsage.ts:82`, `:134` |
| Settlement to Stripe (metered) and retry policy | `lib/billing/settleAIUsageToStripe.ts`, `lib/billing/aiUsageSettlement*.ts` |
| Deployment dispatch reserve, release, settle | `lib/billing/deploymentDispatchReservation.ts:68`, `:127`, `:136` |

### 1.3 Ledger and idempotency
- `UsageEvent` (provider request ID for idempotent reconciliation) is at `prisma/schema.prisma:1241-1244`. `AIUsageReservation` with `@@unique([organizationId, idempotencyKey])` is at `:1277-1293`. A second keyed model is at `:1321-1333`. Others: `StripeBillingEvent` `:1339`, `AIProviderRate` `:1217`, `WorkspaceUsageSummary` `:1448`, `TenantUsageCounter` `:2199`, `TenantBillingPlan` `:2216` (event-ID idempotency at `:2228`), and `AIUsageBillingSettlement` with a unique idempotency key sent to Stripe at `:2252-2262`.
- Writers: `lib/billing/recordAIUsageEvent.ts:53` and `:131` (the reserved V2 path). Rebuild: `lib/billing/rebuildUsageSummary.ts`.
- Cost attribution: `lib/billing/aiCallCostAttribution.ts`, `computeInvocationCost.ts`, `ensureProviderRate.ts`.

### 1.4 Tenants, free variants, entitlements
- Plan IDs `free`, `pro` and `enterprise` are at `lib/billing/publicPlanCatalog.ts:25`, `:43` and `:61`.
- **The deployment quota is tied to plan ID.** `lib/billing/deploymentQuota.ts:65-93` resolves `billingTierToPublicPlan` and then `plan.monthlyDeployments`. Free gets 10/month, Pro 100, Enterprise 500 (`publicPlanCatalog.ts:36`, `:53`, `:71`). If the quota cannot be resolved, it fails closed as `deployment_quota_unavailable`.
- Free enrollment: `lib/billing/publicFreeEnrollment.ts`. Entitlements: `checkEntitlement.ts`, `enforceEntitlement.ts`, `effectiveEntitlements.ts`, `applyAddOnsToEntitlements.ts`, `tierGate.ts`, `tierCapEnforcer.ts`, `tierCatalog.ts`, `planRegistry.ts`, `organizationSeatClaim.ts`.

### 1.5 Current plans, prices and add-ons (all conflict with the direction)
| Plan | Monthly per user | Annual per user | AI credit | Source |
|---|---|---|---|---|
| Free | $0 | $0 | $2 per organization per month | `publicPlanCatalog.ts:25-36` |
| Pro | $29 | $23.20 | $10 per paid seat | `:43-54` |
| Enterprise | $79 | $63.20 | $30 per paid seat | `:61-72` |

Add-ons (`lib/billing/addOnCatalog.ts`). The comment at `:13` says the "customer price is twice the provider-cost budget":
- $10 buys $5 of credit (`:46-47`).
- $40 buys $20 (`:59-60`).
- $150 buys $75 (`:72-73`).
- Two recurring add-ons cost $20/month (`:85`) and $30/month (`:98`).

**Internal inconsistency:** `lib/billing/aiBillingMargin.ts:14` sets `AI_CUSTOMER_USAGE_MARGIN_MULT = 1.5`, while the add-ons embed 2x and the coding quote reserves about 2.25x.

### 1.6 Checkout and Stripe gating
- Public billing runs only if `AXIOM_PUBLIC_BILLING_POLICY=axiom_public_anniversary_v1` (`lib/billing/publicBillingConfig.ts:7-9`).
- Live mode also requires `AXIOM_STRIPE_MODE=live` and `AXIOM_LIVE_BILLING_APPROVED=true` (`:11-15`).
- Stripe provider: subscription mode with livemode binding checks (`lib/billing/publicStripeProvider.ts:38-64`). Checkout service: `publicCheckoutService.ts`.
- The new test subscription has `livemode: false` hard-typed (`lib/billing/newTestSubscription/service.ts:8-9`, `fixtureAllocation.ts:32`). The owned checkout bridge is at `lib/billing/ownedCheckoutBridge/**`.
- AI credit checkout fulfillment, failure and refund reversal: `lib/billing/aiCreditFulfillment.ts:59`, `:87`, `:98`. These are one-time prepaid purchases and fit the direction structurally.

### 1.7 Founding Supporters (donations)
- Routes: `app/api/support/sponsorship/route.ts` and `app/api/support/stripe-webhook/route.ts` (with tests).
- Pages: `app/(marketing)/support/page.tsx` and `support/confirmation/page.tsx`.
- Mentions: `app/page.tsx`, `app/docs/troubleshooting/page.tsx`, `app/download/__tests__/downloadGuidance.test.ts`, `app/__tests__/homepageScope.test.ts`.

### 1.8 Customer-facing price and limit copy
- `app/(marketing)/plans/page.tsx:15` says "Free, Pro, and Enterprise plans with transparent per-seat pricing ... secure Stripe checkout". This conflicts with the direction.
- `app/pricing/page.tsx:15-18` redirects to `/plans`.
- `components/billing/PublicPlansCatalog*` renders `PUBLIC_PLAN_CATALOG`.
- `lib/demo/demoScenarios.ts:305-320` (`pricing_and_usage`) contains "how operators stay inside their plan + when to upgrade", "Overage alert", and "Review gated plan selection" at `/plans`. These assume a plan or upgrade model and overage.

### 1.9 Tests that pin current pricing
- `lib/billing/__tests__/newTestSubscriptionService.postgres.test.ts:430` and `:446-450` pin `$27.50` remaining and a `$30.00` pool (3 seats x $10) in the isolated TEST lane.
- Other `lib/billing/__tests__/*` and `components/billing` tests reference catalog values. Enumerate them with `grep -rn "2_900\|7_900\|monthlyDeployments" lib components app` before changing the catalog. They were not run in this audit.

---

## 2. Gap analysis vs the approved direction

**Already supports prepaid AI credits:**
- Reservation before dispatch, with release, settle and claim.
- An idempotent ledger.
- Gateway reconciliation.
- Fail-closed when a price or quote is unavailable.
- One-time credit checkout with fulfillment and refund reversal.
- A hard output-token ceiling.
- A single-attempt governed path with no silent fallback cost.
- Live gating behind two env flags.

| Conflict | What would change | What it would break |
|---|---|---|
| Per-seat Pro ($29) and Enterprise ($79) plans (`publicPlanCatalog.ts:43-72`) | Drop the paid seats; Free becomes "Start with Axiom" and Enterprise becomes "Scoped evaluation" (no price) | The plan-ID union `PublicPlanId`, `planSelection.ts`, the newTestSubscription contract (`planId: "pro"|"enterprise"`), the `$27.50`/`$30.00` tests, seat claims |
| Deployment quota tied to plan ID (`deploymentQuota.ts:65-93`) | Decouple into a tenant entitlement (free-explore limit plus evaluation override) | The fail-closed `deployment_quota_unavailable` path for tenants without a plan; the dispatch reservation tests |
| AI credit included per paid seat (`aiCreditBasis: "paid_seat"`) | Prepaid balance per organization only | `currentAIAllowance.ts`, `publicSubscriptionAllowance.ts`, `publicCreditAllocation.ts` |
| Recurring add-ons $20/$30 per month (`addOnCatalog.ts:85`, `:98`) | Remove or hide them | `applyAddOnsToEntitlements.ts` |
| Metered settle-to-Stripe (`settleAIUsageToStripe.ts`) charges after use | Must not be used for the prepaid model (never charge beyond prepaid) | Nothing public; keep it test-only |
| Three different multipliers (1.5x margin, 2x add-on, about 2.25x reservation) | One versioned rate card | Margin tests; displayed credit-to-dollar conversions |
| `/plans` subscription and checkout copy; the demo's "upgrade/overage" wording | New "Get started" / "AI usage" / "Enterprise evaluation" copy | The homepage and plans snapshot tests |
| Paid-lane model ID `claude-sonnet-4-20250514` in the registry | Sonnet 4 is marked retired on the Claude API (rate card below) | Fallback runs or model selection could fail |

---

## 3. Cost model

### 3.1 Sources
| Source | URL | Fetched |
|---|---|---|
| Anthropic | https://platform.claude.com/docs/en/about-claude/pricing | 2026-11-08 |
| Vercel AI Gateway | https://vercel.com/docs/ai-gateway/pricing (page `last_updated` 2026-09-08) | 2026-11-08 |
| Stripe | https://stripe.com/pricing | 2026-11-08 |

Not fetched, marked **unknown**: OpenAI, Google Gemini, xAI, Neon, and Vercel hosting/functions/queues. The OpenAI figures in `lib/billing/providerRateSeeds.ts` are code seeds, not verified.

### 3.2 Per-model rates (USD per million tokens)
| Model in code | Where | Input | Cache hit | Output | Note |
|---|---|---|---|---|---|
| anthropic/claude-sonnet-5.5 | `smallSonnet55Request.ts:9` | 2.00 | 0.10 | 10.00 | Anthropic card. 5m cache write 2.50 |
| claude-sonnet-4-20250514 | `AIModelRegistry.ts:35` | 3.00 | 0.30 | 15.00 | Card says retired on the API |
| claude-3-5-haiku-latest | `AIModelRegistry.ts:36` | unknown | unknown | unknown | Not on the current card |
| claude-opus-4-7 / 4-6 | `providerRateSeeds.ts:36`, `:48` | 5.00 | 0.50 | 25.00 | Seeds match the card |
| claude-sonnet-4-6 | `providerRateSeeds.ts:59` | 3.00 | 0.30 | 15.00 | Matches |
| claude-haiku-4-5 | `providerRateSeeds.ts:71` | 1.00 | 0.10 | 5.00 | Matches |
| gpt-4o / gpt-4o-mini | `providerRateSeeds.ts` | 2.50 / 0.15 (seed) | 1.25 / 0.07 (seed) | 10.00 / 0.60 (seed) | Unverified |
| grok-4.7, gemini-2.x | `AIModelRegistry.ts` | unknown | unknown | unknown | Not fetched |
| Free and local providers (Ollama, LM Studio, Cloudflare, GitHub Models) | registry | $0 to Axiom (assumption: user or operator keys) | | | Rate limits apply |

**Extras:**
- Anthropic web search costs $10 per 1,000 searches plus tokens (Anthropic card). The audit found no Axiom tool path that uses it.
- Gateway: "no markup and no platform fee on tokens". BYOK has no Gateway fee. Optional add-ons cost $0.10 per 1,000 requests (team ZDR or allowlist) and $0.075 per 1,000 custom-report writes. When a BYOK request fails, the Gateway retries on system credentials and charges the Axiom balance (Vercel page).
- Retries and fallback: the governed path makes a single attempt, so it adds $0 of extra token cost (`AIProviderManager.ts:202`). Ungoverned chains can fall back; the cost is unbounded unless gated (**gap**).
- Stripe: 2.9% + $0.30 per card payment. International adds 1.5%, currency conversion adds 1%, a dispute costs $15. Stripe Tax costs 0.5% (no-code) or $0.50 per transaction (API). Stripe Billing pay-as-you-go costs 0.7%, which a one-time prepaid top-up avoids (assumption: one-off Checkout is not Billing volume).
- Hosting, DB and queue (Vercel, Neon): **unknown** per request. Assumption: below $0.001 per AI request, but it needs measurement.
- Support, fraud, tax and refunds: unquantified. Card-testing fraud on small top-ups is the main risk. Every refund loses the original $0.30 plus 2.9% (assumption based on Stripe's standard behavior; verify).

### 3.3 Worked example: coding analysis at reserved token counts
Assumptions:
- Sonnet 5.5.
- 20,000 input tokens (assumption).
- Output at the code-reserved maximum of 4,096 (`requestReservationCents.ts:2`).

Provider cost:
- Input: 20,000 x $2/M = $0.040.
- Output: 4,096 x $10/M = $0.04096.
- Total: $0.081, which `ceil`s to **9 cents**.
- Code reservation: ceil(1.5 x ceil(1.5 x 9)) = **21 cents** (`codingRequestQuote.ts:62-63`).

| Method | Customer charge | Axiom gross (before fees) |
|---|---|---|
| Pass-through at cost | 9c | 0 (loses fees) |
| 1.5x | 13.5c | 4.5c |
| 2x | 18c | 9c |
| Cost + fixed $0.05 per action (assumption) | 14c | 5c |
| BYOK (customer pays provider) | 0c of tokens (plus an optional platform fee, undecided) | 0 token risk |

Payment-fee drag on prepaid top-ups (Stripe US card):
- $5 top-up: fee $0.445 (8.9%).
- $10 top-up: $0.59 (5.9%).
- $20 top-up: $0.88 (4.4%).
- $50 top-up: $1.75 (3.5%).

At 1.5x, a $10 top-up yields $6.67 of provider cost. Gross is $3.33, minus $0.59 Stripe, which leaves $2.74 (27%) before tax, support and hosting. At 2x, gross is $5.00 minus $0.59, which leaves $4.41 (44%).

High-percentile case (assumption: 150k input on Sonnet 5.5): $0.30 + $0.041 = 34c provider cost, with a reservation of about 77c. Opus 4.7 at the same size costs $0.75 + $0.10 = 86c.

---

## 4. Safe implementation design vs the acceptance gates
| Gate (plan L278) | Existing code | Status |
|---|---|---|
| Versioned tenant-scoped rate card | `AIProviderRate` (`schema.prisma:1217`), `ensureProviderRate.ts`, `providerRateSeeds.ts`; quote evidence carries `pricingDigest`/`policyVersion` (`codingRequestQuote.ts:74`) | Partial. The rate card is global, not tenant-scoped, and customer markup has no version. **Gap** |
| Units and conversions (1 credit = ?) | Cents are used everywhere | **Gap**: there is no published unit or examples |
| Deterministic immutable ledger | `UsageEvent`, `recordAIUsageEvent.ts`, `rebuildUsageSummary.ts` | Partial. Immutability (no update/delete) is unverified |
| Unique request/run idempotency keys | `AIUsageReservation @@unique(org, idempotencyKey)`, `AIUsageBillingSettlement.idempotencyKey`, Stripe event IDs | Present |
| Cost attribution (model, provider, input, output, cached, extras) | `aiCallCostAttribution.ts`, `computeInvocationCost.ts`, Gateway reconciliation | Present for tokens. Tool and search extras are a **gap** |
| Quote before execution, conservative reservation, reconciliation | The coding quote reserves about 2.25x; `reserveAICredits` / `settle` / `release`; `reconcileGatewayUsage.ts` | Present in isolated tests; the canonical quote is unavailable (by design) |
| Deny by default when a price is unavailable | `quoteCodingRequest` throws; `deployment_quota_unavailable`; `coding_run_budget_unavailable` | Present |
| Hard per-tenant and per-user limits | Per-organization reservation and balance; per-request ceilings | Per-user limit is a **gap** |
| Never charge beyond prepaid | Reservation against balance | Present for credits. `settleAIUsageToStripe.ts` (metered) must stay disabled |
| Visible balances, history and export | `/dashboard/ai-usage`, `usageSummaryResponder.ts`, `invoicePage.ts` | Partial. Export is a **gap** |
| Failed, partial or streamed responses, retries, duplicates, cache | Release on failure; single-attempt governed path; streamed decision handling (`lib/ai/streamedDecisionMessage.ts`) | Partial. A written customer policy is a **gap** |
| Disclosures, refunds, no dark patterns | `reverseAICreditRefund` (`aiCreditFulfillment.ts:98`) | Refund mechanics exist. Policy, copy and an auto top-up ban are **gaps** |
| Test vs live | `publicBillingConfig.ts:11-15`; `newTestSubscription` has `livemode:false` | Present. Keep it |

---

## 5. Decisions the user must make
1. **What "free to explore" means for deployments.**
   - Options: (a) keep 10 counted deployments per month per organization; (b) higher fixed limits for design partners; (c) unlimited with abuse limits.
   - Recommendation: (a) for everyone, plus a per-tenant evaluation override.
   - Trade-off: it is simple and reuses the fail-closed code, but some partners will hit the limit.
2. **Markup method.**
   - Options: 1.5x, 2x, cost plus a fixed fee per action, or pass-through.
   - Recommendation: test 1.5x as one versioned rate card, and show the exact cost per action.
   - Trade-off: 1.5x has thin margins after Stripe fees on small top-ups (about 27% on $10). 2x roughly doubles the gross but looks reseller-like.
3. **Minimum top-up and expiry.**
   - Options: $5, $10 or $20 minimum; no expiry, or 12-month expiry.
   - Recommendation: $10 minimum, no expiry while there are no paying customers.
   - Trade-off: no expiry creates a long-tail liability; a $5 minimum loses about 9% to fees.
4. **Refund policy.**
   - Options: unused balance refundable within N days; always refundable unused; no refunds.
   - Recommendation: unused balance refundable on request within 30 days, and failed actions automatically released.
   - Trade-off: Stripe fees are lost on refunds.
5. **Billing vendor.**
   - Options: Stripe one-time Checkout (existing code), Stripe Billing, or a merchant of record (Paddle or Lemon Squeezy, which handle tax).
   - Recommendation: Stripe one-time Checkout, still behind the live flags.
   - Trade-off: Axiom owns sales-tax and VAT compliance (Stripe Tax costs 0.5%). A merchant of record charges a higher percentage (unknown; not fetched).
6. **BYOK.**
   - Options: none, enterprise-only, or everyone.
   - Recommendation: enterprise evaluations only, at first.
   - Trade-off: there is no key storage or tenant BYOK contract today, and Gateway BYOK failures fall back to Axiom's balance (a cost leak unless disabled).
7. **Enterprise evaluation terms.**
   - Options: free time-boxed (for example 30–60 days) with scoped success criteria, or a paid pilot by invoice.
   - Recommendation: free and time-boxed, with an explicit AI budget cap granted as credits.
   - Trade-off: Axiom bears the AI cost of evaluations.
8. **Paid-lane model.**
   - Options: keep Sonnet 5.5 only, or offer a cheaper Haiku 4.5 or 5.5 tier.
   - Recommendation: keep Sonnet 5.5 first and replace the retired Sonnet 4 registry entries.

---

## 6. Risks and open questions
- Three inconsistent multipliers (1.5x, 2x, about 2.25x) could produce copy that contradicts the charge.
- Retired or unlisted model IDs (`claude-sonnet-4-20250514`, `claude-3-5-haiku-latest`) in the default registry.
- The metered `settleAIUsageToStripe.ts` path could breach "never beyond prepaid" if it is enabled.
- Gateway BYOK fallback charges system credits.
- The ungoverned provider-fallback chains have no cost bound.
- Catalog changes will break the pinned `$27.50`/`$30.00` tests and the plan-ID unions (including a fixture test that a decision-log entry flags as possibly flaky).
- Card-testing fraud on small top-ups. Tax registration obligations are unknown.
- Unknowns:
  - OpenAI, Gemini and xAI current rates.
  - Neon and Vercel per-request infrastructure cost.
  - Whether `UsageEvent` is enforced as append-only.
  - Real token distributions (typical and P95) for coding analysis.
- None of this authorizes live charges. 2x remains a hypothesis. Canonical quote eligibility stays unavailable.
