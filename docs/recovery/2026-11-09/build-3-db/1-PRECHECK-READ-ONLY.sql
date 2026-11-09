-- Build 3 database pre-check. READ-ONLY: changes nothing.
SELECT
  (SELECT max(migration_name) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL) AS latest_applied,
  (SELECT count(*) FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished,
  to_regclass('public."AgentGatewayRequest"') IS NOT NULL AS gateway_table_exists,
  to_regclass('public."AuditSeal"') IS NOT NULL AS seal_table_exists,
  (SELECT count(*) FROM public."_prisma_migrations" WHERE migration_name IN ('20261109090000_add_agent_gateway_request','20261109100000_add_audit_seal')) AS new_ledger_rows;
-- Expected: latest_applied = 20261108120000_add_pipeline_ai_call_quote_fields, unfinished = 0,
-- gateway_table_exists = false, seal_table_exists = false, new_ledger_rows = 0.
