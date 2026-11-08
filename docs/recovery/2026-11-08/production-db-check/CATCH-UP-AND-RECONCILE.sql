-- =====================================================================================
-- Axiom production catch-up and migration-history reconcile (2026-11-08)
-- REVIEWED SCRIPT — WRITES TO PRODUCTION. Run ONLY on the user's explicit go-ahead.
--
-- Where: Neon project odd-union-57413470, branch main, database neondb, SQL Editor.
-- Recovery: 6-hour restore window + manual snapshot "main at 2026-11-08 17:59:32 UTC".
--
-- One DO block = one statement = all or nothing. Any failed check raises and NOTHING changes.
-- Equivalent to the adopted sequence in RECONCILE-PLAN.md, done in SQL because Node/Prisma
-- cannot run here (npm blocker):
--   A. Pre-checks (exact current state from read-only checks 1–6; refuses on any surprise)
--   B. Record the 11 verified migrations as applied   (= prisma migrate resolve --applied)
--   C. Mark the failed agent migration rolled back     (= prisma migrate resolve --rolled-back)
--   D. Record its reviewed NON-GRANTING revision as applied (table already exists; seeds nothing)
--   E. Add the 2 quote columns and record their new migration
--   F. Add the one truly missing index, Lead_source_idx
--   G. Post-checks
-- Checksums are SHA-256 of each repo migration.sql (Prisma's checksum), computed from
-- branch db/converge-production-history.
-- NOT included (separate decisions): the read-only Agent seed (AGENT-IDENTITY-SEED-READONLY.sql),
-- and the 2 extra columns (AuditEvent.status has a default, Lead.phone is nullable — harmless).
-- =====================================================================================
DO $$
DECLARE
  applied CONSTANT text[][] := ARRAY[
    ['20261013193000_add_durable_agent_workflow',          '8a4885e5ca748fd160cf03abfd6ed2c29ce9a390ff89da66967d769ebd70fb75'],
    ['20261013220000_add_founding_supporters',             'ff4b27e0c309b364774948ed47b59b8a42a48af22c6a882ce908f7af8bb792e0'],
    ['20261014090000_add_ai_usage_stripe_settlement',      '5452120f75ffaef7c48e82cb2f6b634f18f853ff23ede3d559a6322b3ee242da'],
    ['20261014120000_add_email_verification',              'ad968345199bb9fa84add0340777631f99d5583aafe1949790051ccdf6d9873f'],
    ['20261014190000_verified_ai_credit_fulfillment',      '226d6c1e3fff21fd3a6a1b88906a2524b7cfd6173f78f58af1ea2efa2102f35f'],
    ['20261014210000_ai_usage_reservations',               'edbce376d52c2e941373a045ff1e6029f892f08d670a3708197fc075972bfb8a'],
    ['20261016010000_cloud_account_enrollment',            'c8069f96117a46bdce012d5727c1b0e17aed3dc68018e884b7177baeafdabc7c'],
    ['20261016020000_cloud_account_credential_revocation', '888b6fd677f7d1fdcaab10ee375587912bbb102d9e266d263784ffdf9963de37'],
    ['20261016030000_ecs_release_review_core',             '7ecc5ea1180d6bd06cbc1e06081389d79dc6a9b321d0314c8bfa1ea7fec22522'],
    ['20261023220000_bind_legacy_cloud_tenant_relations',  '095823adafaa36495edf3c9d97d690a8717bdafc1d8edce656d0bab1cbde4072'],
    ['20261025174000_add_bot_saved_tasks',                 'bb4204b90b6242d81343a8a74fc77ed711d3b6b0f3ff356f38645a14bf2c3f1e']];
  agent CONSTANT text := '20261013172000_add_workspace_agent_identity';
  agent_revision CONSTANT text := 'fa3703cc048fe9f0f7c1285e44e01280725a2a39dd2a39e5411c52edbaca6ec4';
  quote CONSTANT text := '20261108120000_add_pipeline_ai_call_quote_fields';
  quote_checksum CONSTANT text := '70b815339b0a28ac9f5a57f3e7bd3e82d4b3a2912640e0bdff096216102f32da';
  n int; i int;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM set_config('statement_timeout', '60s', true);

  -- A. Pre-checks ---------------------------------------------------------------------
  SELECT count(*) INTO n FROM "_prisma_migrations"
   WHERE migration_name = agent AND finished_at IS NULL AND rolled_back_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'precheck: expected exactly 1 failed row for %, found %', agent, n; END IF;
  SELECT count(*) INTO n FROM "_prisma_migrations" WHERE migration_name = agent;
  IF n <> 1 THEN RAISE EXCEPTION 'precheck: expected 1 total row for %, found %', agent, n; END IF;
  SELECT count(*) INTO n FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;
  IF n <> 1 THEN RAISE EXCEPTION 'precheck: expected 1 unfinished migration overall, found %', n; END IF;
  FOR i IN 1..array_length(applied, 1) LOOP
    SELECT count(*) INTO n FROM "_prisma_migrations" WHERE migration_name = applied[i][1];
    IF n <> 0 THEN RAISE EXCEPTION 'precheck: % is already recorded', applied[i][1]; END IF;
  END LOOP;
  SELECT count(*) INTO n FROM "_prisma_migrations" WHERE migration_name = quote;
  IF n <> 0 THEN RAISE EXCEPTION 'precheck: % is already recorded', quote; END IF;
  IF to_regclass('public."WorkspaceAgentIdentity"') IS NULL THEN RAISE EXCEPTION 'precheck: WorkspaceAgentIdentity missing'; END IF;
  IF to_regclass('public."PipelineAICallReservation"') IS NULL THEN RAISE EXCEPTION 'precheck: PipelineAICallReservation missing'; END IF;
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'PipelineAICallReservation' AND column_name IN ('admissionContract', 'quoteEvidence');
  IF n <> 0 THEN RAISE EXCEPTION 'precheck: quote columns already present (%)', n; END IF;
  IF to_regclass('public."Lead_source_idx"') IS NOT NULL THEN RAISE EXCEPTION 'precheck: Lead_source_idx already exists'; END IF;

  -- B. Record the 11 verified migrations as applied (objects verified by checks 3–6) ------
  FOR i IN 1..array_length(applied, 1) LOOP
    INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES (gen_random_uuid()::text, applied[i][2], now(), applied[i][1], NULL, NULL, now(), 0);
  END LOOP;

  -- C. The failed agent migration applied nothing itself: mark it rolled back (truthful) --
  UPDATE "_prisma_migrations" SET rolled_back_at = now()
   WHERE migration_name = agent AND finished_at IS NULL AND rolled_back_at IS NULL;

  -- D. Its reviewed non-granting revision is CREATE TABLE IF NOT EXISTS only: a no-op here --
  INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, agent_revision, now(), agent, NULL, NULL, now(), 1);

  -- E. Quote columns (metadata-only, constant default; PipelineAICallReservation has 0 rows) --
  ALTER TABLE "PipelineAICallReservation" ADD COLUMN "admissionContract" TEXT NOT NULL DEFAULT 'coding_fixed_hold_v1';
  ALTER TABLE "PipelineAICallReservation" ADD COLUMN "quoteEvidence" JSONB;
  INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, quote_checksum, now(), quote, NULL, NULL, now(), 1);

  -- F. The one truly missing index (from 20260219120000_add_lead_model) ---------------------
  CREATE INDEX "Lead_source_idx" ON "Lead"("source");

  -- G. Post-checks --------------------------------------------------------------------------
  SELECT count(*) INTO n FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'postcheck: % unfinished migrations remain', n; END IF;
  SELECT count(*) INTO n FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'PipelineAICallReservation'
     AND ((column_name = 'admissionContract' AND data_type = 'text' AND is_nullable = 'NO')
       OR (column_name = 'quoteEvidence' AND data_type = 'jsonb' AND is_nullable = 'YES'));
  IF n <> 2 THEN RAISE EXCEPTION 'postcheck: quote columns wrong (%)', n; END IF;
  IF to_regclass('public."Lead_source_idx"') IS NULL THEN RAISE EXCEPTION 'postcheck: Lead_source_idx missing'; END IF;
  SELECT count(*) INTO n FROM "WorkspaceAgentIdentity";
  RAISE NOTICE 'CATCH-UP COMPLETE: 13 history rows written, 2 columns, 1 index. WorkspaceAgentIdentity rows unchanged: %', n;
END $$;

-- Result row to paste back (read-only):
SELECT
  (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS migrations_unfinished,
  (SELECT max(migration_name) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL)            AS latest_applied,
  (SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PipelineAICallReservation'
      AND column_name IN ('admissionContract', 'quoteEvidence'))                                    AS quote_columns,
  to_regclass('public."Lead_source_idx"') IS NOT NULL                                               AS lead_source_idx;
