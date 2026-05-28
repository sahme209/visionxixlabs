-- Phase 507 — PolicyProposal scaffold.
--
-- Captures the Autonomous Policy Proposal engine's suggestions plus
-- the operator's accept/reject decision. Unique on
-- (organizationId, suggestedRuleKey, operatorDecision) lets the same
-- key be re-proposed after a prior rejection (different decision
-- value → different unique tuple).

-- CreateTable
CREATE TABLE "PolicyProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "suggestedRuleKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "evidenceJson" JSONB NOT NULL,
    "suggestedRuleBodyJson" JSONB NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "acceptedRuleId" TEXT,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyProposal_organizationId_suggestedRuleKey_operatorDeci_key" ON "PolicyProposal"("organizationId", "suggestedRuleKey", "operatorDecision");

-- CreateIndex
CREATE INDEX "PolicyProposal_organizationId_operatorDecision_idx" ON "PolicyProposal"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "PolicyProposal_organizationId_generatedAt_idx" ON "PolicyProposal"("organizationId", "generatedAt");
