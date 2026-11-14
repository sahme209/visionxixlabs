# Dormant Linux time-publication adapters

These files are local SOURCE PREPARATION ONLY. They have not been compiled,
executed, linked into the daemon, installed or qualified. No Cargo/dependency,
build workflow, service, credential, route or feature flag changes are included.

`time_publication_adapter.rs` is a proposed patch module inside the pinned
ClockBound daemon crate, using the inspected public `ShmWrite` and V2 getters.
Its constructor and every actual startup/update/disruption/clock-adjustment
caller must be reviewed in the real daemon build. First publication must be
Unknown; a skipped upstream initialization cannot silently start synchronized.
The C publication routine terminates on error; delegate panic also aborts.
This prepares fail-stop behavior, not proof that the actual daemon uses it.

`time_publication.c/.h` implement the fixed fresh-file protocol and a bounded
raw capture interface. The qualified parent must own the protected directory
and already-open read-only source descriptor; the worker duplicates that
source and uses positional reads of an unmodified inode. The parent retains
its original descriptor through final currentness and releases it separately.
No reopen-by-name repair, raw mmap or Rust representation serialization occurs.
Directories are exactly0750 and publications0440, with the qualified producer
UID and dedicated reader GID; access ACL absence must be established. Existing
resources, ACLs or groups are not changed by merely storing this source.

A capture reports only raw P0/realtime/P1/P2 and descriptor identity, with
`time_authority=0`. It cannot prove producer liveness, actual disruption,
conservative clock/rate inputs, source authenticity or later return-time
freshness. The private qualified context must establish these before the shared
ExecutionTimeSource can be used. Proposed process/output/deadline/reap limits
are enforced by the prepared supervisor; native isolation/termination guarantees
still need the separately approved Linux artifact and run.

No native tests or compilation were performed under the local-code grant.
A later exact build must verify target ABI, prototypes, linker inclusion, pinned
dependencies/licenses, native filesystem behavior/persistence/crash cases and
actual protected bootstrap/producer/consumer integration. Keep the native
launcher/profile supplier unavailable until that evidence exists. Old files,
backups, unknown attempts and production resources stay intact.

## Actual pinned constructor patch (local source only)

`clockbound-daemon-integration.patch` applies to the three exact saved upstream
files at revision371058f8f6a1786d4a4ab3eed9f5f2f16eea7777. The original stock
constructors remain unchanged and unqualified. Separate `construct_axiom` paths
move one explicit owned context through Daemon and ClockState into only the V2
writer. The materializer must place `time_publication_adapter.rs` at
`clock-bound/src/daemon/time_publication_adapter.rs`; no Cargo, native linkage,
entrypoint, source configuration or protected resource supplier is provided here.

The patch makes initial Unknown publication unconditional, publishes Unknown
before each correction, and updates/publishes disruption even without existing
clock parameters. Its zero-to-one-nanosecond Unknown/Disrupted records are
structural unusable sentinels, never measured time bounds. The actual application
codec accepts their representation and the interval reader rejects their status
before reading timing premises. V3 and the kernel correction algorithm remain
unchanged. Unknown publication does not assert that ongoing PLL correction stops.

The source-order tests apply the real patch in memory and check saved call sites;
they do not compile or execute Rust or prove native stop/failure behavior. Native
compilation, full daemon build/launcher wiring, source configuration, filesystem,
clock, liveness and real qualification remain required. Historical pre-RED draft
is preserved separately and must not be applied. See
`clockbound-daemon-integration-apply-proof.json` and the recovery integration plan.
