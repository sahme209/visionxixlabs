# Phase 7 — Enterprise Hardening + Platform Maturity Verification

Phase 7 elevates Axiom from "advanced SaaS tool" to "enterprise-grade infrastructure intelligence platform" through reliability, auditability, versioning, and explainability.

---

## A) Scoring Versioning

| Item | Value |
|------|-------|
| Constant | `SCORING_VERSION = "1.0.0"` |
| Location | `lib/axiom/scoringRegistry.ts` |
| Storage | `fullPayload.engine.scoringVersion` |
| Snapshot | `AxiomScoreSnapshot.scoringVersion` |
| Status | `response.scoringVersion` (executive summary) |

**Example:**
```json
{
  "engine": {
    "outputStatus": "ready",
    "scoringVersion": "1.0.0",
    "engineName": "cloud-operator"
  }
}
```

---

## B) Explainability Layer

**File:** `lib/axiom/explainability.ts`

**Function:** `generateScoreExplanation(profile, scores)`

**Example output:**
```json
{
  "infrastructureScoreBreakdown": [
    { "factor": "Infra Readiness", "weight": 40, "value": 72, "contribution": 28.8 },
    { "factor": "Cost Efficiency", "weight": 20, "value": 65, "contribution": 13 },
    { "factor": "CI/CD Maturity", "weight": 20, "value": 70, "contribution": 14 },
    { "factor": "Risk (inverse)", "weight": 20, "value": 100, "contribution": 20 }
  ],
  "keyDrivers": ["Strong infrastructure readiness baseline", "Security posture is solid"],
  "penalties": [],
  "improvementLevers": ["Optimize cost: reserved capacity, storage tiering, idle cleanup"]
}
```

**Storage:** `fullPayload.axiomResult.explainability`  
**UI:** "Score Breakdown" section in cloud-operator Overview tab

---

## C) Rate Limit Tiers

| Tier | Requests / minute |
|------|-------------------|
| Free / Starter | 5 |
| Pro / Professional | 15 |
| Growth | 30 |
| Enterprise | 60 |

**limitKey:** `${tier}:${ip}`

**Applied to:**
- `/api/cloud-operator/submit` (tier: free at submit)
- `/api/cloud-operator/trigger` (tier from payload)
- `/api/cloud-studio/submit` (tier: free at submit)
- `/api/connectors/link` (tier from payload)

**File:** `lib/rateLimitTiered.ts`

---

## D) Identity Tie-In

| Item | Description |
|------|-------------|
| Lead.userId | Optional `String?` binding to authenticated user |
| Submit | When session exists, stores `lead.userId = session.user.id` |
| GET /api/user/leads | Returns all leads for logged-in user |

**No breaking token flows** — token-based access continues to work without auth.

---

## E) Data Retention Policy

| Env | Default | Description |
|-----|---------|-------------|
| LEAD_DATA_RETENTION_DAYS | 365 | Delete leads older than this |

**Exceptions (never deleted):**
- `tier === "enterprise"`
- `lead.userId` exists

**Script:** `scripts/cleanupExpiredLeads.ts`  
**Audit:** Logs `retention_deleted` to AuditLog before each deletion.

---

## F) Structured Log Output

**File:** `lib/observability/events.ts`

**Events:**
- ENGINE_TRIGGERED
- ENGINE_COMPLETED
- ENGINE_FAILED
- DRIFT_DETECTED
- CONNECTOR_LINKED
- EXPORT_DOWNLOADED
- UPGRADE_INTENT_CREATED

**Sample JSON output:**
```json
{"event":"ENGINE_TRIGGERED","ts":"2025-02-26T12:00:00.000Z","leadId":"clx...","engineName":"cloud-operator","tier":"pro"}
{"event":"ENGINE_COMPLETED","ts":"2025-02-26T12:00:15.000Z","leadId":"clx...","engineName":"cloud-operator","tier":"pro"}
{"event":"DRIFT_DETECTED","ts":"2025-02-26T12:00:16.000Z","leadId":"clx...","signalCount":3}
```

**Format:** JSON only via `console.info`. No `console.log` spam.

---

## G) Files Touched

| Path | Purpose |
|------|---------|
| `lib/axiom/scoringRegistry.ts` | SCORING_VERSION |
| `lib/axiom/explainability.ts` | Score breakdown, key drivers, levers |
| `lib/axiom/snapshotService.ts` | scoringVersion in snapshot |
| `lib/rateLimitTiered.ts` | Tier-based rate limits |
| `lib/observability/events.ts` | Structured events |
| `app/api/cloud-operator/trigger/route.ts` | scoringVersion, explainability, events, tiered rate |
| `app/api/cloud-operator/submit/route.ts` | tiered rate, userId |
| `app/api/cloud-operator/status/route.ts` | scoringVersion, explainability |
| `app/api/cloud-operator/export/route.ts` | eventExportDownloaded |
| `app/api/cloud-studio/submit/route.ts` | tiered rate |
| `app/api/connectors/link/route.ts` | tiered rate, eventConnectorLinked |
| `app/api/user/leads/route.ts` | GET leads for user |
| `scripts/cleanupExpiredLeads.ts` | Retention cleanup |
| `prisma/schema.prisma` | Lead.userId, AxiomScoreSnapshot.scoringVersion |

---

## H) Migration

Run Prisma migration for:
- `AxiomScoreSnapshot.scoringVersion` (String?)
- `Lead.userId` (String?)
