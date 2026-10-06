-- Agent runtime: plain-English request -> risk-checked, approval-gated,
-- auditable execution. See prisma/schema.prisma's comment block above
-- AgentConversation for the governance model.

-- CreateTable
CREATE TABLE "AgentConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConversationTurn" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "actionProposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentConversationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentActionProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "argsJson" JSONB NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "resultJson" JSONB,
    "errorMessage" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentActionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentConversation_organizationId_userId_idx" ON "AgentConversation"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "AgentConversationTurn_conversationId_createdAt_idx" ON "AgentConversationTurn"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentActionProposal_organizationId_status_idx" ON "AgentActionProposal"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AgentActionProposal_conversationId_idx" ON "AgentActionProposal"("conversationId");

-- AddForeignKey
ALTER TABLE "AgentConversationTurn" ADD CONSTRAINT "AgentConversationTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentActionProposal" ADD CONSTRAINT "AgentActionProposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AgentConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
