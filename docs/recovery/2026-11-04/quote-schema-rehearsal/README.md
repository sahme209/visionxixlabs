# Bounded old-schema → quote fields rehearsal

One independently reviewed packet8794f87885990fba432961cf3d734a5720ce2da0b14bcd79ca25f3a3245dc370 ran against a newly initialized socket-only PG17 database. The full old Prisma schema came from immutable last-verified production source d3e591b9; installed pinned engine only, no client generation, network, recovery SQL or production connection.

Five synthetic ledger rows span reserved, dispatch_unknown, pending_settlement, settled and released, with matching holds and usage. The SQL draft ran once. Exact canonical JSON of all existing ledger/hold/usage columns was unchanged after removing only the two newly added columns from comparison. All five rows read coding_fixed_hold_v1 and SQL-null quoteEvidence. Source packet equality was checked after execution; owned server stop verified. Receipt and raw snapshots are adjacent.

The reviewer found Python assert guards could disappear under optimization; all five critical checks were changed to explicit errors BEFORE execution. No failing database run or automatic retry occurred.

This proves only the stated local populated-schema case. It does not prove actual production identity/schema, backup recoverability, locks/concurrent writers, runtime deployment compatibility, full historical coverage, migration-history correctness, rollback readiness or quote activation. No existing customer data or financial history was accessed or changed. Production application still requires separate preflight/review/authorization.
