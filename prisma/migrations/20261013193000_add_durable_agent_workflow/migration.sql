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
