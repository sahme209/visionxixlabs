# Build 3 database step: agent gateway table (needs the owner's go-ahead)

Production build 3 includes the agent governance gateway (A10). It needs one **additive** migration before the new code serves traffic:

- `prisma/migrations/20261109090000_add_agent_gateway_request/migration.sql` creates the `AgentGatewayRequest` table and two indexes (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). It does not alter or drop any existing table or column.

Order for build 3:
1. Run `READ-ONLY-CHECK.sql`. It should still report latest = `20261108120000_add_pipeline_ai_call_quote_fields` and zero unfinished migrations.
2. With the owner's explicit go-ahead, apply the migration (the `production-db-migrate` workflow, or `prisma migrate deploy`).
3. Re-check: latest = `20261109090000_add_agent_gateway_request`, `AgentGatewayRequest` exists, zero unfinished migrations. Then update `READ-ONLY-CHECK.sql` to expect the new latest.
4. Deploy build 3.

If the step is skipped, everything else in build 3 works. Only the gateway routes and `/dashboard/agent-gateway` fail, and they fail closed.
