# AI Website Build — Verification & Setup

## Overview

The AI Website Build flow lets customers request a new website, receive an AI-generated preview (no code shown), and get a live preview link. Lead creation is always fast; AI and deployment run asynchronously.

## Modified / Created Files

### API routes
- `app/api/leads/route.ts` — POST: create lead (returns leadId + signed token)
- `app/api/leads/status/route.ts` — GET: poll status by token (no leadId in URL)
- `app/api/leads/trigger/route.ts` — POST: trigger generate + deploy (by token)
- `app/api/leads/list/route.ts` — GET: admin list leads
- `app/api/leads/[id]/generate/route.ts` — POST: regenerate AI package
- `app/api/leads/[id]/deploy-preview/route.ts` — POST: regenerate preview deploy
- `app/api/leads/[id]/publish/route.ts` — POST: production deploy (admin only)

### Pages
- `app/request/page.tsx` — New Website Request form
- `app/request/thank-you/page.tsx` — Thank-you page with polling and Domain & Hosting section
- `app/admin/leads/page.tsx` — Admin leads dashboard with Regenerate package, Regenerate preview, Publish buttons

### Lib
- `lib/aiWebsiteStarter.ts` — Generate AI starter package from lead form (OpenAI)
- `lib/scaffoldGenerator.ts` — Generate 3–5 page static HTML from AI package
- `lib/previewDeploy.ts` — Deploy to Vercel via Deployments API
- `lib/starterToken.ts` — HMAC signed tokens for customer links

### DB
- `prisma/schema.prisma` — Lead model
- `prisma/migrations/20260219120000_add_lead_model/migration.sql` — Migration for Lead table

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STARTER_TOKEN_SECRET` | Yes (for preview flow) | Secret for HMAC signing; min 32 chars. `openssl rand -base64 32` |
| `OPENAI_API_KEY` | Yes (for AI package) | OpenAI API key |
| `MODEL_NAME` | No | Default: `gpt-4o-mini` |
| `VERCEL_TOKEN` | Yes (for deploy) | Vercel API token (from Vercel → Settings → Tokens) |
| `VERCEL_TEAM_ID` | No | Team ID if deploying under a team |
| `RESEND_API_KEY` | Yes (for email) | Resend API key for confirmation email |
| `RESEND_FROM_EMAIL` | No | From address (e.g. `contact@visionxixlabs.com`) |
| `NEXT_PUBLIC_BASE_URL` | No | Base URL for links (e.g. `https://visionxixlabs.com`) |

---

## Flow

1. **Request form** (`/request`): User fills form → POST `/api/leads` → Lead saved → Returns `{ leadId, token }` → Redirect to `/request/thank-you?token=XXX`
2. **Thank-you page**: On load, POST `/api/leads/trigger?token=XXX` (fire-and-forget). Poll GET `/api/leads/status?token=XXX` every 3s. When `deploy_ready`, show preview link.
3. **Trigger**: Verifies token → Generate AI package → Generate static site files → Deploy to Vercel → Store `previewUrl` in `fullPayload` → Send confirmation email
4. **Admin** (`/admin/leads`): List leads, Regenerate package, Regenerate preview, Publish (production deploy)

---

## Security

- **No raw leadId in public URLs.** Thank-you and status use signed token only.
- **Signed tokens:** HMAC-SHA256. Format: `base64url(leadId).hmac(base64url(leadId))`.
- **Verify token** on `/api/leads/status` and `/api/leads/trigger`.
- **Admin endpoints** (`/api/leads/list`, `/api/leads/[id]/publish`) require NextAuth session.
- **Preview URL** is the Vercel deployment URL (e.g. `https://preview-xxx.vercel.app`). No leadId in that URL.

---

## Preview Deploy (Vercel)

1. Uses Vercel Deployments API: `POST https://api.vercel.com/v13/deployments`
2. Sends inline files: `{ name, files: [{ file, data, encoding: "base64" }] }`
3. Project name: `preview-{last8charsOfLeadId}` (unique per lead)
4. Response includes `url` or `alias`; stored in `lead.fullPayload.previewUrl`

### Testing locally

- Set `VERCEL_TOKEN`, `OPENAI_API_KEY`, `STARTER_TOKEN_SECRET`, `RESEND_API_KEY`.
- Run `prisma migrate deploy` (or `prisma db push`).
- Submit form at `/request` → Thank-you page should poll and eventually show preview link.
- Check Vercel dashboard for new deployments.

---

## Domain & Hosting Section (Thank-you page)

- **Has domain:** Ask for registrar name, DNS access; we provide records.
- **No domain:** Recommend Namecheap, Cloudflare, Google Domains; offer to purchase/setup with approval.
- Email-only flow; no forced call.
