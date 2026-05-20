-- CreateTable
CREATE TABLE "AgentBusMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "threadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentBusMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentBusMessage_organizationId_createdAt_idx" ON "AgentBusMessage"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentBusMessage_threadId_createdAt_idx" ON "AgentBusMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentBusMessage_sender_createdAt_idx" ON "AgentBusMessage"("sender", "createdAt");

-- CreateTable
CREATE TABLE "MethodProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorAgent" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "proposedDiff" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MethodProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MethodProposal_organizationId_status_createdAt_idx" ON "MethodProposal"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MethodProposal_target_status_idx" ON "MethodProposal"("target", "status");

-- CreateIndex
CREATE INDEX "MethodProposal_authorAgent_createdAt_idx" ON "MethodProposal"("authorAgent", "createdAt");
