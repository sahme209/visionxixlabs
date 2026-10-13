ALTER TABLE "UsageEvent"
  ADD COLUMN "externalUsageId" TEXT,
  ADD COLUMN "billedCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "billingStatus" TEXT NOT NULL DEFAULT 'settled';

-- Before this migration customer-attributed usage and provider cost shared
-- costCents, so preserve that ledger when introducing the billed-cost field.
UPDATE "UsageEvent" SET "billedCents" = "costCents";

CREATE UNIQUE INDEX "UsageEvent_externalUsageId_key"
  ON "UsageEvent"("externalUsageId");

CREATE INDEX "UsageEvent_billingStatus_createdAt_idx"
  ON "UsageEvent"("billingStatus", "createdAt");
