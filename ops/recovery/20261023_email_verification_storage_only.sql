-- Additive email-verification storage recovery. No account is verified,
-- password changed, token issued or email sent by this script.
BEGIN;
SET LOCAL search_path TO public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $fence$
BEGIN
  IF NOT pg_try_advisory_xact_lock(72707369) THEN
    RAISE EXCEPTION 'email_verification_migration_runner_busy';
  END IF;
END
$fence$;
LOCK TABLE public."_prisma_migrations" IN SHARE MODE;
DO $preconditions$
BEGIN
  IF current_database() <> 'neondb'
     OR current_setting('server_version_num')::int / 10000 <> 17
     OR to_regclass('public."User"') IS NULL
     OR to_regclass('public."WorkspaceAgentIdentity"') IS NULL
     OR to_regclass('public."DurableAgentWorkflow"') IS NULL THEN
    RAISE EXCEPTION 'email_verification_expected_baseline_missing';
  END IF;
  IF to_regclass('public."EmailVerificationToken"') IS NOT NULL
     OR EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
       AND table_name='User' AND column_name='emailVerifiedAt') THEN
    RAISE EXCEPTION 'email_verification_storage_already_present_or_partial';
  END IF;
  IF (SELECT count(*) FROM "_prisma_migrations"
      WHERE migration_name = '20261013172000_add_workspace_agent_identity'
        AND finished_at IS NULL AND rolled_back_at IS NULL
        AND checksum = '761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7') <> 1
     OR EXISTS (SELECT 1 FROM "_prisma_migrations"
      WHERE migration_name = '20261014120000_add_email_verification'
        AND (finished_at IS NOT NULL OR rolled_back_at IS NULL)) THEN
    RAISE EXCEPTION 'email_verification_migration_state_changed';
  END IF;
END
$preconditions$;
-- Credentials accounts remain unverified until the holder completes the
-- one-time email proof. OAuth/SSO behavior is unchanged.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
