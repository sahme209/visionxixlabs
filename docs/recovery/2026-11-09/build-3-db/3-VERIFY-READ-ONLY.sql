-- Build 3 database verification. READ-ONLY.
SELECT
  (SELECT max(migration_name) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL) AS latest_applied,
  (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished,
  to_regclass('public."AgentGatewayRequest"') IS NOT NULL AS gateway_table_exists,
  to_regclass('public."AuditSeal"') IS NOT NULL AS seal_table_exists,
  (SELECT count(*) FROM public."AgentGatewayRequest") AS gateway_rows,
  (SELECT count(*) FROM public."AuditSeal") AS seal_rows;
-- Expected: latest_applied = 20261109100000_add_audit_seal, unfinished = 0, both tables true, 0 rows each.
