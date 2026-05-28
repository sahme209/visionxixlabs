-- Phase 512 — RemediationProposal scaffold.

-- CreateTable
CREATE TABLE "RemediationProposal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "triageId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "prerequisitesJson" JSONB NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "rollbackPlan" TEXT NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "reversible" BOOLEAN NOT NULL DEFAULT true,
    "rationale" TEXT NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "linkedManualFixId" TEXT,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RemediationProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemediationProposal_organizationId_operatorDecision_idx" ON "RemediationProposal"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "RemediationProposal_organizationId_incidentId_idx" ON "RemediationProposal"("organizationId", "incidentId");

-- CreateIndex
CREATE INDEX "RemediationProposal_organizationId_kind_idx" ON "RemediationProposal"("organizationId", "kind");
