-- Phase 485 — DriftFinding scaffold for IaC vs runtime drift.
--
-- Detector (lib/releaseops/driftDetector.ts) is pure; the inbox
-- (Phase 485 driftListResponder.ts) reads from this table; the
-- detect-and-persist endpoint (Phase 486) writes to it.

-- CreateTable
CREATE TABLE "DriftFinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resourceKind" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "applicationId" TEXT,
    "environmentTier" TEXT,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "summary" TEXT NOT NULL,
    "declaredJson" JSONB,
    "observedJson" JSONB,
    "remediationKey" TEXT,
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriftFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriftFinding_organizationId_status_idx" ON "DriftFinding"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DriftFinding_organizationId_severity_idx" ON "DriftFinding"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "DriftFinding_applicationId_idx" ON "DriftFinding"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "DriftFinding_organizationId_resourceKind_resourceId_key" ON "DriftFinding"("organizationId", "resourceKind", "resourceId");

