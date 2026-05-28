-- Phase 529 — Persisted AGI chat turn.

-- CreateTable
CREATE TABLE "AiMemoryChatTurn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "citationsJson" JSONB NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'ai_generated',
    "errorMessage" TEXT,
    "modelHint" TEXT,
    "contextEntriesCount" INTEGER NOT NULL,
    "contextSummariesCount" INTEGER NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMemoryChatTurn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiMemoryChatTurn_organizationId_generatedAt_idx"
    ON "AiMemoryChatTurn"("organizationId", "generatedAt");

-- CreateIndex
CREATE INDEX "AiMemoryChatTurn_organizationId_userId_generatedAt_idx"
    ON "AiMemoryChatTurn"("organizationId", "userId", "generatedAt");
