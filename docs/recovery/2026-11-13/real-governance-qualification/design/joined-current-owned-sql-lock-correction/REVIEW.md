# Corrected original-lock SQL execution review

PREPARED ONLY; actual corrected SQL NOT RUN. Source846e2692; full ordinary19,261pass/0fail/1,143pending, root strict types and15demo checks pass.11focused checks include an actual SQL-like lock restriction in the memory transaction and a drain after the final owner snapshot. Independent source review has no important finding.

## What changed and why

Prior approved229case run:220pass9fail0skip; fixture /private/tmp/axiom-platform-pg-pnwe2e95 retained and server confirmed stopped. Original invocation/packet/result/logs unchanged. No retry occurred. Its permission is consumed.

The actual SQL adapter permits one custodian-lock acquisition per transaction; the owner assertion acquired it twice. A stricter local regression reproduces the positive-path failure. The correction remembers ONLY successful acquisition for the same exact transaction and original intent id/digest/native key. All original record/source/barrier/time reads still execute on EVERY assertion; final-snapshot drain still blocks access. SQL lock guards, timeout, test assertions and count remain unchanged.

The new packet changes exactly TWO previously covered TS files, identified by old/new hashes in PREPARED.json; these are independently source-reviewed, not blind re-pins. All331source files are rebound; installed program and package/test-entry bytes/canonical paths match the prior reviewed packet. The SQL script remains byte-identical and requires229pass/0fail/0skip.

## Conditional single execution

Recheck every frozen source/program/package hash and canonical program coordinate. Refuse drift. Invoke ONLY the frozen scripts/run-platform-governance-postgres.py ONCE after fresh owner approval. It creates one new private socket-only PostgreSQL fixture, verifies empty target, applies only fixed fixture/synthetic identity schema and runs148operational+40image+41template cases once. No real DATABASE_URL or TCP listener. Verify unchanged sources and require229pass/0fail/0skip; no retries, relaxed assertions or deadline increases. Stop and verify ONLY its own server; retain logs/results/fixture. Never delete or restart old fixtures.

Unchanged limits:60seconds test child;30per other child;10final status;340aggregate child seconds including cleanup. All credentials/people/native time/custody/fleet/provider inputs synthetic/intercepted. Real SQL/locks/HMAC are the evidence scope, NOT real AWS/provider/native runtime/custody or OS egress qualification. No production access, real credentials/provider actions, installation, grants, resources, deployment, enablement or spending. Every full Governance and owner gate remains.
