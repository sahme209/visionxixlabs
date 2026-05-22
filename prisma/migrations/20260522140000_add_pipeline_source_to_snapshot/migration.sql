-- Pipeline-sourced approval snapshots — Phase 378.
--
-- Snapshots are now minted from two sources:
--   1. engineer_action — Phase 369; gated engineer attempt asks for
--      approval and lands as a snapshot tied to attemptId.
--   2. pipeline_stage  — Phase 378; pipeline runner pauses at an
--      approval_gate stage and mints a snapshot tied to a
--      PipelineStageRun. Terminal vote auto-resumes the pipeline.
--
-- sourceKind is the discriminator. pipelineStageRunId is the FK back
-- to the stage row when sourceKind="pipeline_stage". Existing rows
-- default to "engineer_action" — no backfill needed.

ALTER TABLE "EngineerApprovalSnapshot"
  ADD COLUMN "sourceKind" TEXT NOT NULL DEFAULT 'engineer_action';
ALTER TABLE "EngineerApprovalSnapshot"
  ADD COLUMN "pipelineStageRunId" TEXT;

CREATE INDEX "EngineerApprovalSnapshot_pipelineStageRunId_idx"
  ON "EngineerApprovalSnapshot"("pipelineStageRunId");

ALTER TABLE "EngineerApprovalSnapshot"
  ADD CONSTRAINT "EngineerApprovalSnapshot_pipelineStageRunId_fkey"
  FOREIGN KEY ("pipelineStageRunId") REFERENCES "PipelineStageRun"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
