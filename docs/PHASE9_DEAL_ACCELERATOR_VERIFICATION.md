# Phase 9 — AI Deal Accelerator Verification

This document verifies the Phase 9 AI Deal Accelerator implementation. Axiom now converts infrastructure intelligence into deal acceleration signals for enterprise sales.

---

## 1. Deal Signals Structure

**Module:** `lib/axiom/dealSignals.ts` — `generateDealSignals()`

**Input:**
```typescript
{
  axiomScores: { infrastructureScore?, estimatedAnnualSavings?, riskExposureLevel?, deploymentFrictionIndex?, automationReadinessScore?, complexityTier?, strategicReadinessScore? },
  strategicReadinessScore?: number,
  driftSignals?: { hasDrift?, driftLevel? },
  tier: "free" | "pro" | "growth" | "enterprise",
  organizationSize?: string,
  monthlySpend?: string
}
```

**Output:**
```json
{
  "urgencyLevel": "low" | "medium" | "high" | "critical",
  "expansionProbability": 0-100,
  "enterpriseLikelihood": 0-100,
  "topBusinessDrivers": ["driver1", "driver2"],
  "objectionPrediction": ["objection1", "objection2"],
  "decisionMakerTargets": ["CTO", "CFO"],
  "recommendedSalesAngle": ["angle1", "angle2"],
  "riskOfChurn": "low" | "medium" | "high"
}
```

**Storage:** `fullPayload.axiomResult.dealSignals`

**Deterministic rules:**
- High risk + high spend → high/critical urgency
- Drift detected + growth tier → expansion probability high (75%)
- Low automation readiness + mid spend (15k–50k) → strong Pro upgrade case (70% expansion)
- High savings (>50k) → expansion probability 80%

---

## 2. Enterprise Readiness Index Formula

**Version:** `SCORING_VERSION = "1.2.0"` (lib/axiom/scoringRegistry.ts)

**Module:** `lib/axiom/infrastructureAdvantage.ts` — `computeEnterpriseReadinessIndex()`

**Formula:**
```
EnterpriseReadinessIndex = min(100, max(0, round(raw)))

where raw =
  complianceMaturity    * 0.20  +
  multiRegionComplexity * 0.15  +
  automationReadiness   * 0.25  +
  (100 - driftPenalty)  * 0.10  +
  trendVolatilityAdj    * 0.10  +
  spendScore           * 0.20
```

**Component definitions:**
| Component | Source | Mapping |
|-----------|--------|---------|
| complianceMaturity | complexityTier | Enterprise=70, Growth=60, else=50 |
| multiRegionComplexity | architectureComplexityTier | Enterprise=80, Growth=50, else=30 |
| automationReadiness | axiomScores.automationReadinessScore | 0–100 |
| driftPenalty | driftDetected | true=15, false=0 |
| spendScore | monthlySpendProxy (annualized) | >100k=90, >50k=70, >20k=50, else=30 |

**Storage:** `axiomResult.scores.enterpriseReadinessIndex`

---

## 3. Internal Dashboard Spec

**Route:** `/admin/enterprise-dashboard` (admin-only, requires ADMIN_EMAILS)

**API:** `GET /api/admin/enterprise-dashboard`

**Query filters:**
- `highUrgency=true` — urgency high or critical
- `tier=pro|growth|enterprise|free`
- `driftDetected=true`
- `minSavings=10000` — minimum estimated annual savings

**Columns:**
- Lead (email, name)
- Tier
- Urgency Level (badge)
- Expansion Probability %
- Enterprise Likelihood %
- Estimated Savings
- Drift (icon if detected)
- Follow-up (recommended days, engagement model)
- Tags

**Sort:** By urgency (critical → high → medium → low)

**Sample screenshot spec:**
- Header: "Sales Intelligence" + "Cloud Operator leads with deal signals"
- Filter bar: checkboxes for high urgency, drift; dropdown for tier; input for min savings
- Table with rows for each cloud-operator lead with axiomResult.dealSignals

---

## 4. Upgrade Advisor Example

**Module:** `lib/axiom/upgradeAdvisor.ts` — `recommendUpgrade()`

**Input:**
```typescript
{
  currentTier: "free",
  dealSignals: { enterpriseLikelihood: 25, expansionProbability: 65, urgencyLevel: "medium" },
  axiomScores: { riskExposureLevel: "High", estimatedAnnualSavings: 25000, deploymentFrictionIndex: 70, automationReadinessScore: 35 }
}
```

**Output:**
```json
{
  "recommendedTier": "pro",
  "reasoning": [
    "Roadmap tier unlocks 30-day plan, playbooks, and technical outputs",
    "High risk exposure — Pro tier reveals security recommendations",
    "Estimated $25,000/yr savings — full analysis available in Pro"
  ],
  "urgencyMessage": "Upgrade to Roadmap Tier to reduce risk exposure by ~28% and unlock 3 key optimizations.",
  "expectedValueIncrease": 4250
}
```

**UI usage:** Replace generic "Upgrade to Pro" with `urgencyMessage` (psychological framing).

---

## 5. Tagging Rules

**Module:** `lib/axiom/dealSignals.ts` — `deriveTagsFromDealSignals()`

**Tags:**
| Tag | Condition |
|-----|-----------|
| `high-risk` | riskExposureLevel === "High" |
| `cost-optimization-heavy` | estimatedAnnualSavings > 30000 |
| `ci-cd-weak` | automationReadinessScore < 50 OR deploymentFrictionIndex > 70 |
| `enterprise-candidate` | enterpriseLikelihood > 55 |
| `security-critical` | riskExposureLevel === "High" OR urgencyLevel === "critical" |

**Storage:** `fullPayload.tags` (merged with existing, de-duped)

**Usage:** Admin dashboard filtering, outbound targeting

---

## 6. Objection Predictor (LLM-Light)

**Extension:** `lib/axiom/strategicBrief.ts` — `objectionForecast?: string[]`

**Tier gating:** Pro+ only (Free does not receive objectionForecast)

**Prompt addition:** When tier !== "free", add `"objectionForecast": ["likely objection 1", "likely objection 2"]` to JSON output.

**Deterministic fallback:**
- savings < 5000 → "ROI may be questioned — emphasize risk avoidance"
- friction > 70 → "Implementation effort concerns — offer phased approach"
- Default: "Timing and prioritization — align with current initiatives"

---

## 7. Deal Timeline Estimator

**Module:** `lib/axiom/dealTimeline.ts` — `estimateDealTimeline()`

**Input:** urgencyLevel, enterpriseLikelihood, driftLevel (optional)

**Output:**
```json
{
  "recommendedFollowUpDays": 1-14,
  "expectedSalesCycleLengthDays": 30-90,
  "idealEngagementModel": "self-serve" | "consulting-led" | "enterprise-program"
}
```

**Rules:**
- critical → 1 day follow-up, 30-day cycle
- enterpriseLikelihood > 65 → enterprise-program
- Exposed in internal dashboard only

---

## 8. SalesPipelineSnapshot Model

**Prisma:**
```prisma
model SalesPipelineSnapshot {
  id                    String   @id @default(cuid())
  createdAt             DateTime @default(now())
  highUrgencyCount      Int
  enterpriseLikelihoodAvg Float
  expansionProbabilityAvg Float
  avgStrategicReadiness Float

  @@index([createdAt])
}
```

**Generation:** `POST /api/cloud-operator/run-recurring` (weekly, at end of cron run)

---

## 9. File Reference

| Component | Path |
|-----------|------|
| Deal Signal Engine | lib/axiom/dealSignals.ts |
| Upgrade Advisor | lib/axiom/upgradeAdvisor.ts |
| Deal Timeline | lib/axiom/dealTimeline.ts |
| Enterprise Readiness Index | lib/axiom/infrastructureAdvantage.ts |
| Strategic Brief + objectionForecast | lib/axiom/strategicBrief.ts |
| Scoring Version | lib/axiom/scoringRegistry.ts (1.2.0) |
| Trigger (dealSignals, tags, ERI) | app/api/cloud-operator/trigger/route.ts |
| Status API (dealSignals, ERI, upgrade) | app/api/cloud-operator/status/route.ts |
| Enterprise Dashboard API | app/api/admin/enterprise-dashboard/route.ts |
| Enterprise Dashboard Page | app/admin/enterprise-dashboard/page.tsx |
| Run Recurring (pipeline snapshot) | app/api/cloud-operator/run-recurring/route.ts |
| Strategic Tab UI | app/cloud-operator/page.tsx |

---

## 10. Phase 9 Result

Axiom now:
- Generates infra intelligence
- Generates strategic board intelligence
- Generates financial modeling
- Detects drift
- Tracks trends
- Simulates automation impact
- Recommends upgrade path
- Predicts enterprise readiness
- Flags high-value prospects
- Assists sales automatically

**Infrastructure Intelligence + Revenue Intelligence.**
