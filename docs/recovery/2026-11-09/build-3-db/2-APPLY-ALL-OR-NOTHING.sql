-- Build 3 database step: two ADDITIVE tables + their migration ledger rows.
-- All-or-nothing: any failed check raises and the whole block rolls back.
-- Creates only new tables/indexes (IF NOT EXISTS); alters and drops nothing existing.
DO $$
DECLARE n integer; latest text;
BEGIN
  -- Prechecks ----------------------------------------------------------------
  SELECT max(migration_name) INTO latest FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;
  IF latest <> '20261108120000_add_pipeline_ai_call_quote_fields' THEN RAISE EXCEPTION 'precheck: unexpected latest migration %', latest; END IF;
  SELECT count(*) INTO n FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'precheck: % unfinished migrations', n; END IF;
  SELECT count(*) INTO n FROM "_prisma_migrations" WHERE migration_name IN ('20261109090000_add_agent_gateway_request','20261109100000_add_audit_seal');
  IF n <> 0 THEN RAISE EXCEPTION 'precheck: ledger already has % of these rows', n; END IF;

  -- A. 20261109090000_add_agent_gateway_request (exact migration SQL) ---------
CREATE TABLE IF NOT EXISTS "AgentGatewayRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "actionKind" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "policyDecision" TEXT NOT NULL,
    "policyReasons" JSONB NOT NULL,
    "actionDigest" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedByUserId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "outcome" TEXT,
    "outcomeDetail" TEXT,
    "outcomeAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentGatewayRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentGatewayRequest_organizationId_status_createdAt_idx" ON "AgentGatewayRequest"("organizationId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentGatewayRequest_apiKeyId_createdAt_idx" ON "AgentGatewayRequest"("apiKeyId", "createdAt");

  -- B. 20261109100000_add_audit_seal (exact migration SQL) --------------------
CREATE TABLE IF NOT EXISTS "AuditSeal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "fromCreatedAt" TIMESTAMP(3) NOT NULL,
    "toCreatedAt" TIMESTAMP(3) NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "eventsRoot" TEXT NOT NULL,
    "prevSealHash" TEXT NOT NULL,
    "sealHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditSeal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AuditSeal_organizationId_sequence_key" ON "AuditSeal"("organizationId", "sequence");
CREATE INDEX IF NOT EXISTS "AuditSeal_organizationId_toCreatedAt_idx" ON "AuditSeal"("organizationId", "toCreatedAt");

  -- C. Ledger rows (checksum = sha256 of each migration.sql) -------------------
  INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
  VALUES (gen_random_uuid()::text, '30fdfebae60c9a44f4f31044c67836a7fb388e889f6017784d61e9976b69350e', now(), '20261109090000_add_agent_gateway_request', NULL, NULL, now(), 1),
         (gen_random_uuid()::text, '4e2dd4100891c0caaf5328503e1b77be2e8334deead96ce7e474ad29ff60428c', now(), '20261109100000_add_audit_seal', NULL, NULL, now(), 1);

  -- Postchecks ---------------------------------------------------------------
  IF to_regclass('public."AgentGatewayRequest"') IS NULL THEN RAISE EXCEPTION 'postcheck: AgentGatewayRequest missing'; END IF;
  IF to_regclass('public."AuditSeal"') IS NULL THEN RAISE EXCEPTION 'postcheck: AuditSeal missing'; END IF;
  IF to_regclass('public."AuditSeal_organizationId_sequence_key"') IS NULL THEN RAISE EXCEPTION 'postcheck: seal unique index missing'; END IF;
  SELECT max(migration_name) INTO latest FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;
  IF latest <> '20261109100000_add_audit_seal' THEN RAISE EXCEPTION 'postcheck: latest is %', latest; END IF;
END $$;
