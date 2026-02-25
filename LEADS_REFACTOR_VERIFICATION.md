# Website Request / Instant Quote — Refactor Verification Summary

## 1. Files Modified (within feature scope only)

| File | Changes |
|------|---------|
| `app/api/leads/route.ts` | Wrapped confirmation + internal notification emails in try/catch; DB write completes even if email fails; log email errors safely; API returns success after DB write |
| `lib/leads/pricingEstimate.ts` | New base ranges: new_website 2500–6000, redesign 2000–5000, landing_page 1200–3000; cap total max at 9000; rebalanced add-ons proportionally |
| `lib/leads/leadSchema.ts` | Added `leadEstimatePayloadSchema` for partial form data with defaults (for live estimate API) |
| `app/request/page.tsx` | Top progress bar (Step X of 4); reassurance microcopy; 4 steps (Contact → Project → Details → Review); two-column desktop layout; smooth step transitions |
| `app/request/thank-you/page.tsx` | No changes (already had estimate display + disclaimer) |
| `app/admin/leads/page.tsx` | No changes (admin auth already uses ADMIN_EMAILS + NextAuth, no Firebase) |
| `lib/admin/auth.ts` | No changes (already lightweight ADMIN_EMAILS check, no Firebase) |

## 2. New Components Created

| Component | Purpose |
|-----------|---------|
| `app/request/RequestPricingPanel.tsx` | Live pricing preview panel; fetches estimate from API; shows min–max range + breakdown; 400ms debounce; disclaimer text |

## 3. New API Route

| Route | Purpose |
|-------|---------|
| `app/api/leads/estimate/route.ts` | POST endpoint that returns pricing estimate for (possibly partial) form payload; does not create lead or send emails; uses existing server-side `estimatePricing` logic |

## 4. Updated Pricing Logic Summary

- **Base prices:**
  - New website: $2,500 – $6,000
  - Redesign: $2,000 – $5,000
  - Landing page: $1,200 – $3,000
- **Additional pages:** $250/page (max 20 extra pages), max side scaled by 1.5x
- **Add-ons (rebalanced):**
  - Copywriting: $400 – $1,500
  - E-commerce: $1,200 – $4,000
  - Blog/CMS: $400 – $1,200
  - SEO setup: $400 – $1,500
  - Hosting & domain: $250 – $600
- **Total cap:** Maximum estimate capped at **$9,000**

## 5. Removed Dependencies

- **None.** Admin auth for `/admin/leads` already uses NextAuth + `ADMIN_EMAILS`; no Firebase Admin SDK was used in visionxixlabs for this feature.

## 6. How Live Pricing Fetch Works

1. User edits form fields that affect pricing (project type, pages, copywriting, goals, required sections, hosting status).
2. `RequestPricingPanel` debounces changes (400ms) via `payloadKey` derived from those fields.
3. When `payloadKey` changes, `useEffect` sends `POST /api/leads/estimate` with the current form payload (partial data allowed via `leadEstimatePayloadSchema`).
4. Server runs `estimatePricing()` (same logic as lead creation); returns `{ min, max, breakdown }`.
5. Client displays estimate range + line-item breakdown + disclaimer: "Estimate only. Final quote confirmed after review."
6. Pricing logic stays server-side; no internal formulas exposed to the client.

## 7. Assumptions Made

- `ADMIN_EMAILS` (comma-separated) remains the env var for admin access; spec mentioned `ADMIN_EMAIL` but visionxixlabs already uses `ADMIN_EMAILS` for multiple admins.
- Step count: 4 steps (Contact, Project, Details, Review) with a Review step before submit.
- Pricing panel shows on both mobile (stacked below form) and desktop (right column); on desktop it is sticky (`lg:sticky lg:top-24`) so it stays visible while scrolling the form.
- Thank-you page continues to receive only `min` and `max` in the URL; breakdown is not passed for that page.
- Prisma schema and database migrations unchanged; no schema modifications.
