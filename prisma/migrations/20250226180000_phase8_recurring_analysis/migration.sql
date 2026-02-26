-- Phase 8: Recurring analysis for Growth+/Enterprise
CREATE TABLE "RecurringAnalysis" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringAnalysis_leadId_idx" ON "RecurringAnalysis"("leadId");
CREATE INDEX "RecurringAnalysis_nextRunAt_idx" ON "RecurringAnalysis"("nextRunAt");
