-- Internal VisionXIXLabs growth autopilot — Phase 2
-- Adds image fields to LinkedInPostDraft + a GrowthAutopilotDecision
-- log so every auto-publish decision is auditable.

-- AlterTable: image fields on LinkedInPostDraft
ALTER TABLE "LinkedInPostDraft"
    ADD COLUMN "imageUrl"          TEXT,
    ADD COLUMN "imageUrn"          TEXT,
    ADD COLUMN "imagePrompt"       TEXT,
    ADD COLUMN "hallucinationScore" DOUBLE PRECISION,
    ADD COLUMN "hallucinationNotes" TEXT,
    ADD COLUMN "autopilotEligible"  BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: audit row per autopilot run
CREATE TABLE "GrowthAutopilotDecision" (
    "id"                 TEXT NOT NULL,
    "ranAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Closed-union: published | queued_for_review | killed | disabled | error
    "decision"           TEXT NOT NULL,
    "draftId"            TEXT,
    "draftsConsidered"   INTEGER NOT NULL DEFAULT 0,
    "bestConfidence"     DOUBLE PRECISION,
    "bestHallucinationScore" DOUBLE PRECISION,
    "threshold"          DOUBLE PRECISION NOT NULL,
    "scheduledFor"       TIMESTAMP(3),
    "reason"             TEXT,
    "detail"             JSONB,

    CONSTRAINT "GrowthAutopilotDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GrowthAutopilotDecision_ranAt_idx" ON "GrowthAutopilotDecision"("ranAt");
CREATE INDEX "GrowthAutopilotDecision_decision_idx" ON "GrowthAutopilotDecision"("decision");
CREATE INDEX "GrowthAutopilotDecision_draftId_idx" ON "GrowthAutopilotDecision"("draftId");
