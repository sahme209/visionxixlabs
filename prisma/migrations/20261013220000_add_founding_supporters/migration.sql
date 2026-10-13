CREATE TABLE "FoundingSupporterPurchase" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "publicName" TEXT,
    "recognitionConsent" BOOLEAN NOT NULL DEFAULT false,
    "updatesOptIn" BOOLEAN NOT NULL DEFAULT false,
    "amountCents" INTEGER NOT NULL,
    "refundedAmountCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "badgeIssuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "confirmationEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FoundingSupporterPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupporterStripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupporterStripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoundingSupporterPurchase_correlationId_key" ON "FoundingSupporterPurchase"("correlationId");
CREATE UNIQUE INDEX "FoundingSupporterPurchase_stripeCheckoutSessionId_key" ON "FoundingSupporterPurchase"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "FoundingSupporterPurchase_stripePaymentIntentId_key" ON "FoundingSupporterPurchase"("stripePaymentIntentId");
CREATE INDEX "FoundingSupporterPurchase_status_createdAt_idx" ON "FoundingSupporterPurchase"("status", "createdAt");
CREATE INDEX "FoundingSupporterPurchase_email_createdAt_idx" ON "FoundingSupporterPurchase"("email", "createdAt");
CREATE INDEX "SupporterStripeEvent_processedAt_idx" ON "SupporterStripeEvent"("processedAt");
