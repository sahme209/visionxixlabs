-- Phase 400: per-stage cost telemetry on PipelineStageRun.
-- Indexed for fast run-level rollup queries (SUM costCents WHERE runId = ?).

ALTER TABLE "PipelineStageRun"
    ADD COLUMN "costCents"    INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "tokensInput"  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "tokensOutput" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "latencyMs"    INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "PipelineStageRun_runId_costCents_idx"
    ON "PipelineStageRun"("runId", "costCents");
