# Production migration reconcile plan (2026-11-08) — prepared, NOT executed

Evidence: read-only checks 1–4, all run by the user in the Neon SQL Editor (branch with compute `ep-small-mountain-ailw0kvt`, database `neondb`, PostgreSQL 17.11). No write has happened.

## Verified state
- **Objects:** all 69 objects from the 12 unrecorded migrations exist. The one "missing" index exists under its PostgreSQL-truncated name `CloudAccountEnrollmentAttempt_organizationId_userId_expiresAt_i`.
- **Column shapes:** all **203 columns** in 21 tables match their migration files (type, nullability, default). Six flags from the automated comparison were parser artifacts (schema-qualified enum names, `TEXT PRIMARY KEY`, inline `CHECK`). `AddOnPurchase.idempotencyKey` is `NOT NULL` because the same migration sets it on line 11.
- **Legacy foreign keys:** all 3 from `20261023220000_bind_legacy_cloud_tenant_relations` exist with their expected names.
- **Agent seed:** `WorkspaceAgentIdentity` has **1 row (enabled)**, but **3 organizations** have members, so **2 organizations have no Agent identity**. Their desktop Agent is fail-closed (disabled). The failed migration's seed never ran.
- **Quote fields:** `admissionContract` and `quoteEvidence` are missing; `PipelineAICallReservation` has 0 rows.

## Root cause
`20261013172000_add_workspace_agent_identity` ends with `INSERT … SELECT "id" … FROM "Organization"`. That table has never existed (tenants are text `organizationId`s, with members in `OrgMembership`). The `CREATE TABLE` ran and the `INSERT` failed, so Prisma recorded the migration as failed, and every later `migrate deploy` has refused since 2026-10-14. The later objects were applied by some other route.

**The same bug breaks any fresh database built from migrations**, including the separate Preview database we still need. So the migration file itself must be corrected.

## Proposed steps (each needs your explicit approval; none is done)
1. ~~**Recovery confirmed (user, 2026-11-08):** Neon project `odd-union-57413470`, branch `main` (`br-holy-voice-ai303o8m`, default, **not protected**); 6-hour restore window with "now" restorable; manual snapshot **`main at 2026-11-08 17:59:32 UTC (manual)`**, never expires (plus Codex's `axiom-before-billing-repair-20261022`).~~ Recommendations (not done): protect `main`; add a snapshot schedule. Original step: Confirm the Neon restore window covers "now", then create a backup branch from production (instant; a Neon write).
2. **Correct the broken migration file in the repo**, so fresh databases work. Replace `FROM "Organization"` with organizations taken from `OrgMembership` (`SELECT DISTINCT "organizationId" …`), keeping the original intent. PR + CI. *Changes a migration file, which changes its checksum; that's acceptable here because production records it as failed, not applied.*
3. **Resolve history in production** (this modifies migration history; held per your instruction):
   - `prisma migrate resolve --rolled-back 20261013172000_add_workspace_agent_identity`, then `prisma migrate resolve --applied 20261013172000_add_workspace_agent_identity` (its table already exists with the exact shape).
   - `prisma migrate resolve --applied <name>` for each of the 11 verified migrations, in order.
   - Then `prisma migrate status` must report no pending or failed migrations.
4. ~~**Agent seed decision: user chose CREATE ENABLED (2026-11-08).**~~ Prepared as `AGENT-IDENTITY-SEED.sql` with the migration's **full 17-tool list**, which includes proposal-gated write tools (`create_environment`, `configure_deployment_target`, `connect_identity_provider`, `create_github_branch`, `commit_github_file(s)`, `open_github_pull_request`, `trigger_aws_deploy`). A read-only alternative (9 tools) is in `AGENT-IDENTITY-SEED-READONLY.sql`. Both are idempotent with a count check, and neither has been executed. Claude first described the list as read/preview only, which was wrong. **The user reconfirmed with the corrected information and chose the READ-ONLY 9 tools (2026-11-08): use `AGENT-IDENTITY-SEED-READONLY.sql`.** Owners can add action tools later. Original decision text: Either create identities for the 2 organizations as the migration intended (Agent **enabled** with the migration's tool list), or leave them disabled until each owner enables it. This has security weight (it grants the Agent its read and preview tools for those workspaces).
5. **Quote fields as a proper new migration**, e.g. `20261108120000_add_pipeline_ai_call_quote_fields`, containing Codex's reviewed guarded SQL (refuses if the columns exist, timeouts, postcondition). After step 3, a normal `migrate deploy` applies it and history stays truthful.
6. Re-run read-only check 1: both quote columns present, and `matches_repo_latest` true.
7. Only then: **production build 1 of 3** → smoke checks → promote.

## Who runs steps 3–5
These need Node plus the production `DATABASE_URL`. Options:
- **(a)** You run the exact commands on your Mac with `DATABASE_URL` set only for that terminal.
- **(b)** A reviewed one-off GitHub workflow using the repo's existing production database secret, dispatched manually with an explicit confirmation input. That's a production write via CI, so it needs separate approval.
Either way, nothing secret goes into chat, files or logs.


## CORRECTION and convergence strategy (2026-11-08, after reading Codex's records)
**Corrections to the above:**
- `WorkspaceAgentIdentity` was **not** left behind by a partial migration. Codex created it on 2026-10-23 through an approved schema-only repair (`ops/recovery/20261022_agent_identity_schema_only.sql`, record `ops/recovery/20261023_agent_identity_storage_repair_record.md`): zero rows, disabled, no tools, rehearsed on a restored backup first.
- That record holds: *"Do not run its broad enabling/tool-grant backfill … or falsely mark omitted work complete. Generic migration deployment remains blocked pending an explicit migration-history convergence strategy."* So `migrate resolve --applied 20261013172000…` (step 3) would **falsely** claim its backfill ran. **Withdrawn.**

**Proposed truthful convergence strategy (needs your explicit decision):**
1. `20261013172000_add_workspace_agent_identity`: mark **`--rolled-back`**. That's true: the migration itself failed and applied nothing; its table came from the separate approved repair.
2. Make that migration file **idempotent and non-granting**: `CREATE TABLE IF NOT EXISTS`, and seed nothing (no enabling, no tools). Fresh databases get the same disabled default production has, and a normal `migrate deploy` can re-run it on production as a no-op. *(PR #204 currently keeps the broad seed for fresh databases. It would be amended to match before merge.)*
3. The 11 later migrations: `--applied` is true for them, since their objects exist exactly (69 objects, 203 columns verified). Before that, confirm how they were applied (the `ops/recovery/*_schema_only.sql` records) so the history note is accurate.
4. **Agent identities for the 2 organizations:** your choice of enabled with 9 read-only tools stays a **separate, explicit data change** (`AGENT-IDENTITY-SEED-READONLY.sql`), recorded as a deliberate user override of the Oct 23 hold, narrowed from a broad grant to read-only. Not part of any migration.
5. Quote fields: a new guarded migration, applied by `migrate deploy` once history converges.

## ADOPTED by the user (2026-11-08): exact sequence (still not executed)
How the 11 migrations reached production: Codex's approved schema-only storage repairs (`ops/recovery/20261015_auth_schema_only.sql`, `20261022_billing_storage_repair.sql`, `20261022_public_billing_v1.sql`, `20261023_durable_agent_storage_only.sql`, `20261023_email_verification_storage_only.sql`, `20261023_cloud_enrollment_storage_only.sql`, legacy storage review, each with a `*_record.md`), applied outside Prisma's ledger. Checks 3–4 confirmed that the result matches the migration files exactly.

Codex's `20261023_migration_replay_refusal.md` removed a "roll back then deploy everything" shortcut because it could replay the **broad** tool backfill. The adopted strategy keeps that protection: after a rollback, only the reviewed **non-granting** revision (checksum `fa3703cc…`) can pass the deploy preflight (PR #204).

**Order matters:** if the failed row is rolled back while the 11 are still unrecorded, `migrate deploy` would try to re-create existing tables and fail partway. So:
1. ~~Recovery: 6-hour restore window plus the snapshot at 17:59:32 UTC~~ ✅
2. Merge PR #204 (idempotent, non-granting revision plus preflight gate) after CI passes.
3. `prisma migrate resolve --applied <name>` for each of the 11, in this order: `20261013193000_add_durable_agent_workflow`, `20261013220000_add_founding_supporters`, `20261014090000_add_ai_usage_stripe_settlement`, `20261014120000_add_email_verification`, `20261014190000_verified_ai_credit_fulfillment`, `20261014210000_ai_usage_reservations`, `20261016010000_cloud_account_enrollment`, `20261016020000_cloud_account_credential_revocation`, `20261016030000_ecs_release_review_core`, `20261023220000_bind_legacy_cloud_tenant_relations`, `20261025174000_add_bot_saved_tasks`.
4. `prisma migrate resolve --rolled-back 20261013172000_add_workspace_agent_identity`.
5. `npm run db:migrate:deploy`. The preflight must report `deployAllowed: true`; Prisma then runs the no-op revision (`CREATE TABLE IF NOT EXISTS`) and the new quote-field migration once it's added.
6. Agent identities for the 2 organizations: `AGENT-IDENTITY-SEED-READONLY.sql`, run separately as the user's explicit, recorded override of the Oct 23 hold (enabled, 9 read-only tools).
7. Re-run read-only check 1: both quote columns present, `matches_repo_latest` true, `migrations_unfinished` 0.
8. Production build 1 of 3, then smoke checks, then promote.

Steps 3–6 write to production, and each needs your explicit go-ahead at the time it runs.
