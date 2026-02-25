# AI-Assisted Website Starter Flow — Verification Summary

## Files Created/Modified

### Created
| File | Purpose |
|------|---------|
| `lib/leads/aiWebsiteStarter.ts` | OpenAI/Gemini service for Website Starter Package generation; prompt, schema, markdown export |
| `lib/leads/rateLimit.ts` | In-memory rate limiter (5 req/IP/hour) for leads API |
| `lib/leads/scaffoldGenerator.ts` | Next.js + Tailwind scaffold generator; stores in `data/scaffolds/{leadId}/` |
| `app/api/leads/[leadId]/starter/route.ts` | GET: return AI Starter Package (public via leadId) |
| `app/api/leads/[leadId]/starter/download/route.ts` | GET: markdown download of Starter Package |
| `app/api/admin/leads/[id]/starter/route.ts` | POST: regenerate AI Starter Package (admin only) |
| `app/api/admin/leads/[id]/scaffold/route.ts` | POST: generate scaffold zip (admin only) |
| `app/api/admin/leads/[id]/scaffold/download/route.ts` | GET: download scaffold zip (admin only) |

### Modified
| File | Changes |
|------|---------|
| `app/api/leads/route.ts` | Lead save first; fire-and-forget AI; rate limit; return leadId; pass leadId to email |
| `app/request/page.tsx` | Redirect with leadId in URL |
| `app/request/thank-you/page.tsx` | Fetch AI package by leadId; polling when pending; polished summary; Download Starter Package |
| `lib/leads/leadEmailService.ts` | Accept leadId; add "View your Website Starter Package" link in confirmation email |
| `app/admin/leads/page.tsx` | View AI Starter Package; Regenerate AI; Generate scaffold; Download scaffold |
| `.gitignore` | Add `/data/scaffolds` |
| `package.json` | Add `archiver` dependency |

---

## Schema Changes

**No Prisma schema changes.** AI output stored inside `fullPayload` JSON:

- `fullPayload.aiStarterPackage` — structured AI output (JSON object)
- `fullPayload.aiStarterError` — boolean, true if AI generation failed

---

## OpenAI Prompt & Expected JSON Schema

### System prompt (summary)

```
You are an expert web strategist and copywriter for a professional web agency.
Output ONLY valid JSON matching the schema (no markdown, no code blocks).
```

### Expected JSON schema

```json
{
  "siteStructure": { "pages": [{ "name": string, "sections": string[] }] },
  "heroHeadline": string,
  "heroSubheadline": string,
  "draftCopy": { "home": string, "services": string, "about": string, "contact": string },
  "ctaRecommendations": [{ "label": string, "placement": string, "type": "button"|"form"|"link" }],
  "colorStyleDirection": string,
  "seoStarter": { "keywords": string[], "metaTitle": string, "metaDescription": string },
  "nextStepsDomainHosting": {
    "haveDomainHosting": { "whatWeNeed": string[] },
    "needHelp": { "recommendedRegistrar": string, "recommendedHosting": string, "stepsWeHandle": string[] }
  },
  "disclaimer": string
}
```

### User prompt (summary)

Project brief: business, industry, project type, pages, goals, required sections, copywriting, hosting status, timeline, budget, notes.

---

## PDF / Markdown Download

- **Endpoint:** `GET /api/leads/[leadId]/starter/download`
- **Response:** `Content-Type: text/markdown; charset=utf-8` with `Content-Disposition: attachment; filename="website-starter-{leadId}.md"`
- **Logic:** `aiStarterToMarkdown()` in `lib/leads/aiWebsiteStarter.ts` converts `AiStarterPackage` to markdown
- **PDF:** Not implemented; markdown download only (as requested in spec)

---

## Scaffold Generation & Artifact Storage

### Flow

1. Admin clicks "Generate Scaffold" in lead detail.
2. `POST /api/admin/leads/[id]/scaffold` runs.
3. Uses `fullPayload.aiStarterPackage` (must exist).
4. `lib/leads/scaffoldGenerator.ts`:
   - Writes files to `data/scaffolds/{leadId}/`
   - Creates Next.js app: `app/layout.tsx`, `app/page.tsx`, `app/about/page.tsx`, `app/services/page.tsx`, `app/contact/page.tsx`
   - Adds `package.json`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, `next.config.js`, `app/globals.css`
   - Zips folder to `data/scaffolds/{leadId}.zip`
5. Returns `downloadUrl`: `/api/admin/leads/[id]/scaffold/download`.
6. Admin downloads zip via link; code is not shown to customer.

### Storage

- **Folder:** `data/scaffolds/{leadId}/` (per-lead scaffold files)
- **Zip:** `data/scaffolds/{leadId}.zip`
- Ignored in git via `.gitignore`

---

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Primary AI provider for Website Starter Package |
| `GEMINI_API_KEY` | (Optional) Fallback when OpenAI fails |
| `NEXT_PUBLIC_BASE_URL` | Base URL for thank-you links and scaffold download URLs |
| `RESEND_API_KEY` | Confirmation and internal emails |
| `RESEND_FROM_EMAIL` | Sender for emails |
| `DATABASE_URL` | Prisma / Postgres |
| `ADMIN_EMAILS` | Admin access for /admin/leads |

---

## Assumptions / TODOs

1. **PDF:** Only markdown download implemented; PDF can be added via `@react-pdf/renderer` or similar.
2. **Gemini fallback:** Uses `@google/genai` `generateContent`; API may differ across versions.
3. **Scaffold storage:** Local filesystem; for production, consider object storage (S3, etc.).
4. **Rate limit:** In-memory; resets on server restart; use Redis for distributed setups.
5. **Thank-you without leadId:** If `leadId` is missing, shows estimate only and no AI package.
6. **Scaffold download auth:** Admin session required (NextAuth); cookies sent with request.
