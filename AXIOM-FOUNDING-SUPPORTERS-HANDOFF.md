# Vision XIX Labs — Axiom Founding Supporters Handoff

## Status

Implemented and pushed on the established review branch `codex/ai-agent-governance`. The temporary duplicate branch was removed after its commits were safely fast-forwarded into this canonical branch. Nothing was merged, promoted to production, or enabled for live payments. No outreach email was sent.

Stripe Support confirmation supplied by the founder on October 13, 2026: Vision XIX Labs account `acct_1SpEdeFet66ERY29` is fully verified and activated, with no payment-processing restrictions. Stripe account activation is therefore **complete** and is no longer a launch blocker. This confirmation does not itself approve the supporter page for production or replace legal, tax, staging, and founder release approval.

## Production rollback and Vercel safety status

- Verified on October 13, 2026: `visionxixlabs.com` points to ready production deployment `dpl_AoFAj2SSkBcdZLANn9XXX1A9MWSj`, built from `main` commit `d921d836adfb469d367fda40e570d035bb4c0503`.
- During review, a pushed review-branch commit was incorrectly classified by the Vercel Git integration as a production-target deployment and briefly received the production alias. It was immediately rolled back to the deployment above. The live alias was rechecked after the rollback.
- Vercel project setting `autoAssignCustomDomains` is now `false`. A future deployment cannot automatically seize the custom production domain; production alias assignment must be explicit.
- `vercel.json` disables automatic Git deployments specifically for `codex/ai-agent-governance`. Pushing the review line therefore updates GitHub without creating another automatic Vercel deployment; Preview creation remains an explicit reviewed action.
- GitHub's remote default branch is `main`. The active review branch is `codex/axiom-founding-supporters`.
- GitHub reports that neither `main` nor `codex/axiom-founding-supporters` currently has branch protection enabled. Recommended production governance is to require reviewed pull requests and passing status checks on `main`; this was reported but not changed because repository-wide enforcement is outside this implementation.
- The Vercel connector does not expose the Git production-branch field. Because the review branch was observed being classified as production, that production-branch rule still requires confirmation/correction in Vercel before this branch is pushed again.
- Explicit deployments were attempted from the exact pushed SHA using both the standard Preview target (`target: null`) and Vercel's staging target. Vercel stopped each before build with `Resource provisioning failed`; none affected the production custom domain. Repeating the request with the verified numeric GitHub repository ID and the established governance branch produced the same result. Historical Vercel deployment records show the same Preview provisioning failure on earlier governance commits, confirming this is a pre-existing project-level Preview problem rather than a failure in the supporter or redesign code.

## Experience delivered

- Premium responsive `/support` page in the existing Vision XIX Labs dark design system.
- Mission-led hero, restrained orange accents, subtle native interactions, and mobile layouts.
- Existing honest Axiom product tour embedded directly in the story. It remains labeled as scripted data and touches no live customer system.
- Separate implemented-versus-planned capability sections to avoid implying unreleased functionality.
- Factual funding priorities: AI engineering, security/governance, autonomous workflows, infrastructure/testing, and broader access.
- Founding Supporter purchase experience with suggested amounts, custom USD amount from $1, receipt email, optional badge name, development-update opt-in, and consent-based public recognition.
- Strategic sponsorship inquiry for individuals, foundations, and organizations. It records a lead and never collects a payment.
- For-profit, non-charitable, non-investment, no-equity, and no-return disclosures near the transaction controls.
- Privacy, terms, security, refund-contact, and company-contact links.

## Full marketing-site redesign

- Axiom is now the centerpiece of the homepage, with a new editorial hero, direct product and interactive-tour paths, and the existing factual product demonstration retained as the proof surface.
- The shared navigation is simpler and consistent: Axiom, Product tour, Integrations, and Security form the primary path. Founding Supporters is discoverable as a restrained secondary link rather than a donation-style homepage demand.
- The homepage removes repeated card treatments in its core story and uses quieter divided editorial sections, stronger typography, larger whitespace, and one restrained warm accent.
- All public pages that use the shared marketing navigation now inherit the same canvas, typography, focus treatment, surface colors, responsive chrome, and footer without changing authenticated product, billing, dashboard, control, or admin surfaces.
- Insights and legal pages now use the shared footer, removing the last major public-shell discontinuities.
- Existing canonical routes and redirects remain intact, including `/axiom`, `/axiom/operations`, `/axiom/releaseops`, `/axiom/pricing`, `/pricing`, `/case-studies`, `/cloud-security`, and `/cloud-solutions`.
- The support page remains a dedicated destination. Its real scripted product tour, implemented-versus-planned distinction, supporter checkout, sponsorship inquiry, and legal disclosures were preserved.

## Payment and benefit architecture

- New namespace: `/api/support/*`. It does not call or modify Axiom subscriptions, workspace billing, or AI-credit fulfillment.
- Stripe-hosted one-time Checkout with server-side dynamic price data. Vision XIX Labs does not store card numbers.
- Eligible card wallets and payment methods are presented by Stripe Checkout according to the account, device, currency, country, and Stripe settings.
- Server-side integer-cent validation: $1 minimum and Stripe's applicable USD Checkout channel bound. There is no lower company maximum.
- Same-origin enforcement, rate limiting, honeypot protection, normalized input, and required legal acknowledgment.
- Client correlation key plus Stripe idempotency key to prevent accidental duplicate Checkout sessions.
- Dedicated `STRIPE_SUPPORTER_WEBHOOK_SECRET`; signed webhooks are verified from the raw body with Stripe's SDK.
- Dedicated `SupporterStripeEvent` ledger makes event processing replay-safe.
- Dedicated `FoundingSupporterPurchase` ledger tracks pending, paid, failed, expired, partially refunded, and refunded states.
- Payment confirmation comes only from a signed Stripe webhook—not the browser redirect.
- Paid supporters receive a confirmation and a personalized HMAC-signed SVG badge. A fully refunded purchase can no longer download the badge.
- Update and recognition consent are separate. Recognition defaults to private.
- Partial and full Stripe refunds reconcile back to the supporter ledger.
- Confirmation delivery is retry-safe: a provider failure returns a retryable webhook error, while a duplicate event retries only the unsent email and never repeats the financial mutation.

## Required environment configuration

```dotenv
AXIOM_SUPPORTER_CHECKOUT_ENABLED=false
AXIOM_SUPPORTER_LIVE_APPROVED=false
STRIPE_SUPPORTER_WEBHOOK_SECRET=whsec_...
SUPPORTER_BADGE_SIGNING_SECRET=<long-random-server-only-secret>
DATABASE_URL=<preview-database-url>
RESEND_API_KEY=<preview-resend-key>
STRIPE_SUPPORTER_AUTOMATIC_TAX=false
NEXT_PUBLIC_APP_URL=https://visionxixlabs.com
```

The implementation fails closed. Test-mode review requires the checkout-enabled flag plus a Stripe test key, the supporter webhook secret, badge secret, database, and email provider. A live Stripe key additionally requires `AXIOM_SUPPORTER_LIVE_APPROVED=true`.

## Staging configuration status

The connected Vercel project is `visionxixlabs`. The review branch now has these branch-scoped Preview values:

```dotenv
AXIOM_SUPPORTER_CHECKOUT_ENABLED=false
AXIOM_SUPPORTER_LIVE_APPROVED=false
STRIPE_SUPPORTER_AUTOMATIC_TAX=false
```

They intentionally keep collection disabled. Vercel Preview currently has no Stripe, database, or Resend variables available for this flow. No secret value was created, copied, logged, or exposed.

The connected project has no custom Vercel environment configured. The explicitly created Preview deployment failed during Vercel resource provisioning before build logs were emitted. Local production-mode Preview is therefore the current review surface until the Vercel Preview resource binding is repaired.

## Database change

Migration: `20261013220000_add_founding_supporters`

It creates only the supporter purchase and supporter Stripe-event tables. Apply it through the normal reviewed deployment pipeline; it was not run against production.

## Verification completed

- Prisma Client generation: passed.
- TypeScript (`tsc --noEmit`): passed.
- Focused ESLint on supporter files and all redesigned marketing files: passed.
- Original focused security and billing regression suite: 30 tests passed.
- Combined supporter and homepage interaction suite: 29 tests passed across 6 files. It covers the $1 Checkout payload, duplicate checkout keys, fail-closed readiness, signed paid-event processing, duplicate event replay, failed/retried confirmation delivery, full refund state, signature rejection, signed badge access, forged-token denial, badge revocation after refund, and homepage media/demo interaction behavior.
- Production Next.js build: passed with an 8 GB Node heap; the default 4 GB heap exhausted memory in this unusually large application.
- Production-mode local preview started successfully with the supporter system failing closed because staging credentials were intentionally absent.
- Prisma schema validation could not run without `DATABASE_URL`; Prisma Client generation and the production build both validated schema compilation.

## Screenshot status

Screenshot destinations were prepared for desktop (homepage, product, support), tablet (product), and mobile (homepage, support). The local application served correctly, but the only installed browser aborted inside the managed Xcode filesystem sandbox before it could open a page, and the environment exposes no user-facing browser/preview tool. No fabricated mockup was substituted for an actual render. Capture these six screenshots after opening the local Preview or a repaired Vercel Preview in an authorized browser.

## Provider-side test status

The route-level scenarios are complete and passing. A genuine Stripe test-mode transaction was **not** represented as complete because no Stripe test secret, Preview database, Preview webhook secret, or Resend test credential is available locally or in the connected Vercel Preview environment. There is also no Stripe CLI authenticated in this workspace. The first external boundary—creating a real test Checkout Session—is therefore blocked by missing test infrastructure, not by application code.

## Remaining gates before live use

1. Confirm Vercel's Git production branch is `main`, then repair the Preview resource-provisioning failure. Keep automatic custom-domain assignment disabled.
2. Supply branch-scoped **test-only** `STRIPE_SECRET_KEY`, `STRIPE_SUPPORTER_WEBHOOK_SECRET`, `DATABASE_URL`, `RESEND_API_KEY`, `SUPPORTER_BADGE_SIGNING_SECRET`, and the final Preview URL. Do not reuse production secrets or the production database.
3. Apply `20261013220000_add_founding_supporters` to the isolated Preview database.
4. Create the Stripe test-mode webhook destination for `/api/support/stripe-webhook` and select `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.
5. Deploy an access-controlled Preview, temporarily set only `AXIOM_SUPPORTER_CHECKOUT_ENABLED=true`, and run the real provider-side $1, replay, partial-refund, full-refund, email, and badge tests. Reset the flag to false after acceptance.
6. Counsel/accountant must approve supporter terms, refunds, sales-tax/VAT/GST treatment, receipt wording, and the countries/currencies to enable.
7. The founder must approve the final copy, suggested amounts, benefit commitments, verified founder profile, and live activation.
8. Confirm the production sending domain, support mailbox, unsubscribe handling, and suppression workflow before enabling supporter updates.
9. Decide whether Stripe Tax should be enabled and which international payment methods the account should expose.
10. Replace or augment the current in-memory request limiter with a distributed production limiter; Stripe Radar and idempotency remain additional controls, not substitutes.
11. Move benefit email delivery to a durable outbox/worker if strict fast-ack webhook latency is required. The present implementation is financially idempotent and retry-safe but waits for Resend before returning 2xx.
12. Obtain explicit founder approval before setting either live flag, deploying to production, or linking the page from outreach.

## Known operational notes

- Large sponsorships should remain inquiry-led. After identity, sanctions, source-of-funds, contract, tax, and bank verification, Vision XIX Labs may provide business bank-transfer instructions through a secure authenticated channel. Never place banking details on the public page or in this repository.
- Development updates are a genuine opt-in recorded with the purchase. Any future campaign email must honor unsubscribe, suppression, privacy, and applicable regional marketing rules.
- The public founder section intentionally says verification is pending rather than publishing an unverified identity.
- No homepage “Donate Now” treatment was added. A single restrained Founding Supporters editorial link appears after the product story; the homepage remains centered on Axiom and enterprise credibility.

## Recommended release sequence

1. Review this branch and deploy only to an access-controlled preview.
2. Add verified founder content and approved legal/tax copy.
3. Apply the migration in staging and configure Stripe test-mode secrets/webhook.
4. Complete the provider-side end-to-end acceptance tests listed above.
5. Obtain written legal/tax and founder approval. Stripe account activation is already confirmed.
6. Deploy with checkout still disabled; review the public page.
7. Enable checkout in a separate, auditable production change.
