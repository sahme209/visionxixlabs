# Phase 6 — Monetization + Funnels Verification

Phase 6 drives conversion through self-serve upgrades, implementation requests, and enterprise pipeline—without spammy upsells.

---

## A) Tier Label Dictionary

| Internal (Operator) | Internal (Studio) | Internal (Website) | Unified Label |
|--------------------|-------------------|--------------------|---------------|
| free | free | starter | Analysis |
| pro | professional | professional | Roadmap |
| growth | — | — | Automation Signals |
| enterprise | enterprise | doneForYou | Strategic Advisory |

**File:** `lib/pricing/tiers.ts`

- `getUnifiedTierLabel(source, tier)` → display label
- `getUnifiedTierBenefits(source, tier)` → benefit list
- `getUpgradePath(source, tier)` → suggested next tier (internal id)

---

## B) Upgrade Paths

| Current | Suggested Next |
|---------|----------------|
| free | pro |
| starter | professional |
| pro / professional | growth |
| growth | enterprise |
| enterprise | null |

---

## C) One-Time Unlock Flow

| Step | Description |
|------|-------------|
| 1 | Free user sees "Upgrade" or "$29 Full Roadmap Unlock" CTA |
| 2 | $29 unlock links to `/contact?intent=roadmap-unlock&token=...` |
| 3 | After payment (Stripe / manual), backend calls `POST /api/cloud-operator/unlock?token=...` |
| 4 | Unlock record: `fullPayload.unlock = { type: "roadmap", paid: true, paidAt, expiresAt }` |
| 5 | Status endpoint treats unlock as Pro for this lead (roadmap, configs) |

**Endpoint:** `POST /api/cloud-operator/unlock?token=XXX`

---

## D) Billing Endpoints (Stripe Ready)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/billing/create-checkout-session` | Create Stripe checkout (requires auth) |
| POST | `/api/billing/create-portal-session` | Create Stripe portal (manage subscription) |

**Behavior when Stripe env vars missing:**  
Returns 503 with `{ error, message, cta: "contact" }` — show "Contact Sales" CTA.

**billingIntent storage:**  
`fullPayload.billingIntent = { desiredTier, createdAt, sourcePage }`

---

## E) Enterprise Readiness Brief

**File:** `lib/axiom/enterpriseBrief.ts`

**Input:** scores, drift, trend  
**Output:**  
- biggestRiskExposures  
- biggestSavingsLevers  
- governanceGaps  
- recommended90DayOutline  
- recommendedEngagementModel  

**Gating:**
- Free/Pro/Growth: preview (top 2 risks, top 2 savings, CTA)
- Enterprise: full brief + download

**CTA:** "Request Enterprise Brief Review Call" (implementation request + enterprise flag)

---

## F) Nav Changes

| Change | Before | After |
|--------|--------|-------|
| Primary CTA | Contact | Run Axiom Analysis (indigo button) |
| Products list | Axiom — Autonomous Infrastructure Intelligence | Run Axiom Analysis |
| Solutions | Free Cloud & AI Review, Cloud Review Session | Free Review (Human-Led), Cloud Review (legacy) |

---

## G) Gentle Notices (No Hard Redirects)

| Page | Notice | CTA |
|------|--------|-----|
| `/cloud-studio/result` | "Want the full unified model?" | Run Axiom Analysis → `/cloud-operator` |
| `/request/thank-you` | "Want infra optimization + deployment hardening?" | Run Axiom Analysis → `/cloud-operator?ref=TOKEN` |

---

## H) Example UI Copy Snippets

**Upgrade card (cloud-operator):**
- "Analysis (free): Summary dashboard only."
- "Roadmap (pro): Full technical outputs, configs, savings breakdown."
- "Automation Signals (growth): Drift detection, trend history."
- "Strategic Advisory (enterprise): Policy packs, enterprise brief."
- CTA: "Upgrade" → `/auth/signin?callbackUrl=/cloud-operator`
- Fallback: "Or Contact Sales"

**Free user download block:**
- "Upgrade to Roadmap (Pro+) or unlock for this report:"
- Buttons: "Upgrade" | "$29 Full Roadmap Unlock" (→ Contact)

**Cloud Studio result:**
- "Want the full unified model?"
- "Run Axiom for Infrastructure Advantage Model™ scoring, 30-day roadmap, playbooks, and deployment hardening."

**Request thank-you:**
- "Want infra optimization + deployment hardening?"
- "Run Axiom on this project for 30-day roadmap, playbooks, and infrastructure intelligence."
