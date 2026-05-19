-- CreateTable
CREATE TABLE "AutonomyDecisionRationale" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cycleId" TEXT,
    "candidateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "charterMode" TEXT NOT NULL,
    "boundaryClass" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "haltedAtStage" TEXT,
    "haltReason" TEXT,
    "proposedIntent" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "evidenceRefs" TEXT[],
    "durationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomyDecisionRationale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutonomyDecisionRationale_organizationId_createdAt_idx" ON "AutonomyDecisionRationale"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AutonomyDecisionRationale_organizationId_outcome_createdAt_idx" ON "AutonomyDecisionRationale"("organizationId", "outcome", "createdAt");

-- CreateIndex
CREATE INDEX "AutonomyDecisionRationale_candidateId_createdAt_idx" ON "AutonomyDecisionRationale"("candidateId", "createdAt");
