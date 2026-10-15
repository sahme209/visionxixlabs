# Production login recovery — 2026-10-15

## Confirmed incident

Production deployment `dpl_DNyBMLHZmytDiYcrJ6rYnhnWRBer` is READY on
`9e3e6df749511c0ce79e36122c2654a814263d4f` (merged PR #102).
Vercel runtime logs for `/api/auth/callback/credentials`, `/google`, and
`/github` on October 15 report Prisma `P2022`:
`The column User.emailVerifiedAt does not exist in the current database.`
The password lookup and both OAuth identity upserts fail before workspace
bootstrap. This establishes a schema/application mismatch, not a founder role,
pilot entitlement, or provider-account rejection. Other problems may become
visible after schema recovery; none are established by these logs.

PR #101 added `20261014120000_add_email_verification`. Application builds
deliberately do not apply migrations. The migration adds a nullable verification
timestamp and an expiring single-use token table; it does not verify existing
password accounts or alter memberships, admin lists, or pilot access.

## Recovery requiring production approval

1. An authorized operator must inspect production migration status and review
   **all** pending migrations against the intended production database. Do not
   assume the email-verification migration is the only pending migration.
2. After explicit approval, use the existing **Production database migration**
   GitHub Actions workflow on `main`, confirmation `APPLY`. Leave the optional
   rolled-back migration input empty unless a separately reviewed failed
   migration requires recovery. The workflow runs `prisma migrate deploy` and
   `prisma migrate status` in the protected production environment.
3. Confirm the migration succeeds and the deployed application uses that same
   database. Do not add migrations to Vercel builds or silently skip verification
   when a column is absent.
4. Have the founder sign in through their established Google/GitHub identity.
   For password login, existing accounts with a null verification timestamp must
   complete the existing `/api/auth/resend-verification` and single-use email
   verification flow. Check delivery configuration without exposing secrets.
   Do not backfill verification based on account age or possession of a password.
5. Check the canonical user ID, existing accepted organization membership,
   selected tenant, configured platform-admin policy, and pilot entitlement using
   authorized records. Repository ownership or a Git commit email alone is not
   proof of which production account should receive founder access.
6. Verify successful Google, GitHub, and verified-password sessions; verify
   unverified/wrong-password users are rejected, and authenticated users without
   operational entitlement still cannot execute operations. Confirm callback
   destinations, cookies, pairing, and absence of new `P2022` errors.

No production database credentials or founder account records are available in
this workspace. No production mutation, account role change, migration, merge,
or deployment was performed during this investigation. Restoration remains
unverified until the approved migration and real sign-in checks succeed.

## Regression coverage and handoff

`lib/__tests__/authLoginRecovery.test.ts` exercises verified password login,
unknown/unverified/OAuth-only accounts, wrong passwords, missing schema,
Google/GitHub success and rejection, and safe denial audits. These are callback
unit tests with mocked storage, not a real OAuth or production database test.
Existing sign-in gate tests preserve best-effort personal-workspace bootstrap;
no change to authorization is needed to repair this schema mismatch.

Local validation: all 527 Vitest files / 5,146 tests pass after Prisma client
generation, web `tsc --noEmit` and the full production build pass, desktop TypeScript and frontend build
pass, and all 30 Python CLI tests pass. Native Rust checks cannot run because
`cargo` is not installed in this environment. These checks do not establish
live provider authentication or production schema readiness.

Keep the broader master mission paused at login recovery. The historical 85%
completion estimate has not been audited. Claude can review recovery UX later;
the founder can perform real browser sign-in and laptop integration validation
after production recovery is approved.
