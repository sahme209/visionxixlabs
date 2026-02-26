# Master Structural Stabilization & Monetization Alignment — Summary

**Date:** February 2025  
**Scope:** Structural cleanup and unification. No new features. No breaking changes.

---

## 1. Files Modified

| Area | Files |
|------|-------|
| **Tier system** | lib/pricing/unifiedTier.ts (new), lib/cloudOperator/pricing.ts |
| **Website starter** | lib/websiteStarter/engine.ts (new), app/api/leads/trigger/route.ts, app/api/leads/[id]/generate/route.ts, app/api/leads/[id]/preview/update/route.ts, app/api/leads/[leadId]/starter/generate/route.ts, app/api/admin/leads/[id]/starter/route.ts, app/api/leads/[leadId]/starter/download/route.ts, lib/deploy/provider.ts, lib/previewDeploy.ts, lib/scaffoldGenerator.ts, lib/leads/scaffoldGenerator.ts, app/api/leads/[id]/deploy-preview/route.ts, app/api/leads/[id]/publish/route.ts, app/api/admin/leads/[id]/scaffold/route.ts |
| **Prisma** | prisma/schema.prisma, prisma/migrations/20250226210000_structural_stabilization_fks/migration.sql |
| **fullPayload** | lib/schema/fullPayloadSchema.ts (new) |
| **Rate limit** | app/api/leads/trigger/route.ts (added checkRateLimit) |
| **Cloud review** | next.config.ts (redirect /cloud-review → /free-review), components/Navigation.tsx |
| **Navigation** | components/Navigation.tsx (Products → Axiom, removed cloud-review, removed duplicate Run Axiom, consolidated structure) |
| **Observability** | lib/observability/events.ts (unifiedTier, scoringVersion), app/api/cloud-operator/trigger/route.ts, app/api/cloud-studio/trigger/route.ts, app/api/leads/trigger/route.ts |

---

## 2. Tier Mapping Logic

**lib/pricing/unifiedTier.ts:**

- `UnifiedTier = "free" | "pro" | "growth" | "enterprise"`
- `userPlanToUnified(plan)`: starter → free, growth → growth, scale → enterprise
- `websiteBuilderTierToUnified(tier)`: starter → free, professional/pro → pro, enterprise/done_for_you → enterprise
- `cloudStudioTierToUnified(tier)`: free → free, professional/pro → pro, enterprise → enterprise
- `operatorTierToUnified(tier)`: free → free, pro/professional → pro, growth → growth, enterprise → enterprise
- `stripePriceToUnified(priceId)`: uses STRIPE_PRICES_STARTER/GROWTH/SCALE env
- `resolveUnifiedTierForLead(rawTier, fullPayload)`: base operator tier; if free + valid roadmap unlock → pro

---

## 3. Schema Validation Coverage

**lib/schema/fullPayloadSchema.ts:**

- `axiomScoresSchema`: infrastructureScore, estimatedAnnualSavings, riskExposureLevel, deploymentFrictionIndex, etc.
- `engineSchema`: scoringVersion, outputStatus, engineName, updatedAt
- `axiomResultSchema`: scores, plan, driftSignals, dealSignals, playbooks, quality, policyPack, explainability, strategicBrief
- `fullPayloadSchema`: context, engine, axiomResult, axiomScores, scoringVersion
- `validateFullPayloadOnWrite(payload)`: throws on invalid
- `parseFullPayloadOnRead(payload)`: returns validated or null for legacy

**Not yet enforced:** Routes still cast fullPayload ad hoc. Schema is available for gradual adoption.

---

## 4. FK Constraints Added

- **AxiomScoreSnapshot.leadId** → Lead.id (onDelete: Cascade)
- **RecurringAnalysis.leadId** → Lead.id (onDelete: Cascade)
- **Lead** model: added `AxiomScoreSnapshots` and `RecurringAnalyses` relations

**Migration:** `prisma/migrations/20250226210000_structural_stabilization_fks/migration.sql`

---

## 5. Skipped Refactors and Rationale

| Item | Rationale |
|------|-----------|
| **Rename public tier labels** | Task: "Do not rename public tier labels yet" |
| **Wire fullPayload validation on all writes** | Task: "Do NOT enforce strict migration yet" — schema created, gradual adoption |
| **Remove lib/aiWebsiteStarter.ts and lib/leads/aiWebsiteStarter.ts** | Both remain as implementations; engine.ts delegates to them. No deletion to avoid risk. |
| **Unify cloudOperator pricing to use UnifiedTier exclusively** | Added toUnifiedTier helper; existing functions kept for backward compatibility |
| **Cloud Studio route removal** | Task: "No removing Cloud Studio" — route intact, not in primary nav |
| **Stripe flow changes** | Task: "No breaking Stripe flow" — no changes |
| **Scoring math changes** | Task: "No altering scoring math" — unchanged |

---

## 6. Observability

All engines now emit:

- `ENGINE_TRIGGERED` (leadId, engineName, tier, unifiedTier, scoringVersion if applicable)
- `ENGINE_COMPLETED` (same)
- `ENGINE_FAILED` (leadId, engineName, error, unifiedTier)

Engines: cloud-operator, cloud-studio, website-builder.

---

## 7. Navigation Structure (Preparation)

- **Axiom** (renamed from Products): Run Axiom Analysis, AI Website Builder, Vision XIX AI, Bots & Assistants
- **Solutions**: unchanged (cloud-review removed)
- **Insights**: unchanged
- **Company**: About
- **Press**: separate link
- **Run Axiom** (CTA): single primary CTA; duplicate removed
- Cloud Review (legacy) removed from nav; redirect to /free-review
