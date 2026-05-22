-- AI Workforce runtime enforcement — Phase 362
--
-- AgentEngineerRecord:
--   One row per (organizationId, engineerId). Holds the workspace's
--   tightened approval rule (may not loosen the canonical floor),
--   the enabled flag, optional operator notes, and config blob.
--
-- AgentEngineerActionAttempt:
--   Append-only log of every gated action attempt. Surface for the
--   /dashboard/workforce/[id] activity feed + the audit fabric.

CREATE TABLE "AgentEngineerRecord" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "defaultApprovalRule" TEXT NOT NULL,
  "currentApprovalRule" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentEngineerRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentEngineerRecord_organizationId_engineerId_key"
  ON "AgentEngineerRecord"("organizationId", "engineerId");

CREATE INDEX "AgentEngineerRecord_organizationId_isEnabled_idx"
  ON "AgentEngineerRecord"("organizationId", "isEnabled");

CREATE INDEX "AgentEngineerRecord_organizationId_createdAt_idx"
  ON "AgentEngineerRecord"("organizationId", "createdAt");


CREATE TABLE "AgentEngineerActionAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "isReadOnly" BOOLEAN NOT NULL,
  "module" TEXT,
  "connector" TEXT,
  "runtimeDecision" TEXT NOT NULL,
  "effectiveRule" TEXT NOT NULL,
  "policySource" TEXT NOT NULL,
  "requiredApprovers" INTEGER NOT NULL DEFAULT 0,
  "requestedBy" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "approvalRequestId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentEngineerActionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentEngineerActionAttempt_organizationId_createdAt_idx"
  ON "AgentEngineerActionAttempt"("organizationId", "createdAt");

CREATE INDEX "AgentEngineerActionAttempt_recordId_createdAt_idx"
  ON "AgentEngineerActionAttempt"("recordId", "createdAt");

CREATE INDEX "AgentEngineerActionAttempt_organizationId_runtimeDecision_createdAt_idx"
  ON "AgentEngineerActionAttempt"("organizationId", "runtimeDecision", "createdAt");

CREATE INDEX "AgentEngineerActionAttempt_correlationId_idx"
  ON "AgentEngineerActionAttempt"("correlationId");

ALTER TABLE "AgentEngineerActionAttempt"
  ADD CONSTRAINT "AgentEngineerActionAttempt_recordId_fkey"
  FOREIGN KEY ("recordId") REFERENCES "AgentEngineerRecord"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
