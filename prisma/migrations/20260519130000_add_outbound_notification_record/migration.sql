-- CreateTable
CREATE TABLE "OutboundNotificationRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "channelsSucceeded" TEXT[],
    "channelsSkipped" TEXT[],
    "evidenceRefs" TEXT[],
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundNotificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboundNotificationRecord_organizationId_createdAt_idx" ON "OutboundNotificationRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundNotificationRecord_organizationId_dedupeKey_created_idx" ON "OutboundNotificationRecord"("organizationId", "dedupeKey", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundNotificationRecord_dedupeKey_createdAt_idx" ON "OutboundNotificationRecord"("dedupeKey", "createdAt");
