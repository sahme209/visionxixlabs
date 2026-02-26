# Site Functionality Audit — "Make Everything Functional"

**What changed:** Full-site audit to ensure every CTA/button/link works end-to-end. Removed dead ends, added Vercel fallback for Website Builder preview, fixed "Coming Soon" buttons, consolidated navigation.

---

## Page → CTA/Button → Expected → Current → Fix

| Page | CTA/Button | Expected | Current | Fix |
|------|------------|----------|---------|-----|
| Home | Run Axiom Analysis | → /cloud-operator | ✓ Works | None |
| Home | Talk to an Architect | → /contact | ✓ Works | None |
| Home | AWS/Azure/GCP pill links | → cloud-solutions | ✓ Works | None |
| Request | Get my AI-built site preview | Submit → thank-you | ✓ Works | None |
| Request | Run Axiom (inline link) | → /cloud-operator | ✓ Works | None |
| Thank-you | View your website | Opens preview URL | ✓ Works | None |
| Thank-you | (no VERCEL_TOKEN) | Show managed-pending message | Was 500 | Added fallback: "Preview pending—our team will deploy" |
| Cloud Operator | Start analysis (submit) | → /cloud-operator?token= | ✓ Works | None |
| Cloud Operator | Execute with Operator (coming soon) | Dead button | Nothing | Replaced with Link "Request implementation support" → /contact |
| Cloud Studio | Generate AI output | → /cloud-studio/result?token= | ✓ Works | None |
| Cloud Studio Result | Run Axiom Analysis | → /cloud-operator | ✓ Works | None |
| Navigation | Run Axiom (CTA) | → /cloud-operator | ✓ Works | None |
| Navigation | Get a Quote (duplicate) | → /request | Duplicate, missing onClick | Removed duplicate; AI Website Builder covers /request |
| Apps | App Store / Website | External links | ✓ Works | None |

---

## Broken Links (Before / After)

| Before | After |
|--------|-------|
| Execute with Operator — disabled, no action | Request implementation support → /contact |
| Duplicate Get a Quote in mobile nav | Removed; use AI Website Builder |
| VERCEL_TOKEN missing → 500 on website builder deploy | Returns managed_pending, shows "Preview pending—our team will deploy" |

---

## Routes Returning 404 (in dev)

- None identified. Key routes render:
  - /, /cloud-operator, /request, /request/thank-you
  - /cloud-studio, /cloud-studio/result
  - /contact, /insights, /ai-solutions, /cloud-solutions, /free-review, /apps

---

## APIs Erroring During Flows

| Flow | API | Error (before) | Fix |
|------|-----|----------------|------|
| Website Builder | POST /api/leads/trigger | 500 when VERCEL_TOKEN missing | deployPreview returns PENDING; status package_ready, deployStatus managed_pending |
| Leads | POST /api/leads | ✓ 200 | None |
| Cloud Operator | POST /api/cloud-operator/submit | ✓ 200 | None |
| Cloud Studio | POST /api/cloud-studio/submit | ✓ 200 | None |

---

## Final Confirmation Checklist

- [x] Home → Run Axiom → submit → status polling → analysis result
- [x] Home → AI Website Builder → submit → thank-you → preview ready (or managed_pending when no VERCEL_TOKEN)
- [x] Home → Cloud Studio → submit → result → status polling → output ready
- [x] Cloud Operator "Execute with Operator (coming soon)" → replaced with working CTA
- [x] Navigation mobile menu: no duplicate links; all paths valid
- [x] No placeholder href="#"
- [x] Coming Soon items: either working CTA or tier-gated / request form

---

## Route Check Script

```bash
# Start dev server first
npm run dev

# In another terminal
node scripts/check-routes.mjs
```

Validates: /, /cloud-operator, /request, /request/thank-you, /cloud-studio, /cloud-studio/result, /contact, /insights, /ai-solutions, /cloud-solutions, /free-review, /apps, /visionxix-ai, /visionxix-ai/pricing.

---

## Required Env Vars

| Var | Purpose | Fallback |
|-----|---------|----------|
| VERCEL_TOKEN | Website Builder preview deploy | Shows "Preview pending—our team will deploy" |
| STARTER_TOKEN_SECRET | Lead tokens (cloud-operator, leads) | 500 if missing |
| RESEND_API_KEY | Confirmation emails | Email skipped |
| DATABASE_URL | Prisma | Required for all flows |
