# Final Production Verification Checklist

**Date:** March 1, 2025  
**Focus:** Stripe lifecycle, feature-flag enforcement, privacy/compliance  
**Scope:** Hardening only — no new product features

---

## 1) Stripe Lifecycle Correctness — DONE

### Admin Plan Debug (added)

| File | Change |
|------|--------|
| `app/admin/plan-debug/page.tsx` | **New.** Admin-only page showing user.plan, derived entitlements, last Stripe webhook event id, env var status. |
| `app/api/admin/plan-debug/route.ts` | **New.** Admin-only API; uses `requireAdmin`; returns plan, entitlements, `lastStripeWebhookEventId` from AuditLog (no PII). |
| `app/admin/layout.tsx` | Added Plan Debug nav link. |

### Stripe Webhook Updates (added)

| File | Change |
|------|--------|
| `app/api/webhooks/stripe/route.ts` | Logs every verified webhook to AuditLog (`stripe_webhook_processed`) with `stripeEventId`, `stripeEventType`. Added `STRIPE_PRICES_ENTERPRISE` mapping. Removed PII from logs. |

### Enterprise Price ID — Action Required

| Item | File | Status |
|------|------|--------|
| Add `STRIPE_PRICES_ENTERPRISE` | `.env` / Vercel | Set comma-separated enterprise Stripe price IDs. Plan-debug page shows when missing. |

---

## 2) Feature-Flag Enforcement — Verified

### Gating Status

| Component | File | Gated | Notes |
|-----------|------|-------|-------|
| **Plugins list** | `lib/plugins/registry.ts` | ✓ | `listPlugins()` / `listPluginsForTrack()` filter via `ENABLE_PLACEHOLDER_PLUGINS`. Placeholder IDs: analytics, domain-dns, deployment, aws, azure, gcp. |
| **Execution plugins** | `lib/plugins/executionRegistry.ts` | ✓ | `getExecutionPlugin` / `listExecutionPlugins` filter via `ENABLE_PLACEHOLDER_PLUGINS`. Placeholder: aws:iam-exposure-scan, aws:cost-explorer-summary. |
| **API plugins list** | `app/api/plugins/list/route.ts` | ✓ | Uses `listPluginsForTrack` → placeholder plugins excluded when flag off. |
| **Connector link** | `app/api/connectors/link/route.ts:87–91` | ✓ | `isCloudConnectorEnabled(connector)` blocks AWS/Azure/GCP with 503 when flag off. |
| **Connector status** | `app/api/connectors/status/route.ts:37–39` | ✓ | Returns `status: "unavailable"` for AWS/Azure/GCP when flag off. |
| **Deploy options** | `app/request/thank-you/page.tsx:270` | ✓ | Only "Managed Cloud (Vercel)" shown. No AWS/Azure/GCP deploy options in UI. |

### Connector UI Caveat

| File | Issue | Fix |
|------|-------|-----|
| `app/cloud-operator/page.tsx:1666–1682` | Connectors tab shows AWS/Azure/GCP cards regardless of flags. API blocks link; status returns "unavailable". | Optional: Add note "Coming soon" when connector disabled. Requires feature-flag API or client-side config. **Not required for production** — API enforces. |

### Env Vars for Feature Flags

| Flag | Default | Purpose |
|------|---------|---------|
| `ENABLE_PLACEHOLDER_PLUGINS` | `false` | Show placeholder plugins in list and execution. |
| `ENABLE_CLOUD_CONNECTORS_AWS` | `false` | Allow AWS connector link. |
| `ENABLE_CLOUD_CONNECTORS_AZURE` | `false` | Allow Azure connector link. |
| `ENABLE_CLOUD_CONNECTORS_GCP` | `false` | Allow GCP connector link. |

---

## 3) Privacy / Compliance

### Raw Tokens and Secrets — Verified

| Location | Storage | Status |
|----------|---------|--------|
| **Connector credentials** | `lead.fullPayload.connectors[type].encryptedCredRef` | ✓ AES-256-GCM via `lib/security/credentialVault.ts`; never raw keys. |
| **GitHub token** | `encryptedCredRef` | ✓ Encrypted before persist. |
| **AWS/Azure/GCP creds** | `encryptedCredRef` | ✓ Encrypted before persist. |
| **Starter token** | Signed JWT-style; stored nowhere | ✓ Created per-request; not persisted. |
| **User password** | `User.passwordHash` | ✓ bcrypt hash only. |

### Files to Audit (no raw secrets)

| File | Check |
|------|-------|
| `lib/connectors/link/route.ts:96–154` | ✓ Writes `encryptedCredRef` only; no raw creds in DB. |
| `lib/plugins/credentials.ts:35–43` | ✓ Reads `encryptedCredRef`, decrypts in memory; never logs plain creds. |
| `lib/security/credentialVault.ts` | ✓ Encrypt/decrypt only; no logging of plaintext. |

### Logging — No Secrets

| File | Change |
|------|--------|
| `app/api/webhooks/stripe/route.ts` | Removed `console.log` with email; removed `err` from error log. |
| `app/api/contact/route.ts:90` | Replace `console.log(..., { name, email, message })` with generic log when RESEND not configured. |
| `app/api/visionxix-ai-chat/route.ts:78–82` | Reduce to single `console.error` with message only (no stack/status/code). |

### Retention Defaults — Documented

| Item | File | Default |
|------|------|---------|
| **Lead retention** | `scripts/cleanupExpiredLeads.ts` | `LEAD_DATA_RETENTION_DAYS=365`; deletes leads older than cutoff. Exceptions: `userId` exists or `tier === "enterprise"`. |
| **AuditLog** | Prisma schema | No automatic purge; consider periodic cleanup policy. |
| **ExecutionLog** | Prisma schema | No automatic purge. |

### EncryptedCredRef Usage — Verified

| Flow | File | Usage |
|------|------|-------|
| Link connector | `app/api/connectors/link/route.ts` | `encryptCredential(cred)` → store as `encryptedCredRef`. |
| Get AWS creds | `lib/plugins/credentials.ts` | `decryptCredential(aws.encryptedCredRef)` → use in memory only. |
| Remediate (GitHub) | `app/api/automation/remediate/route.ts` | `decryptCredential(ghConn.encryptedCredRef)` → use for API call; not logged. |

---

## 4) Exact File Paths to Change (Remaining)

| # | File | Change |
|---|------|--------|
| 1 | `.env.example` | Add `# STRIPE_PRICES_ENTERPRISE=price_xxx` |
| 2 | `app/api/contact/route.ts:90` | Replace `console.log("Contact form submission...", { name, email, company, topic, message })` with `console.warn("[Contact] RESEND_API_KEY not configured; submission not sent")` |
| 3 | `app/api/visionxix-ai-chat/route.ts:78–82` | Replace multi-line `console.error` with single `console.error("[VisionXIX AI Chat]", err?.message ?? String(e))` |

---

## 5) Summary

| Category | Status |
|----------|--------|
| Stripe lifecycle | ✓ Plan-debug page, webhook event logging, enterprise price mapping added |
| Feature flags | ✓ Plugins, connectors, deploy options properly gated |
| Privacy | ✓ encryptedCredRef used; no raw secrets stored; retention defaults documented |
| Logging | Minor: contact + visionxix-ai-chat logs to sanitize (see §4) |
