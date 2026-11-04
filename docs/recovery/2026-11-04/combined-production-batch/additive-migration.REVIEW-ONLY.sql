-- AlterTable
ALTER TABLE "PipelineStageRun" ADD COLUMN     "aiClaimGeneration" TEXT;

-- CreateTable
CREATE TABLE "PipelineAICallReservation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stageRunId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "claimGeneration" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "workspaceReservationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "estimatedCents" INTEGER NOT NULL,
    "capCents" INTEGER,
    "capSource" TEXT NOT NULL,
    "allocationPolicy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "usageEventId" TEXT,
    "externalUsageId" TEXT,
    "providerCents" INTEGER,
    "integrityError" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineAICallReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PipelineAICallReservation_workspaceReservationId_key" ON "PipelineAICallReservation"("workspaceReservationId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineAICallReservation_usageEventId_key" ON "PipelineAICallReservation"("usageEventId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineAICallReservation_externalUsageId_key" ON "PipelineAICallReservation"("externalUsageId");

-- CreateIndex
CREATE INDEX "PipelineAICallReservation_runId_status_idx" ON "PipelineAICallReservation"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineAICallReservation_organizationId_workspaceReservati_key" ON "PipelineAICallReservation"("organizationId", "workspaceReservationId");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineAICallReservation_organizationId_stageRunId_phase_key" ON "PipelineAICallReservation"("organizationId", "stageRunId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineAICallReservation_organizationId_idempotencyKey_key" ON "PipelineAICallReservation"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineRun_organizationId_id_key" ON "PipelineRun"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStageRun_runId_id_key" ON "PipelineStageRun"("runId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AIUsageReservation_organizationId_id_key" ON "AIUsageReservation"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "PipelineAICallReservation" ADD CONSTRAINT "PipelineAICallReservation_organizationId_runId_fkey" FOREIGN KEY ("organizationId", "runId") REFERENCES "PipelineRun"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineAICallReservation" ADD CONSTRAINT "PipelineAICallReservation_runId_stageRunId_fkey" FOREIGN KEY ("runId", "stageRunId") REFERENCES "PipelineStageRun"("runId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineAICallReservation" ADD CONSTRAINT "PipelineAICallReservation_organizationId_workspaceReservat_fkey" FOREIGN KEY ("organizationId", "workspaceReservationId") REFERENCES "AIUsageReservation"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

