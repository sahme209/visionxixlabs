# Serving runtime Agent storage evidence

`GET /api/control/ai-governance/recovery-status` is restricted to an authenticated workspace owner/admin. It accepts no request parameters and does not accept a database target. Responses are private and not cached. A bounded per-process limiter reduces repeat queries.

The diagnostic requires production runtime configuration pointing at the previously provider-verified Axiom main endpoint/database. It then uses the application's existing Prisma client to read fixed PostgreSQL and migration metadata in an explicitly read-only transaction, with short timeouts. It returns booleans only, never a URL, credentials, customer rows, migration log or provider payload.

`state: verified` verifies this narrow configuration/metadata observation; it does not mean a repair is safe. `schemaOnlyPreconditionsMatch` means the baseline User table exists, Agent identity table is absent, and exactly one unfinished original migration has the expected checksum with no finished attempt. An unfinished attempt can be active or failed. This is not a diagnosis of failure or a concurrency lock.

The response deliberately reports `repairAuthorized`, `recoveryPointVerified`, and `isolatedRestoreVerified` as false. A usable recovery point, matching isolated restore rehearsal, safe migration-ledger strategy and explicit exact-target production approval remain separate requirements. Do not run the original migration: its data backfill enables identities and grants broad tools. The schema-only proposal leaves identities absent/disabled and does not resolve that historical migration.

Tests cover authentication/roles, request-target rejection, bounded errors/rate limiting, exact target validation, metadata interpretation, actual PostgreSQL17 query compatibility and rejection of writes inside the transaction. The local PostgreSQL test deliberately injects a disposable local repository and is not production-binding evidence.
