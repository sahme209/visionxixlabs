-- Phase 414/425 — ConnectorSetupSession state-machine persistence.
--
-- Adds the per-(org, provider) status row + an append-only audit
-- table for every transition attempt, legal or illegal. SQL is the
-- exact output of `prisma migrate diff --from-empty
-- --to-schema-datamodel prisma/schema.prisma --script`, scoped to
-- just the new tables. The `provider` column is plain TEXT (not a
-- Postgres enum) because the legacy CloudProvider enum has no
-- corresponding declaration in any prior migration; the application
-- layer gates allowed values via ALLOWED_PROVIDERS in
-- connectorSetupEventEmit.ts.

-- CreateEnum
CREATE TYPE "ConnectorSetupStatus" AS ENUM ('not_connected', 'setup_started', 'waiting_for_provider', 'validating', 'connected', 'failed', 'disconnected', 'revoked', 'needs_attention');

-- CreateTable
CREATE TABLE "ConnectorSetupSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ConnectorSetupStatus" NOT NULL DEFAULT 'not_connected',
    "lastEventKind" TEXT,
    "lastErrorCode" TEXT,
    "firstConnectedAt" TIMESTAMP(3),
    "lastTransitionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectorSetupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorSetupTransition" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fromStatus" "ConnectorSetupStatus" NOT NULL,
    "toStatus" "ConnectorSetupStatus" NOT NULL,
    "eventKind" TEXT NOT NULL,
    "isLegal" BOOLEAN NOT NULL,
    "rejectionReason" TEXT,
    "eventPayload" JSONB,
    "actorUserId" TEXT,
    "actorLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorSetupTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectorSetupSession_organizationId_idx" ON "ConnectorSetupSession"("organizationId");

-- CreateIndex
CREATE INDEX "ConnectorSetupSession_status_idx" ON "ConnectorSetupSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorSetupSession_organizationId_provider_key" ON "ConnectorSetupSession"("organizationId", "provider");

-- CreateIndex
CREATE INDEX "ConnectorSetupTransition_sessionId_createdAt_idx" ON "ConnectorSetupTransition"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectorSetupTransition_isLegal_createdAt_idx" ON "ConnectorSetupTransition"("isLegal", "createdAt");

-- AddForeignKey
ALTER TABLE "ConnectorSetupTransition" ADD CONSTRAINT "ConnectorSetupTransition_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ConnectorSetupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
