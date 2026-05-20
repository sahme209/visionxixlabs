-- CreateTable
CREATE TABLE "OutboundNotificationRetry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "evidenceRefs" TEXT[],
    "safeActionLabel" TEXT,
    "safeActionHref" TEXT,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retriedAt" TIMESTAMP(3),

    CONSTRAINT "OutboundNotificationRetry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundNotificationRetry_status_enqueuedAt_idx" ON "OutboundNotificationRetry"("status", "enqueuedAt");

-- CreateIndex
CREATE INDEX "OutboundNotificationRetry_organizationId_status_idx" ON "OutboundNotificationRetry"("organizationId", "status");
