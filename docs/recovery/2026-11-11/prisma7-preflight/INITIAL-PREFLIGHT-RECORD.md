# Prisma 7 initial production compatibility gate — mismatch observed

TypeScript PR #320 merged green as `a99c053f`. This is the next handoff item.
This preparation changes no schema, data, migration ledger or runtime setting.
It authorizes no production query by itself.

The owner approved the read-only check, then explicitly instructed Codex to run it.
Codex verified the recorded production branch and its compute through current Neon
metadata, then executed exactly the prepared SELECT once through the connector.
No connection string or credential was fetched. See `OBSERVED-RESULT.json`.

**Observed:** PostgreSQL 17.11, zero unfinished migrations, no unrecognized ledger
names, and all three reservation columns match. However, latest applied migration
is `20261108120000_add_pipeline_ai_call_quote_fields`; `AuditSeal` and
`AgentGatewayRequest` are absent along with both November 9 ledger records.
This contradicts the historical build-3 receipt. Do not infer whether this is a
restore, target/configuration mismatch or another cause. No repair was applied.
Current production changes remain blocked pending reconciliation and separate
explicit authorization for any write. The historical receipt is preserved.

Expected baseline from the accepted build-3 database receipt: database `neondb`,
zero unfinished migrations, latest `20261109100000_add_audit_seal`, both new tables
present, and no unapplied/unrecognized migration names (null aggregates mean none).
The three reservation columns must exist with their reviewed types/nullability:
`admissionContract` text/non-null, `estimatedCents` integer/non-null, `quoteEvidence`
jsonb/nullable. Report mismatches; do not repair or apply anything automatically.

The query returns catalog and migration metadata, not customer rows, credentials
or Prisma failure logs. It is an initial drift/version screen, not a complete
column/index comparison or proof of Prisma 7 compatibility. The native compiler,
client/adapter/config migration and isolated tests remain separate local work;
production deployment and any database change require their own explicit approval.
No apply SQL is included because no production schema change is proposed.

## Local migration impact reviewed while awaiting the result

The official Prisma 7 upgrade guide requires a driver adapter, separate CLI config
and changed client generation/initialization:
https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7

Current runtime constructors to migrate deliberately include `lib/db.ts`,
`lib/security/privateAuthorityDatabase.ts` and
`lib/billing/newTestSubscription/postgresFixtureStore.ts`; isolated rehearsal
scripts also use the removed `datasources` constructor shape. Review transaction,
pool/timeout, TLS and private-instance boundaries rather than weakening them.
The published 7.10.1 engine floor is Node ^20.19 / ^22.12 / >=24; local/CI use24.

Governance packaging/qualification also binds the old Rust query-engine file and
`@prisma/client/runtime/library.js` (for example
`scripts/local_prisma_engine_inputs.py` and
`scripts/governance_local_issuer/fixture_delivery_inputs.py`). Prisma 7's new
client/adapter layout cannot reuse those old receipts or be accepted through blind
hash replacement. Production schema metadata alone does not resolve that separate
local compatibility work. The candidate dependency workflow and local generator/config preparation now ran; no qualification was renewed. See LOCAL-GENERATOR-PROGRESS.json.

## Current implementation checkpoint

Candidate branch `deps/audit-fix-43111724897` uses workflow-generated Prisma/client/adapter 7.10.1. Schema metadata only now uses the new generator and CLI config; all 175 model/enum/relation bodies and migration files are byte-preserved. The client is generated as source, then compiled by the existing explicit native TypeScript checker into ignored CommonJS JS/declarations. This supports existing Node tooling without relying on implicit TypeScript execution. No real DATABASE_URL is needed for generation/validation, and no synthetic datasource is substituted.

The old schema actually failed Prisma 7 validation (P1012); new metadata passed. Compilation first failed with no generated input (TS18003), then db:generate passed. A real generated-client test passed: construction lazy, unconfigured adapter rejects one query attempt before network access (zero Socket.connect calls). Application constructors/imports, driver options/TLS/timeouts, rehearsal/tooling support and full types/tests/builds remain INCOMPLETE; no PR or deployment acceptance is claimed.

The separately approved private Vercel comparison stopped after one metadata call, before any decrypted detail read. It is consumed, not retried. Only a fixed stopped/unverified receipt is saved; no raw value/response/error was written. Current Vercel target mapping and the live schema discrepancy remain unresolved.

Next local steps: migrate actual constructors and 108 typed import consumers to the generated-client boundary, preserving exact private targets, no fallback DB, isolated-marker checks and transaction behavior; adapt ordinary rehearsal callers and source-bound packaging without fabricating historical profile compatibility. Run meaningful regressions and full validation before any PR. Do not re-run the consumed private comparison or apply historical SQL automatically.
