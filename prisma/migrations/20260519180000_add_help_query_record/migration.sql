-- CreateTable
CREATE TABLE "HelpQueryRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "query" TEXT NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "primaryEntryId" TEXT,
    "topHitScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpQueryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HelpQueryRecord_createdAt_idx" ON "HelpQueryRecord"("createdAt");

-- CreateIndex
CREATE INDEX "HelpQueryRecord_verdict_createdAt_idx" ON "HelpQueryRecord"("verdict", "createdAt");

-- CreateIndex
CREATE INDEX "HelpQueryRecord_organizationId_createdAt_idx" ON "HelpQueryRecord"("organizationId", "createdAt");
