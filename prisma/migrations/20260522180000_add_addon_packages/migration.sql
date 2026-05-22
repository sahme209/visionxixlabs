-- Add-on packages ledger — Phase 386.
--
-- Purchasable top-ups that augment the plan's included entitlements
-- for a single period (or permanently when permitted). The catalog
-- lives in code (ADD_ON_CATALOG) — only the purchase ledger lives in
-- the DB. This mirrors how PROVIDER_RATE_SEEDS + AIProviderRate split:
-- code is the source of truth, DB tracks the workspace transactions.

CREATE TABLE "AddOnPurchase" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  -- The catalog SKU (e.g. ai_credits_small, seat_addon, connector_addon).
  "sku" TEXT NOT NULL,
  -- What the operator paid, in cents (USD).
  "pricePaidCents" INTEGER NOT NULL,
  -- What the operator gets, denormalized from the catalog at purchase time.
  "deliveredAICreditsCents" INTEGER NOT NULL DEFAULT 0,
  "deliveredSeats" INTEGER NOT NULL DEFAULT 0,
  "deliveredConnectors" INTEGER NOT NULL DEFAULT 0,
  -- "current_month" rolls off; "permanent" persists.
  "validFor" TEXT NOT NULL,
  -- YYYY-MM the purchase applies to (for current_month skus).
  "periodMonth" TEXT NOT NULL,
  -- pending | paid | refunded | failed
  "status" TEXT NOT NULL DEFAULT 'pending',
  -- Stripe Checkout linkage; null on the stub path until real wiring lands.
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "purchasedBy" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AddOnPurchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AddOnPurchase_organizationId_periodMonth_status_idx"
  ON "AddOnPurchase"("organizationId", "periodMonth", "status");
CREATE INDEX "AddOnPurchase_organizationId_createdAt_idx"
  ON "AddOnPurchase"("organizationId", "createdAt");
CREATE INDEX "AddOnPurchase_stripeCheckoutSessionId_idx"
  ON "AddOnPurchase"("stripeCheckoutSessionId");
CREATE INDEX "AddOnPurchase_correlationId_idx"
  ON "AddOnPurchase"("correlationId");
