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
1. **Recovery first.** Confirm the Neon restore window covers "now", then create a backup branch from production (instant; a Neon write).
2. **Correct the broken migration file in the repo**, so fresh databases work. Replace `FROM "Organization"` with organizations taken from `OrgMembership` (`SELECT DISTINCT "organizationId" …`), keeping the original intent. PR + CI. *Changes a migration file, which changes its checksum; that's acceptable here because production records it as failed, not applied.*
3. **Resolve history in production** (this modifies migration history; held per your instruction):
   - `prisma migrate resolve --rolled-back 20261013172000_add_workspace_agent_identity`, then `prisma migrate resolve --applied 20261013172000_add_workspace_agent_identity` (its table already exists with the exact shape).
   - `prisma migrate resolve --applied <name>` for each of the 11 verified migrations, in order.
   - Then `prisma migrate status` must report no pending or failed migrations.
4. **Agent seed: your product decision.** Either create identities for the 2 organizations as the migration intended (Agent **enabled** with the migration's tool list), or leave them disabled until each owner enables it. This has security weight (it grants the Agent its read and preview tools for those workspaces).
5. **Quote fields as a proper new migration**, e.g. `20261108120000_add_pipeline_ai_call_quote_fields`, containing Codex's reviewed guarded SQL (refuses if the columns exist, timeouts, postcondition). After step 3, a normal `migrate deploy` applies it and history stays truthful.
6. Re-run read-only check 1: both quote columns present, and `matches_repo_latest` true.
7. Only then: **production build 1 of 3** → smoke checks → promote.

## Who runs steps 3–5
These need Node plus the production `DATABASE_URL`. Options:
- **(a)** You run the exact commands on your Mac with `DATABASE_URL` set only for that terminal.
- **(b)** A reviewed one-off GitHub workflow using the repo's existing production database secret, dispatched manually with an explicit confirmation input. That's a production write via CI, so it needs separate approval.
Either way, nothing secret goes into chat, files or logs.
