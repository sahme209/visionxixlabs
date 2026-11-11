# Prisma 7 initial production compatibility gate — approved, result pending

TypeScript PR #320 merged green as `a99c053f`. This is the next handoff item.
This preparation changes no schema, data, migration ledger or runtime setting.
It authorizes no production query by itself.

The owner approved this read-only check on November 11 and will run it in Neon.
The result is still pending; approval is not proof that it ran. Select the confirmed production
Neon branch/database used by Vercel (not a preview or backup), and run only
`1-PRECHECK-READ-ONLY.sql`. Return its metadata result only, never a connection
string, password or console screenshot containing one.

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
local compatibility work. No dependency upgrade or qualification change has run.
