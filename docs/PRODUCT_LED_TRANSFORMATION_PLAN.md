# Product-led transformation plan

This plan records the gap between the current product and the self-service Axiom vision. It is intentionally staged so visual work cannot outrun product truth, billing safety, or deployment governance.

## Current strengths

- The public site, desktop application, safe scripted demo, GitHub write path, environment model, AWS ECS deployment workflow, approvals, audit records, Airflow automation, and provider-policy controls already exist.
- Public demonstrations are isolated from real workspaces and do not consume AI credits or trigger providers.
- The desktop app is the operational surface. Public website work must not recreate product features under redirected `/dashboard` routes.

## Blocking gaps found in the audit

1. **Pricing is not yet one source of truth.** The public pricing page describes bespoke engagement pricing, the plan registry defines Starter/Growth/Business/Enterprise, and Stripe webhook mapping still uses Starter/Growth/Scale/Enterprise.
2. **Billing ownership is inconsistent.** Some paths update user-level subscription fields while the requested model is organization-based billing and entitlement enforcement.
3. **Self-service signup is desktop-bound.** The signup route expects a desktop pairing challenge, so the website cannot honestly promise browser-only organization creation yet.
4. **The product story is fragmented.** Existing pages mix several visual accents, dense explanations, legacy cloud-consulting language, and product claims with different levels of readiness.
5. **The repository contains broad pre-existing lint debt.** Changed-file linting and production builds are reliable gates today; repository-wide lint must be repaired separately before it can block releases.

## Delivery sequence

### Phase 1 — Product story and design foundation

- Establish one dark, near-white, orange-accent visual system.
- Make the primary path Product → Demo → Download → Docs, without requiring a sales call.
- Add a responsive, reduced-motion-aware interactive tour grounded in the real desktop workflow.
- Label every scripted experience as a simulation and never imply that it operates on a visitor's cloud account.

### Phase 2 — Route-wide consolidation

- Migrate public product, capabilities, integrations, plans, download, docs, security, support, authentication, and legal surfaces to the shared shell and typography.
- Remove duplicated copy and legacy service-led positioning from the primary product journey.
- Preserve all public URLs, metadata, downloads, and redirects.

### Phase 3 — Zero-touch onboarding

- Add browser-first organization creation and invite flow without weakening desktop pairing.
- Build a resumable onboarding checklist spanning download, pairing, GitHub, environment, deployment target, AI provider policy, and first governed workflow.
- Return actionable recovery steps from every connector validation failure.
- Measure activation milestones with privacy-conscious events.

### Phase 4 — Billing and entitlements

- Approve a single Free/Pro/Business catalog and define exactly what counts as a billable deployment.
- Move subscription authority to the organization and reconcile every Stripe price mapping.
- Make webhook handling idempotent at the database boundary and cover renewals, failed payments, cancellations, refunds, seat changes, and concurrent quota consumption.
- Enforce seats, deployments, automation, and AI usage on the server. Security controls, production approval gates, and audit protections remain available on every tier.
- Add monthly/annual checkout only after pricing economics and Stripe test-mode journeys are approved.

### Phase 5 — Proof and release readiness

- Add end-to-end tests for discover → demo → download → signup → pair → connect → first workflow → upgrade.
- Test responsive layouts, keyboard navigation, screen readers, contrast, and reduced motion.
- Verify download signing/notarization, rollback, tenant isolation, and production permission boundaries.
- Release through a reviewed pull request with a rollback plan. Never activate charges, merge, or deploy from this plan alone.

## Decisions requiring explicit approval

- Final Free/Pro/Business prices, annual discount, included deployments, and AI markup.
- Migration of existing subscriptions or Stripe products/prices.
- Production database migrations affecting subscription authority or counters.
- Enabling live checkout or deploying the redesigned site to production.
