# Production Verification Sweep — Prioritized Checklist

**Date:** March 1, 2025  
**Focus:** Misleading UI copy, secret exposure, rate limiting, observability  
**Scope:** Minimal hardening only — no new features

---

## Priority 1 — Misleading Claims in UI Copy

| # | File | Issue | Current Copy | Recommended Fix |
|---|------|-------|--------------|-----------------|
| 1.1 | `app/request/thank-you/page.tsx:248` | "Your AI-built site is live" shown when `previewUrl` exists and `status === "deploy_ready"`. For `managed_pending`, user sees "Your AI site is ready—preview pending" which is correct. However, "live" can imply production; preview is staging. | `Your AI-built site is live` | Change to: `Your AI-built site preview is ready` to avoid implying production/go-live. |
| 1.2 | `app/builder/page.tsx:416` | Claims "email you the live link in 1–3 minutes" — when `managed_pending`, deployment is manual and can take longer. | `we'll deploy to managed cloud with CDN, SSL, and email you the live link in 1–3 minutes` | Qualify: `Typically 1–3 minutes for managed cloud. In some cases our team deploys and we'll email you when ready.` |
| 1.3 | `app/builder/page.tsx:253` | "production-ready" for AI-generated sites before any review | `One prompt, production-ready` | Soften: `One prompt, ready for deployment` |

---

## Priority 2 — Secret Exposure (NEXT_PUBLIC, Logs, API Errors)

### 2.1 NEXT_PUBLIC Usage

| # | File | Issue | Risk | Fix |
|---|------|-------|------|-----|
| 2.1 | `app/visionxix-ai/pricing/page.tsx:9–18` | Hardcoded fallback Stripe Payment Link URLs exposed in client bundle. `NEXT_PUBLIC_*` vars are intended; fallbacks leak live/test links. | LOW — Payment Links are designed to be public; avoid committing production URLs in fallbacks. | Remove hardcoded fallback URLs. Require env vars in production: `process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY ?? ""` — fail gracefully if missing. |
| 2.2 | `lib/leads/leadEmailService.ts:17` | `NEXT_PUBLIC_BASE_URL` — acceptable; base URL is not a secret. | — | No change. |
| 2.3 | `.env.example` | Documents `NEXT_PUBLIC_BASE_URL`, Stripe links. | — | Ensure no real secrets in .env.example. ✓ |

### 2.2 Logs Leaking Secrets / PII

| # | File | Issue | Fix |
|---|------|-------|-----|
| 2.4 | `app/api/visionxix-ai-chat/route.ts:78–82` | Logs full error object, message, stack, status, code. Could include API responses or internal paths. | Log only: `console.error("[VisionXIX AI Chat]", err?.message ?? String(e));` — omit stack/status/code in production or gate behind log level. |
| 2.5 | `app/api/contact/route.ts:90` | When RESEND_API_KEY missing: `console.log(..., { name, email, company, topic, message })` — logs full PII. | Remove message content from log: `console.warn("[Contact] RESEND_API_KEY not configured; submission not sent");` |
| 2.6 | `app/api/webhooks/stripe/route.ts:73` | `console.log("[Stripe Webhook] Updated plan for", email, "to", plan)` — logs PII. | Use session/event id only: `console.info("[Stripe Webhook] Plan updated", { eventId: event.id, plan });` |
| 2.7 | `lib/leads/leadEmailService.ts:112,141` | `console.log(..., data.email)` and internal notification sent. | Use generic: `console.info("[LeadEmailService] Confirmation sent");` — omit email. |
| 2.8 | `app/api/webhooks/stripe/route.ts:43` | `console.error("[Stripe Webhook] Signature verification failed:", err)` — err can include raw payload details. | Log: `console.error("[Stripe Webhook] Signature verification failed");` — do not log `err`. |

### 2.3 API Error Messages Exposing Internals

| # | File | Issue | Fix |
|---|------|-------|-----|
| 2.9 | `app/api/auth/signup/route.ts:7–8,34,36` | Returns `DATABASE_URL`, `Vercel`, `npx prisma migrate deploy` — exposes stack/ops. | Return generic: `"Service temporarily unavailable. Please try again later."` for all 503. |
| 2.10 | `app/api/bots/train/route.ts:89–90` | Returns `err.message` to client (e.g. "HTTP 403", "Request timed out", URL fetch errors). | Return generic: `{ error: "Failed to fetch URL. Please check the URL and try again." }` instead of `msg`. |
| 2.11 | `app/api/execution/run/route.ts:99–101` | Returns `e.message` in 500 response — can leak plugin/credential errors. | Return generic: `{ error: "Execution failed. Please try again." }` — log `e` server-side only. |
| 2.12 | `app/api/visionxix-ai-chat/route.ts:88–89` | Returns "AI provider API key invalid or expired. Please check your configuration." — hints at env config. | Use: `"AI service is unavailable. Please try again later."` for 503. |
| 2.13 | `app/api/contact/route.ts:93` | When RESEND not configured: exposes "RESEND_API_KEY" in error. | Use: `"Email service not configured. Please email us at support@visionxixlabs.com."` |
| 2.14 | `app/api/contact/route.ts:166` | Returns `resend_message` (up to 200 chars) — could leak Resend API details. | Remove `resend_message` from client response; keep only user-facing message. |

---

## Priority 3 — Rate Limiting (Chat / Train / Leads)

| # | Endpoint | File | Status | Fix |
|---|----------|------|--------|-----|
| 3.1 | `POST /api/chat` | `app/api/chat/route.ts` | **None** | Add `checkRateLimit(\`chat:${botId}\`)` or `chat:${ip}` at top of handler. Import from `@/lib/rateLimit`. Return 429 if limited. |
| 3.2 | `POST /api/bots/train` | `app/api/bots/train/route.ts` | **None** | Add `checkRateLimit(\`train:${session.user.id}\`)` after auth. Return 429. |
| 3.3 | `POST /api/leads` | `app/api/leads/route.ts` | **None** | Add IP-based limit: `const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown";` then `checkRateLimit(\`leads-create:${ip}\`)`. Return 429. |
| 3.4 | `GET /api/leads/status` | `app/api/leads/status/route.ts` | **None** | Add token-based: `checkRateLimit(\`leads-status:${token.slice(0,32)}\`)` — already has token. Return 429. |
| 3.5 | `POST /api/leads/trigger` | `app/api/leads/trigger/route.ts` | ✓ Has | — |
| 3.6 | `POST /api/leads/[id]/preview/update` | `app/api/leads/[id]/preview/update/route.ts` | ✓ Has | — |
| 3.7 | `POST /api/visionxix-ai-chat` | `app/api/visionxix-ai-chat/route.ts` | **None** | Add `checkRateLimit(\`visionxix-chat:${ip}\`)` — public endpoint, IP-based. |

**Note:** `lib/rateLimit.ts` uses 10 req/min per key. Consider a separate limit for leads-create (e.g. 5/hr) if needed — can add a second helper or pass a different MAX_REQUESTS.

---

## Priority 4 — Observability (Stripe Webhook + Error Tracking)

### 4.1 Stripe Webhook Logging

| # | File | Issue | Fix |
|---|------|-------|-----|
| 4.1 | `app/api/webhooks/stripe/route.ts` | Events logged via console; no structured webhook event log. | Add structured JSON log on success/failure: `console.info(JSON.stringify({ event: "STRIPE_WEBHOOK", type: event.type, success: !!plan, eventId: event.id }));` — no PII. |
| 4.2 | Same | Error paths log raw `err` which can contain sensitive data. | Replace `console.error(..., e)` with `console.error("[Stripe Webhook] Update failed", { eventId: event?.id });` — never log full error object. |

### 4.2 Error Tracking Hooks

| # | File | Issue | Fix |
|---|------|-------|-----|
| 4.3 | `lib/observability/events.ts` | Uses `console.info` only. No Sentry/Axiom/DataDog ingest. | Add optional hook: `if (typeof process.env.AXIOM_TOKEN !== "undefined") { /* send to Axiom */ }` or document that production should use log aggregation (Vercel logs, Axiom, etc.) to capture console output. **Minimal:** Add a `captureError(err, context)` stub that logs JSON and can be wired to external service later. |
| 4.4 | Critical API routes | No centralized error capture. | Create `lib/observability/captureError.ts`: `export function captureError(err: unknown, context?: Record<string, string>) { console.error(JSON.stringify({ event: "API_ERROR", error: err instanceof Error ? err.message : String(err), ...context })); }` — use in catch blocks instead of raw `console.error(e)`. Enables future Sentry/Axiom integration. |

**Recommendation:** Do not add Sentry/Axiom SDK as a new feature. Instead: (a) ensure all errors log as JSON for aggregation, and (b) add a small `captureError` helper so routes can be updated incrementally. Production logging (Vercel, Axiom) will pick up stdout.

---

## Summary — Minimal Fixes (No New Features)

| Priority | Category | Items | Effort |
|----------|----------|-------|--------|
| 1 | Misleading UI | 3 | Low |
| 2 | Secret exposure | 14 | Medium |
| 3 | Rate limiting | 5 endpoints: chat, train, leads POST, leads status, visionxix-chat | Low |
| 4 | Observability | Stripe webhook JSON logs; `captureError` helper | Low |

### Suggested Implementation Order

1. **P2.9, P2.10, P2.11, P2.12, P2.13, P2.14** — Sanitize API error responses (no internals).
2. **P2.4–P2.8** — Reduce log verbosity; remove PII and raw errors from logs.
3. **P3.1–P3.4, P3.7** — Add rate limiting to chat, train, leads, visionxix-chat.
4. **P1.1–P1.3** — Adjust UI copy.
5. **P4.1–P4.4** — Stripe webhook structured logging; `captureError` helper.
6. **P2.1** — Env-only Stripe links (optional; depends on deployment).
