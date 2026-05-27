-- Phase 495 — ManualFix scaffold.
--
-- One row per out-of-band fix engineers applied directly to an
-- environment (typically prod). Drives the readiness evaluator's
-- `hasManualProdFixes` signal with an auditable trail. Reconciled
-- flips when a follow-up PR / IaC catch-up commit captures the
-- fix back into source-of-truth.

-- CreateTable
CREATE TABLE "ManualFix" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "releaseId" TEXT,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "environmentTier" TEXT NOT NULL DEFAULT 'prod',
    "fixedAtIso" TIMESTAMP(3) NOT NULL,
    "loggedByUserId" TEXT NOT NULL,
    "reconciledByUserId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciliationRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualFix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualFix_organizationId_status_idx" ON "ManualFix"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ManualFix_organizationId_releaseId_idx" ON "ManualFix"("organizationId", "releaseId");

-- CreateIndex
CREATE INDEX "ManualFix_organizationId_fixedAtIso_idx" ON "ManualFix"("organizationId", "fixedAtIso");
