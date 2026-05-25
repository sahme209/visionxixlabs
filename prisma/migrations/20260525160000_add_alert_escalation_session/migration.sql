-- Phase 427/430 — AlertEscalationSession state-machine persistence.
--
-- Per-(organizationId, signalRef) status row + append-only audit table
-- for every transition attempt, legal or illegal. SQL is the verbatim
-- output of `prisma migrate diff --from-empty --to-schema-datamodel
-- prisma/schema.prisma --script` scoped to the new tables, so client
-- expectations and DB shape match exactly.

-- CreateEnum
CREATE TYPE "AlertEscalationStatus" AS ENUM ('quiet', 'fired', 'escalated', 'acknowledged', 'snoozed', 'resolved', 'auto_resolved', 'expired');

-- CreateTable
CREATE TABLE "AlertEscalationSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "signalRef" TEXT NOT NULL,
    "status" "AlertEscalationStatus" NOT NULL DEFAULT 'quiet',
    "lastEventKind" TEXT,
    "firstFiredAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByUserId" TEXT,
    "snoozedUntilAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "lastTransitionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertEscalationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEscalationTransition" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromStatus" "AlertEscalationStatus" NOT NULL,
    "toStatus" "AlertEscalationStatus" NOT NULL,
    "eventKind" TEXT NOT NULL,
    "isLegal" BOOLEAN NOT NULL,
    "rejectionReason" TEXT,
    "eventPayload" JSONB,
    "actorUserId" TEXT,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEscalationTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertEscalationSession_organizationId_idx" ON "AlertEscalationSession"("organizationId");

-- CreateIndex
CREATE INDEX "AlertEscalationSession_status_idx" ON "AlertEscalationSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEscalationSession_organizationId_signalRef_key" ON "AlertEscalationSession"("organizationId", "signalRef");

-- CreateIndex
CREATE INDEX "AlertEscalationTransition_sessionId_createdAt_idx" ON "AlertEscalationTransition"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AlertEscalationTransition_isLegal_createdAt_idx" ON "AlertEscalationTransition"("isLegal", "createdAt");

-- AddForeignKey
ALTER TABLE "AlertEscalationTransition" ADD CONSTRAINT "AlertEscalationTransition_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AlertEscalationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
