# Build 3 database step: agent gateway and audit seal tables (needs the owner's go-ahead)

Production build 3 includes the agent governance gateway (A10). It needs one **additive** migration before the new code serves traffic:

- `prisma/migrations/20261109090000_add_agent_gateway_request/migration.sql` creates the `AgentGatewayRequest` table and two indexes.
- `prisma/migrations/20261109100000_add_audit_seal/migration.sql` creates the `AuditSeal` table, a unique `(organizationId, sequence)` index and one index.

Both use `IF NOT EXISTS` and neither alters or drops an existing table or column.

Order for build 3:
1. Run `READ-ONLY-CHECK.sql`. It should still report latest = `20261108120000_add_pipeline_ai_call_quote_fields` and zero unfinished migrations.
2. With the owner's explicit go-ahead, apply the migration (the `production-db-migrate` workflow, or `prisma migrate deploy`).
3. Re-check: latest = `20261109100000_add_audit_seal`, `AgentGatewayRequest` and `AuditSeal` exist, zero unfinished migrations. Then update `READ-ONLY-CHECK.sql` to expect the new latest.
4. Deploy build 3.

If the step is skipped, everything else in build 3 works. Only the gateway routes, `/dashboard/agent-gateway` and the audit seal/verify on `/dashboard/trust-tools` fail, and they fail closed. Policy replay and impact preview need no new table.
