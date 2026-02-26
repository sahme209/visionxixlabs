-- Phase 9: SalesPipelineSnapshot for admin dashboard
CREATE TABLE "SalesPipelineSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "highUrgencyCount" INTEGER NOT NULL,
    "enterpriseLikelihoodAvg" DOUBLE PRECISION NOT NULL,
    "expansionProbabilityAvg" DOUBLE PRECISION NOT NULL,
    "avgStrategicReadiness" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SalesPipelineSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesPipelineSnapshot_createdAt_idx" ON "SalesPipelineSnapshot"("createdAt");
