# Vision XIX Labs — Production State Audit

**Date:** 2025-03-02  
**Scope:** Actual code behavior and runtime configuration; no theory.

---

## 1) ENVIRONMENT STATUS

### Required env vars referenced in code

| Env Var | Referenced In | In .env.example | Notes |
|---------|---------------|-----------------|-------|
| `DATABASE_URL` | `prisma/schema.prisma:8`, `app/api/auth/signup/route.ts:6` | ✓ | Required for Prisma |
| `RESEND_API_KEY` | `app/api/contact/route.ts:93`, `lib/agents/contactResolutionTools.ts:50`, etc. | ✓ | Required for emails |
| `RESEND_FROM_EMAIL` | `app/api/contact/route.ts:94`, `lib/agents/contactResolutionTools.ts:56` | ✓ | |
| `CONTACT_EMAIL` | `app/api/contact/route.ts:95` | ✓ | |
| `NEXTAUTH_SECRET` | `lib/auth.ts:7`, `app/api/auth/[...nextauth]/route.ts:10` | ✓ | Required for auth |
| `NEXTAUTH_URL` | `app/api/auth/[...nextauth]/route.ts:11` | ✓ | |
| `OPENAI_API_KEY` | `lib/ai/providers/openai.ts:10`, `lib/ai/orchestrator.ts` | ✓ | At least one AI key required |
| `GEMINI_API_KEY` | `lib/ai/providers/gemini.ts:10` | ✓ | |
| `ANTHROPIC_API_KEY` | `lib/ai/providers/anthropic.ts:10` | ✓ | |
| `STRIPE_SECRET_KEY` | `app/api/webhooks/stripe/route.ts:8`, `app/api/billing/create-checkout-session/route.ts:12` | ✓ | |
| `STRIPE_WEBHOOK_SECRET` | `app/api/webhooks/stripe/route.ts:33` | ✓ | |
| `STRIPE_PRICES_STARTER` | `app/api/webhooks/stripe/route.ts:12`, `lib/entitlements.ts:187` | ✓ | |
| `STRIPE_PRICES_GROWTH` | `app/api/webhooks/stripe/route.ts:13`, `lib/entitlements.ts:188` | ✓ | |
| `STRIPE_PRICES_SCALE` | `app/api/webhooks/stripe/route.ts:14`, `lib/entitlements.ts:189` | ✓ | |
| `STRIPE_PRICES_ENTERPRISE` | `app/api/webhooks/stripe/route.ts:15` | ✓ | |
| `STARTER_TOKEN_SECRET` | `lib/starterToken.ts:3`, `app/api/cloud-operator/submit/route.ts:72`, etc. | ✓ | |
| `CRON_SECRET` | `app/api/agents/run/route.ts:21`, `app/api/cloud-operator/run-recurring/route.ts:15` | ✓ | |
| `ADMIN_EMAILS` | `lib/admin/auth.ts:10` | **MISSING** | Referenced in code, not in .env.example |
| `CREDENTIAL_ENCRYPTION_KEY` | `lib/security/credentialVault.ts:9` | **MISSING** | Falls back to STARTER_TOKEN_SECRET |
| `CONTACT_AGENT_USER_ID` | `lib/agents/contactResolutionTools.ts:13` | ✓ | Optional, defaults to system-contact-agent |
| `ENABLE_CLOUD_CONNECTORS_AWS` | `lib/featureFlags.ts:8` | ✓ | Feature flag |
| `AWS_CONNECTOR_BROKER_*` | `lib/connectors/aws.ts` | ✓ | Required for real AWS connector |
| `VERCEL_TOKEN`, `VERCEL_TEAM_ID` | `lib/deploy/provider.ts:59-60` | ✓ | For deployments |
| `NEXT_PUBLIC_BASE_URL` | `lib/leads/leadEmailService.ts:17` | ✓ | |
| `INTERNAL_PRICING_KEY` | `app/internal/pricing/page.tsx:11` | ✓ | Optional |
| `LEAD_DATA_RETENTION_DAYS` | `scripts/cleanupExpiredLeads.ts:11` | **MISSING** | Optional, defaults 365 |
| `PLUGIN_TIMEOUT_MS` | `lib/execution/pluginEngine.ts:11` | **MISSING** | Optional, defaults 60000 |
| `AI_ORCHESTRATOR_TIMEOUT_MS` | `lib/ai/orchestrator.ts:151` | **MISSING** | Optional |

### Duplicate/conflicting keys

- **STRIPE_PRICE_PRO / STRIPE_PRICE_ID** (`app/api/billing/create-checkout-session/route.ts:71-72`): Used for cloud-operator checkout; single price for all tiers. Webhook uses `STRIPE_PRICES_*` per plan. **MISMATCH:** Checkout sends same price regardless of tier; webhook maps by price ID.

### Verdict

| Item | Status |
|------|--------|
| All required vars in .env.example | **PARTIAL** — ADMIN_EMAILS, CREDENTIAL_ENCRYPTION_KEY missing |
| Duplicate/conflicting keys | **VERIFIED** — create-checkout-session uses single STRIPE_PRICE_PRO; webhook uses STRIPE_PRICES_* per plan |
| Unused env vars | **VERIFIED** — SENDGRID_API_KEY referenced in EMAIL_SETUP.md only; app uses Resend |

---

## 2) BILLING + STRIPE

| Item | Status | File / Line |
|------|--------|-------------|
| Webhook mapping starter/growth/scale/enterprise | **VERIFIED** | `app/api/webhooks/stripe/route.ts:10-20` priceToPlan() |
| Price IDs align with STRIPE_PRICES_* | **VERIFIED** | Same env vars used |
| Plan changes update User.plan | **VERIFIED** | `app/api/webhooks/stripe/route.ts:77-85` (checkout), `98-106` (subscription) |
| Mismatch: checkout uses single price | **VERIFIED** | `app/api/billing/create-checkout-session/route.ts:69-87` — STRIPE_PRICE_PRO or STRIPE_PRICE_ID for all tiers |
| Vision XIX AI pricing page | **PARTIAL** | `app/visionxix-ai/pricing/page.tsx:7-18` — hardcoded fallback Stripe Payment Link URLs; env vars intended |
| Enterprise price mapping | **VERIFIED** | `app/api/webhooks/stripe/route.ts:15,19` — STRIPE_PRICES_ENTERPRISE supported |

---

## 3) AUTH + DATABASE

| Item | Status | File / Line |
|------|--------|-------------|
| DATABASE_URL connectivity | **RUNTIME** | Prisma client uses `env("DATABASE_URL")` — must be set at deploy |
| Prisma schema matches deployed DB | **RUNTIME** | Migrations in `prisma/migrations/`; run `prisma migrate deploy` |
| Models referenced in code | **VERIFIED** | User, Lead, Bot, ExecutionLog, AuditLog, AgentJob, AxiomScoreSnapshot, etc. — all in schema |
| NextAuth config valid | **VERIFIED** | `lib/auth.ts` — CredentialsProvider, bcrypt, prisma User lookup |
| NEXTAUTH_URL required | **VERIFIED** | `app/api/auth/[...nextauth]/route.ts:11` |

---

## 4) AWS CONNECTOR STATUS

| Item | Status | File / Line |
|------|--------|-------------|
| Uses STS AssumeRole | **VERIFIED** | `lib/connectors/aws.ts:191-196` AssumeRoleCommand, DurationSeconds 900 |
| No fallback to AWS_* for tenant execution | **VERIFIED** | `getBrokerCredentialsForTenant()` (`lib/connectors/aws.ts:36-42`) — broker-only; `assumeRoleForCredentials` uses it |
| verifiedAccountId + callerArn stored | **VERIFIED** | `app/api/connectors/link/route.ts:175-182` — connectorsForAws.aws.verifiedAccountId, verifiedCallerArn |
| Invalid roleArn returns invalid status | **VERIFIED** | `lib/connectors/aws.ts:37` validateInput(); `app/api/connectors/link/route.ts:147-156` stores status "invalid" on failure |

---

## 5) AWS IAM SCAN

| Item | Status | File / Line |
|------|--------|-------------|
| Uses real AWS SDK | **VERIFIED** | `lib/plugins/aws/iam-readonly-scan.ts` — IAMClient, ListUsers, ListAccessKeys, GetAccessKeyLastUsed, ListRoles, etc. |
| Results from live AWS data | **VERIFIED** | Creds from `getCredentialProvider().getAWSCredentials()` → assumeRoleForCredentials → real IAM calls |
| ExecutionLog entry created | **VERIFIED** | `lib/execution/pluginEngine.ts:118-130` — prisma.executionLog.create with pluginId |
| No placeholder/mock | **VERIFIED** | No stub data; plugin requires dryRun=true, real creds |

---

## 6) APPLY FIX (Remediation)

| Item | Status | File / Line |
|------|--------|-------------|
| Real AWS API calls | **VERIFIED** | `lib/plugins/aws/disable-unused-access-key.ts:80-86` — UpdateAccessKeyCommand Status=Inactive |
| dryRun vs apply logic | **VERIFIED** | `app/api/execution/run/route.ts:76-82` — dryRun=false only when apply=true for disable plugin |
| rollbackSteps in ExecutionLog | **VERIFIED** | `lib/execution/pluginEngine.ts:157` — rollbackSteps from plugin result.rollbackHints |

---

## 7) CONTACT AUTOMATION

| Item | Status | File / Line |
|------|--------|-------------|
| Agent runs via job queue | **VERIFIED** | `app/api/agents/run/route.ts` — fetches pending AgentJobs, runs runContactResolutionAgent |
| AgentJob model exists | **VERIFIED** | `prisma/schema.prisma:177-194`, migration `20260301120000_add_agent_job` |
| AgentJob created on contact submit | **VERIFIED** | `app/api/contact/route.ts:83-89` |
| No hard-coded response bypass | **VERIFIED** | `lib/agents/contactResolutionAgent.ts` — uses `generate()` TOOL_CALLING, executes tools |
| Actions logged | **VERIFIED** | `logAudit` for agent_completed, agent_failed, agent_ticket_created, agent_followup_sent, agent_report_sent, agent_escalated |

---

## 8) SECURITY

| Item | Status | File / Line |
|------|--------|-------------|
| encryptedCredRef used for connectors | **VERIFIED** | `lib/plugins/credentials.ts:37-41`, `app/api/connectors/link/route.ts`, `app/api/automation/remediate/route.ts:86-97` |
| No raw secrets logged | **VERIFIED** | `app/api/connectors/link/route.ts:239-244` redacts before console.error; `lib/connectors/aws.ts` testBrokerIdentity redacts |
| Admin routes protected | **VERIFIED** | `requireAdmin` in `/api/admin/*`, `/api/leads/list`, `/api/agents/run` (fallback) |
| Rate limiting | **PARTIAL** | `checkRateLimit` / `checkTieredRateLimit` on: connector-link, cloud-operator-trigger, cloud-studio-trigger, leads-trigger, submit, preview-update. **MISSING:** `/api/contact`, `/api/chat`, `/api/visionxix-ai-chat`, `/api/leads` POST |

---

## 9) WEBSITE TRUTH CHECK

| Claim | Location | Implementation | Status |
|-------|----------|----------------|--------|
| "Connect your environment via APIs for real-time analysis" | `app/cloud-operator/page.tsx:1064` | AWS connector uses assume-role; IAM scan uses real SDK. Azure/GCP connectors are stubs. | **PARTIAL** — AWS real; Azure/GCP stub |
| "AI turns your actual inventory, cost data, and config" | `app/cloud-operator/page.tsx:1064` | IAM scan returns real users/roles/findings. Cost data: cost-explorer-summary is placeholder unless enabled. | **PARTIAL** — IAM real; cost placeholder |
| "Execute changes via cloud APIs" | `app/axiom/page.tsx:34` | Disable unused key performs real UpdateAccessKey. GitHub PR in remediate works. | **VERIFIED** |
| "Apply fixes via API" | `app/axiom/page.tsx:61` | aws:disable-unused-access-key, automation/remediate (GitHub) | **VERIFIED** |
| "real execution" | `app/axiom/page.tsx:61` | IAM disable key, GitHub PR | **VERIFIED** |
| "Execution logs and rollback" | `app/axiom/page.tsx:61` | ExecutionLog with rollbackSteps; pluginEngine persists | **VERIFIED** |

---

## OVERALL SYSTEM STATUS: **PARTIALLY READY**

### Blockers for PRODUCTION-READY

1. **Checkout tier mismatch:** `create-checkout-session` uses single STRIPE_PRICE_PRO; should map tier → correct price ID.
2. **ADMIN_EMAILS** not in .env.example — admins cannot access admin routes without it.
3. **Rate limiting gaps:** Contact, chat, leads create endpoints unprotected.
4. **Azure/GCP connectors:** Stub validation (always valid when flag on); no real API integration.
5. **Hardcoded Stripe Payment Links** in `app/visionxix-ai/pricing/page.tsx:9-18` — fallbacks expose URLs in client bundle.

### Verified production-ready components

- AWS connector: STS AssumeRole, broker-only, encryptedCredRef, verifiedAccountId stored
- IAM scan: Real @aws-sdk/client-iam, live data, ExecutionLog
- Disable key remediation: Real UpdateAccessKey, dryRun/apply, rollbackSteps
- Contact agent: AgentJob queue, AI classification, tools, AuditLog
- Stripe webhook: plan mapping, User.plan update, enterprise support
- Auth: NextAuth, credentials, Prisma
- Encrypted credentials, admin protection, secret redaction in connector link
