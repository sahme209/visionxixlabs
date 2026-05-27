-- Phase 506 — AdvisorRecommendation scaffold.
--
-- Persists the Autonomous Release Advisor's recommendations + the
-- operator's accept/reject decision. Drives the AGI cockpit for
-- ReleaseOps.

-- CreateTable
CREATE TABLE "AdvisorRecommendation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "suggestedActionsJson" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "inputsJson" JSONB NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvisorRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdvisorRecommendation_organizationId_operatorDecision_idx" ON "AdvisorRecommendation"("organizationId", "operatorDecision");

-- CreateIndex
CREATE INDEX "AdvisorRecommendation_organizationId_releaseId_idx" ON "AdvisorRecommendation"("organizationId", "releaseId");

-- CreateIndex
CREATE INDEX "AdvisorRecommendation_organizationId_generatedAt_idx" ON "AdvisorRecommendation"("organizationId", "generatedAt");
