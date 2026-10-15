-- PROPOSAL ONLY. Production execution and ledger resolution require explicit approval.
-- Auth-only additive repair; does not resolve or retry the failed Agent migration.
BEGIN;
SET LOCAL search_path TO public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preconditions$
BEGIN
  IF to_regclass('public."User"') IS NULL
     OR to_regclass('public."_prisma_migrations"') IS NULL THEN
    RAISE EXCEPTION 'auth_recovery_expected_baseline_missing';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'emailVerifiedAt')
     OR to_regclass('public."EmailVerificationToken"') IS NOT NULL THEN
    RAISE EXCEPTION 'auth_recovery_schema_already_present_or_partial';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    WHERE c.conrelid = 'public."User"'::regclass AND c.contype = 'p'
      AND array_length(c.conkey, 1) = 1 AND a.attname = 'id'
      AND a.atttypid = 'text'::regtype AND a.attnotnull
  ) THEN
    RAISE EXCEPTION 'auth_recovery_user_primary_key_drift';
  END IF;
  IF (SELECT count(*) FROM "_prisma_migrations"
      WHERE migration_name = '20261013172000_add_workspace_agent_identity'
        AND finished_at IS NULL AND rolled_back_at IS NULL
        AND checksum = '761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7') <> 1
     OR EXISTS (SELECT 1 FROM "_prisma_migrations"
      WHERE migration_name = '20261014120000_add_email_verification') THEN
    RAISE EXCEPTION 'auth_recovery_migration_state_changed';
  END IF;
END
$preconditions$;
-- BEGIN UNCHANGED AUTH MIGRATION
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

-- END UNCHANGED AUTH MIGRATION
COMMIT;
