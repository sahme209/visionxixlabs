# Phase 9: Playbook Data Model Implementation

**Objective:** Implement the three missing Prisma data models that currently return unavailable states in the release playbook endpoint, enabling real data to flow through the system.

**Current Status:** The release playbook endpoint (`/api/dashboard/release-playbook/[id]`) returns `DataSourceState { available: false; reason: "schema not yet implemented" }` for three critical data sources.

---

## 1. Missing Data Models

### ReleaseExecution
**Purpose:** Track execution history, step progress, and timing for release deployments.

**Proposed Schema:**
```prisma
model ReleaseExecution {
  id                String   @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  releaseId         String   @unique
  release           Release @relation(fields: [releaseId], references: [id])
  
  status            String   // "not_started" | "in_progress" | "completed" | "failed" | "rolled_back"
  startedAt         DateTime?
  completedAt       DateTime?
  rolledBackAt      DateTime?
  
  totalSteps        Int
  completedSteps    Int
  failedSteps       Int
  
  currentStepId     String?  // Reference to active step
  currentStepStatus String?  // "pending" | "running" | "success" | "failed"
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([organizationId, releaseId])
  @@index([organizationId])
  @@index([releaseId])
}
```

**Integration Points:**
- `app/api/dashboard/release-playbook/[id]/route.ts` line 241: Return `stepCount: execution?.totalSteps ?? unavailable`
- `app/api/dashboard/release-playbook/[id]/route.ts` line 260: Return `startedAt: execution?.startedAt ?? null`

---

### ReleaseValidation
**Purpose:** Store validation test plans, results, and evidence for release validation stage.

**Proposed Schema:**
```prisma
model ReleaseValidation {
  id                String   @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  releaseId         String   @unique
  release           Release @relation(fields: [releaseId], references: [id])
  
  status            String   // "not_run" | "in_progress" | "passed" | "failed" | "partial"
  planCount         Int      // Total number of planned tests
  completedCount    Int      // Completed tests
  passedCount       Int      // Passed tests
  failedCount       Int      // Failed tests
  
  startedAt         DateTime?
  completedAt       DateTime?
  
  // Supporting data
  plans             ValidationPlan[]
  results           ValidationResult[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([organizationId, releaseId])
  @@index([organizationId])
  @@index([releaseId])
}

model ValidationPlan {
  id                String   @id @default(cuid())
  validationId      String
  validation        ReleaseValidation @relation(fields: [validationId], references: [id])
  
  name              String
  owner             String   // Team/engineer responsible
  type              String   // "technical" | "functional" | "security" | "performance"
  
  createdAt         DateTime @default(now())
  @@index([validationId])
}

model ValidationResult {
  id                String   @id @default(cuid())
  validationId      String
  validation        ReleaseValidation @relation(fields: [validationId], references: [id])
  planId            String
  
  status            String   // "pending" | "passed" | "failed" | "skipped"
  result            String?  // Error/result details
  
  completedAt       DateTime?
  createdAt         DateTime @default(now())
  @@index([validationId])
}
```

**Integration Points:**
- `app/api/dashboard/release-playbook/[id]/route.ts` line 264: Return `planCount: validation?.planCount ?? unavailable`
- `app/api/dashboard/release-playbook/[id]/route.ts` line 265: Return `resultsCount: validation?.completedCount ?? unavailable`

---

### ReleaseServiceImpact
**Purpose:** Track which services/systems are affected by a release and their impact assessment.

**Proposed Schema:**
```prisma
model ReleaseServiceImpact {
  id                String   @id @default(cuid())
  organizationId    String
  organization      Organization @relation(fields: [organizationId], references: [id])
  releaseId         String   @unique
  release           Release @relation(fields: [releaseId], references: [id])
  
  affectedServices  Int      // Count of impacted services
  criticalServices  Int      // Services marked as critical
  
  services          AffectedService[]
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@unique([organizationId, releaseId])
  @@index([organizationId])
  @@index([releaseId])
}

model AffectedService {
  id                String   @id @default(cuid())
  impactId          String
  impact            ReleaseServiceImpact @relation(fields: [impactId], references: [id])
  
  serviceName       String
  serviceId         String?  // Optional reference to service catalog
  criticality       String   // "low" | "medium" | "high" | "critical"
  estimatedDowntime String?  // "0-5min" | "5-30min" | "30min-1h" | "1h+"
  
  createdAt         DateTime @default(now())
  @@index([impactId])
}
```

**Integration Points:**
- `app/api/dashboard/release-playbook/[id]/route.ts` line 248: Return `affectedServiceCount: serviceImpact?.affectedServices ?? unavailable`

---

## 2. Migration Strategy

### Phase 9a: Schema Definition
- [ ] Define all three models in `prisma/schema.prisma`
- [ ] Add relations to `Release` model
- [ ] Add indexes and constraints

### Phase 9b: Migration Generation
- [ ] Run `npx prisma migrate dev --name add_release_execution_validation_impact`
- [ ] Verify migration SQL
- [ ] Test rollback/reapply

### Phase 9c: Endpoint Updates
- [ ] Update endpoint queries to fetch ReleaseExecution, ReleaseValidation, ReleaseServiceImpact
- [ ] Remove `UnavailableDataSourceState` for these fields
- [ ] Update TypeScript types

### Phase 9d: Tests
- [ ] Add migration test
- [ ] Add endpoint integration tests for new data sources
- [ ] Test playbook page rendering with real data

---

## 3. TypeScript Type Updates

Remove from `DataSourceState` union and update response interface:

```typescript
// BEFORE: app/api/dashboard/release-playbook/[id]/route.ts
playbook: {
  stepCount: number | DataSourceState;  // becomes just number
  ...
};

risk: {
  affectedServiceCount: number | DataSourceState;  // becomes just number
};

validation: {
  planCount: number | DataSourceState;  // becomes just number
  resultsCount: number | DataSourceState;  // becomes just number
};
```

---

## 4. Page Component Updates

Once endpoints return real data:

### `app/dashboard/releases/[id]/playbook/playbook/page.tsx`
```typescript
// Remove the typeof check for stepCount
const stepCount = data.playbook.stepCount; // Now always a number
```

### `app/dashboard/releases/[id]/playbook/risk/page.tsx`
```typescript
// Remove the typeof check for affectedServiceCount
const count = data.risk.affectedServiceCount; // Now always a number
```

### `app/dashboard/releases/[id]/playbook/validation/page.tsx`
```typescript
// Remove the typeof checks for planCount and resultsCount
const plans = data.validation.planCount; // Now always a number
const results = data.validation.resultsCount; // Now always a number
```

---

## 5. Acceptance Criteria

✓ All three models exist in Prisma schema
✓ Migration applies without errors
✓ Endpoint queries fetch real data from new models
✓ TypeScript types are simplified (no more DataSourceState for these fields)
✓ Playbook pages render with real numbers (not unavailable states)
✓ Tests verify data flows correctly end-to-end
✓ No regression in existing playbook functionality

---

## 6. What's NOT Included in Phase 9

- Desktop app integration with new data
- Automatic data population (manually inserted for testing)
- Real execution/validation workflows (just storage layer)
- Performance optimization/caching

---

## 7. Next Steps After Phase 9

Once these models exist:
- Phase 9b: Wire up actual execution engine to populate ReleaseExecution
- Phase 10: Wire up validation framework to populate ReleaseValidation
- Phase 11: Implement service impact analysis to populate ReleaseServiceImpact

---

## 8. Local Implementation Notes

**When npm is available:**
```bash
# 1. Update schema
# 2. Generate migration
npx prisma migrate dev --name add_release_execution_validation_impact

# 3. Run tests
npx vitest run lib/__tests__/releasePlaybookEndpoint.test.ts

# 4. TypeScript check
npx tsc --noEmit

# 5. Build
npm run build
```

**Before database migration:**
- Back up development database
- Test migration on a copy
- Verify rollback strategy

---

**Status:** Ready for implementation once npm registry is available  
**Estimated effort:** 4-6 hours including tests and verification  
**Dependencies:** npm access, database migration capability
