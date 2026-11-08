-- Read-only production compatibility check (2026-11-08). One SELECT, no writes, no secrets in output.
-- Run by the user in the Neon console SQL editor on the PRODUCTION branch (Codex records: project odd-union-57413470, branch br-holy-voice-ai303o8m, database neondb).
SELECT
  (SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, '-'), ' | ' ORDER BY column_name)
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PipelineAICallReservation'
      AND column_name IN ('admissionContract', 'quoteEvidence', 'estimatedCents')) AS quote_columns,
  (SELECT count(*) FROM public."_prisma_migrations") AS migrations_total,
  (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS migrations_unfinished,
  (SELECT max(migration_name) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL) AS latest_applied_migration,
  (SELECT max(migration_name) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL) = '20261108120000_add_pipeline_ai_call_quote_fields' AS matches_repo_latest;
