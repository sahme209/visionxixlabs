# Durable workflow recovery verification

The additive live storage repair is recorded separately in `ops/recovery/20261023_durable_agent_storage_repair_record.md`.

An actual Prisma-backed test on an owned Unix-socket-only PostgreSQL 17 restore reproduced an abandoned cancellation becoming `retrying` indefinitely: recovery discarded the cancellation intent when its worker disappeared. The repair preserves the intent and finalizes `cancelled`, with completion/cancellation timestamps, no next attempt and an atomic system audit event. Cancellation takes precedence over exhausted retries. The existing organization/version/status/expired-lease compare-and-swap remains authoritative; recovery does not invoke the underlying operation.

Evidence:

- Before repair: six actual-PG tests passed, cancellation recovery test failed (`retrying` versus `cancelled`).
- After repair: seven actual-PG tests passed, covering competing claims, tenant/stale worker refusal, completion replay, cancellation, replacement worker recovery, disappeared-worker cancellation and exhaustion.
- Eight everyday mocked transaction tests passed, including exhausted cancellation and lost recovery CAS.
- Full suite: 9,932 passed, zero failed, 69 skipped; the seven actual-PG opt-in cases are executed separately, not silently counted as default-suite passes.
- Root TypeScript, production build and independent review passed.
- All 134 preexisting public-table full-row fingerprints on the private restore remained unchanged after the application-store tests. Owned cluster removed afterward; no customer rows printed.

The opt-in test requires `AXIOM_OWNED_WORKFLOW_PG_SOCKET` to identify an owner-only canonical `/private/tmp/axiom-private-restore-*/socket` directory. It constructs its own local connection, verifies role `recovery_fixture`, database `neondb` and disabled TCP listening, then clears only the two workflow tables in that selected disposable fixture. Never direct it at an existing application database. The fixture must contain the exact durable schema and generated Prisma client. Private production backup bytes are never repository fixtures.

This verifies storage/state transitions, not a live worker, provider task, desktop acceptance or signed installer. Source currently has no application callers of these store functions outside tests, so this must not be presented as a completed background automation engine.

A separate read-only installed-Prisma schema comparison against the restored database identified additional absent legacy/cloud/security/billing models. It also proposed destructive removal of separately managed public billing tables. That generated comparison was retained privately and marked DO NOT APPLY. Never use blanket `db push`, generated destructive diff or the historical unsafe identity backfill to reconcile production. Remaining storage and history need explicit additive, capability-scoped recovery with the same review/recovery gates.
