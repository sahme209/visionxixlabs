-- Tamper-evident audit seals (A11). Additive only: one new table.
CREATE TABLE IF NOT EXISTS "AuditSeal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "fromCreatedAt" TIMESTAMP(3) NOT NULL,
    "toCreatedAt" TIMESTAMP(3) NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "eventsRoot" TEXT NOT NULL,
    "prevSealHash" TEXT NOT NULL,
    "sealHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditSeal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuditSeal_organizationId_sequence_key" ON "AuditSeal"("organizationId", "sequence");
CREATE INDEX IF NOT EXISTS "AuditSeal_organizationId_toCreatedAt_idx" ON "AuditSeal"("organizationId", "toCreatedAt");
