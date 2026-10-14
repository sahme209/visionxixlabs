ALTER TABLE "AddOnPurchase"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reversedAICreditsCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "AddOnPurchase"
SET "idempotencyKey" = 'legacy:' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "AddOnPurchase"
  ALTER COLUMN "idempotencyKey" SET NOT NULL;

DROP INDEX IF EXISTS "AddOnPurchase_stripeCheckoutSessionId_idx";
CREATE UNIQUE INDEX "AddOnPurchase_stripeCheckoutSessionId_key"
  ON "AddOnPurchase"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "AddOnPurchase_stripePaymentIntentId_key"
  ON "AddOnPurchase"("stripePaymentIntentId");
CREATE UNIQUE INDEX "AddOnPurchase_organizationId_idempotencyKey_key"
  ON "AddOnPurchase"("organizationId", "idempotencyKey");

CREATE TABLE "StripeBillingEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeBillingEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StripeBillingEvent_processedAt_idx"
  ON "StripeBillingEvent"("processedAt");
