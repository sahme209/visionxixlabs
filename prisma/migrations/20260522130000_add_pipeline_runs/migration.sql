-- Pipeline runs — Phase 377.
--
-- A pipeline is a multi-stage workflow (CI/CD, db-migrate, etc.).
-- Each PipelineRun is one execution of a pipeline definition for a
-- workspace; each PipelineStageRun is one stage's lifecycle within
-- that run. Stages advance through a closed-union status machine:
--   queued → running → succeeded | failed | skipped
-- A stage that needs human approval pauses at "awaiting_approval"
-- and resumes after the approval terminal status (Phase 369/371).

CREATE TABLE "PipelineRun" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "pipelineId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "triggeredBy" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "metadata" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PipelineRun_organizationId_pipelineId_startedAt_idx"
  ON "PipelineRun"("organizationId", "pipelineId", "startedAt");
CREATE INDEX "PipelineRun_organizationId_status_startedAt_idx"
  ON "PipelineRun"("organizationId", "status", "startedAt");
CREATE INDEX "PipelineRun_correlationId_idx"
  ON "PipelineRun"("correlationId");

CREATE TABLE "PipelineStageRun" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "stageKind" TEXT NOT NULL,
  "ordering" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  "approvalRequestId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "outputSummary" TEXT,
  "outputDetail" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PipelineStageRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PipelineStageRun_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PipelineStageRun_runId_ordering_key"
  ON "PipelineStageRun"("runId", "ordering");
CREATE INDEX "PipelineStageRun_runId_status_idx"
  ON "PipelineStageRun"("runId", "status");
