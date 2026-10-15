# Production authentication recovery — proposal, not authorization

Status: production untouched. Founder approval is required before any production
SQL or migration-ledger write. The existing blanket migration workflow is **not**
the proposed first recovery step.

## Evidence and root cause

[Protected preflight #2](https://github.com/sahme209/visionxixlabs/actions/runs/38792352304)
checked main `043664b15edd6437c44418e4724c5cc3e0c89d37`. Its read-only inspection
completed with diagnostic exit 2, not an inspection failure. The public-safe
report is preserved in `docs/mission/auth-preflight-run-2.json`:

- Seven migrations are pending; workspace-agent identity is unfinished.
- `Organization` is absent; no earlier repository migration creates it and the
  current Prisma schema has no Organization model. Workspace IDs are represented
  by tenant-scoped records such as OrgMembership. This is a migration-source
  defect, not evidence that production lost a required Organization table.
- User.emailVerifiedAt and EmailVerificationToken are absent. Default Prisma
  User queries therefore fail with P2022 in password and OAuth authentication.
- The founder account check passed: unique canonical email/account and accepted
  derived personal-workspace membership. This does not prove successful login,
  external OAuth ownership, platform-admin configuration or operational access.
- Financial duplicate groups were not found by the scoped preflight. This is
  not blanket approval of billing migrations or existing financial state.

`20261013172000_add_workspace_agent_identity` creates a policy table then tries
`INSERT ... SELECT ... FROM "Organization"`. Retrying unchanged repeats the
invalid dependency. Do not create a fabricated Organization table, infer an
Agent tool allowlist from membership, reset migrations, rewrite historical SQL,
or mark this failed migration successful without implementing reviewed policy
postconditions. Fresh read-only catalog inspection confirms the Agent table is
absent on the inspected Neon target; this supersedes the earlier unknown partial
effect status. Serving/preflight resource binding is still unverified.

## Recommended first phase: authentication only

The auth migration depends on the existing User primary key. It has no dependency
on Agent, durable workflow, supporter purchase or metered-billing tables. Its
correct dependency order is therefore User baseline → auth schema → auth ledger
record → read-only validation → actual authentication. It can be reviewed as a
narrow exception to chronological application of the seven-file batch.

Proposed production changes, requiring explicit approval:

1. Execute `ops/recovery/20261015_auth_schema_only.sql` **once**, against the same
   database inspected by the protected workflow, from a pinned reviewed checkout.
   This transaction contains the unchanged auth migration:
   - Add nullable User.emailVerifiedAt TIMESTAMP(3), with no default/backfill.
   - Create EmailVerificationToken with id/userId/tokenHash/expiresAt/usedAt/createdAt.
   - Add its primary key, unique tokenHash index and userId/expiresAt index.
   - Add its User(id) foreign key with existing CASCADE semantics.
2. Verify those exact column/table/index/foreign-key postconditions privately.
   Then, from that same checkout, run **only**:
   `npx prisma migrate resolve --applied 20261014120000_add_email_verification --schema prisma/schema.prisma`.
   This records the original auth SQL checksum as applied. It is a separate
   migration-ledger write requiring approval, not a reset or a claim that other
   migrations succeeded. Preserve every failed Agent history row unchanged.
3. Rerun the protected read-only preflight. Expect auth schema present and six
   pending migrations at the original seven-file baseline, with the original
   Agent failure still reported. This checkout additionally proposes
   `20261016010000_cloud_account_enrollment`; when that source is included,
   expect eight pending before auth-only repair and seven afterward. Including
   the separate `20261016020000_cloud_account_credential_revocation` proposal
   expects nine before and eight afterward. Both remain unapplied and separately
   reviewed. Compare exact pending names from the
   pinned checkout, never apply extra files to force an old count. A full
   preflight exit 2 remains expected; it must not be relabeled fully healthy.

The SQL guards require the expected baseline User primary key, absent auth schema,
exactly one active failed Agent row with the original checksum, and no existing
auth migration record. Unexpected state causes an exception before DDL. The
transaction uses search_path public, a 5-second lock timeout and a 30-second
statement timeout. It contains no user, membership, Agent-policy or financial
DML and no migration-history write. It does not verify any existing password
account, grant roles, seed an Agent allowlist, enable billing or change credentials.

Proposed guarded SQL SHA-256: `3b447f657b20293132b0d39926737314b0ac4776a97cb5a2eeedfb5313d839e6`.

Pinned original SHA-256 values:

- Agent migration: `761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7`.
- Auth migration: `ad968345199bb9fa84add0340777631f99d5583aafe1949790051ccdf6d9873f`.

## Execution prerequisites and abort conditions

Before requesting execution approval, record the reviewed PR/commit and SQL hash,
confirm the intended production database binding in the protected runtime, and
confirm a current restorable backup/PITR point with an isolated restore rehearsal.
Fresh read-only inspection identifies Neon and the reported main database, but
does not establish the serving/preflight resource binding or restore capability.
The project is at its reported 10/10 branch limit, its history retention is six
hours, and no snapshots or schedule entries were returned. Capacity resolution,
a usable fresh pre-repair point and isolated restore verification remain gates. See `PRODUCTION_DATABASE_HOSTING_AND_RESTORE.md` for
current discovery evidence, status and the gated restore procedure. Serialize with all other migration jobs; do not dispatch
the existing production-db-migrate workflow or allow concurrent manual DDL.
Use the existing required reviewer/change controls; manual execution must not bypass protected production governance. Keep all production billing activation flags and live Stripe settings unchanged.
Never expose DATABASE_URL, founder address, hashes, tokens or private account rows.

Abort without further mutation if the target/backup is uncertain, any guard fails,
lock acquisition times out, schema differs from the original migration, more than
the expected auth ledger row would change, or actual identity/membership evidence
changes. Do not turn a guard failure into IF NOT EXISTS or edit the historical SQL
to force completion. Obtain a new read-only report and review the divergence.

## Risks, rollback and recovery

- Nullable-column addition is additive and normally avoids a table rewrite, but
  ALTER TABLE still needs an exclusive lock. The short timeout aborts rather than
  waiting indefinitely; it cannot guarantee zero latency impact.
- Existing password accounts remain unverified. They need the normal single-use
  email proof and working delivery configuration. No timestamp backfill is allowed.
  OAuth and password sessions must be tested separately after schema recovery.
- SQL and Prisma ledger resolution are separate operations. If SQL succeeds but
  ledger resolution fails, stop: do not rerun the DDL. Inspect exact postconditions
  and resolve only that already-completed auth migration after review.
- Before COMMIT, a failure rolls back the whole auth DDL transaction. This was
  injected and verified in the isolated full-history rehearsal.
- After COMMIT, prefer leaving this additive schema in place if an application
  rollback is needed. Do not automatically drop verification data or reset ledger
  rows. Once verification tokens/timestamps exist, dropping the table/column loses
  security/account state. A destructive downgrade or backup restore needs a write
  freeze, data-preservation plan and separate explicit approval.
- The failed Agent migration still blocks blanket `migrate deploy` with P3009.
  Auth recovery is not completion of database recovery or authorization to apply
  unrelated financial backfills. Agent, workflow or financial paths referencing
  still-pending tables/columns may remain unavailable or fail closed. Do not claim
  a restored governed deployment/customer journey merely because sign-in succeeds.

## Remaining chronological recovery, separately reviewed

After auth acceptance, inspect the failed row's original logs/checksum/steps and
actual WorkspaceAgentIdentity table/constraints/row inventory read-only. Decide
which previously authorized workspace policies must be preserved. No source in
this report authorizes bulk enabling Agent tools. An exact compensating SQL plan
and its checksum/ledger resolution must be reviewed before repairing that failure.
Do not silently choose between enabling all workspaces and disabling existing
policies. No production plan for that policy DML is executable from this document.

Once reviewed Agent postconditions are implemented and its failed state is
explicitly reconciled, the remaining independent files keep their chronological
order (auth already applied in phase one):

1. 20261013193000_add_durable_agent_workflow — workflow/event tables and indexes.
2. 20261013220000_add_founding_supporters — supporter purchase/event tables.
3. 20261014090000_add_ai_usage_stripe_settlement — config/settlement/period tables;
   enabled defaults false and limit zero; do not populate or activate them.
4. 20261014190000_verified_ai_credit_fulfillment — AddOnPurchase columns, legacy
   idempotency backfill and unique financial constraints, plus StripeBillingEvent.
   This changes existing financial records and requires its own approved review.
5. 20261014210000_ai_usage_reservations — reservation table and unique indexes.

The original unfinished Agent migration remains a prerequisite for blanket deploy.
All six original remaining items, plus the separately proposed
`20261016010000_cloud_account_enrollment` and
`20261016020000_cloud_account_credential_revocation`, are retained in the tracker; none is
silently skipped or represented as completed by the auth-only plan.

## Rehearsal and acceptance evidence

`node scripts/rehearse-auth-recovery.mjs` accepts only the explicitly named empty
loopback fixture via AUTH_RECOVERY_TEST_DATABASE_URL. It refuses a populated DB
and never resets it. A dedicated CI workflow has only contents:read, no protected
production environment and no production secrets. The harness has passed local
disposable PostgreSQL 16 and 17.11: it recreates the full original chain, confirms
99 applied migrations then P3018, injects DDL rollback, preserves existing identity/membership and unverified status, records
only the exact auth checksum, preserves the original failed row, and confirms
blanket deployment remains blocked with P3009. Local evidence is in
`docs/mission/auth-recovery-rehearsal.json`; newer PostgreSQL 16/17.11 source and
engine compatibility evidence is in `docs/mission/aws-enrollment-schema-rehearsal.json`.
Synthetic engine compatibility is not Neon target binding or restore readiness.
No historical migration file changes.

Actual production acceptance still requires: successful founder Google and GitHub
sessions; successful verified-password login for an account that legitimately has a
password, plus rejection of wrong/unverified passwords (do not create or change
credentials as part of this schema repair); canonical User/membership/workspace mapping; platform-admin policy
checked privately if required; browser-to-desktop pairing and access denial
checks; and no new schema errors. Provider listing, founder preflight and build
success alone cannot satisfy these acceptance criteria.

Local validation for this proposal: 541 Vitest files / 5,365 tests; web/desktop
TypeScript; desktop frontend build; 30 Python CLI tests; targeted preflight,
recovery-boundary and walkthrough tests; mission register coverage; and the full
isolated PostgreSQL rehearsal passed. Exact-head CI is recorded in the focused
PR. This evidence is not production execution approval or live login acceptance.
