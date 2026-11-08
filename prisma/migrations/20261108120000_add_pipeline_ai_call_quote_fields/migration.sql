-- Quote fields for prepaid AI call admission (reviewed additive fix, 2026-11-08).
-- Constant defaults are metadata-only on PostgreSQL 11+ (no table rewrite).
-- Idempotent so fresh databases and the reviewed production catch-up converge on one shape.
ALTER TABLE "PipelineAICallReservation" ADD COLUMN IF NOT EXISTS "admissionContract" TEXT NOT NULL DEFAULT 'coding_fixed_hold_v1';
ALTER TABLE "PipelineAICallReservation" ADD COLUMN IF NOT EXISTS "quoteEvidence" JSONB;
