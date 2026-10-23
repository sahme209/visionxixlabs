-- Additive, empty cloud-enrollment storage only. No account, credential,
-- provider connection, Agent permission or migration-ledger row is created.
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $fence$
BEGIN
  IF NOT pg_try_advisory_xact_lock(72707369) THEN RAISE EXCEPTION 'cloud_storage_migration_runner_busy'; END IF;
END $fence$;
LOCK TABLE public."_prisma_migrations" IN SHARE MODE;
DO $baseline$
BEGIN
  IF current_database()<>'neondb' OR current_setting('server_version_num')::int/10000<>17
     OR to_regclass('public."User"') IS NULL
     OR to_regclass('public."WorkspaceAgentIdentity"') IS NULL
     OR to_regclass('public."DurableAgentWorkflow"') IS NULL
     OR to_regclass('public."EmailVerificationToken"') IS NULL THEN
    RAISE EXCEPTION 'cloud_storage_expected_baseline_required';
  END IF;
  IF to_regclass('public."CloudAccount"') IS NOT NULL
     OR to_regclass('public."CloudAccountCredential"') IS NOT NULL
     OR to_regclass('public."CloudAccountEnrollmentAttempt"') IS NOT NULL THEN
    RAISE EXCEPTION 'cloud_storage_already_present_or_partial';
  END IF;
  IF (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name='20261013172000_add_workspace_agent_identity'
      AND checksum='761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7'
      AND finished_at IS NULL AND rolled_back_at IS NULL)<>1
     OR EXISTS(SELECT 1 FROM public."_prisma_migrations" WHERE migration_name IN
       ('20261016010000_cloud_account_enrollment','20261016020000_cloud_account_credential_revocation')
       AND (finished_at IS NOT NULL OR rolled_back_at IS NULL)) THEN
    RAISE EXCEPTION 'cloud_storage_migration_state_changed';
  END IF;
  IF NOT has_schema_privilege(current_user,'public','CREATE')
     OR current_user<>(SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public."User"'::regclass) THEN
    RAISE EXCEPTION 'cloud_storage_application_owner_required';
  END IF;
  IF EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtenabled<>'D')
     OR EXISTS(SELECT 1 FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE d.defaclrole=(SELECT relowner FROM pg_class WHERE oid='public."User"'::regclass) AND (d.defaclnamespace=0 OR n.nspname='public')) THEN
    RAISE EXCEPTION 'cloud_storage_access_defaults_changed';
  END IF;
END $baseline$;

DO $guard$
DECLARE labels text[];
BEGIN
  IF to_regtype('public."CloudProvider"') IS NULL THEN
    CREATE TYPE public."CloudProvider" AS ENUM ('aws', 'azure', 'gcp');
  ELSE
    SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e WHERE e.enumtypid = 'public."CloudProvider"'::regtype;
    IF labels IS DISTINCT FROM ARRAY['aws','azure','gcp'] THEN
      RAISE EXCEPTION 'cloud_enrollment_incompatible_CloudProvider';
    END IF;
  END IF;
  IF to_regtype('public."AutopilotMode"') IS NULL THEN
    CREATE TYPE public."AutopilotMode" AS ENUM ('observe_only', 'recommend', 'assisted_apply', 'full_guarded');
  ELSE
    SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e WHERE e.enumtypid = 'public."AutopilotMode"'::regtype;
    IF labels IS DISTINCT FROM ARRAY['observe_only','recommend','assisted_apply','full_guarded'] THEN
      RAISE EXCEPTION 'cloud_enrollment_incompatible_AutopilotMode';
    END IF;
  END IF;
  IF to_regclass('public."CloudAccountCredential"') IS NOT NULL OR
     to_regclass('public."CloudAccountEnrollmentAttempt"') IS NOT NULL THEN
    RAISE EXCEPTION 'cloud_enrollment_partial_or_already_present';
  END IF;
  -- A pre-existing canonical account table is allowed only with exact column
  -- names/types/nullability. Never silently adapt a legacy account layout.
  IF to_regclass('public."CloudAccount"') IS NOT NULL AND (
    SELECT jsonb_object_agg(column_name, jsonb_build_array(udt_name, is_nullable))
    FROM information_schema.columns WHERE table_schema='public' AND table_name='CloudAccount'
  ) IS DISTINCT FROM '{"id":["text","NO"],"organizationId":["text","NO"],"provider":["CloudProvider","NO"],"externalAccountId":["text","NO"],"alias":["text","YES"],"credentialRef":["text","YES"],"regions":["_text","NO"],"autopilotMode":["AutopilotMode","NO"],"connectedAt":["timestamp","NO"],"lastScannedAt":["timestamp","YES"],"enabled":["bool","NO"],"createdAt":["timestamp","NO"],"updatedAt":["timestamp","NO"]}'::jsonb THEN
    RAISE EXCEPTION 'cloud_enrollment_incompatible_CloudAccount';
  END IF;
  IF to_regclass('public."CloudAccount"') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c WHERE c.conrelid='public."CloudAccount"'::regclass AND c.contype='p'
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='id')]::smallint[]
    ) THEN RAISE EXCEPTION 'cloud_enrollment_incompatible_CloudAccount_primary_key'; END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='CloudAccount' AND column_name='autopilotMode' AND column_default LIKE '''observe_only''::%') THEN
      RAISE EXCEPTION 'cloud_enrollment_incompatible_CloudAccount_default';
    END IF;
  END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS public."CloudAccount" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" public."CloudProvider" NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "alias" TEXT,
  "credentialRef" TEXT,
  "regions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "autopilotMode" public."AutopilotMode" NOT NULL DEFAULT 'observe_only',
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastScannedAt" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CloudAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CloudAccount_id_organizationId_key" ON public."CloudAccount"("id", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "CloudAccount_organizationId_provider_externalAccountId_key" ON public."CloudAccount"("organizationId", "provider", "externalAccountId");
CREATE INDEX IF NOT EXISTS "CloudAccount_organizationId_idx" ON public."CloudAccount"("organizationId");
CREATE INDEX IF NOT EXISTS "CloudAccount_provider_idx" ON public."CloudAccount"("provider");

-- A same-named pre-existing index is not evidence that its key is correct.
DO $indexes$
DECLARE entry record; actual text[];
BEGIN
  FOR entry IN SELECT * FROM (VALUES
    ('CloudAccount_id_organizationId_key', ARRAY['id','organizationId']::text[]),
    ('CloudAccount_organizationId_provider_externalAccountId_key', ARRAY['organizationId','provider','externalAccountId']::text[])
  ) AS required(name, columns) LOOP
    SELECT array_agg(a.attname::text ORDER BY key.ordinality) INTO actual
    FROM pg_index i JOIN pg_class index_relation ON index_relation.oid=i.indexrelid
    JOIN pg_namespace n ON n.oid=index_relation.relnamespace
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY key(attnum, ordinality)
    JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=key.attnum
    WHERE n.nspname='public' AND index_relation.relname=entry.name
      AND i.indrelid='public."CloudAccount"'::regclass AND i.indisunique AND i.indisvalid AND i.indisready
      AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts=i.indnatts;
    IF actual IS DISTINCT FROM entry.columns THEN
      RAISE EXCEPTION 'cloud_enrollment_incompatible_CloudAccount_unique_index';
    END IF;
  END LOOP;
END $indexes$;

CREATE TABLE public."CloudAccountCredential" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "encryptedConfiguration" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "validatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CloudAccountCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CloudAccountCredential_version_check" CHECK ("version" >= 1),
  CONSTRAINT "CloudAccountCredential_id_organizationId_fkey" FOREIGN KEY ("id", "organizationId") REFERENCES public."CloudAccount"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CloudAccountCredential_id_organizationId_key" ON public."CloudAccountCredential"("id", "organizationId");
CREATE INDEX "CloudAccountCredential_organizationId_idx" ON public."CloudAccountCredential"("organizationId");

CREATE TABLE public."CloudAccountEnrollmentAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expectedAccountId" TEXT NOT NULL,
  "roleArn" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "externalIdDigest" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "expectedCredentialVersion" INTEGER,
  "expectedAccountUpdatedAt" TIMESTAMP(3),
  "cloudAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CloudAccountEnrollmentAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CloudAccountEnrollmentAttempt_digest_check" CHECK ("externalIdDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "CloudAccountEnrollmentAttempt_version_check" CHECK ("expectedCredentialVersion" IS NULL OR "expectedCredentialVersion" >= 1),
  CONSTRAINT "CloudAccountEnrollmentAttempt_cloudAccountId_organizationId_fkey" FOREIGN KEY ("cloudAccountId", "organizationId") REFERENCES public."CloudAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CloudAccountEnrollmentAttempt_organizationId_userId_expiresAt_idx" ON public."CloudAccountEnrollmentAttempt"("organizationId", "userId", "expiresAt");
CREATE INDEX "CloudAccountEnrollmentAttempt_cloudAccountId_organizationId_idx" ON public."CloudAccountEnrollmentAttempt"("cloudAccountId", "organizationId");

DO $$
DECLARE
  relation_oid oid := to_regclass('public."CloudAccountCredential"');
BEGIN
  IF relation_oid IS NULL OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=relation_oid AND relkind='r') THEN
    RAISE EXCEPTION 'cloud_revocation_credentials_table_required';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='CloudAccountCredential' AND column_name='revokedAt') THEN
    RAISE EXCEPTION 'cloud_revocation_column_already_present';
  END IF;
  IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='CloudAccountCredential') <> 7
    OR EXISTS (
      SELECT 1 FROM (VALUES
        ('id','text',NULL::integer), ('organizationId','text',NULL::integer), ('encryptedConfiguration','text',NULL::integer),
        ('version','integer',NULL::integer), ('validatedAt','timestamp without time zone',3),
        ('createdAt','timestamp without time zone',3), ('updatedAt','timestamp without time zone',3)
      ) AS required(name, data_type, precision)
      LEFT JOIN information_schema.columns c ON c.table_schema='public' AND c.table_name='CloudAccountCredential' AND c.column_name=required.name
      WHERE c.column_name IS NULL OR c.data_type<>required.data_type OR c.is_nullable<>'NO'
         OR (required.precision IS NOT NULL AND c.datetime_precision<>required.precision)
    ) THEN
    RAISE EXCEPTION 'cloud_revocation_incompatible_credentials_shape';
  END IF;
END $$;
-- Existing credentials remain unrevoked. No account/configuration row is changed.
ALTER TABLE public."CloudAccountCredential" ADD COLUMN "revokedAt" TIMESTAMP(3);

COMMIT;
