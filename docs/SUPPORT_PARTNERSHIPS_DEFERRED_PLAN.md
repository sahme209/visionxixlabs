# Support and strategic partnerships — deferred audit and proposal

Status: read-only source audit, October 16, 2026. Implementation requires spare
capacity and founder approval of the concrete design/payment changes. No active
Axiom agent was reassigned. No payment, outreach, CRM, deployment or production
operation occurred. The full directive is preserved in
`SUPPORT_STRATEGIC_PARTNERSHIPS_DIRECTIVE.md`; the canonical mission register is
the tracker, not this proposal. This supersedes the earlier narrower funding-page
planning scope without changing engineering priorities.

## Existing assets and reusable functionality

- `/support`: `app/(marketing)/support/page.tsx` has long-form storytelling,
  funding categories, implemented/planned sections, a scripted cinematic demo,
  supporter checkout, strategic inquiry form, and legal/privacy/security links.
  Current dark/orange presentation differs from the newly requested warm-white
  support-page direction. Do not redesign unrelated pages or change global tokens.
- `components/support/SupporterCheckout.tsx`: one-time USD payment; suggested
  $25/$100/$500/$2,500, initial $100, custom minimum $1. A giant $1 selection
  control is absent. Reuse the current form and hosted checkout; selecting $1
  must only prepare the form, never charge. Retain explicit final amount and
  currency confirmation before opening Stripe (tax, if configured, disclosed).
- `/api/support/checkout-session`: same-origin/rate checks, validated cents,
  correlation id, separate purchase ledger, Stripe mode=payment, purpose-bound
  metadata and Stripe idempotency. Readiness has explicit enable/dependency/live
  approval gates. No live configuration or hosted-payment success was inspected.
- `/api/support/stripe-webhook`: signature verification, paid-status filter,
  transactional event-id deduplication, receipt delivery retry, expired/failed
  states and refunds. `/support/confirmation` reads persisted paid state; a
  redirect alone is not payment proof. Badge access uses HMAC and persisted
  status. These sources remain unchanged.
- Existing recognition is optional, with separate explicit public-name consent.
  Updates currently default opted-in; review an explicit opt-in default later.
  A live public supporters wall, documented funding target and personalized
  post-payment animation were not verified.
- `/api/support/sponsorship` already records inquiries and notifies the company.
  Reuse this inbound path after review; do not invoke it during the audit, create
  synthetic customer leads, or add automatic outbound prospecting.

## Security and acceptance gaps to review before any payment changes

Source controls are not hosted Stripe acceptance. Independently review and test:

1. Bind paid fulfillment to the stored expected session/purchase, USD, amount,
   payment mode, customer and purpose. Current `markPaid` checks purpose and
   paid status but does not explicitly compare session amount/currency with the
   stored purchase before updating it. This is a source-review gap, not evidence
   that an incorrect payment has occurred.
2. Preserve event deduplication, but test completed/async-success duplicates,
   out-of-order expiry/failure/refund, cross-purchase sessions and replay email
   eligibility. Distinct successful event ids must not reissue fulfillment.
3. Preserve the same client correlation key across ambiguous retries; current
   form generates a new UUID on each submission. Check request body bounds,
   safe errors, rate-limit scope and webhook/receipt privacy without logging PII.
4. Keep contributions completely separate from subscriptions, AI allowance,
   plan entitlements, sponsorship contracts and investment. No new benefits or
   tax-deductibility claims are approved. Retain one-time digital supporter
   purchase/legal terms unless counsel and the founder approve revised language.
5. Verify $1/custom/invalid/maximum amounts, checkout cancellation, signed payment,
   pending confirmation, badge authorization and full/partial refunds in an
   isolated fixture. Hosted test-mode checkout is a separate access/approval gate.

## Proposed support-page experience — not implemented

Use a page-scoped #F8F8F6 background, #202020 type, calm hierarchy, generous spacing,
visible keyboard focus and reduced-motion support. Retain the existing narrative
and identity. Hero proposal: “Help build what comes next.” and “Independent
technology. Ambitious ideas. Built with purpose.” An oversized charcoal circular
`$1 / Support the work` button selects a one-time amount; quiet “Or choose your
own amount” reveals the existing custom form. Accessible text must say checkout
follows and no charge occurs on selection. No glow, urgency or invented progress.

Use a small selected-state response and a thank-you only after verified payment.
Public acknowledgment remains opt-in. A progress bar requires an approved real
objective, accounting source, scope and update date; otherwise omit it. Funding
categories already exist, but dollar targets/use-of-funds allocations and claims
about company/founder identity require verified founder evidence before publication.

Evidence brief: distinguish merged source, isolated HTTP/PostgreSQL acceptance,
scripted demonstrations, unreleased integrations, and production/provider proof.
Current facts include governed approval/tenant safeguards and local test evidence;
production login/binding/restore, real cloud deployment and hosted Stripe acceptance
remain unresolved. Existing `public/images/axiom-*-landscape-v1.png` assets require
authenticity/provenance and privacy review before being labeled product screenshots.
Do not present a scripted demo as a live deployment or claim launch readiness.

## Two separate outreach programs — preparation deferred

**Track A: individual support/philanthropy.** Research only relevant publicly
stated interests and official professional contact channels. Offer voluntary
support and appropriate acknowledgment, no charitable eligibility/returns claims.
Prospect fields: public source/date, alignment, official channel, evidence-backed
request, draft status, owner approval, follow-up date and opt-out status. No private
contact scraping, mass email, fabricated relationship or automatic outreach.

**Track B: companies/partners/investors.** Separate templates and qualification
for AI/API collaboration, cloud/GPU credits, tooling/in-kind sponsorship, strategic
distribution and investment. Each needs a verified company/product brief, exact
readiness, specific realistic request and collaboration benefit. Investment is a
separate commercial/legal process; no promised equity, ownership or return.

Use source-control planning first. No extra CRM tracker or account write is needed
now. Later, founder-approved personalized prospects may be recorded in an existing
authorized CRM; verify its connection and consent before any write. This audit
does not establish access to Figma, MagicPath, Stripe, HubSpot, PostHog or Apollo.
No prospect list, outreach draft, company registration attestation or public
contact verification has been completed; repository support contact is
`support@visionxixlabs.com`, with delivery/ownership not independently attested.

## Gates and next action

After higher-priority engineering stabilizes, prepare a scoped visual prototype,
exact contribution flow, claims/evidence brief and isolated security test plan for
founder review. Obtain specific approval before page/payment implementation.
Then validate responsive accessibility and existing support functionality, prepare
a release candidate and keep deployment/live payments behind separate approval.
Every outbound message requires explicit founder approval; none is authorized here.
