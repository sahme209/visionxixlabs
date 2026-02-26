# Axiom Trending Verification

## Phase 4 — Persistent Trend History

### 1) Prisma Migration

- **Model:** `AxiomScoreSnapshot`
- **Migration:** `prisma/migrations/20250226120000_add_axiom_score_snapshot/migration.sql`

```prisma
model AxiomScoreSnapshot {
  id        String   @id @default(cuid())
  leadId    String
  createdAt DateTime @default(now())
  tier      String
  provider  String?
  infrastructureScore     Int?
  estimatedAnnualSavings  Int?
  riskExposureLevel       String?
  deploymentFrictionIndex Int?
  complexityTier          String?
  automationReadinessScore Int?
  raw Json?
  @@index([leadId])
}
```

### 2) Snapshot Insertion

| Trigger | When | Behavior |
|---------|------|----------|
| `/api/cloud-operator/trigger` | After successful generation | Inserts one snapshot row with axiomScores + raw operatorProfile |
| `/api/cloud-studio/trigger` | After successful generation, **only if** `axiomScores` exists | Inserts one snapshot row with axiomScores + raw serviceType/form |

### 3) Status Trend Exposure (Cloud Operator)

| Tier | trendHistory |
|------|--------------|
| Free | Not returned |
| Pro | `lastDelta: { scoreDelta, savingsDelta }` (previous vs current snapshot) |
| Growth+ | Last 10 snapshots as array `[{ id, createdAt, tier, provider, infrastructureScore, ... }]` |

### 4) Files Modified

- `prisma/schema.prisma` — added AxiomScoreSnapshot model
- `lib/axiom/snapshotService.ts` — new `insertAxiomSnapshot()`
- `app/api/cloud-operator/trigger/route.ts` — inserts snapshot after success
- `app/api/cloud-studio/trigger/route.ts` — inserts snapshot after success (if axiomScores)
- `app/api/cloud-operator/status/route.ts` — loads snapshots, returns trendHistory with tier gating
