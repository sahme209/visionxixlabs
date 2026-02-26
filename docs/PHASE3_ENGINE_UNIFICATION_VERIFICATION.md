# Phase 3 — Engine Unification Verification

## 1) Files Created

| File | Purpose |
|------|---------|
| `scripts/token-smoke-test.ts` | Smoke test for token verification: current format, legacy format, invalid token |

## 2) Files Modified

| File | Changes |
|------|---------|
| `lib/async/engineRunner.ts` | Rewritten to Phase 3 API: `getTier`, `generate`, `persist`, `isReady`, `getExistingResult`; idempotency; engine nesting; deep-merge; `engine.outputStatus`, `engine.errorMessage`, `engine.engineName`, `engine.updatedAt` |
| `lib/async/statusBuilder.ts` | Added fallback to `engine.outputStatus`; cloud-studio tier fallback from payload |
| `app/api/cloud-operator/trigger/route.ts` | Refactored to use new `runAsyncLeadEngine` API |
| `app/api/cloud-studio/trigger/route.ts` | Refactored to use new `runAsyncLeadEngine` API |
| `app/api/leads/trigger/route.ts` | Refactored package-generation step to use new `runAsyncLeadEngine` API |
| `app/api/cloud-operator/submit/route.ts` | Added `engine.engineName`, `engine.updatedAt` |
| `app/api/cloud-studio/submit/route.ts` | Added `engine.engineName`, `engine.updatedAt` |
| `app/api/leads/route.ts` | Added `engine.engineName`, `engine.updatedAt` |

## 3) Routes Refactored

| Route | Refactor |
|-------|----------|
| `POST /api/cloud-operator/trigger` | Uses `runAsyncLeadEngine` with getTier, generate, persist, isReady, getExistingResult |
| `POST /api/cloud-studio/trigger` | Uses `runAsyncLeadEngine` with same pattern |
| `POST /api/leads/trigger` | Uses `runAsyncLeadEngine` for AI package generation step only |
| `GET /api/cloud-operator/status` | Uses `buildEngineStatusResponse` (unchanged from prior Phase) |
| `GET /api/cloud-studio/status` | Uses `buildEngineStatusResponse` (unchanged from prior Phase) |
| `GET /api/leads/status` | Uses `buildEngineStatusResponse` (unchanged from prior Phase) |

## 4) Response Shapes (Unchanged)

### Cloud Operator Status — Example Response

```json
{
  "leadId": "clxx...",
  "status": "package_ready",
  "outputStatus": "ready",
  "tier": "pro",
  "canViewTechnicalOutputs": true,
  "canDownloadConfigs": true,
  "hasContinuousReassessment": false,
  "hasEnterpriseEngagement": false,
  "infrastructureReadinessScore": 72,
  "costEfficiencyScore": 65,
  "securityRiskLevel": "Medium",
  "ciCdMaturityScore": 60,
  "architectureComplexity": "Growth",
  "estimatedAnnualSavings": 12000,
  "infrastructureScore": 68,
  "axiomEstimatedAnnualSavings": 12000,
  "riskExposureLevel": "Medium",
  "deploymentFrictionIndex": 40,
  "complexityTier": "Growth",
  "automationReadinessScore": 55,
  "trend": null,
  "recommendedImprovements": ["..."],
  "businessImpactSummary": "...",
  "recommendedNextAction": "...",
  "axiomPlan": { "executiveSummary": {...}, "prioritizedCategories": {...}, "timeSequencedPlan": {...} },
  "launch": {...},
  "optimize": {...},
  "secure": {...},
  "detections": {...}
}
```

### Cloud Studio Status — Example Response

```json
{
  "leadId": "clxx...",
  "status": "package_ready",
  "outputStatus": "ready",
  "serviceType": "cicd",
  "tier": "professional",
  "canViewFullOutput": true,
  "canDownload": true,
  "cloudIntelligence": {...},
  "infrastructureScore": 70,
  "axiomEstimatedAnnualSavings": null,
  "riskExposureLevel": "Medium",
  "deploymentFrictionIndex": 45,
  "complexityTier": "Growth",
  "automationReadinessScore": 58,
  "summary": "...",
  "fullOutput": "...",
  "artifacts": [...],
  "generatedAt": "2025-02-26T...",
  "axiomPlan": {...}
}
```

### Website Builder (Leads) Status — Example Response

```json
{
  "leadId": "clxx...",
  "status": "deploy_ready",
  "outputStatus": "ready",
  "previewUrl": "https://...",
  "packageReady": true,
  "deployReady": true,
  "revisionsRemaining": 3,
  "infrastructure": {
    "cloudProvider": "managed",
    "cdnEnabled": false,
    "sslEnabled": true,
    "cicdEnabled": false,
    "securityLevel": "basic",
    "addOns": []
  },
  "form": {
    "hasDomain": false,
    "domainName": ""
  }
}
```

**No field names were changed.** All existing response fields remain identical.

## 5) Token Backward Compatibility

- **Canonical module:** `lib/starterToken.ts`
- **Re-export wrapper:** `lib/leads/starterToken.ts` re-exports from `lib/starterToken.ts`
- **Current format:** `base64url(leadId).timestamp.signature` — expires in 7 days
- **Legacy format:** `base64url(leadId).base64url(hmac)` — accepted without expiry check (backward compatibility)
- **Expiry rules:** Not changed; existing tokens remain valid
- **Smoke test:** `scripts/token-smoke-test.ts` — run with `STARTER_TOKEN_SECRET=test npx ts-node scripts/token-smoke-test.ts`

## 6) Standardized fullPayload Structure (Additive)

New leads receive nested keys; legacy keys preserved:

```json
{
  "context": { "type": "operator" | "cloud-studio" | "website" },
  "form": {...},
  "engine": {
    "outputStatus": "pending" | "ready" | "failed",
    "engineName": "cloud-operator" | "cloud-studio" | "website-builder",
    "updatedAt": "ISO8601",
    "errorMessage": "optional, on failure",
    "rawOutput": "operator/cloud-studio",
    "scores": "operator/cloud-studio",
    "axiomScores": "operator/cloud-studio",
    "roadmap": "operator/cloud-studio",
    "cloudIntelligence": "cloud-studio",
    "website": { "aiPackage": "..." }
  },
  "infrastructure": {...},
  "metadata": {...},
  "operatorProfile": "...",
  "output": "...",
  "outputStatus": "pending"
}
```

Old records are not migrated; `statusBuilder` falls back to legacy fields.

## 7) Scoring Registry (Centralized)

- `lib/axiom/scoringRegistry.ts` exports:
  - `computeBaseCloudIntelligence`
  - `computeOperatorScores`
  - `computeInfrastructureAdvantageScore`
- Cloud Studio trigger uses `computeBaseCloudIntelligence`, `computeInfrastructureAdvantageScore`
- Cloud Operator trigger uses `computeOperatorScores`, `computeInfrastructureAdvantageScore`
- No scoring math changed; only centralization of imports/exports.

## 8) Skipped Items

| Item | Reason |
|------|--------|
| Unit tests for status builder | Spec says "Add tests where easy but do not block progress"; no existing test setup; script smoke test for token added instead |
| Migration of old records | Spec: "Do NOT migrate old records yet; only ensure new records get nested keys" |
| prisma param in runAsyncLeadEngine | Spec shows `prisma` in params; implementation uses `@/lib/db` directly to match existing pattern; behavior identical |
