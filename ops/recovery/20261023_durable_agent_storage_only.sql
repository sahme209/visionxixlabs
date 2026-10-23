-- Additive Agent workflow storage recovery only. No workflow is queued,
-- permission granted, billing enabled or migration-history row modified.
-- Execute only after exact source binding, private recovery backup, isolated
-- restore rehearsal and current role/ACL/concurrency verification.
BEGIN;
SET LOCAL search_path TO public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Use the installed Prisma migration advisory key and fence ledger writes.
DO $fence$
BEGIN
  IF NOT pg_try_advisory_xact_lock(72707369) THEN
    RAISE EXCEPTION 'durable_agent_migration_runner_busy';
  END IF;
END
$fence$;
LOCK TABLE public."_prisma_migrations" IN SHARE MODE;
DO $preconditions$
BEGIN
  IF current_database() <> 'neondb'
     OR current_setting('server_version_num')::int / 10000 <> 17
     OR to_regclass('public."User"') IS NULL
     OR to_regclass('public."WorkspaceAgentIdentity"') IS NULL
     OR to_regclass('public."_prisma_migrations"') IS NULL THEN
    RAISE EXCEPTION 'durable_agent_expected_baseline_missing';
  END IF;
  IF to_regclass('public."DurableAgentWorkflow"') IS NOT NULL
     OR to_regclass('public."DurableAgentWorkflowEvent"') IS NOT NULL THEN
    RAISE EXCEPTION 'durable_agent_storage_already_present_or_partial';
  END IF;
  IF (SELECT count(*) FROM "_prisma_migrations"
      WHERE migration_name = '20261013172000_add_workspace_agent_identity'
        AND finished_at IS NULL AND rolled_back_at IS NULL
        AND checksum = '761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7') <> 1
     OR EXISTS (SELECT 1 FROM "_prisma_migrations"
      WHERE migration_name = '20261013193000_add_durable_agent_workflow'
        AND (finished_at IS NOT NULL OR rolled_back_at IS NULL)) THEN
    RAISE EXCEPTION 'durable_agent_migration_state_changed';
  END IF;
END
$preconditions$;
-- Exact unchanged pending migration schema; no backfill or data update.
CREATE TABLE "DurableAgentWorkflow" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workflowKind" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "autonomyLevel" TEXT NOT NULL,
    "currentStep" TEXT,
    "inputJson" JSONB NOT NULL,
    "stateJson" JSONB NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "approvalProposalId" TEXT,
    "pauseReason" TEXT,
    "failureCode" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "cancelRequestedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DurableAgentWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DurableAgentWorkflowEvent" (
    "id" TEXT NOT NULL,
    "workflowRunId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorKind" TEXT NOT NULL,
    "actorId" TEXT,
    "detailJson" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DurableAgentWorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DurableAgentWorkflow_organizationId_status_updatedAt_idx" ON "DurableAgentWorkflow"("organizationId", "status", "updatedAt");
CREATE INDEX "DurableAgentWorkflow_status_nextAttemptAt_idx" ON "DurableAgentWorkflow"("status", "nextAttemptAt");
CREATE INDEX "DurableAgentWorkflow_leaseExpiresAt_idx" ON "DurableAgentWorkflow"("leaseExpiresAt");
CREATE INDEX "DurableAgentWorkflow_approvalProposalId_idx" ON "DurableAgentWorkflow"("approvalProposalId");
CREATE UNIQUE INDEX "DurableAgentWorkflowEvent_workflowRunId_sequence_key" ON "DurableAgentWorkflowEvent"("workflowRunId", "sequence");
CREATE INDEX "DurableAgentWorkflowEvent_organizationId_occurredAt_idx" ON "DurableAgentWorkflowEvent"("organizationId", "occurredAt");
CREATE INDEX "DurableAgentWorkflowEvent_workflowRunId_occurredAt_idx" ON "DurableAgentWorkflowEvent"("workflowRunId", "occurredAt");

ALTER TABLE "DurableAgentWorkflowEvent" ADD CONSTRAINT "DurableAgentWorkflowEvent_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "DurableAgentWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
