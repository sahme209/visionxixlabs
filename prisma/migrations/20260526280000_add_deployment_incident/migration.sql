-- Phase 501 — DeploymentIncident scaffold.
--
-- Captures post-deploy spikes attributed to a specific Release.
-- Closed-union state machine: open → mitigated → resolved | wont_fix.

-- CreateTable
CREATE TABLE "DeploymentIncident" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "manualFixId" TEXT,
    "reportedByUserId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mitigatedByUserId" TEXT,
    "mitigatedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeploymentIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeploymentIncident_organizationId_status_idx" ON "DeploymentIncident"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DeploymentIncident_organizationId_releaseId_idx" ON "DeploymentIncident"("organizationId", "releaseId");

-- CreateIndex
CREATE INDEX "DeploymentIncident_organizationId_severity_idx" ON "DeploymentIncident"("organizationId", "severity");
