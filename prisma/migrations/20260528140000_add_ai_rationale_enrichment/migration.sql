-- Phase 518 — AI rationale enrichment for council decisions.

-- CreateTable
CREATE TABLE "AiRationaleEnrichment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL DEFAULT 'council',
    "targetId" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "riskFactorsJson" JSONB NOT NULL,
    "nextActionsJson" JSONB NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ai_generated',
    "errorMessage" TEXT,
    "modelHint" TEXT,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRationaleEnrichment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiRationaleEnrichment_organizationId_targetKind_targetId_key"
    ON "AiRationaleEnrichment"("organizationId", "targetKind", "targetId");

-- CreateIndex
CREATE INDEX "AiRationaleEnrichment_organizationId_targetKind_generatedAt_idx"
    ON "AiRationaleEnrichment"("organizationId", "targetKind", "generatedAt");
