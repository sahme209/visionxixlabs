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

## Safety preflight before requesting production approval

The target email-verification SQL was exercised on an isolated PostgreSQL 16
database. Existing identity, password hash, name, and membership role were
preserved; existing accounts remained unverified. Unique token hashes, rejection
of orphan tokens, and token deletion when the fixture user was deleted passed.
This was synthetic test data, not founder records or production validation.

A fresh replay applied 99 migrations, then failed at
`20261013172000_add_workspace_agent_identity`: it creates a table and attempts an
`INSERT ... FROM "Organization"`, but no preceding migration creates that
relation and the current Prisma schema has no Organization model. A real run
may therefore have a partially created table and an unfinished migration entry.
Do not blindly mark it applied/rolled back or edit its historical SQL before
checking the actual production ledger and schema. This finding may explain why
later migrations have not reached production; production history is not yet
available to establish that causal link.

The production workflow applies **all** pending files. Later billing migrations
backfill `AddOnPurchase.idempotencyKey` and add uniqueness constraints on Stripe
checkout/payment identifiers. Duplicate historical identifiers could block
those indexes. They must not be deleted or merged to make a migration pass.

Run `node scripts/auth-recovery-preflight.mjs` from this checkout in an approved
environment where `DATABASE_URL` selects the intended production database and
`AUTH_PREFLIGHT_FOUNDER_EMAIL` contains the founder-confirmed login email. A
SELECT-only database role is preferred. Do not put secrets in chat or command
history. Supply the existing `ADMIN_EMAILS` configuration only in that secure
runtime if platform-admin matching is to be verified. Do not infer the founder
email from repository ownership or commit authorship.

The script uses a repeatable-read, read-only transaction with a five-second
statement timeout. It checks applied migration checksums, unfinished/unknown
entries, all pending migration names, the known Organization dependency, auth
schema, founder case variants/canonical user ID, derived personal workspace,
existing memberships/accepted status, platform-admin match when configuration
is available, billing-plan metadata, and financial duplicate-group counts.
It neither bootstraps memberships nor invokes login callbacks. It never returns
email addresses, password hashes, Stripe identifiers, tokens, or connection URLs.
Exit 2 signals findings; exit 1 signals incomplete inspection. Exit 0 is evidence
collection only and never grants production approval or proves live login.
Review output privately: user/workspace IDs and membership roles remain internal
account information and should not be pasted into public PR comments.
The preflight was run against isolated PostgreSQL using a SELECT-only role. It
resolved the synthetic account and its existing accepted `read_only` membership,
retained the unverified-password state, and detected a seeded duplicate checkout
identifier without returning that identifier or the fixture email/password hash.
Unit coverage also rejects absent founder emails, non-read-only transactions,
ambiguous email case variants, and reports failed migrations without repair.

The founder supplied the intended login email in this chat. Its match to a
production user, memberships, and admin configuration remains **unverified**:
this runtime has no production database binding. The derived workspace can be
computed locally but that alone is not evidence of an existing account or role.

## Regression coverage and handoff

`lib/__tests__/authLoginRecovery.test.ts` exercises verified password login,
unknown/unverified/OAuth-only accounts, wrong passwords, missing schema,
Google/GitHub success and rejection, and safe denial audits. These are callback
unit tests with mocked storage, not a real OAuth or production database test.
Existing sign-in gate tests preserve best-effort personal-workspace bootstrap;
no change to authorization is needed to repair this schema mismatch.

Local validation: all 528 Vitest files / 5,151 tests pass after Prisma client
generation, web `tsc --noEmit` and the full production build pass, desktop TypeScript and frontend build
pass, and all 30 Python CLI tests pass. Native Rust checks cannot run because
`cargo` is not installed in this environment. These checks do not establish
live provider authentication or production schema readiness.

The original master mission remains active. Login recovery is the first gate;
after real sign-in recovery, resume an audit of current main/PRs/CI and the
existing execution backlog, then desktop paired authentication/security, AI
billing, real integration gaps, governed automation, desktop release usability,
and web companion contracts. Avoid duplicate implementations and preserve
working functionality. Live cloud tests, live Stripe test-account runs, native
Mac acceptance, production operations, merges, and deployment approvals retain
their original founder ownership. The historical 85% estimate is not audited.
Claude retains later UX/design/governance review; Cursor remains optional for
local inspection. Existing `docs/AXIOM_EXECUTION_BACKLOG.md` contains historical
evidence and must be reconciled against current main rather than treated as a
current deployment inventory.
