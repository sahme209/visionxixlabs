# New Website Request / Instant Quote — Verification Summary

## 1. New Files Created

| File | Purpose |
|------|---------|
| `lib/db.ts` | Prisma client singleton |
| `lib/leads/leadSchema.ts` | Zod validation schema for lead form |
| `lib/leads/pricingEstimate.ts` | Server-side pricing estimation logic |
| `lib/leads/leadEmailService.ts` | Confirmation + internal notification emails |
| `lib/admin/auth.ts` | Admin auth helper (Firebase ID token + admin claim) |
| `app/request/page.tsx` | Public multi-step request form at `/request` |
| `app/request/thank-you/page.tsx` | Thank-you page with estimate and disclaimer |
| `app/api/leads/route.ts` | `POST /api/leads` — create lead, validate, store, emails |
| `app/api/admin/leads/route.ts` | `GET /api/admin/leads` — list/filter leads (admin only) |
| `app/api/admin/leads/[id]/route.ts` | `GET` / `PATCH` lead by id (admin only) |
| `app/admin/leads/page.tsx` | Protected admin leads dashboard |
| `prisma/migrations/20250225000000_init_leads/migration.sql` | Initial migration for Lead table |
| `VERIFICATION_SUMMARY.md` | This verification summary |

## 2. Files Modified

| File | Changes |
|------|---------|
| `package.json` | Added `prisma`, `@prisma/client`, `zod`; build script runs `prisma generate`; added `db:migrate`, `db:push` |
| `prisma/schema.prisma` | Added Lead model and indexes; uses `provider = "prisma-client-js"` and `url = env("DATABASE_URL")` |
| `lib/db.ts` | Prisma client singleton (uses `@prisma/client`) |
| `lib/leads/leadEmailService.ts` | Removed unused `MIN_COMPLETION_SECONDS` constant |
| `prisma.config.ts` | **Deleted** — Prisma 5 uses schema.prisma directly; prisma.config.ts was Prisma 7–specific |

## 3. Prisma Schema Changes

```prisma
model Lead {
  id         String   @id @default(cuid())
  name       String
  email      String
  phone      String?
  fullPayload Json
  status     String   @default("new")
  source     String   @default("website-request")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([email])
  @@index([status])
  @@index([createdAt])
}
```

## 4. Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (used by Prisma) |
| `RESEND_API_KEY` | Resend API key for emails |
| `RESEND_FROM_EMAIL` | From address for emails (optional, defaults to SUPPORT_EMAIL) |
| `NEXT_PUBLIC_BASE_URL` | Base URL for links in emails |
| `VISIONXIX_LEADS_TEAM_EMAIL` | Internal notification recipient (optional, defaults to SUPPORT_EMAIL) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Firebase Admin (for admin auth) |

Existing vars (unchanged): `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_PROJECT_ID`, etc.

## 5. Migration Command

```bash
# Set DATABASE_URL in .env or .env.local, then:
npm run db:migrate
# or
npx prisma migrate dev --name init_leads
```

For production:
```bash
npx prisma migrate deploy
```

## 6. Example API Request/Response

**Request:**
```http
POST /api/leads
Content-Type: application/json

{
  "fullName": "Jane Doe",
  "businessName": "Acme Inc",
  "email": "jane@acme.com",
  "phone": "(555) 123-4567",
  "currentWebsiteUrl": "",
  "industry": "technology",
  "projectType": "new_website",
  "numberOfPages": 8,
  "requiredSections": "Home, About, Services, Contact",
  "projectGoals": ["lead_generation", "brand_awareness"],
  "designPreference": "Minimal, modern",
  "referenceSites": "",
  "copywritingNeeded": true,
  "logoBrandAssetsReady": true,
  "hostingDomainStatus": "need_hosting",
  "timeline": "1_month",
  "budgetRange": "5k_10k",
  "additionalNotes": "Looking for a redesign.",
  "_honeypot": "",
  "_startTime": 1730000000000
}
```

**Success response (201):**
```json
{
  "success": true,
  "leadId": "clxx123...",
  "estimate": {
    "min": 4850,
    "max": 13300,
    "breakdown": [
      { "label": "new_website (base)", "min": 3000, "max": 8000 },
      { "label": "Additional pages (3 × $300)", "min": 900, "max": 1350 },
      { "label": "Copywriting", "min": 500, "max": 2000 },
      { "label": "SEO setup", "min": 500, "max": 2000 },
      { "label": "Hosting & domain setup", "min": 300, "max": 800 }
    ]
  }
}
```

## 7. Pricing Logic Explanation

- **Base prices (project type):**
  - New website: $3,000–$8,000
  - Redesign: $2,500–$6,000
  - Landing page: $1,500–$3,500

- **Extra pages:** First 5 included. Additional pages: $300/page (up to 20), max applied.

- **Add-ons:**
  - Copywriting: $500–$2,000
  - E-commerce (when goal includes ecommerce): $1,500–$5,000
  - Blog (when required sections include “blog”): $500–$1,500
  - SEO setup (when goals include lead_generation or brand_awareness): $500–$2,000
  - Hosting & domain (when status = need_hosting): $300–$800

- Final min/max are the sum of base + extra pages + selected add-ons.

## 8. Assumptions and TODOs

### Assumptions
- Postgres is available via `DATABASE_URL`; no other DB changes.
- Admin access uses Firebase custom claim `admin === true`; admins are set via Firebase Admin or backend tooling.
- Resend is used for emails; existing `RESEND_API_KEY` and `RESEND_FROM_EMAIL` apply.
- `/request` is public; `/admin/leads` is client-protected (login required) and API-protected (admin claim required).
- Vision XIX Labs branding and SUPPORT_EMAIL from `lib/constants/company.ts` are used.

### TODOs
- Run `prisma migrate dev` or `prisma migrate deploy` once Postgres is configured.
- Set `admin: true` on admin user(s) via Firebase Admin SDK if not already done.
- Optionally set `VISIONXIX_LEADS_TEAM_EMAIL` for a dedicated lead inbox.
