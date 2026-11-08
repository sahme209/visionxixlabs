# Reviewed additive fix: PipelineAICallReservation quote fields (2026-11-08)

**Status: prepared, NOT applied.** No write, migration-history change or deploy is authorized by this file.

## Facts so far (user ran read-only check 1, 2026-11-08)
- Production lacks `admissionContract` and `quoteEvidence` on `public."PipelineAICallReservation"`.
- **One Prisma migration is unfinished.** Its name, steps and failure log come from read-only check 2 (`READ-ONLY-CHECK-2.sql`).
- No repo migration adds these two columns; they exist only in `prisma/schema.prisma` (lines 5065–5066).

## The fix under review
`ops/proposals/coding-request-quotes/add-quote-evidence.DRAFT.sql`, sha256 `52b8a07ab4af5205e3bc513fb94ad5fd5d65742f6c01483376f843a36b4e2a7f` (Codex, rehearsed once on an owned populated old-schema database, 2026-11-04).

| Step | What it does | Review |
|---|---|---|
| `BEGIN` … `COMMIT` | Single transaction | ✅ All-or-nothing |
| `lock_timeout 5s`, `statement_timeout 30s` | Bounded waits | ✅ Fails fast instead of queueing behind live traffic |
| `LOCK … ACCESS EXCLUSIVE` | Briefly blocks all access to the table | ⚠️ Acceptable only at low traffic; run when check 2 shows 0 locks and few active sessions |
| Preflight `DO` block | Refuses if either column already exists (partial apply), or if `estimatedCents integer NOT NULL` is missing | ✅ Guards against drift and double-apply |
| `ADD COLUMN "admissionContract" TEXT NOT NULL DEFAULT 'coding_fixed_hold_v1'`, `ADD COLUMN "quoteEvidence" JSONB` | Adds both fields | ✅ Constant defaults are metadata-only on PostgreSQL 11+ (no table rewrite); matches `schema.prisma` |
| Postcondition | Every existing row has the fixed-hold default and null evidence | ✅ Proves no existing financial row changed meaning |

**Compatibility (two writers during cutover):** old code never reads or writes the new columns, and the defaults keep its inserts valid. New code reads nullable `quoteEvidence` safely. So apply-then-deploy is safe in both directions; deploy-then-apply is **not** (new code would fail).

## Preconditions before any apply (each needs your explicit approval)
1. **The unfinished migration is identified and shown unrelated** to this table, or resolved first. Prisma's `migrate deploy` refuses to run while a migration is unfinished (P3009), and this fix must not be mixed into that state.
2. **Recovery verified now, not from old notes:**
   - Neon Console → Project → **Settings → Storage / History retention**: the restore window covers the apply time (note the window length).
   - Neon Console → production branch → **Restore**: point-in-time restore is offered for "now".
   - Optional, recommended: create a **backup branch from production immediately before** applying (instant, copy-on-write). This is a write to Neon, so it needs your approval.
3. **Quiet moment:** check 2 shows `reservation_locks = 0` and low `active_sessions`.
4. **Exact target:** branch whose compute is `ep-small-mountain-ailw0kvt`, database `neondb`.

## Apply and verify (later, on approval)
1. Run the draft SQL exactly as hashed above, in the Neon SQL Editor.
2. Re-run `READ-ONLY-CHECK.sql`: `quote_columns` must list both new columns with the expected types and defaults.

## Recovery if something looks wrong
- **Before any new code writes quotes:** `ALTER TABLE … DROP COLUMN "quoteEvidence", DROP COLUMN "admissionContract";` restores the old shape (also needs approval).
- **Anything worse:** point-in-time restore or the pre-apply backup branch.

## Migration history (deliberately later)
The columns were never in a Prisma migration. To keep history truthful after the apply, a migration file containing the same `ADD COLUMN` statements should be added to the repo and then marked applied with `prisma migrate resolve --applied <name>`. **That modifies migration history, so it's out of scope until you approve it.** It should also wait until the unfinished migration is settled.

## Cutover order (once everything above passes)
apply columns → verify → production build 1 of 3 → smoke checks → promote.
