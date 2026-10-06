# Production database migrations

Application builds must never alter the production schema. Axiom keeps schema
promotion separate from Vercel so an operator can review a migration, approve
it, and record the outcome before application code relies on it.

## One-time GitHub setup

1. In the repository, create a GitHub environment named `production`.
2. Add at least one required reviewer to that environment.
3. Add `DATABASE_URL` as an environment secret. Use the production database
   connection string; never put it in repository variables or source files.
4. Verify that the account used to dispatch workflows may request access to
   the `production` environment.

## Applying a migration

1. Merge the reviewed migration into `main`.
2. Open **Actions → Production database migration → Run workflow**.
3. Run it from `main` and type `APPLY` in the confirmation field.
4. Approve the protected `production` environment when GitHub asks.
5. Review the final `prisma migrate status` output. A failed migration must be
   investigated and reconciled before retrying; do not edit migration history
   to force a green result.

The workflow is manual-only, serializes migration runs, and cannot run from a
feature branch. Vercel preview and application builds remain schema read-only.
