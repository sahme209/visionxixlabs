-- AI coding task — Phase 379.
--
-- A CodingTask is one operator-initiated request to the AI coding
-- loop: "go fix X" or "go add Y". It binds 1:1 to a PipelineRun
-- (the ai_coding pipeline), which orchestrates the actual work
-- through the existing stage runner + approval-gate framework.

CREATE TABLE "CodingTask" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "instruction" TEXT NOT NULL,
  "repoRef" TEXT NOT NULL,
  "branchHint" TEXT,
  /// queued | running | succeeded | failed | cancelled — mirrors PipelineRun.status.
  "status" TEXT NOT NULL DEFAULT 'queued',
  "createdBy" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CodingTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CodingTask_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CodingTask_runId_key" ON "CodingTask"("runId");
CREATE INDEX "CodingTask_organizationId_status_createdAt_idx"
  ON "CodingTask"("organizationId", "status", "createdAt");
CREATE INDEX "CodingTask_correlationId_idx" ON "CodingTask"("correlationId");
