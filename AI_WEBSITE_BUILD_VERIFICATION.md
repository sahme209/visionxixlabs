# AI Website Build Flow — Verification Summary

## 1. Modified / Created Files

### New Files

| File | Purpose |
|------|---------|
| `lib/leads/starterToken.ts` | HMAC-SHA256 signed tokens for lead links; `createStarterToken`, `verifyStarterToken` |
| `lib/leads/aiWebsiteStarter.ts` | AI Website Starter Package generator (OpenAI); `generateWebsiteStarterPackage` |
| `lib/leads/scaffoldGenerator.ts` | Next.js scaffold generator (disabled in prod); `generateScaffold` |
| `lib/leads/previewDeploy.ts` | Static HTML + Vercel Deploy API; `deployPreview` |
| `app/api/leads/[leadId]/starter/route.ts` | GET starter status (token required) |
| `app/api/leads/[leadId]/starter/generate/route.ts` | POST generate AI package (token required) |
| `app/api/leads/[leadId]/preview/deploy/route.ts` | POST deploy preview (token required) |
| `app/api/leads/[leadId]/preview/status/route.ts` | GET preview status (token required) |
| `app/api/admin/leads/[id]/starter/regenerate/route.ts` | POST regenerate AI (admin) |
| `app/api/admin/leads/[id]/preview/deploy/route.ts` | POST deploy preview (admin) |
| `app/api/admin/leads/[id]/preview/publish/route.ts` | POST production deployment (admin) |
| `AI_WEBSITE_BUILD_VERIFICATION.md` | This verification doc |

### Modified Files

| File | Changes |
|------|---------|
| `app/api/leads/route.ts` | Returns `token`; creates thank-you link; passes `thankYouLink` to confirmation email |
| `lib/leads/leadEmailService.ts` | `ConfirmationEmailOptions`; Domain & Hosting section; thank-you link in email |
| `app/request/page.tsx` | Redirects with `leadId` and `token` to thank-you page |
| `app/request/thank-you/page.tsx` | Full flow: starter polling, generate trigger, preview deploy trigger, preview polling; Domain & Hosting section |
| `app/admin/leads/page.tsx` | Regenerate AI, Regenerate preview, Publish buttons; collapsible AI package; preview/production URLs |
| `package.json` | Added `archiver`, `@types/archiver` (for scaffold generator) |

## 2. Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (Prisma) |
| `RESEND_API_KEY` | Resend for confirmation and internal emails |
| `RESEND_FROM_EMAIL` | Optional; from address |
| `NEXT_PUBLIC_BASE_URL` | Base URL for thank-you links and emails |
| `VISIONXIX_LEADS_TEAM_EMAIL` | Optional; internal lead notification recipient |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin for admin auth |
| `OPENAI_API_KEY` | AI Website Starter Package generation |
| `VERCEL_TOKEN` | Vercel Deployments API (preview deploy) |
| `VERCEL_TEAM_ID` | Optional; Vercel team ID for deployments |
| `STARTER_TOKEN_SECRET` | HMAC secret for signed lead tokens; **required** for token-based access |

## 3. How Preview Deploy Works

1. **Lead creation** → Lead saved, `token` returned; confirmation email includes thank-you link with `leadId` and `token`.
2. **Thank-you page** → Fetches `GET /api/leads/[leadId]/starter?token=`. If `pending`, triggers `POST /api/leads/[leadId]/starter/generate?token=` and polls every 3s.
3. **AI ready** → When `aiStarterPackage` is present, thank-you page triggers `POST /api/leads/[leadId]/preview/deploy?token=` and polls `GET /api/leads/[leadId]/preview/status?token=` every 4s.
4. **Preview deploy** → `previewDeploy.deployPreview()` generates static HTML (index.html, about.html, services.html, contact.html, style.css) from the AI package and deploys to Vercel via `POST https://api.vercel.com/v13/deployments`.
5. **previewUrl** → Stored in `lead.fullPayload.previewUrl`; shown on thank-you page and in confirmation email.

## 4. How to Test Locally

1. Set `.env.local`:
   ```
   DATABASE_URL=postgresql://...
   RESEND_API_KEY=re_...
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   OPENAI_API_KEY=sk-...
   VERCEL_TOKEN=...
   STARTER_TOKEN_SECRET=your-secret-at-least-32-chars
   ```

2. Run `npm run dev` and submit a lead at `/request`.
3. After submit, you’re redirected to `/request/thank-you?leadId=...&token=...&min=...&max=...`.
4. Thank-you page will:
   - Trigger AI generation (if pending)
   - Poll until AI package is ready
   - Trigger preview deploy
   - Poll until `previewUrl` is available
5. Click “View preview” when ready.
6. Admin: open `/admin/leads`, select a lead, use “Regenerate AI”, “Regenerate preview”, “Publish”.

**Preview deploy** requires `VERCEL_TOKEN`. Without it, preview deploy fails with 500; lead creation and AI generation still work.

## 5. Security Model for Access Tokens

- **STARTER_TOKEN_SECRET**: HMAC-SHA256 secret. Must be at least 32 characters, kept server-only.
- **createStarterToken(leadId)**: Produces `leadId.signature` (base64url).
- **verifyStarterToken(token)**: Verifies signature and returns `leadId` or `null`. Uses `crypto.timingSafeEqual` to avoid timing attacks.
- **Protected endpoints**: `GET/POST /api/leads/[leadId]/starter/*` and `GET/POST /api/leads/[leadId]/preview/*` require `token` query param and validate with `verifyStarterToken`. No raw `leadId` access to starter/preview content.
- **Admin endpoints**: `POST /api/admin/leads/[id]/starter/regenerate`, `.../preview/deploy`, `.../preview/publish` require Firebase admin claim.
