-- Phase 523 — Persisted AGI meta-summary log.

-- CreateTable
CREATE TABLE "AiMemorySummaryLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetKind" TEXT,
    "narrative" TEXT NOT NULL,
    "themesJson" JSONB NOT NULL,
    "notableEntriesJson" JSONB NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ai_generated',
    "errorMessage" TEXT,
    "modelHint" TEXT,
    "windowSize" INTEGER NOT NULL,
    "aiAvailabilityPct" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMemorySummaryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiMemorySummaryLog_organizationId_generatedAt_idx"
    ON "AiMemorySummaryLog"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "AiMemorySummaryLog_organizationId_targetKind_generatedAt_idx"
    ON "AiMemorySummaryLog"("organizationId", "targetKind", "generatedAt");
