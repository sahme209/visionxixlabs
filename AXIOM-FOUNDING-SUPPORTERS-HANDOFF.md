# Vision XIX Labs — Axiom Founding Supporters Handoff

## Status

Implemented on review branch `codex/axiom-founding-supporters`. Nothing was merged, deployed, published, or enabled for live payments. No outreach email was sent.

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

## Required environment configuration

```dotenv
AXIOM_SUPPORTER_CHECKOUT_ENABLED=false
AXIOM_SUPPORTER_LIVE_APPROVED=false
STRIPE_SUPPORTER_WEBHOOK_SECRET=whsec_...
SUPPORTER_BADGE_SIGNING_SECRET=<long-random-server-only-secret>
STRIPE_SUPPORTER_AUTOMATIC_TAX=false
NEXT_PUBLIC_APP_URL=https://visionxixlabs.com
```

The implementation fails closed. Test-mode review requires the checkout-enabled flag plus a Stripe test key, the supporter webhook secret, and the badge secret. A live Stripe key additionally requires `AXIOM_SUPPORTER_LIVE_APPROVED=true`.

## Database change

Migration: `20261013220000_add_founding_supporters`

It creates only the supporter purchase and supporter Stripe-event tables. Apply it through the normal reviewed deployment pipeline; it was not run against production.

## Verification completed

- Prisma Client generation: passed.
- TypeScript (`tsc --noEmit`): passed.
- Focused ESLint on every new supporter file: passed.
- Focused security and billing regression suite: 30 tests passed.
- Production Next.js build: passed with an 8 GB Node heap; the default 4 GB heap exhausted memory in this unusually large application.
- Production-mode local preview: `/support` returned HTTP 200 and rendered the expected mission headline.
- Prisma schema validation could not run without `DATABASE_URL`; Prisma Client generation and the production build both validated schema compilation.

## Approval gates before live use

1. Stripe must complete account activation/final review for this digital supporter product.
2. Counsel/accountant must approve supporter terms, refunds, sales-tax/VAT/GST treatment, receipt wording, and the countries/currencies to enable.
3. The founder must approve the final copy, suggested amounts, benefit commitments, and live activation.
4. Add and verify the founder's approved name, biography, and profile links. The repository contains no verified founder profile, so the page does not invent one.
5. Configure and test the separate Stripe webhook endpoint in Stripe test mode.
6. Confirm the production sending domain and support mailbox before enabling confirmation email.
7. Decide whether Stripe Tax should be enabled and which international payment methods the account should expose.
8. Run a real test-mode purchase, replay, partial refund, full refund, receipt, and badge-revocation acceptance test against the review deployment.
9. Obtain explicit founder approval before setting either live flag, deploying the page, or linking it from outreach.

## Known operational notes

- Large sponsorships should remain inquiry-led. After identity, sanctions, source-of-funds, contract, tax, and bank verification, Vision XIX Labs may provide business bank-transfer instructions through a secure authenticated channel. Never place banking details on the public page or in this repository.
- Development updates are a genuine opt-in recorded with the purchase. Any future campaign email must honor unsubscribe, suppression, privacy, and applicable regional marketing rules.
- The public founder section intentionally says verification is pending rather than publishing an unverified identity.
- No homepage “Donate Now” treatment was added. The enterprise homepage remains focused on the product.

## Recommended release sequence

1. Review this branch and deploy only to an access-controlled preview.
2. Add verified founder content and approved legal/tax copy.
3. Apply the migration in staging and configure Stripe test-mode secrets/webhook.
4. Complete the end-to-end acceptance tests listed above.
5. Obtain written Stripe, legal/tax, and founder approval.
6. Deploy with checkout still disabled; review the public page.
7. Enable checkout in a separate, auditable production change.
