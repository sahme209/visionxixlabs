-- Relation hardening only; no seeds, backfill, permissions or execution flags.
-- Generic production migration deployment remains subject to recovery preflight.
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $tenant_binding$
DECLARE target text; relation_oid oid; new_name text; relation_key smallint[]; account_key smallint[];
BEGIN
 FOREACH target IN ARRAY ARRAY['AxiomAgentRun','AxiomScheduledRun','AxiomAutopilotEvent'] LOOP
  relation_oid := to_regclass(format('public.%I', target));
  IF relation_oid IS NULL OR to_regclass('public."CloudAccount"') IS NULL THEN RAISE EXCEPTION 'legacy_cloud_storage_required_before_tenant_binding'; END IF;
  new_name := target || '_cloudAccountId_organizationId_fkey';
  SELECT ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=relation_oid AND attname='cloudAccountId' AND NOT attisdropped),(SELECT attnum FROM pg_attribute WHERE attrelid=relation_oid AND attname='organizationId' AND NOT attisdropped)]::smallint[] INTO relation_key;
  SELECT ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public."CloudAccount"'::regclass AND attname='id' AND NOT attisdropped),(SELECT attnum FROM pg_attribute WHERE attrelid='public."CloudAccount"'::regclass AND attname='organizationId' AND NOT attisdropped)]::smallint[] INTO account_key;
  IF array_position(relation_key,NULL) IS NOT NULL OR array_position(account_key,NULL) IS NOT NULL THEN RAISE EXCEPTION 'legacy_cloud_tenant_columns_required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=relation_oid AND conname=new_name) THEN
   EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY ("cloudAccountId", "organizationId") REFERENCES public."CloudAccount"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE',target,new_name);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=relation_oid AND conname=new_name AND contype='f' AND confrelid='public."CloudAccount"'::regclass AND conkey=relation_key AND confkey=account_key AND confupdtype='c' AND confdeltype='r' AND convalidated AND NOT condeferrable) THEN RAISE EXCEPTION 'legacy_cloud_tenant_constraint_mismatch'; END IF;
  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',target,target || '_cloudAccountId_fkey');
 END LOOP;
END $tenant_binding$;
COMMIT;
