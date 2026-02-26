-- Phase 7: Enterprise Hardening
-- Add scoringVersion to AxiomScoreSnapshot
ALTER TABLE "AxiomScoreSnapshot" ADD COLUMN "scoringVersion" TEXT;

-- Add userId to Lead for identity tie-in
ALTER TABLE "Lead" ADD COLUMN "userId" TEXT;

-- CreateIndex for Lead.userId
CREATE INDEX "Lead_userId_idx" ON "Lead"("userId");
