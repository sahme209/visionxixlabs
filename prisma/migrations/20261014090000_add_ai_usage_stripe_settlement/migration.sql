-- Metered AI billing is disabled by default.  A per-workspace configuration
-- plus a serialized period counter prevents accidental or over-limit charges.
CREATE TABLE "AIUsageBillingConfig" (
    "organizationId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "monthlySpendLimitCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIUsageBillingConfig_pkey" PRIMARY KEY ("organizationId")
);

CREATE TABLE "AIUsageBillingSettlement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "usageEventId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "idempotencyKey" TEXT NOT NULL,
    "stripeInvoiceItemId" TEXT,
    "failureReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIUsageBillingSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIUsageBillingSettlement_usageEventId_key" ON "AIUsageBillingSettlement"("usageEventId");
CREATE UNIQUE INDEX "AIUsageBillingSettlement_idempotencyKey_key" ON "AIUsageBillingSettlement"("idempotencyKey");
CREATE UNIQUE INDEX "AIUsageBillingSettlement_stripeInvoiceItemId_key" ON "AIUsageBillingSettlement"("stripeInvoiceItemId");
CREATE INDEX "AIUsageBillingSettlement_organizationId_periodMonth_status_idx" ON "AIUsageBillingSettlement"("organizationId", "periodMonth", "status");

CREATE TABLE "AIUsageBillingPeriod" (
    "organizationId" TEXT NOT NULL,
    "periodMonth" TEXT NOT NULL,
    "limitCents" INTEGER NOT NULL,
    "reservedCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AIUsageBillingPeriod_pkey" PRIMARY KEY ("organizationId", "periodMonth")
);
