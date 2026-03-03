# Website Messaging + UX Audit

**Date:** March 1, 2025  
**Vision:** Axiom is primary (deep, trustworthy enterprise cloud automation); Builder and chatbots secondary.

---

## 1) HOMEPAGE CLARITY (Above-the-fold)

### Current one-sentence takeaway
*"We're a Cloud & AI engineering firm that delivers production results; you can build a website, automate your cloud, or explore AWS/Azure/GCP solutions."*

### Three confusing or too-broad elements

1. **Builder as primary CTA** — "Build & Deploy a Website" is the gradient primary CTA; Axiom is secondary. Homepage feels builder-led, not Axiom-first.
2. **"Cloud & AI Engineering That Delivers Production Results"** — Generic. Does not name Axiom or enterprise cloud automation.
3. **No product hierarchy** — ProductDemoShowcase shows Builder, Axiom, Cloud Solutions as equal. Axiom’s role as core product is unclear.

### Rewrite: Axiom-first, enterprise-credible

| Element | Current | Recommended |
|---------|---------|-------------|
| **Headline** | "Cloud & AI Engineering That Delivers Production Results — AWS, Azure, GCP" | **"Axiom: Enterprise cloud automation that scores, optimizes, and secures your AWS, Azure, GCP."** |
| **Subheadline** | "We design, automate, secure, and optimize multi-cloud platforms with production-grade AI workflows..." | **"Real connectors, real scans, safe execution. No changes to your cloud without your approval. For CTOs and teams scaling production systems."** |
| **Primary CTA** | "Build & Deploy a Website" | **"Run Axiom"** (link to /cloud-operator) |
| **Secondary CTA** | "Automate Your Cloud Infrastructure" (→ /axiom) | **"See how it works"** (→ /axiom) or **"Build a website"** (→ /builder, lower emphasis) |

---

## 2) NAVIGATION + INFORMATION ARCHITECTURE

### Top-nav items that dilute the Axiom story

- **"Build Website"** — Primary gradient CTA, distracts from Axiom.
- **Solutions dropdown** — Website Builder and Axiom at same level; Cloud Solutions, AI Solutions, Case Studies compete for attention.
- **No Pricing** in top nav — Users can’t easily find plans.

### Proposed simplified nav

| Tier | Items |
|------|-------|
| **Primary** | Axiom, Solutions (dropdown), Pricing, Contact |
| **Secondary / footer** | Builder, Apps, Press, Insights, Company |

**Changes:**
- Primary CTA: **"Run Axiom"** (one clear CTA).
- Solutions dropdown: Cloud Solutions, AI Solutions, Case Studies, Free Review. Axiom as standalone top-level item.
- Pricing: Top-level link (→ /visionxix-ai/pricing or /products).
- Builder: In Solutions or footer, not primary CTA.

### Duplicate / overlapping pages

| Page | Purpose | Recommendation |
|------|---------|----------------|
| **/axiom** | Axiom marketing/landing | **Keep** — Marketing entry point. |
| **/cloud-operator** | Axiom product UI (run scans, view scores) | **Keep** — Main product experience. |
| **/visionxix-ai** | Chatbots (Vision XIX AI) | **Keep** — Separate product. Badge "Part of Axiom ecosystem" is correct. |
| **/cloud-studio** | Request form for CI/CD, cost, security services | **Keep** — Different flow (scoping form). Consider "Cloud Studio" vs "Axiom" naming to avoid confusion. |

**Summary:** No true duplicates. `/axiom` explains Axiom and links to `/cloud-operator`. Consolidate naming and hierarchy, not pages.

---

## 3) PRODUCT PAGE CONSISTENCY

### Overlap and contradictions

| Page | Overlap / Contradiction | Risk |
|------|-------------------------|------|
| **/axiom** | "Apply Fix execution" — "Execute changes via cloud APIs or generated scripts" | Implies broad automation; some plugins are placeholder/stub. |
| **/axiom** | "Not just assessment—real execution" | Real execution exists (GitHub PR, execution engine) but AWS/Azure/GCP remediate are stubs. |
| **/cloud-operator** | "Select fixes to execute via cloud APIs" | Same gap: GitHub works; AWS remediate is placeholder. |
| **/visionxix-ai** | "Integrates with Zendesk, Intercom, Crisp" | Unverified; may imply integrations that don’t exist. |
| **/products** | "Separate pricing for each product" | Misleading; only membership has Stripe checkout. |

### Exact lines/sections to adjust or remove

| File | Location | Issue | Change |
|------|----------|-------|--------|
| `app/axiom/page.tsx` | FEATURES "Apply Fix execution" (lines 33–34) | Overstates automation | Change to: "Apply fixes via approved actions (e.g. GitHub PR). Toggle per issue; confirm before destructive actions. Execution logs and rollback. Some cloud remediations in preview." |
| `app/axiom/page.tsx` | Header para (lines 60–61) | "apply fixes via API" too broad | Change to: "Scan your cloud, get an actionable plan, and apply approved fixes (e.g. GitHub PR). Real AWS connector for assume-role validation. Execution logs and rollback." |
| `app/cloud-operator/page.tsx` | Line 812 | "Connect your environment via APIs for real-time analysis" | Clarify: "Connect AWS (assume-role), GitHub, or other connectors when enabled. AI analyzes inventory, cost, and config." |
| `app/visionxix-ai/page.tsx` | Integrations section (lines 223–247) | "Connect to Zendesk, Intercom, Crisp" | Add: "Coming soon" or "Planned integrations" — or remove if not implemented. |
| `app/products/page.tsx` | Line 19 | "Separate pricing for each product" | Change to: "One membership includes Axiom, Builder, and AI assistants. View plans." |

---

## 4) PRICING COMMUNICATION (Truthful)

### Alignment with billing

| Page | Billing reality | Copy fix |
|------|-----------------|----------|
| **/visionxix-ai/pricing** | Real — Stripe Payment Links, membership | OK. Clearly purchasable. |
| **/axiom/pricing** | Display only — CTA → Run Axiom or Contact sales | Add line: **"Axiom is included in membership. Run Axiom to start, or Contact sales for enterprise."** |
| **/builder/pricing** | Display only — CTA → builder or Contact sales | Add line: **"Builder is included in membership. Get started to try, or Contact sales for custom."** |
| **/products** | Implies separate checkout per product | Change to: **"One membership. Axiom, Builder, and AI assistants included. View plans."** |

### CTAs that look purchasable but aren’t wired

| Page | CTA | Reality |
|------|-----|---------|
| `/axiom/pricing` | "Run Axiom" (non-enterprise) | Goes to product; no payment. OK if copy explains "included in membership." |
| `/axiom/pricing` | "Contact sales" (enterprise) | Correct. |
| `/builder/pricing` | "Get started" | Goes to builder; no payment. Add "Included in membership" to avoid confusion. |
| `/builder/pricing` | "Contact sales" (business) | Correct. |

### Required additions

| File | Add |
|------|-----|
| `app/axiom/pricing/page.tsx` | Subhead or note: "Axiom is included in membership. Run Axiom to try, or contact sales for enterprise." |
| `app/builder/pricing/page.tsx` | Subhead or note: "Website Builder is included in membership. Get started to try, or contact sales for custom packages." |

---

## 5) TRUST + ENTERPRISE SIGNALS

### Missing trust signals we can add (without inventing)

| Signal | Status in code | Add where |
|--------|----------------|-----------|
| "Credentials encrypted (AES-256-GCM)" | ✓ credentialVault | Axiom, Connectors tab |
| "Assume-role only — no long‑lived customer keys" | ✓ AWS connector | Connectors, Axiom |
| "Requires explicit authorization before execution" | ✓ Approval flow | Axiom, Apply Fix section |
| "Execution logs & rollback-safe workflow" | ✓ ExecutionLog, rollback schema | Axiom feature list |
| "Audit logs for connector link, export, changes" | ✓ AuditLog | Footer or trust section |

### Five short credibility bullets (all true)

1. **"Assume-role model for AWS — we never store customer access keys."**
2. **"Execution requires your approval. No automatic changes without confirmation."**
3. **"Execution logs and rollback capability for applied fixes."**
4. **"Credentials stored encrypted (AES-256-GCM). Audit trail for connector and export actions."**
5. **"Read-only analysis by default. Changes only after you approve."**

---

## 6) EDIT LIST (Exact file paths and changes)

| # | File | Change |
|---|------|--------|
| 1 | `components/HeroHeadlineGlow.tsx` | Replace HEADLINE_WORDS with Axiom-first headline: "Axiom: Enterprise Cloud Automation — AWS, Azure, GCP" (or similar). |
| 2 | `app/page.tsx` | Lines 92–96: Subheadline → "Real connectors, real scans, safe execution. No changes to your cloud without your approval. For CTOs and teams scaling production systems." |
| 3 | `app/page.tsx` | Lines 99–115: Swap CTAs — Primary: "Run Axiom" (→ /cloud-operator, gradient). Secondary: "Build a website" (→ /builder, subdued) or "See how it works" (→ /axiom). |
| 4 | `components/Navigation.tsx` | Primary nav: Axiom first. "Run Axiom" as main CTA. "Build Website" move to Solutions or secondary. Add "Pricing" link. |
| 5 | `components/ProductDemoShowcase.tsx` | Reorder DEMOS: Axiom first, then Builder, then Cloud Solutions. Or add short line under Axiom: "Our flagship product." |
| 6 | `app/axiom/page.tsx` | FEATURES "Apply Fix execution" — soften copy per §3. Header para — soften "apply fixes via API" per §3. |
| 7 | `app/axiom/pricing/page.tsx` | Add note: "Axiom is included in membership. Run Axiom to try, or contact sales for enterprise." |
| 8 | `app/builder/pricing/page.tsx` | Add note: "Website Builder is included in membership. Get started to try, or contact sales for custom." |
| 9 | `app/products/page.tsx` | Line 19: "One membership includes Axiom, Builder, and AI assistants. View plans." |
| 10 | `app/visionxix-ai/page.tsx` | Integrations: Add "Planned" or "Coming soon" if Zendesk/Intercom/Crisp not live. |
| 11 | `app/cloud-operator/page.tsx` | Connectors copy — add "AWS assume-role, no stored keys" if space allows. |
| 12 | `components/EnterpriseTrustSignals.tsx` or new trust block | Add 5 credibility bullets from §5 (assume-role, approval required, execution logs, encryption, read-only default). |

---

## Summary

- Homepage and nav are Builder-first; they should be Axiom-first.
- Axiom/Apply Fix copy slightly overstates automation; soften where cloud remediations are placeholder.
- Axiom and Builder pricing pages should say "Included in membership" so CTAs aren’t misleading.
- Add trust signals (assume-role, approval, encryption, logs) that match current implementation.
