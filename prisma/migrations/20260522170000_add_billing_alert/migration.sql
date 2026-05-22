-- Billing alert — Phase 385.
--
-- Push-based notifications when a workspace crosses 70% / 90% / 100%
-- of any plan entitlement. Insert-once per (workspace, dimension,
-- threshold) per period so the operator dashboard doesn't spam them
-- with duplicates; once the new month begins, the periodMonth changes
-- and the same threshold can fire again.

CREATE TABLE "BillingAlert" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  -- ai_credits | agent_runs_per_month | connectors | ...
  "dimension" TEXT NOT NULL,
  -- 70 | 90 | 100
  "threshold" INTEGER NOT NULL,
  -- Period key in YYYY-MM format. Same dimension+threshold can fire next month.
  "periodMonth" TEXT NOT NULL,
  "planTier" TEXT NOT NULL,
  "ratioAtTrigger" DOUBLE PRECISION NOT NULL,
  "limitAtTrigger" INTEGER,
  "currentAtTrigger" INTEGER NOT NULL,
  "deliveredAt" TIMESTAMP(3),
  "deliveryChannel" TEXT NOT NULL DEFAULT 'dashboard',
  "correlationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingAlert_pkey" PRIMARY KEY ("id")
);

-- One row per (workspace, dimension, threshold, periodMonth) — the idempotency
-- lock. The cron tries to insert; the unique constraint prevents duplicates.
CREATE UNIQUE INDEX "BillingAlert_unique_per_period"
  ON "BillingAlert"("organizationId", "dimension", "threshold", "periodMonth");

CREATE INDEX "BillingAlert_organizationId_createdAt_idx"
  ON "BillingAlert"("organizationId", "createdAt");
CREATE INDEX "BillingAlert_periodMonth_idx"
  ON "BillingAlert"("periodMonth");
