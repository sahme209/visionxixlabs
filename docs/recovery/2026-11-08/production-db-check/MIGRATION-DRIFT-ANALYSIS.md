# Production migration drift — analysis (2026-11-08, read-only)

Source: read-only check 2, run by the user in the Neon SQL Editor (production endpoint `ep-small-mountain-ailw0kvt`, database `neondb`, PostgreSQL 17.11). Nothing was written.

## What check 2 showed
- **Failed migration:** `20261013172000_add_workspace_agent_identity`. It started on 2026-10-14 at 12:36 UTC with 0 steps applied and failed with `ERROR 42P01: relation "Organization" does not exist`.
- **Not recorded as finished: 12 repo migrations**, the failed one plus 11 queued behind it (2026-10-13 → 2026-10-25): durable agent workflow, founding supporters, AI usage Stripe settlement, email verification, verified AI credit fulfillment, AI usage reservations, cloud account enrollment, credential revocation, ECS release review core, legacy cloud tenant binding, saved Bot tasks.
- **Recorded as applied anyway:** later migrations through `20261027030000_azure_guided_authorization`, which is the repo's latest. So some migrations were applied **outside Prisma's normal order**, since `migrate deploy` refuses to continue past a failed migration (P3009).
- **Rolled back before:** 4 distinct migrations, one listed twice (`20260526110000_add_releaseops_foundation`).
- `db_not_in_repo`: none. The history has no unknown migrations.
- `PipelineAICallReservation`: **0 rows**, so no financial rows are affected by the quote-field fix.
- `reservation_locks = 1`: almost certainly the check's own `count(*)` share lock; `active_sessions = 0`.

## Root cause of the failure
The migration ends with `INSERT … SELECT "id" … FROM "Organization"`. **There is no `Organization` table:** there's no such model in `prisma/schema.prisma` and no migration creates it. Axiom keys tenants by a text `organizationId`, with membership in `OrgMembership`. **The migration was broken on arrival.**

On PostgreSQL, Prisma does not wrap a migration in a single transaction, so its first statement, `CREATE TABLE "WorkspaceAgentIdentity"`, **may already exist** even though Prisma recorded 0 applied steps. Check 3 answers that.

## What this means
- The quote-field fix (`admissionContract`, `quoteEvidence`) is the smaller problem. Production may also lack objects from up to 11 queued migrations that current code expects.
- No fix should be chosen until **read-only check 3** (`READ-ONLY-CHECK-3.sql`) shows, object by object (69 tables, columns, indexes and constraints), what already exists.
- Then the realistic paths, each needing explicit approval:
  1. **Corrected migration:** fix the `Organization` reference (for example, select distinct `organizationId` from `OrgMembership`). Then mark the failed record rolled back and let `migrate deploy` apply the queue in order. This **modifies migration history**, so it's out of scope until you approve it.
  2. **Reconcile:** for migrations whose objects already exist, mark them applied after verifying exact shape, and apply only what's missing. Also a history change.
- The fix for the quote columns stays sequenced after this, and recovery must be confirmed first (restore window plus a backup branch).

**Nothing is applied, resolved or deployed.**
