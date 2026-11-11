# Prisma 7 initial production compatibility gate — not executed

TypeScript PR #320 merged green as `a99c053f`. This is the next handoff item.
This preparation changes no schema, data, migration ledger or runtime setting.
It authorizes no production query by itself.

The owner must approve the production schema check, select the confirmed production
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
