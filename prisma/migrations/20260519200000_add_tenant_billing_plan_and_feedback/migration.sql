-- CreateTable
CREATE TABLE "TenantBillingPlan" (
    "organizationId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "lastStripeEventId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantBillingPlan_pkey" PRIMARY KEY ("organizationId")
);

-- CreateIndex
CREATE INDEX "TenantBillingPlan_status_currentPeriodEndsAt_idx" ON "TenantBillingPlan"("status", "currentPeriodEndsAt");

-- CreateIndex
CREATE INDEX "TenantBillingPlan_tier_status_idx" ON "TenantBillingPlan"("tier", "status");

-- CreateTable
CREATE TABLE "FeedbackRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "email" TEXT,
    "sentiment" TEXT NOT NULL,
    "pagePath" TEXT,
    "message" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackRecord_createdAt_idx" ON "FeedbackRecord"("createdAt");

-- CreateIndex
CREATE INDEX "FeedbackRecord_sentiment_createdAt_idx" ON "FeedbackRecord"("sentiment", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackRecord_organizationId_createdAt_idx" ON "FeedbackRecord"("organizationId", "createdAt");
