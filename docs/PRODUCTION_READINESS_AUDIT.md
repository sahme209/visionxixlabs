# Production-Readiness & No-Fake-Features Audit

**Date:** March 1, 2025  
**Scope:** Vision XIX Labs codebase — demo/placeholder detection, pricing/billing, entitlements, connectors, execution, AI outputs.

---

## 1) DEMO / FAKE / PLACEHOLDER FEATURES (Highest Priority)

### 1.1 Connectors — Always Return "valid/linked"

| Item | File(s) | UI Claims | Backend Reality | Risk | Recommended Action |
|------|---------|-----------|-----------------|------|--------------------|
| **AWS Connector** | `lib/connectors/aws.ts` | "Link AWS" → status "linked" | Always returns `{ valid: true, status: "linked" }` regardless of credentials. No API validation. | **HIGH** — Users believe credentials are validated; any garbage input appears linked | Mark "Beta" or implement real STS GetCallerIdentity validation |
| **Azure Connector** | `lib/connectors/azure.ts` | Same | Same stub: always `valid: true`, `status: "linked"` | **HIGH** | Same |
| **GCP Connector** | `lib/connectors/gcp.ts` | Same | Same stub | **HIGH** | Same |
| **GitHub Connector** | `lib/connectors/github.ts` | "Link GitHub" | **REAL** — Validates via `GET https://api.github.com/user` | — | Keep as-is |

### 1.2 Cloud Deploy — Stubbed to Contact URL

| Item | File(s) | UI Claims | Backend Reality | Risk | Recommended Action |
|------|---------|-----------|-----------------|------|--------------------|
| **AWS Deploy** | `lib/deploy/provider.ts` | Deploy to AWS | Returns `{ url: "https://visionxixlabs.com/contact", deploymentId: "aws-pending", state: "PENDING" }` — no S3/CloudFront/etc. | **HIGH** | Remove AWS deploy option or hide behind "Coming soon / Contact us" |
| **Azure Deploy** | `lib/deploy/provider.ts` | Deploy to Azure | Same — contact URL + `azure-pending` | **HIGH** | Same |
| **GCP Deploy** | `lib/deploy/provider.ts` | Deploy to GCP | Same — contact URL + `gcp-pending` | **HIGH** | Same |
| **Vercel Deploy** | `lib/deploy/provider.ts` | Deploy to Vercel | **REAL** — Calls Vercel API when token present | — | Keep as-is |

### 1.3 Plugins — Placeholder / Mock

| Item | File(s) | UI/Backend Claims | Backend Reality | Risk | Recommended Action |
|------|---------|-------------------|-----------------|------|--------------------|
| **Analytics Plugin** | `lib/plugins/analytics.ts` | GA, Plausible tracking | Returns `{ status: "plugin_placeholder" }` | **MEDIUM** | Remove from UI or mark "Coming soon" |
| **Domain-DNS Plugin** | `lib/plugins/domain-dns.ts` | Manage domain/DNS | Returns `{ status: "plugin_placeholder" }` | **MEDIUM** | Same |
| **Deployment Plugin** | `lib/plugins/deployment.ts` | One-click deploy | Returns `{ status: "plugin_placeholder" }` | **MEDIUM** | Same |
| **AWS Plugin (remediate)** | `lib/plugins/aws.ts` | Remediate improvements | Comment: "Placeholder: would parse improvementText, map to AWS API calls" — returns `status: "executed"` with no real change | **HIGH** | Mark "Preview" or implement |
| **AWS IAM Scan** | `lib/plugins/aws/iam-readonly-scan.ts` | Scan IAM users/roles/policies | Without creds: mock "0 users, 0 roles". With creds: placeholder "integrate @aws-sdk/client-iam" — no live data | **HIGH** | Mark "Beta / Coming soon" or implement |
| **AWS Cost Explorer** | `lib/plugins/aws/cost-explorer-summary.ts` | Cost summary | Without creds: mock $0. With creds: placeholder "integrate AWS Cost Explorer" — no live data | **HIGH** | Same |

### 1.4 Credential Provider — Cross-Tenant Risk

| Item | File(s) | Claim | Reality | Risk | Recommended Action |
|------|---------|-------|---------|------|--------------------|
| **Credential Provider** | `lib/plugins/credentials.ts` | Fetch credentials by userId/credentialsKey | Mock provider ignores `userId`/`credentialsKey`; falls back to `process.env.AWS_*` | **CRITICAL** — All users share env AWS keys | Replace mock with credential vault lookup by credentialsKey; never use env as fallback for multi-tenant |

### 1.5 Other Placeholder / Demo Artifacts

| Item | File(s) | Notes | Risk | Recommended Action |
|------|---------|-------|------|--------------------|
| **Cloud Studio placeholder email** | `app/api/cloud-studio/submit/route.ts` | If email omitted: `cloud-studio@placeholder.local` | **LOW** — Internal placeholder | Document; consider requiring email |
| **README "Coming Soon"** | `README.md` | "Android Apps: Coming Soon" | **LOW** | Remove if not planned |
| **Axiom placeholders** | `lib/axiom/infrastructureAdvantage.ts` | "Simple placeholders for Growth/Enterprise features" | **MEDIUM** | Audit; ensure UI doesn't imply full capability |
| **async statusBuilder** | `lib/async/statusBuilder.ts` | "placeholder numeric delta" | **LOW** | Clarify in UI if shown |

---

## 2) PRICING + BILLING WIRING

### 2.1 Current Pricing Model

| Source | Plans | Prices | Checkout / Webhook |
|--------|-------|--------|--------------------|
| **Membership (canonical)** | starter, growth, scale, enterprise | $35, $75, $249; Enterprise custom | — |
| **Vision XIX AI Pricing** | `/visionxix-ai/pricing` | Uses `MEMBERSHIP_PLANS`; Stripe Payment Links (hardcoded buy.stripe.com URLs) | Direct to Stripe; no checkout API |
| **Axiom Pricing** | `/axiom/pricing` | `AXIOM_PLANS` (cloud-basic $49, cloud-pro $99, enterprise) | **Display only** — CTA → /cloud-operator or Contact sales |
| **Builder Pricing** | `/builder/pricing` | `BUILDER_PLANS` (starter $29, pro $59, business $149) | **Display only** — CTA → /builder or Contact sales |
| **Cloud Operator Checkout** | `app/api/billing/create-checkout-session/route.ts` | Uses `STRIPE_PRICE_PRO` or `STRIPE_PRICE_ID` | **Single price ID** — ignores tier; always same product |

### 2.2 Stripe Webhook (`app/api/webhooks/stripe/route.ts`)

| Env Vars | Mapping |
|----------|---------|
| `STRIPE_PRICES_STARTER` | Comma-separated price IDs → plan `starter` |
| `STRIPE_PRICES_GROWTH` | → plan `growth` |
| `STRIPE_PRICES_SCALE` | → plan `scale` |
| (none for enterprise) | Enterprise price IDs → `priceToPlan` returns **null** → plan not updated |

**Issue:** Enterprise subscribers are never mapped; `plan` stays previous or null.

### 2.3 Mismatches

| Mismatch | Details |
|----------|---------|
| **Checkout vs. tiers** | create-checkout-session accepts `tier` in body but uses one `priceId` for all. User always gets same Stripe product regardless of tier selection. |
| **Vision XIX AI pricing vs. webhook** | Vision XIX AI page links to Stripe Payment Links per plan. Webhook maps by price ID. **Assumption:** Payment Links use correct price IDs that match `STRIPE_PRICES_*`. Must be verified. |
| **Axiom / Builder pricing** | Display-only. No Stripe products; no webhook mapping. Users cannot "buy" Axiom or Builder plans via these pages. |
| **User.plan** | Updated only on checkout.session.completed and customer.subscription.updated/deleted. Signup sets `plan: "starter"`; webhook may overwrite. |

### 2.4 Production-Correct Wiring Plan

1. **Single source of truth:** `lib/pricing/membership.ts` — already canonical. Ensure all UIs and checkouts reference it.
2. **Price ID mapping:**
   - Add `STRIPE_PRICES_ENTERPRISE` (or custom logic for enterprise).
   - Ensure Payment Links for starter/growth/scale use price IDs included in `STRIPE_PRICES_*`.
3. **Checkout session:** For cloud-operator checkout, map `tier` → correct Stripe price ID per plan (starter/growth/scale) instead of single `STRIPE_PRICE_PRO`.
4. **Axiom / Builder pricing pages:** Either wire to Stripe products + webhook mapping, or clearly label "Contact sales" / "Included in membership" so users understand they are not standalone products.
5. **Tests:**
   - Upgrades: purchase growth → webhook → User.plan = growth.
   - Downgrades: subscription.updated → User.plan = scale → growth.
   - Cancel: subscription.deleted → User.plan cleared or downgraded per product logic.
   - Enterprise: custom price ID → User.plan = enterprise.

---

## 3) ENTITLEMENTS / ACCESS CONTROL

### 3.1 Entitlement Model

- **lib/entitlements.ts:** Derives from `User.plan` (Stripe). No `User.modules` dependency in design.
- **lib/userModules.ts:** `hasAxiomModule`, `hasBuilderModule`, `hasPlugin` — read from `User.modules` (JSON).

### 3.2 Critical Issue: User.modules Never Set

| Code Path | Uses | Result |
|-----------|------|--------|
| Signup | `prisma.user.create({ plan: "starter" })` | No `modules` field → null |
| Stripe webhook | `prisma.user.updateMany({ plan })` | Only updates `plan`; never `modules` |
| Execution run | `hasAxiomModule(user.modules)` | `user.modules` = null → **false** |
| Axiom execute-fixes | `hasAxiomModule(userModules)` | Same → **false** |
| Execution engine | `hasAxiomModule(userModules)` | Same → **false** |

**Effect:** Execution and "Apply fixes" are **blocked for all users** with "Axiom module required" (403).

**Recommendation:** Either:
- (A) Derive modules from plan at runtime: e.g. `getEntitlementsFromPlan(plan).axiomScan` → treat as axiom module for execution; **remove** `hasAxiomModule(userModules)` and use plan-based checks; or
- (B) Set `User.modules` in webhook when plan changes: e.g. `modules: { axiom: true, builder: true }` for paid plans.

### 3.3 Entitlement Checks

| Location | Check | Source |
|----------|-------|--------|
| Execution run | `hasAxiomModule` | User.modules |
| Axiom execute-fixes | `hasAxiomModule` | User.modules |
| Execution engine | `hasAxiomModule`, `hasBuilderModule`, `hasPlugin` | User.modules |
| Connectors link | `canViewTechnicalOutputs(tier)` for cloud connectors | payload.tier (form) |
| Entitlements | `getEntitlementsFromPlan(plan)` | User.plan |

### 3.4 Route Protection

| Route | Protection | Issue |
|-------|------------|-------|
| `/admin/leads` | Layout: session only | **No admin check** — any signed-in user can access |
| `/admin/enterprise-dashboard` | Same | Same |
| `/api/leads/list` | Session only | **No admin check** — any user can list leads |
| `/api/admin/leads` | `requireAdmin` | Correct |
| Dashboard, cloud-operator pages | Session via layout | Correct |

**Recommendation:** Admin layout and `/api/leads/list` should use `requireAdmin` (or equivalent) so only `ADMIN_EMAILS` can access.

---

## 4) CONNECTORS + EXECUTION

### 4.1 Connector Validation

| Connector | File | Real or Stub | Validation |
|-----------|------|--------------|------------|
| AWS | `lib/connectors/aws.ts` | **Stub** | Always `valid: true` |
| Azure | `lib/connectors/azure.ts` | **Stub** | Always `valid: true` |
| GCP | `lib/connectors/gcp.ts` | **Stub** | Always `valid: true` |
| GitHub | `lib/connectors/github.ts` | **Real** | `GET /user` with Bearer token |

### 4.2 Credential Storage

- **lib/security/credentialVault.ts:** AES-256-GCM encryption. Credentials stored as `encryptedCredRef` in `lead.fullPayload.connectors[type]`.
- **Retrieval:** `lib/plugins/credentials.ts` — **mock provider** ignores `credentialsKey`; returns `process.env.AWS_*` if set. Real vault lookup by credentialsKey not implemented.

### 4.3 Execution Plugins

| Plugin | File | Real API/SDK | Notes |
|--------|------|--------------|-------|
| aws | `lib/plugins/aws.ts` | No | Placeholder remediate |
| aws:iam-readonly-scan | `lib/plugins/aws/iam-readonly-scan.ts` | No | Mock or placeholder |
| aws:cost-explorer-summary | `lib/plugins/aws/cost-explorer-summary.ts` | No | Mock or placeholder |
| GitHub PR | `lib/connectors/githubWrite.ts` | **Yes** | Creates real PR via GitHub API |

### 4.4 Cross-Tenant Risk

- **lib/plugins/credentials.ts:** `getAWSCredentials` returns env vars for all users when no per-user creds. All tenants share same AWS account.

---

## 5) AI OUTPUT RELIABILITY

### 5.1 AI-Generated Deliverables

| Deliverable | File | Execution | Notes |
|-------------|------|-----------|-------|
| Strategic Brief | `lib/axiom/strategicBrief.ts` | AI orchestration (OpenAI/Gemini/Anthropic) | Generated from scores; no cloud execution |
| Board Deck Outline | `lib/axiom/boardDeck.ts` | Deterministic — splits strategic brief text | No AI; derived from brief |
| Enterprise Brief | `lib/axiom/enterpriseBrief.ts` | Similar pattern | Advisory only |
| Axiom Scores, Plan, Playbooks | Various | AI + deterministic logic | No direct cloud mutations |
| Drift signals, Deal signals | `lib/axiom/driftDetector.ts`, `dealSignals.ts` | Logic on payload | No execution |

**Conclusion:** AI deliverables (brief, deck, scores) are advisory. They do not execute cloud changes. "Apply fixes" and remediation flows use plugins; those are partially stubbed as noted in §1 and §4.

---

## 6) MUST-FIX LIST (Production Launch Checklist)

### P0 — Critical (Before Launch)

- [ ] **Credential provider:** Remove env fallback for multi-tenant AWS. Implement credential lookup by `credentialsKey` from lead connectors.
- [ ] **User.modules vs plan:** Fix execution blocking. Either derive module access from plan or set modules in webhook. Unblock "Apply fixes" and execution for paid users.
- [ ] **Admin protection:** Require `requireAdmin` for `/admin/*` layout and `/api/leads/list`.

### P1 — High

- [ ] **AWS/Azure/GCP connectors:** Add real validation (e.g. STS GetCallerIdentity, Azure token validation) or mark "Beta" and clarify they are format-only.
- [ ] **Deploy provider:** Remove or hide AWS/Azure/GCP deploy options; or label "Contact us for custom deploy."
- [ ] **Stripe webhook:** Add enterprise price ID mapping; verify Payment Link price IDs match env vars.
- [ ] **Checkout session:** Map tier → correct Stripe price ID for cloud-operator checkout.

### P2 — Medium

- [ ] **Placeholder plugins:** Remove analytics, domain-dns, deployment from UI or mark "Coming soon."
- [ ] **AWS plugins (IAM, Cost Explorer, remediate):** Implement real SDK calls or mark "Preview / Coming soon."
- [ ] **Builder / Axiom pricing:** Clarify display-only or wire to Stripe.

### P3 — Lower

- [ ] **Cloud Studio placeholder email:** Require email or document placeholder.
- [ ] **README:** Remove "Coming Soon" for Android if not planned.
- [ ] **Add logging/monitoring:** Webhook events, execution outcomes, connector link attempts.

---

## Summary Table

| Category | Status | Action |
|----------|--------|--------|
| Demo/Fake features | Multiple stubs | Remove, hide, or implement |
| Pricing wiring | Partial | Align checkout, webhook, env; add enterprise |
| Entitlements | Broken (modules) | Fix module/plan derivation |
| Connectors | AWS/Azure/GCP stub | Validate or mark beta |
| Credentials | Cross-tenant risk | Replace mock with vault lookup |
| Execution | Blocked (modules) | Fix entitlements |
| Admin routes | Underprotected | Add admin check |
| AI outputs | Advisory only | Document; no changes needed |
