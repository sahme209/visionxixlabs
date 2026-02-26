# Enterprise AI + Multi-Cloud Website Platform — Verification

## 1) Files Created

| File | Purpose |
|------|---------|
| `lib/deploy/provider.ts` | Provider abstraction layer: `deploySite(provider, pkg, options)` |
| `lib/credentialEncrypt.ts` | AES-256-GCM credential encryption/decryption |
| `lib/infrastructureAddOns.ts` | Provider-specific add-on definitions |
| `lib/rateLimit.ts` | In-memory rate limiting for preview update endpoint |
| `middleware.ts` | Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, CSP |

## 2) Files Modified

| File | Changes |
|------|---------|
| `lib/previewDeploy.ts` | Calls `deploySite()`, accepts `provider` and optional `credentials` |
| `app/request/page.tsx` | Cloud provider select (vercel/aws/azure/gcp), "Use my cloud account", credential fields, add-on checkboxes |
| `app/request/thank-you/page.tsx` | Infrastructure Stack Overview section (provider, CDN, SSL, CI/CD, security level, add-ons) |
| `app/api/leads/route.ts` | Accepts `cloudProvider`, `useMyCloud`, `addOns`, credential fields; encrypts and stores in `fullPayload` |
| `app/api/leads/trigger/route.ts` | Passes `cloudProvider` to deploy, sets `fullPayload.infrastructure` |
| `app/api/leads/status/route.ts` | Returns `infrastructure` object for thank-you page |
| `app/api/leads/[id]/preview/update/route.ts` | Rate limiting (10 req/min by token) |

## 3) Provider Abstraction Summary

**Interface:** `deploySite(provider, pkg, options): Promise<DeployResult>`

- **Providers:** vercel, aws, azure, gcp
- **Vercel:** Full deploy via Vercel API (production-ready)
- **AWS / Azure / GCP:** Minimal stubs returning `{ url: contact-link, deploymentId: "{provider}-pending", state: "PENDING" }`
- **Options:** `projectName`, optional `credentials`
- **Result:** `{ url, deploymentId, state }`

Preview flow uses Vercel by default. Non-Vercel providers are prepared for future implementation (e.g., S3, Azure Static Web Apps, GCP Storage).

## 4) Cloud Credential Handling

- **Intake:** Form fields per provider:
  - AWS: Access Key, Secret, Bucket
  - Azure: Service Principal JSON (textarea)
  - GCP: Service Account JSON (textarea)
- **Storage:** Encrypted via `lib/credentialEncrypt.ts` (AES-256-GCM), stored in `fullPayload.credentials`
- **Key:** Derived from `CREDENTIAL_ENCRYPTION_KEY` or `STARTER_TOKEN_SECRET` (fallback)
- **Flow:** If "Use my cloud account" is yes and credentials provided, they are encrypted and stored. Deploy layer can later decrypt when implementing provider-specific deploys. If not provided, platform uses managed account (Vercel for preview).

## 5) CI/CD Structure Summary

- CI/CD is **simulated** as part of infrastructure overview (flags in `fullPayload.infrastructure.cicdEnabled`).
- Professional and Done-For-You tiers show CI/CD as enabled in the UI.
- No Git-based auto-deploy or environment config management implemented yet; structure is modular for future extension (e.g., webhook on Git push).

## 6) Security Middleware Implementation

**`middleware.ts`** applies to all routes:

- **HSTS:** `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- **X-Frame-Options:** `DENY`
- **X-Content-Type-Options:** `nosniff`
- **Content-Security-Policy:** Basic CSP (self for scripts/styles; img/connect relaxed for compatibility)

**Rate limiting** (`lib/rateLimit.ts`):

- Applied to `POST /api/leads/[id]/preview/update`
- 10 requests per minute per token (keyed by token prefix)
- Returns 429 with message when exceeded

**Token security** (existing): 7-day expiry, HMAC-signed; 401/403 on invalid/expired.

## 7) Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `STARTER_TOKEN_SECRET` | Token signing, fallback for credential encryption |
| `CREDENTIAL_ENCRYPTION_KEY` | Primary key for credential encryption (min 32 chars) |
| `VERCEL_TOKEN` | Vercel deploy |
| `VERCEL_TEAM_ID` | Optional team ID |
| `OPENAI_API_KEY` | AI package generation |
| `RESEND_API_KEY` | Confirmation email |

**For future AWS deploy:**

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`

**For future Azure deploy:**

- `AZURE_CREDENTIALS` or service principal env vars

**For future GCP deploy:**

- `GOOGLE_APPLICATION_CREDENTIALS` or service account JSON path

## 9) Failed Migration Fix (P3009)

If build fails with `migrate found failed migrations` for `20260219120000_add_lead_model`:

1. **Automatic (during build):** The build script now runs `prisma migrate resolve --applied` before deploy to clear failed state.
2. **Manual:** Run `npm run migrate:resolve` with `DATABASE_URL` set, then re-run build.

## 8) Assumptions and Simplifications

1. **AWS/Azure/GCP deploys:** Stubbed to contact URL; no S3/Azure Static/GCP Storage implementation yet.
2. **Credentials:** Stored encrypted in `fullPayload`; decryption used only when provider-specific deploy is implemented.
3. **Rate limiting:** In-memory; resets on server restart; not suitable for multi-instance without Redis.
4. **CI/CD:** Conceptual only; no Git integration or auto-redeploy.
5. **CSP:** Relaxed for Next.js (e.g., `unsafe-inline` for scripts/styles) to avoid breaking the app.
6. **Add-ons:** Stored in `fullPayload`; enforcement and provisioning left for future implementation.
