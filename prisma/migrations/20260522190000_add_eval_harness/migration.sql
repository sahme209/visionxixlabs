-- AI coding loop eval harness — Phase 389.
--
-- Synthetic-task quality gate for the AGI coding pipeline.
-- An EvalRun is one batch execution of the eval suite; each
-- EvalCase is one synthetic task within that batch.

CREATE TABLE "EvalRun" (
  "id" TEXT NOT NULL,
  -- "manual" | "cron_daily" | "ci_smoke"
  "runKind" TEXT NOT NULL,
  -- pending | running | completed | failed
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalCases" INTEGER NOT NULL DEFAULT 0,
  "passCount" INTEGER NOT NULL DEFAULT 0,
  "failCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "totalCostCents" INTEGER NOT NULL DEFAULT 0,
  -- The model the suite ran against (for regression tracking).
  "modelUsed" TEXT,
  "triggeredBy" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "errorSummary" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EvalRun_runKind_startedAt_idx" ON "EvalRun"("runKind", "startedAt");
CREATE INDEX "EvalRun_status_idx" ON "EvalRun"("status");

CREATE TABLE "EvalCase" (
  "id" TEXT NOT NULL,
  "evalRunId" TEXT NOT NULL,
  -- Catalog key, e.g. "add_healthz", "rename_var", "fix_typo".
  "taskKey" TEXT NOT NULL,
  -- The synthetic operator instruction.
  "instruction" TEXT NOT NULL,
  -- If the eval triggered a real coding task, this is the id.
  "codingTaskId" TEXT,
  -- "pass" | "fail" | "skipped" | "errored"
  "outcome" TEXT NOT NULL,
  -- 0..1 score from the pure scorer.
  "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  -- JSON array of FailureKind strings that fired (empty when pass).
  "failures" JSONB NOT NULL,
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  -- Notes from the scorer (free text for human review).
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvalCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EvalCase_evalRunId_fkey"
    FOREIGN KEY ("evalRunId") REFERENCES "EvalRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "EvalCase_evalRunId_outcome_idx" ON "EvalCase"("evalRunId", "outcome");
CREATE INDEX "EvalCase_taskKey_idx" ON "EvalCase"("taskKey");
