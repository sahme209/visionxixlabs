-- Phase 513 — AutonomousTickLog scaffold.

-- CreateTable
CREATE TABLE "AutonomousTickLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "totalRuns" INTEGER NOT NULL,
    "okRuns" INTEGER NOT NULL,
    "errorRuns" INTEGER NOT NULL,
    "skippedRuns" INTEGER NOT NULL,
    "reportJson" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutonomousTickLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutonomousTickLog_organizationId_generatedAt_idx" ON "AutonomousTickLog"("organizationId", "generatedAt");
