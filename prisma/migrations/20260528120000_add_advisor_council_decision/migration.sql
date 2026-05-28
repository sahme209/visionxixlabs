-- Phase 514 — AdvisorCouncilDecision scaffold.

-- CreateTable
CREATE TABLE "AdvisorCouncilDecision" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "consensusKind" TEXT NOT NULL,
    "agreementScore" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "votesJson" JSONB NOT NULL,
    "voterCount" INTEGER NOT NULL,
    "inputsJson" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "overrideKind" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorCouncilDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorCouncilDecision_organizationId_operatorDecision_idx" ON "AdvisorCouncilDecision"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "AdvisorCouncilDecision_organizationId_releaseId_idx" ON "AdvisorCouncilDecision"("organizationId", "releaseId");

-- CreateIndex
CREATE INDEX "AdvisorCouncilDecision_organizationId_consensusKind_idx" ON "AdvisorCouncilDecision"("organizationId", "consensusKind");
