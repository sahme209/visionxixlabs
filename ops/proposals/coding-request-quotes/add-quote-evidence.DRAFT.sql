-- DRAFT ONLY. No production execution is authorized by this file.
-- Separate target/backup/cutover review and specific apply approval are required.
-- Intentionally outside prisma/migrations; never use a generic migration runner.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public."PipelineAICallReservation" IN ACCESS EXCLUSIVE MODE;
DO $quote_preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PipelineAICallReservation'
      AND column_name IN ('admissionContract', 'quoteEvidence')
  ) THEN
    RAISE EXCEPTION 'Quote columns already present or partially applied; inspect without retry';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PipelineAICallReservation'
      AND column_name = 'estimatedCents' AND data_type = 'integer'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Expected existing coding ledger shape is absent';
  END IF;
END
$quote_preflight$;
ALTER TABLE public."PipelineAICallReservation"
  ADD COLUMN "admissionContract" TEXT NOT NULL DEFAULT 'coding_fixed_hold_v1',
  ADD COLUMN "quoteEvidence" JSONB;
DO $quote_postcondition$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public."PipelineAICallReservation"
    WHERE "admissionContract" <> 'coding_fixed_hold_v1'
       OR "quoteEvidence" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Historical fixed-hold defaults do not match';
  END IF;
END
$quote_postcondition$;
COMMIT;
