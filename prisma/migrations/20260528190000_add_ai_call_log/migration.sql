-- Phase 531 — AI call log + circuit breaker source-of-truth.

CREATE TABLE "AiCallLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "engineName" TEXT NOT NULL,
    "model" TEXT,
    "outcome" TEXT NOT NULL,
    "errorMessage" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCallLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiCallLog_engineName_startedAt_idx" ON "AiCallLog"("engineName", "startedAt");
CREATE INDEX "AiCallLog_organizationId_engineName_startedAt_idx" ON "AiCallLog"("organizationId", "engineName", "startedAt");
CREATE INDEX "AiCallLog_outcome_startedAt_idx" ON "AiCallLog"("outcome", "startedAt");
