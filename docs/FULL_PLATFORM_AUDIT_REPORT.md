# Full Platform Audit Report

**Vision XIX Labs — Internal Audit**  
**Date:** February 2025  
**Scope:** Architecture, product, UX, API, data model, security, performance, monetization, technical debt

---

## Executive Summary

Vision XIX Labs runs a multi-product platform: **AI Website Builder** (request → thank-you), **AI Cloud Studio** (cloud-studio → result), **Axiom Cloud Operator** (cloud-operator with tiers), **Vision XIX AI** (chat/product), **Bots & Assistants**, and marketing/solutions pages. The platform has grown through incremental phases (Phases 3–9) with consistent patterns (async engine, starter token, tier gating) but **no unified schema, shared types, or consistent product narrative**.

**Critical findings:**
- **fullPayload** is a schema-less JSON blob cast ad hoc in 50+ files.
- **Two parallel AI website starter implementations** (lib/aiWebsiteStarter.ts vs lib/leads/aiWebsiteStarter.ts).
- **No foreign keys** on AxiomScoreSnapshot, RecurringAnalysis → Lead; referential integrity not enforced.
- **Rate limiting** is inconsistent: website builder trigger has none; Cloud Operator has token + tiered.
- **User.plan** (starter/growth/scale) and Operator tiers (free/pro/growth/enterprise) are not reconciled with Stripe.
- **43 frontend routes** with overlapping narratives (cloud-review vs free-review vs cloud-operator).
- **Observability** is console-only; Cloud Studio and website builder do not emit engine events.
- **Maintainability: 52/100** — high coupling, duplicated logic, implicit assumptions.
- **Platform maturity: 48/100** — basic audit/connectors/encryption; no retention policy, no unified error handling.

---

## 1. System Map

### 1.1 Product Flows

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ MARKETING / INFO PAGES                                                               │
│ /, /services, /visionxix-ai, /ai-solutions, /cloud-solutions, /enterprise-readiness, │
│ /insights, /contact, /press, /terms, /privacy, /case-studies                         │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ AI WEBSITE BUILDER (source: website-request)                                         │
│ /request → POST /api/leads → /request/thank-you?token=                               │
│   → fire-and-forget POST /api/leads/trigger                                          │
│   → poll /api/leads/status until ready → display                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ AI CLOUD STUDIO (source: cloud-studio)                                               │
│ /cloud-studio → POST /api/cloud-studio/submit → redirect /cloud-studio/result?token= │
│   → fire-and-forget POST /api/cloud-studio/trigger                                   │
│   → poll /api/cloud-studio/status until ready                                        │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ AXIOM CLOUD OPERATOR (source: cloud-operator)                                        │
│ /cloud-operator?token= → POST /api/cloud-operator/submit (if new)                    │
│   → fire-and-forget POST /api/cloud-operator/trigger                                 │
│   → poll /api/cloud-operator/status until ready → tabs: Overview, Roadmap, etc.      │
│   → Tier-gated: strategic brief, board deck, export, connectors                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ADMIN                                                                                │
│ /admin/leads (website-request leads), /admin/enterprise-dashboard (cloud-operator)   │
│ Require: session + ADMIN_EMAILS                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 API Topology

| Domain           | Submit                | Trigger              | Status               | Other                                      |
|-----------------|------------------------|----------------------|----------------------|--------------------------------------------|
| Leads (website) | POST /api/leads        | POST /api/leads/trigger | GET /api/leads/status | generate, deploy-preview, publish, starter |
| Cloud Studio    | POST /api/cloud-studio/submit | POST /api/cloud-studio/trigger | GET /api/cloud-studio/status | — |
| Cloud Operator  | POST /api/cloud-operator/submit | POST /api/cloud-operator/trigger | GET /api/cloud-operator/status | export, unlock, board-deck, strategic-brief, run-recurring, send-report |
| Billing         | —                      | —                    | —                    | create-checkout-session, create-portal-session |
| Connectors      | POST /api/connectors/link | —                  | GET /api/connectors/status | — |
| Admin           | —                      | —                    | —                    | leads, leads/[id], enterprise-dashboard    |

### 1.3 Data Model (Prisma)

```
User ─┬─ Bot ─── KnowledgeSource
      │
Lead (fullPayload: Json, source, status)
  │
  ├── AxiomScoreSnapshot (leadId, no FK)
  └── RecurringAnalysis (leadId, no FK)

AuditLog (leadId?)
SalesPipelineSnapshot (standalone)
```

---

## 2. Strengths

### 2.1 Architecture

- **Async engine pattern** (`lib/async/engineRunner.ts`): idempotent, tier-aware, shared for operator and studio.
- **Status builder** (`lib/async/statusBuilder.ts`): unified output shape and tier gating.
- **Starter token** (`lib/starterToken.ts`): opaque, signed, 7-day expiry; simple and effective.
- **Scoring registry** (`lib/axiom/scoringRegistry.ts`): single `SCORING_VERSION = "1.2.0"` for audit.
- **Explainability** (`lib/axiom/explainability.ts`): score breakdown for all tiers.
- **Credential encryption** (`lib/security/credentialVault.ts`): AES-256-GCM, per-record IV.
- **Connector isolation**: tier gating (GitHub free; AWS/Azure/GCP Pro+); credentials stored encrypted in fullPayload.

### 2.2 Product

- **Cloud Operator** has a clear flow: submit → trigger → status → tabs (Overview, Roadmap, Playbooks, Strategic, Trends, Export).
- **Tier gating** is explicit: `canViewTechnicalOutputs`, `canDownloadConfigs`, `hasEnterpriseEngagement`.
- **Phase-based evolution** (3–9) with verification docs; changes are additive and documented.

### 2.3 Monetization

- **Unlock flow** (`POST /api/cloud-operator/unlock`): one-time roadmap unlock with expiry.
- **Stripe integration**: checkout, portal, webhook for subscription lifecycle.
- **Deal signals** and **upgrade advisor** provide psychological framing for upgrades.

---

## 3. Weaknesses

### 3.1 Frontend

| Issue | Detail |
|-------|--------|
| **Naming inconsistency** | "Website Request", "Get a Quote", "AI Website Builder" used interchangeably. |
| **Overlapping products** | cloud-review (human-led), free-review (contact form), cloud-operator (automated Axiom) — unclear differentiation. |
| **Dead/indirect routes** | /cloud-studio/result, /visionxix-ai-assistant, /internal/pricing, /embed/[botId] not in nav. |
| **Nav overload** | Solutions dropdown has 14 links; Cloud vs Solutions vs Products is ambiguous. |
| **Legacy route live** | "Cloud Review (legacy)" still reachable. |
| **Duplicate CTA** | "Run Axiom Analysis" appears in Products and as primary button. |
| **Admin leads vs enterprise dashboard** | Admin leads = website-request only; enterprise dashboard = cloud-operator. No unified admin view. |

### 3.2 Backend

| Issue | Detail |
|-------|--------|
| **fullPayload schema** | No shared type; cast as `Record<string, unknown>` in 50+ places; keys vary by source. |
| **Rate limiting gaps** | Website builder trigger has no rate limit; Cloud Operator has token + tiered; Cloud Studio has both. |
| **Error handling** | No shared error type; inconsistent `{ error: string }` vs status codes. |
| **Tier mapping** | User.plan (starter/growth/scale) vs Operator (free/pro/growth/enterprise) vs Stripe prices — unclear mapping. |
| **Engine observability** | Only Cloud Operator emits ENGINE_TRIGGERED/COMPLETED/FAILED; Cloud Studio and website builder do not. |
| **Audit scope** | Audit for connector, export, roadmap, drift; no audit for login, checkout, tier upgrade. |
| **Recurring job** | run-recurring has no Tier gating for who can create RecurringAnalysis; tier rules exist but setup flow is unclear. |

### 3.3 Data Model

| Issue | Detail |
|-------|--------|
| **Missing FKs** | AxiomScoreSnapshot.leadId, RecurringAnalysis.leadId — no `@relation`; orphan records possible. |
| **fullPayload extensibility** | New keys added without schema; migration and versioning are ad hoc. |
| **Snapshot fragmentation** | AxiomScoreSnapshot (operator), SalesPipelineSnapshot (aggregate); no RecurringAnalysis ↔ Lead FK. |
| **Migration dates** | Mix of 2025 and 2026; ordering and naming are inconsistent. |
| **Lead status** | Status values (`created`, `package_generating`, etc.) are string literals; no enum. |

### 3.4 AI & Scoring

| Issue | Detail |
|-------|--------|
| **Dual starter implementations** | lib/aiWebsiteStarter.ts vs lib/leads/aiWebsiteStarter.ts; AiStarterPackage vs AIStarterPackage naming. |
| **OpenAI fallbacks** | strategicBrief has deterministic fallback; other LLM calls may not. |
| **Model selection** | Uses `MODEL_NAME` env or default gpt-4o-mini; no per-flow model selection. |

### 3.5 Monetization

| Issue | Detail |
|-------|--------|
| **Unlock vs Stripe** | Unlock is payload-only; no link to Stripe session or User.plan. |
| **Plan vs tier** | User.plan (starter/growth/scale) and Operator tier (free/pro/growth/enterprise) not reconciled. |
| **Enterprise funnel** | Enterprise dashboard exists; no explicit enterprise signup flow or tier upgrade path. |

---

## 4. Architectural Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **fullPayload schema drift** | High | New features add keys without validation; typos and structural changes cause silent failures. |
| **Orphan snapshots** | Medium | Deleted leads leave AxiomScoreSnapshot and RecurringAnalysis rows; no cascade. |
| **Engine divergence** | Medium | Cloud Operator uses full engine + drift + playbooks; Cloud Studio is simpler; website builder different again — shared abstractions are partial. |
| **Token lifecycle** | Medium | Starter token 7-day expiry; no refresh; leads may lose access after expiry. |
| **In-memory rate limit** | Medium | Rate limits use in-memory store; not distributed; resets on restart. |
| **Concurrent payload writes** | Medium | Multiple routes read-modify-write fullPayload; race conditions possible. |

---

## 5. Product Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **Narrative confusion** | High | Multiple "review" and "cloud" products; unclear which is flagship. |
| **Legacy routes** | Medium | Cloud Review (legacy) still active; confuses users and support. |
| **Admin fragmentation** | Medium | /admin/leads for website; /admin/enterprise-dashboard for cloud-operator; no unified CRM. |
| **Free tier ceiling** | Medium | Free tier sees limited output; upgrade path and value prop could be clearer. |

---

## 6. Scalability Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **Rate limit store** | Medium | In-memory; single-instance only. |
| **Polling load** | Medium | Thank-you and result pages poll status; no backoff or cap documented. |
| **fullPayload size** | Medium | JSON blob grows with axiomResult, playbooks, strategicBrief, dealSignals; no size limit. |
| **Recurring job** | Low | run-recurring processes 50 per run; SalesPipelineSnapshot aggregates all cloud-operator leads — O(n) per run. |
| **No caching** | Low | Strategic brief, board deck generated on demand; no CDN or caching layer. |

---

## 7. Security Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **Admin check** | Medium | requireAdmin checks ADMIN_EMAILS; layout checks session only; non-admin can load admin pages, APIs return 403. |
| **Token in URL** | Low | Starter token in query string; logged in server logs; consider POST body for sensitive flows. |
| **Cron auth** | Low | run-recurring uses CRON_SECRET; env must be set. |
| **Credential storage** | Low | Connectors use credentialVault; key from CREDENTIAL_ENCRYPTION_KEY or STARTER_TOKEN_SECRET fallback — key management is critical. |
| **No CSRF** | Low | API routes assume same-origin or trusted client; no explicit CSRF for state-changing ops. |
| **fullPayload PII** | Medium | fullPayload may contain email, form data, operator profile; no documented retention or anonymization. |

---

## 8. UX Clarity Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **Cognitive load** | High | 14 solutions links; Cloud/Solutions/Products overlap. |
| **Hidden flows** | Medium | cloud-studio/result, request/thank-you reached only via redirect; not discoverable. |
| **Tier messaging** | Medium | Upgrade prompts vary; upgradeAdvisor improves framing but not all upgrade surfaces use it. |
| **Error states** | Medium | Generic "Failed" or "Please try again" with limited guidance. |
| **Mobile nav** | Low | Mirrors desktop; 14-item Solutions list may be unwieldy on small screens. |

---

## 9. Revenue Risks

| Risk | Severity | Description |
|------|----------|-------------|
| **Unlock vs subscription** | High | One-time unlock and Stripe subscription are separate; no clear path from unlock → subscription. |
| **Plan/tier mismatch** | High | User.plan (starter/growth/scale) and Operator tier (free/pro/growth/enterprise) not aligned. |
| **Enterprise funnel** | Medium | Enterprise dashboard for sales; no self-serve enterprise signup or pricing. |
| **Upgrade surface** | Low | upgradeAdvisor provides good framing; adoption across all upgrade prompts is incomplete. |

---

## 10. Maintainability

### 10.1 Coupling

- **fullPayload** is the central integration point; 50+ files touch it.
- **statusBuilder** depends on operator/studio/website-specific logic; engine-specific branches.
- **Tier resolvers** duplicated: cloudOperator/pricing, cloudStudio/pricing, websiteBuildPricing.

### 10.2 Duplication

- **Two AI website starter packages**: lib/aiWebsiteStarter.ts and lib/leads/aiWebsiteStarter.ts.
- **fullPayload casting**: same pattern repeated everywhere.
- **Tier checks**: canViewTechnicalOutputs, canDownloadConfigs, etc., scattered across routes.
- **Profile extraction**: operatorProfile, operatorScores, axiomResult extracted with similar code in many routes.

### 10.3 Implicit Assumptions

- Lead.source matches engine type (cloud-operator, cloud-studio, website-request).
- fullPayload.axiomResult exists when Cloud Operator has run.
- fullPayload.outputStatus or engine.outputStatus drives polling.
- ADMIN_EMAILS is set for admin access.
- Stripe price IDs map to plans; mapping in webhook handler.
- CRON_SECRET required for run-recurring.

### 10.4 Fragile Dependencies

- OpenAI API key required for strategic brief; deterministic fallback if missing.
- Resend for send-report; 503 if RESEND_API_KEY not set.
- archiver for export zip; module may be missing (TypeScript error in build).
- Prisma migrations depend on DATABASE_URL format.

### 10.5 Maintainability Score: **52/100**

- **Strengths:** Phase docs, scoring version, shared engine pattern, explainability.
- **Weaknesses:** Dual starter implementations, schema-less fullPayload, 50+ cast sites, tier logic fragmentation, missing FKs, inconsistent rate limiting.

---

## 11. Platform Maturity

### 11.1 Observability

- **Events:** lib/observability/events.ts — console.info(JSON.stringify).
- **Scope:** Cloud Operator only; Cloud Studio and website builder do not emit engine events.
- **No:** structured logging, tracing, metrics, alerting.

### 11.2 Audit Logging

- **Scope:** connector linked, export downloaded, implementation requested, roadmap generated, drift detected.
- **Missing:** login, logout, checkout, tier upgrade, admin actions.
- **Storage:** AuditLog table; no retention policy.

### 11.3 Data Retention

- **Lead:** no documented retention; fullPayload kept indefinitely.
- **AxiomScoreSnapshot:** no retention policy.
- **AuditLog:** no retention policy.
- **RecurringAnalysis:** no cleanup of disabled/stale records.
- **scripts/cleanupExpiredLeads.ts** exists; usage and schedule unclear.

### 11.4 Encryption

- **Credentials:** AES-256-GCM via credentialVault.
- **Key management:** CREDENTIAL_ENCRYPTION_KEY or STARTER_TOKEN_SECRET; no key rotation.
- **At rest:** database depends on provider; no application-level encryption for fullPayload.

### 11.5 Connector Isolation

- **Tier gating:** GitHub free; AWS/Azure/GCP Pro+.
- **Storage:** fullPayload.connectors[type]; credentials encrypted.
- **Validation:** Connector-specific validation in lib/connectors/*.

### 11.6 Platform Maturity Score: **48/100**

- **Strengths:** AuditLog, credential encryption, connector isolation, tier gating.
- **Weaknesses:** Console-only observability, partial audit coverage, no retention policy, no key rotation, no distributed rate limiting.

---

## 12. Summary Tables

### 12.1 Route Inventory (Frontend)

| Route | Purpose | In Nav |
|-------|---------|--------|
| / | Home | — |
| /cloud-operator | Axiom Cloud Operator | Products |
| /cloud-studio | AI Cloud Studio | Products (AI Website Builder adjacent) |
| /cloud-studio/result | Cloud Studio result (token) | No |
| /request | AI Website Builder | Solutions, Products |
| /request/thank-you | Post-request (token) | No |
| /visionxix-ai | Vision XIX AI | Products |
| /visionxix-ai/pricing | Pricing | Solutions |
| /visionxix-ai/features | Features | Solutions |
| /dashboard | Bots & Assistants | Products |
| /admin/leads | Website leads | — |
| /admin/enterprise-dashboard | Cloud Operator sales | — |
| /free-review | Free Review (human) | Solutions |
| /cloud-review | Cloud Review (legacy) | Solutions |
| /internal/pricing | Internal pricing | No |
| /visionxix-ai-assistant | AI assistant | No |
| /embed/[botId] | Embed bot | No |
| + 26 marketing/solutions pages | — | Various |

### 12.2 API Rate Limiting Coverage

| Route | Token Limit | Tiered Limit |
|-------|-------------|--------------|
| /api/cloud-operator/submit | — | Yes (free) |
| /api/cloud-operator/trigger | Yes | Yes |
| /api/cloud-studio/submit | — | Yes (free) |
| /api/cloud-studio/trigger | Yes | No |
| /api/leads/trigger | — | No |
| /api/leads/[id]/preview/update | Yes | — |
| /api/connectors/link | — | Yes |
| Others | — | — |

### 12.3 fullPayload Keys (by source)

| Source | Key examples |
|--------|--------------|
| website-request | form, aiPackage, previewUrl, productionUrl, engine, outputStatus |
| cloud-operator | operatorProfile, operatorOutput, axiomResult, axiomScores, axiomPlan, engine, unlock, connectors, tags |
| cloud-studio | operatorProfile, axiomResult, output, cloudIntelligence, outputStatus |

---

## 13. Recommendations (Observations Only)

*No implementation changes suggested per audit scope. The following are observation-only.*

1. **Schema fullPayload:** Introduce a versioned, source-specific schema (e.g., Zod) and validate on write.
2. **Add FKs:** AxiomScoreSnapshot, RecurringAnalysis → Lead with onDelete Cascade or Restrict.
3. **Unify starter packages:** Single implementation; deprecate duplicate.
4. **Reconcile tiers:** Map User.plan ↔ Operator tier ↔ Stripe; document in one place.
5. **Rate limit website trigger:** Apply token or tiered limit to /api/leads/trigger.
6. **Expand observability:** Emit engine events for Cloud Studio and website builder; add structured logging.
7. **Audit expansion:** Log login, checkout, tier upgrade, admin actions.
8. **Retention policy:** Define and implement retention for Lead, AxiomScoreSnapshot, AuditLog.
9. **Simplify nav:** Reduce Solutions to 5–7; clarify Cloud vs Products.
10. **Deprecate or remove:** Cloud Review (legacy); document internal/pricing purpose or gate.

---

**End of Report**
