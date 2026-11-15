# Prepared actual local PostgreSQL/Prisma integration

Preparation only; runner has not executed. Root must review the exact runner,
client and input hashes before one execution. No authoring source is changed.

One new mode0700 directory owns a fresh PostgreSQL17.11 cluster, synthetic
superuser/password, one-day test CA/key/certificate, all logs and receipt. The
foreground PostgreSQL server binds127.0.0.1 only, disables Unix sockets, and
accepts that synthetic owner only through hostssl/SCRAM-SHA-256. No daemon or
existing service is used. No migrations, schema creation or package install.

A clean Node24.21 child starts with NODE_EXTRA_CA_CERTS pointing only to the
new test CA. Its URI uses127.0.0.1, verify-full and channel_binding=require.
The original factory, policy, strict pg.Client, installed Prisma adapter and
generated Prisma client are loaded through an in-memory TypeScript CJS hook;
none is mocked or replaced. Certificate IP SAN validation/rejectUnauthorized
remain original. This tests actual PostgreSQL SSLRequest/TLS/SCRAM PLUS and
Prisma-owned pool operation, complementing the separate adverse wire tests.

Queries read current_user/current_database/data_directory/search_path and
pg_stat_ssl. Two acquisitions and a read-only transaction must reuse the one
physical connection. After disconnection, a fresh factory client observes the
previous app-named physical session absent in pg_stat_activity. Two previous
pools must be absent before final client disposal and natural Node exit.
No data is written after initdb; transaction BEGIN/COMMIT are read-only work.

Overall180s deadline; per-phase5–45s ceilings;1MiB per log with final overshoot
truncation/failure. Every child gets a new owned process group, SIGINT stop,
five-second wait then SIGKILL/two-second wait, and group-empty confirmation.
SIGINT/SIGTERM/SIGHUP trigger cleanup. Both active child and PostgreSQL cleanup
are attempted even if one fails. Fresh cluster deletion requires confirmed
empty groups. Synthetic password and CA/server private keys are removed.

Only loopback transport is requested; clean child environment drops cloud,
database, signing and auth variables. System openssl/official locally installed
PostgreSQL/Node binaries are read-hash-bound. No account, hosted database,
external endpoint, native app, deployment or Governance execution is included.

Scope limits: generic local-host startup search_path is tested, not a real Neon
endpoint or transaction-pooler promise. Successful factory require-mode on real
PostgreSQL is positive integration evidence; independently validated wrong
proof/order/race/certificate failures belong to the separate actual TLS suite.
No live configuration value/enum or production connectivity is inferred.
