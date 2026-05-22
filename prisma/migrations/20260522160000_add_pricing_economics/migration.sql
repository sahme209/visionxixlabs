-- Pricing economics foundation — Phase 381.
--
-- Three new tables. Strictly additive — does NOT touch TenantBillingPlan,
-- TenantUsageCounter, AIInvocation, or the Stripe webhook surface.
--
-- 1. AIProviderRate — configurable per-(provider, model, effective_date) cost
--    table. Inputs/outputs/cached/batch rates are stored as cents-per-million
--    tokens (integers — no float drift). Rates change; we never hardcode.
-- 2. UsageEvent — per-invocation usage log with computed cost_cents. Joins
--    to AIInvocation in spirit; AIInvocation continues as the PII-safe log,
--    UsageEvent is the cost-attribution log.
-- 3. WorkspaceUsageSummary — month-to-date aggregate per workspace.
--    Rebuilt nightly via cron; client billing dashboard reads from here.

CREATE TABLE "AIProviderRate" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "inputCentsPerMillion" INTEGER NOT NULL,
  "outputCentsPerMillion" INTEGER NOT NULL,
  /// Nullable — many models have no cached read pricing.
  "cachedReadCentsPerMillion" INTEGER,
  /// Nullable — batch APIs offer ~50% discount; null when not applicable.
  "batchInputCentsPerMillion" INTEGER,
  "batchOutputCentsPerMillion" INTEGER,
  /// Negotiated enterprise rate, null on list price rows.
  "enterpriseRateNote" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIProviderRate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIProviderRate_provider_modelId_effectiveFrom_idx"
  ON "AIProviderRate"("provider", "modelId", "effectiveFrom");
CREATE INDEX "AIProviderRate_isActive_idx" ON "AIProviderRate"("isActive");

CREATE TABLE "UsageEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  /// "ai_invocation" | "agent_run" | "automation_run" | "connector_sync"
  /// | "cloud_scan" | "report_generated" | "monitoring_event" | "desktop_task"
  "eventKind" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "cachedReadTokens" INTEGER NOT NULL DEFAULT 0,
  /// Cost attributed to VisionXIXLabs in cents (USD). Integer — no float.
  "costCents" INTEGER NOT NULL DEFAULT 0,
  /// Operator/agent that triggered the event.
  "triggeredBy" TEXT,
  /// Optional join keys to existing telemetry (PII-safe).
  "aiInvocationId" TEXT,
  "correlationId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UsageEvent_organizationId_createdAt_idx"
  ON "UsageEvent"("organizationId", "createdAt");
CREATE INDEX "UsageEvent_organizationId_eventKind_createdAt_idx"
  ON "UsageEvent"("organizationId", "eventKind", "createdAt");
CREATE INDEX "UsageEvent_correlationId_idx" ON "UsageEvent"("correlationId");

CREATE TABLE "WorkspaceUsageSummary" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  /// Period key in YYYY-MM format. One row per workspace per month.
  "periodMonth" TEXT NOT NULL,
  "totalCostCents" INTEGER NOT NULL DEFAULT 0,
  "aiCostCents" INTEGER NOT NULL DEFAULT 0,
  "aiInvocationCount" INTEGER NOT NULL DEFAULT 0,
  "aiInputTokens" BIGINT NOT NULL DEFAULT 0,
  "aiOutputTokens" BIGINT NOT NULL DEFAULT 0,
  "aiCachedReadTokens" BIGINT NOT NULL DEFAULT 0,
  "agentRunCount" INTEGER NOT NULL DEFAULT 0,
  "automationRunCount" INTEGER NOT NULL DEFAULT 0,
  "connectorSyncCount" INTEGER NOT NULL DEFAULT 0,
  "cloudScanCount" INTEGER NOT NULL DEFAULT 0,
  "reportCount" INTEGER NOT NULL DEFAULT 0,
  "lastRebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceUsageSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceUsageSummary_organizationId_periodMonth_key"
  ON "WorkspaceUsageSummary"("organizationId", "periodMonth");
CREATE INDEX "WorkspaceUsageSummary_periodMonth_idx"
  ON "WorkspaceUsageSummary"("periodMonth");
