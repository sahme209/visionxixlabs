# Neon foundations: protect production, scheduled snapshots, separate Preview database (2026-11-08)

Prepared by Claude. **The user does every step in the Neon and Vercel consoles; Claude has no access to either.** None of this changes production data.

## Extra columns: decision recorded, no change
- `AuditEvent.status`: added to the wrong table by `20261005020000_add_simulated_audit_event_status`; the schema puts that field on `AxiomAuditEvent`. It has a default (`'pending'`) and no code reads it. Harmless; leave it.
- `Lead.phone`: comes from `20250225180000_add_lead`; the current schema dropped it. It **may contain contact details from past leads**, so dropping it would delete customer data. That needs the user's explicit decision (export first). Until then, leave it. Prisma ignores both columns.

## 1. Protect the production branch (Neon console)
Project `odd-union-57413470` → **Branches** → `main` → **⋯** → **Set as protected**.
Protected branches can't be deleted or reset by accident. If the option isn't offered on your plan, skip it and tell Claude.

## 2. Snapshot schedule (Neon console)
Project → **Backup & Restore** (or **Snapshots**) → **Schedule** → daily, keep 7. If scheduling isn't offered on your plan, create a manual snapshot before each production DB change (as on 2026-11-08) and tell Claude, so this file records the fallback.

## 3. Separate Preview database
Goal: preview deployments must never touch production data (standing rule: no preview deploys while Preview shares the production DB).
1. Neon → **Branches** → **Create branch** from `main`. Choose **Schema only** (no data) and name it `preview`.
   - If "Schema only" isn't available, **stop** and don't create a full-data branch, because it would copy customer data into Preview. Tell Claude; the fallback is a new empty project, to be designed separately.
2. Open the new branch → **Connect** → copy its pooled connection string. **Don't paste it in chat.**
3. Vercel → project → **Settings → Environment Variables** → `DATABASE_URL`: edit it so the **Production** value stays as it is, and add a **separate** value for **Preview only**, using the new branch's string. Remove Preview from the production entry's targets.
4. Tell Claude "preview DB done". Claude will then give a read-only check for the preview branch: same 173 tables, 0 rows in customer tables, migration history equal to production.

Until step 4 is verified, preview deploys stay off.

## Status (2026-11-08, user)
- ✅ 1. `main` protected.
- ✅ 2. Daily snapshot schedule: 00:00 UTC, kept 14 days (Neon default; weekly/monthly off).
- ⏸ 3. `preview` branch created (schema only, auto-delete **Never**). **Not wired yet.** The Neon–Vercel integration creates a branch for each Vercel preview deployment, and those are normally **full-data copies of `main`**; the user saw several in the branch list. Its "create branch for preview deployments" setting couldn't be found in Neon Integrations or Vercel Storage settings, so it's deferred by the user's choice.
- **Holds until resolved:** preview deploys stay **off** (git deploys are already disabled; never click a Preview deploy). Open items:
  - find and turn off the integration's preview-branch setting, or set Preview `DATABASE_URL` to `preview`, then verify;
  - review and delete the old auto-created preview branches, which may hold copies of customer data, after confirming none is in use.
