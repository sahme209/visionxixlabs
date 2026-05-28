-- Phase 525 — Proactive AGI Suggestion.

-- CreateTable
CREATE TABLE "ProactiveAgiSuggestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "targetKind" TEXT,
    "targetId" TEXT,
    "confidence" INTEGER NOT NULL,
    "citationsJson" JSONB NOT NULL,
    "operatorDecision" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'ai_generated',
    "errorMessage" TEXT,
    "modelHint" TEXT,
    "engineVersion" TEXT NOT NULL,
    "windowSize" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProactiveAgiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProactiveAgiSuggestion_organizationId_operatorDecision_genera_idx"
    ON "ProactiveAgiSuggestion"("organizationId", "operatorDecision", "generatedAt");

-- CreateIndex
CREATE INDEX "ProactiveAgiSuggestion_organizationId_kind_idx"
    ON "ProactiveAgiSuggestion"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "ProactiveAgiSuggestion_organizationId_targetKind_targetId_idx"
    ON "ProactiveAgiSuggestion"("organizationId", "targetKind", "targetId");
