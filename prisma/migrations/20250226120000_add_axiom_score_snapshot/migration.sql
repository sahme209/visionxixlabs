-- CreateTable
CREATE TABLE "AxiomScoreSnapshot" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "tier" TEXT NOT NULL,
    "provider" TEXT,

    "infrastructureScore" INTEGER,
    "estimatedAnnualSavings" INTEGER,
    "riskExposureLevel" TEXT,
    "deploymentFrictionIndex" INTEGER,
    "complexityTier" TEXT,
    "automationReadinessScore" INTEGER,

    "raw" JSONB,

    CONSTRAINT "AxiomScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AxiomScoreSnapshot_leadId_idx" ON "AxiomScoreSnapshot"("leadId");
