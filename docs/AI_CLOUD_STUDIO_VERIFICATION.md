# AI Cloud Studio — Verification

## Enhancement: Cloud Intelligence Scoring (files modified)

| File | Change |
|------|--------|
| `lib/cloudStudio/scoring.ts` | **Created** — `computeCloudIntelligence(serviceType, form, output)`; deterministic rules; returns CloudIntelligence. |
| `app/api/cloud-studio/trigger/route.ts` | After AI output, call `computeCloudIntelligence`, store in `fullPayload.cloudIntelligence`. |
| `app/api/cloud-studio/status/route.ts` | Include `cloudIntelligence` in response. |
| `app/cloud-studio/result/page.tsx` | Score card (maturity, optimization, risk, savings, tier); Enterprise = "Strategic Optimization Recommended"; Self-Serve = upgrade suggestions only. |
| `docs/AI_CLOUD_STUDIO_VERIFICATION.md` | Scoring logic summary and rules. |

---

## Files Created (initial)

| File | Purpose |
|------|---------|
| `lib/cloudStudio/types.ts` | Service types, form types, output type, tier definitions |
| `lib/cloudStudio/pricing.ts` | canViewFullOutput, canDownload, isFreeTier (tier gating) |
| `lib/cloudStudio/prompts.ts` | AI prompt builders per service (CI/CD, cost, security, architecture, networking) |
| `lib/cloudStudio/generate.ts` | generateCloudStudioOutput() — calls OpenAI, returns summary/fullOutput/artifacts |
| `app/api/cloud-studio/submit/route.ts` | POST — create Lead (source: cloud-studio), rate limit, return token |
| `app/api/cloud-studio/trigger/route.ts` | POST ?token= — verify token, generate AI output, store in fullPayload.output |
| `app/api/cloud-studio/status/route.ts` | GET ?token= — return status, summary, fullOutput/artifacts (tier-gated) |
| `app/cloud-studio/page.tsx` | Service selection, structured forms per type, tier choice, submit |
| `app/cloud-studio/result/page.tsx` | Poll status, show summary/full output/artifacts, Request Implementation CTA |

## Service Abstraction Summary

- **Service types:** `cicd` | `cost` | `security` | `architecture` | `networking`
- **Storage:** Lead model, `source: "cloud-studio"`, `fullPayload`: `{ serviceType, form, tier, output, outputStatus }`
- **Token:** Reuses `createStarterToken` / `verifyStarterToken` (same secret, 7-day expiry)
- **Flow:** Submit → redirect to result?token= → trigger POST (fire-and-forget) → poll status → display output
- **No auto-execution:** Output is generated only; “Request Implementation” links to /contact

## AI Prompt Templates Used

- **CI/CD:** `buildCicdPrompt(form, fullOutput)` — Git provider, language/framework, deployment target, repo URL, env vars. Full: JSON with summary, githubActionsYaml, dockerfile, deploymentSteps.
- **Cost:** `buildCostPrompt(form, fullOutput)` — Cloud provider, services used, spend, region. Full: JSON with summary, optimizationReport, reservedInstanceSuggestions, storageTierSuggestions, estimatedSavings.
- **Security:** `buildSecurityPrompt(form, fullOutput)` — Cloud provider, public services, compliance goal. Full: JSON with summary, hardeningChecklist, iamRoleSuggestions, networkSegmentationPlan.
- **Architecture:** `buildArchitecturePrompt(form, fullOutput)` — Cloud provider, app type, traffic estimate, data storage. Full: JSON with summary, mermaidDiagram, serviceBreakdown, scalingStrategy.
- **Networking:** `buildNetworkingPrompt(form, fullOutput)` — Cloud provider, VPC requirements, connectivity, region. Full: JSON with summary, networkDiagram, vpcDesign, connectivitySteps.

Free tier: same prompts but `fullOutput: false` → model returns short summary (plain text or minimal JSON).

## Pricing Enforcement Logic

- **Free:** `isFreeTier("free")` → prompt asks for summary only; `canViewFullOutput` / `canDownload` false → status API does not return fullOutput or artifacts.
- **Professional:** full prompt, fullOutput and artifacts returned, downloadable.
- **Enterprise:** same as Professional; CLOUD_STUDIO_TIERS.enterprise.implementation = true (used for UI only; no schema).

Enforcement is server-side in:
- `lib/cloudStudio/generate.ts` — uses `isFreeTier(tier)` to decide full vs summary prompt.
- `app/api/cloud-studio/status/route.ts` — uses `canViewFullOutput(tier)` and `canDownload(tier)` to include or omit fullOutput and artifacts.

## Cloud Intelligence Scoring Engine

**File:** `lib/cloudStudio/scoring.ts`

Deterministic, rule-based scoring (no AI). Stored in `fullPayload.cloudIntelligence`.

### Outputs

- **Cloud Maturity Score (0–100):** Base 40; +15 if monthly spend ≥ $2k, +10 if ≥ $500; +10 multi-region; +10 strict compliance (SOC 2, HIPAA, PCI); +5 high traffic; +5 many services; +10 security + public exposure; cap 100.
- **Optimization Opportunity:** Cost service only: High if spend ≥ $2k, Medium if ≥ $500, else Low.
- **Risk Level:** High if security + public exposure + compliance; Medium if security + public or architecture + public; else Low.
- **Estimated Annual Savings:** Cost service only; annual = monthly × 12; rate 10% (Low) / 15% (Medium) / 20% (High opportunity); rounded.
- **Complexity Tier:** Enterprise if maturity ≥ 70 or spend ≥ $2k or (multi-region + compliance); Growth if maturity ≥ 45 or spend ≥ $500 or ≥ 4 services; else Self-Serve.

### Rules used

- **Monthly spend:** From cost form `estimatedMonthlySpend` (parsed number).
- **Services used:** From cost `servicesUsed` (comma/semicolon count); architecture/networking inferred from text length.
- **Traffic estimate:** From architecture `trafficEstimate` (keywords: million, 100k → high; 10k → medium).
- **Multi-region:** Region/connectivity fields contain "multi", comma, or "multiple".
- **Public exposure:** Security `publicServices` or architecture app/storage text contains "api", "web", "public".
- **Compliance:** Security `complianceGoal` contains SOC 2, HIPAA, PCI, GDPR, FedRAMP.

### Result page

- **Score card:** Shows maturity score, optimization opportunity, risk level, est. annual savings, complexity tier.
- **Segment = Enterprise:** Show "Strategic Optimization Recommended" with CTA to schedule strategic review.
- **Segment = Self-Serve:** Show upgrade suggestions only (Professional/Enterprise).
- Free-tier upgrade box hidden when segment is Enterprise.

---

## Assumptions

1. **No Prisma schema change:** Cloud Studio uses existing Lead model with `source: "cloud-studio"` and JSON in `fullPayload`.
2. **Placeholder email:** If user omits email, lead is created with `email: "cloud-studio@placeholder.local"` to satisfy non-null email.
3. **Rate limiting:** Submit keyed by IP (`cloud-studio-submit:${ip}`); trigger keyed by token prefix; same in-memory store as preview update (10 req/min).
4. **Artifacts:** Only selected keys (e.g. githubActionsYaml, dockerfile, mermaidDiagram, networkDiagram) are exposed as downloadable files; rest is in fullOutput JSON text.
5. **Request Implementation:** Button links to /contact; no automation or cloud account execution in Phase 1.
6. **Website build:** Unchanged; no edits to /request, thank-you, or website build APIs.
