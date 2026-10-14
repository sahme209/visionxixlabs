CREATE TABLE "AIUsageReservation" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "reservedCents" INTEGER NOT NULL,
  "settledCents" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'reserved',
  "correlationId" TEXT,
  "usageEventId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "settledAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIUsageReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIUsageReservation_organizationId_idempotencyKey_key"
  ON "AIUsageReservation"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "AIUsageReservation_usageEventId_key"
  ON "AIUsageReservation"("usageEventId");
CREATE INDEX "AIUsageReservation_organizationId_status_expiresAt_idx"
  ON "AIUsageReservation"("organizationId", "status", "expiresAt");
CREATE INDEX "AIUsageReservation_correlationId_idx"
  ON "AIUsageReservation"("correlationId");
