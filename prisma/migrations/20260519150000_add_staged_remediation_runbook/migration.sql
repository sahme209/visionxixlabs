-- CreateTable
CREATE TABLE "StagedRemediationRunbook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runbookId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "affectedResource" TEXT NOT NULL,
    "reversalLabel" TEXT NOT NULL,
    "reversalRisk" TEXT NOT NULL,
    "reversalApi" TEXT,
    "hardeningLabel" TEXT NOT NULL,
    "hardeningApi" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "evidenceRefs" TEXT[],
    "status" TEXT NOT NULL,
    "decision" TEXT,
    "stagedBy" TEXT,
    "stagedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,

    CONSTRAINT "StagedRemediationRunbook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StagedRemediationRunbook_organizationId_status_stagedAt_idx" ON "StagedRemediationRunbook"("organizationId", "status", "stagedAt");

-- CreateIndex
CREATE INDEX "StagedRemediationRunbook_organizationId_runbookId_idx" ON "StagedRemediationRunbook"("organizationId", "runbookId");
