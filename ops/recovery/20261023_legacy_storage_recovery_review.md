# Empty legacy storage recovery — review candidate

Not applied or approved for production. This is a targeted additive repair, not a Prisma migration deploy or historical backfill.

Target: Neon project `odd-union-57413470`, branch `br-holy-voice-ai303o8m`, database `neondb`. The operator must pin that exact target outside SQL and exclude concurrent administrative DDL or default-privilege changes. An identical clone cannot be distinguished by database name or schema fingerprints alone.

Exact SQL: `20261023_legacy_storage_only.REVIEW.sql`, SHA-256 `73c36226df193755bd09b7d7f966b54152f7112e3b1e864add70e26796f31ddd`.

The repair adds exactly 25 empty missing legacy tables and 18 source-defined enum types. It preserves all existing data, credentials, workspace membership, Agent tools and model policy, migration history, billing configuration, schedules, and provider settings. It creates no enabled configuration or other records and does not activate Terraform or legacy execution flags. Creating storage is not provider execution acceptance or historical data recovery.

The transaction binds the current 140-table inventory, CloudAccount column signature, and migration-ledger state; requires the application owner; rejects existing/partial target storage or types, enabled DDL event triggers, and changed default access; takes the cooperating Prisma advisory fence and ledger lock; and uses 5-second lock and 30-second statement timeouts. SQL object names are schema-qualified. It validates 165 final tables and every new table empty, without changing the historical failed migration marker. Migration reconciliation remains a separate task.

Three new legacy cloud relationships use `(cloudAccountId, organizationId)` referencing `CloudAccount(id, organizationId)`. Prisma declarations and a separately gated migration preserve these tenant boundaries for future schema management. The migration rejects incompatible existing rows rather than moving or backfilling them. Do not run generic migration deployment while the existing recovery preflight refuses it.

## Verification

A fresh read-only production logical backup was restored into an owned, private Unix-socket PostgreSQL17 cluster with TCP disabled. All 140 original table data fingerprints stayed unchanged. No prerequisite tables were reconstructed for this final rehearsal. The backup and prior recovery backup are retained privately, and no customer rows were printed.

Verified actual PostgreSQL cases:

- Exact SQL applies 25 empty tables and 18 enum types.
- Seven precondition refusals: partial enum, partial table, changed cloud column shape, changed migration state, changed default privileges, enabled DDL event trigger, competing Prisma advisory lock.
- Full schema inventory and all existing data fingerprints remain unchanged after transaction rollback and repeat refusal.
- Three legitimate same-tenant inserts succeed; three cross-tenant inserts fail. Synthetic records roll back.
- Old single-column foreign keys reproduce the cross-tenant defect.
- The checked-in tenant-binding migration upgrades valid old relations, validates already-correct relations without schema changes, and rejects existing cross-tenant rows without backfill.
- The local cluster was stopped and removed. If a future stop cannot be verified, the runner reports and securely retains its owned directory instead of deleting a running database.

Live application and provider behavior after restoration still needs separate read-only acceptance. No live database mutation, seed, migration-ledger update, provider call, purchase, permission expansion, or historical execution was performed by this rehearsal.
