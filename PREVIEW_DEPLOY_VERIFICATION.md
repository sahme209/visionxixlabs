# AI Website Preview Deploy — Verification Summary

## 1. Modified / Created Files

### New Files
| File | Purpose |
|------|---------|
| `lib/leads/starterToken.ts` | HMAC-signed token create/verify (STARTER_TOKEN_SECRET) |
| `lib/leads/aiWebsiteStarter.ts` | OpenAI-based AI starter package generator |
| `lib/leads/previewHtmlGenerator.ts` | Static HTML generator from AiStarterPackage |
| `lib/leads/vercelDeploy.ts` | Vercel Deployments API client |
| `lib/leads/previewDeploy.ts` | Wrapper: HTML generation + Vercel deploy |
| `app/api/leads/[leadId]/starter/generate/route.ts` | POST generate AI package (token required) |
| `app/api/leads/[leadId]/preview/route.ts` | GET preview status/URL (token required) |
| `app/api/admin/leads/[id]/starter/route.ts` | POST regenerate AI (admin only) |
| `app/api/admin/leads/[id]/preview/regenerate/route.ts` | POST regenerate preview (admin only) |
| `app/api/admin/leads/[id]/preview/publish/route.ts` | POST production deploy (admin only) |

### Modified Files
| File | Changes |
|------|---------|
| `app/api/leads/route.ts` | Returns `starterToken`, passes to email |
| `app/api/leads/[leadId]/starter/route.ts` | Returns `previewUrl` with starter (existing) |
| `app/api/leads/[leadId]/preview/deploy/route.ts` | Sets `previewStatus: "ready"` in fullPayload |
| `lib/leads/leadEmailService.ts` | Thank-you link with leadId+token, preview note |
| `app/request/page.tsx` | Redirects to thank-you with leadId and token |
| `app/request/thank-you/page.tsx` | Full preview flow: starter polling, deploy, preview link, Domain & Hosting section |
| `app/admin/leads/page.tsx` | Regenerate AI, Regenerate preview, Publish buttons; preview/production URLs |

## 2. Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI API key for AI starter generation |
| `VERCEL_TOKEN` | Vercel API token for preview/production deployments |
| `VERCEL_TEAM_ID` | Optional: Vercel team ID for deployments |
| `STARTER_TOKEN_SECRET` | Secret for HMAC-signed access tokens (min 16 chars) |
| `NEXT_PUBLIC_BASE_URL` | Base URL for thank-you links (e.g. https://yoursite.com) |

Existing: `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `VISIONXIX_LEADS_TEAM_EMAIL`, `FIREBASE_SERVICE_ACCOUNT_KEY`, etc.

## 3. How Preview Deploy Works

1. **Lead creation**: User submits form → lead saved → `starterToken` created and returned.
2. **Thank-you page**: Receives `leadId` and `token` in URL. Does not expose raw leadId for content access.
3. **AI generation**: POST `/api/leads/[leadId]/starter/generate?token=` runs AI, stores `aiStarterPackage` in `fullPayload`.
4. **Preview deploy**: POST `/api/leads/[leadId]/preview/deploy?token=` generates static HTML from AI package, deploys to Vercel via API, stores `previewUrl` and `previewDeploymentId` in `fullPayload`.
5. **Customer view**: Thank-you page polls GET `/api/leads/[leadId]/preview?token=` until `previewUrl` is ready, then shows "Your website preview is ready" with link.
6. **Admin**: Regenerate AI, Regenerate preview, or Publish (production deployment) from `/admin/leads`.

Flow is non-blocking: lead is saved first; AI and deploy run via dedicated endpoints and polling.

## 4. How to Test Locally

1. Set env vars: `STARTER_TOKEN_SECRET`, `OPENAI_API_KEY`, `VERCEL_TOKEN` (optional: `VERCEL_TEAM_ID`).
2. Run `npm run dev`.
3. Submit a request at `/request`.
4. On thank-you page, ensure `leadId` and `token` are in the URL. If `STARTER_TOKEN_SECRET` is missing, token will be omitted and preview flow will not run.
5. Wait for AI generation and preview deploy. Check Network tab for `/api/leads/.../starter/generate`, `/api/leads/.../preview/deploy`, `/api/leads/.../preview`.
6. Preview link should appear. Without `VERCEL_TOKEN`, deploy will fail with a clear error; AI will still run if `OPENAI_API_KEY` is set.
7. Admin: Sign in with admin claim, go to `/admin/leads`, open a lead, use Regenerate AI, Regenerate preview, Publish.

## 5. Security Model for Access Tokens

- **HMAC signed**: `createStarterToken(leadId)` produces `base64url(leadId + "." + HMAC-SHA256(leadId))`. Verified with `verifyStarterToken(token)`.
- **No raw leadId access**: All public endpoints (`/starter`, `/starter/generate`, `/preview`, `/preview/deploy`) require `token` query param. Invalid or missing token returns 401.
- **Admin routes**: Use Firebase ID token + `admin` claim; no starter token required.
- **Avoid leaky IDs**: Customer links use signed token only; leadId in URL is only valid when paired with a valid token.

## 6. fullPayload JSON Extensions (No Prisma Schema Changes)

- `aiStarterPackage`: AI output
- `aiStarterError`: boolean, true if AI failed
- `previewUrl`: string, Vercel deployment URL
- `previewDeploymentId`: string
- `previewStatus`: `"ready"` | `"error"`
- `productionUrl`: string (after Publish)
- `productionDeploymentId`: string
