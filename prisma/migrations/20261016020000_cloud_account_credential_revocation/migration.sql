-- Separate additive proposal. Never part of the authentication-only repair.
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
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
