# AI Website Build Upgrade — Verification Output

## 1) Files Modified

| File | Changes |
|------|---------|
| `lib/starterToken.ts` | Token format `leadId.timestamp.signature`, 7-day expiry, `verifyStarterToken` returns `VerifyResult` with `error: "invalid" \| "expired"` |
| `lib/aiWebsiteStarter.ts` | Extended `AIStarterPackage` (metaTitle, metaDescription, brandTone, homepageHero, aboutDraft, servicesDraft, contactContent); added `generateAIStarterPackageWithChanges` for iteration |
| `lib/scaffoldGenerator.ts` | Added SEO meta tags, `homepageHero` for hero, `wrapPage` now takes `metaTitle`, `metaDesc` |
| `app/request/page.tsx` | Tier selection (Starter/Professional/Done-For-You), premium copy, tier in form submit |
| `app/request/thank-you/page.tsx` | "Your AI-built website is live", Request changes text box + submit, `submitChangeRequest` calls `/api/leads/[id]/preview/update`, revisions remaining display |
| `app/admin/leads/page.tsx` | View AI output (expandable), Upgrade tier dropdown |
| `app/api/leads/route.ts` | Accept and store `tier` in `fullPayload.form` |
| `app/api/leads/status/route.ts` | Use new `verifyStarterToken`, return `revisionsRemaining` |
| `app/api/leads/trigger/route.ts` | Use new `verifyStarterToken` |
| `app/api/leads/[id]/preview/update/route.ts` | **New** — token-verified update endpoint for change requests, revision limit check |
| `app/api/leads/[id]/upgrade-tier/route.ts` | **New** — admin-only tier update in fullPayload |

## 2) Files Deleted

None. No scaffold zip, local filesystem storage, or duplicate preview routes existed.

## 3) Final Architecture Summary

```
/request (form)
    → POST /api/leads (save lead, return token)
    → Redirect /request/thank-you?token=XXX

Thank-you page:
    → POST /api/leads/trigger?token=XXX (generate AI + deploy preview)
    → Poll GET /api/leads/status?token=XXX
    → When deploy_ready: show preview link + Request changes box
    → POST /api/leads/[id]/preview/update?token=XXX { changeRequest } (iteration)

Admin /admin/leads:
    → GET /api/leads/list
    → POST /api/leads/[id]/generate
    → POST /api/leads/[id]/deploy-preview
    → POST /api/leads/[id]/publish
    → POST /api/leads/[id]/upgrade-tier { tier }
```

- **Token:** `base64url(leadId).timestamp.signature`, expires in 7 days. 401 with "Token expired" when expired.
- **No code exposure** — customer only sees live preview link and Request changes text area.
- **Serverless-safe** — dedicated POST endpoints, polling on thank-you page. Lead save never blocks.

## 4) Pricing Logic Summary

| Tier | Price | Revisions | Production Deploy |
|------|-------|-----------|-------------------|
| Starter AI Build | $49 | 3 | No |
| Professional Publish | $399 | Unlimited (for publish) | Yes |
| Done-For-You Premium | $2,000–$5,000 | Unlimited | Yes |

- Stored in `fullPayload.form.tier`.
- Revision limit enforced in `POST /api/leads/[id]/preview/update` for Starter only.
- Professional and Done-For-You: no revision cap for preview iteration.

## 5) Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `STARTER_TOKEN_SECRET` | HMAC signing for tokens |
| `OPENAI_API_KEY` | AI package generation |
| `MODEL_NAME` | (optional) Default: gpt-4o-mini |
| `VERCEL_TOKEN` | Preview/production deploy |
| `VERCEL_TEAM_ID` | (optional) Team projects |
| `RESEND_API_KEY` | Confirmation email |

## 6) What Was Skipped (Already Implemented)

- Lead creation and storage (unchanged)
- Trigger pipeline (generate + deploy)
- Status polling
- Admin regenerate package, regenerate preview, publish
- Domain & Hosting section on thank-you page
- Scaffold generator (4–5 page HTML) — enhanced, not replaced
- Preview deploy to Vercel — unchanged

## 7) Technical Risks

1. **Token expiry:** Tokens expire after 7 days. Users who wait longer cannot use the thank-you page or Request changes. Consider extending or offering a “resend link” flow.
2. **Vercel API:** Deployment format assumes Vercel accepts inline files. If Vercel changes API or project requirements, deploy may fail.
3. **Stripe build error:** Pre-existing — Stripe webhook imports Stripe client which requires `STRIPE_SECRET_KEY` at module load. Not related to this upgrade.
4. **Revision count:** Stored in `fullPayload.revisionCount`. Starter tier limited to 3; upgrade tier to get more.
