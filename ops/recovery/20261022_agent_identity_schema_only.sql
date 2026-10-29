-- PROPOSAL ONLY. Do not execute without exact database-binding, recovery-point,
-- migration-ledger verification and explicit owner approval.
-- Additive identity schema only: NO organization backfill, identity enablement,
-- tool grants, ledger resolution or edits to historical migration files.
-- The failed migration remains unresolved; never mark its omitted backfill applied.
BEGIN;
SET LOCAL search_path TO public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preconditions$
BEGIN
  IF to_regclass('public."User"') IS NULL
     OR to_regclass('public."_prisma_migrations"') IS NULL THEN
    RAISE EXCEPTION 'agent_identity_expected_baseline_missing';
  END IF;
  IF to_regclass('public."WorkspaceAgentIdentity"') IS NOT NULL THEN
    RAISE EXCEPTION 'agent_identity_schema_already_present';
  END IF;
  IF (SELECT count(*) FROM "_prisma_migrations"
      WHERE migration_name = '20261013172000_add_workspace_agent_identity'
        AND finished_at IS NULL AND rolled_back_at IS NULL) <> 1
     OR NOT EXISTS (SELECT 1 FROM "_prisma_migrations"
      WHERE migration_name = '20261013172000_add_workspace_agent_identity'
        AND finished_at IS NULL AND rolled_back_at IS NULL
        AND checksum = '761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7')
     OR EXISTS (SELECT 1 FROM "_prisma_migrations"
      WHERE migration_name = '20261013172000_add_workspace_agent_identity'
        AND finished_at IS NOT NULL) THEN
    RAISE EXCEPTION 'agent_identity_migration_state_changed';
  END IF;
END
$preconditions$;
-- Unchanged CREATE TABLE portion only; empty store defaults to disabled.
CREATE TABLE "WorkspaceAgentIdentity" (
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT 'Axiom Agent',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedTools" JSONB NOT NULL DEFAULT '[]',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAgentIdentity_pkey" PRIMARY KEY ("organizationId")
);
COMMIT;
