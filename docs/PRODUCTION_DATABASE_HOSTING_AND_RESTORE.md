# Production database hosting and restore readiness

Status: protected preflight #3 identifies a **Neon configured endpoint**. The
application binding, actual backup/PITR availability and restore readiness remain
**unverified**. See NEON_AUTH_RECOVERY_READINESS.md for the provider-specific procedure.
The owner confirmed this status after production preflight #2. No production
migration, backup creation, restore, credential retrieval or infrastructure change
is authorized by this discovery work.

## Evidence available now

- The application uses Prisma's PostgreSQL datasource and DATABASE_URL. The
  protected production preflight successfully ran PostgreSQL read-only catalog
  queries. This verifies an accessible PostgreSQL-compatible target, not its host.
- Vercel account/project integration metadata exposed Resend; the project's
  connector is GitHub. Neither identifies a database resource. The project
  response does not expose a database/storage attachment in its available fields.
- Repository `.env.example`, VERCEL_ENV_CHECKLIST.md and SELLABLE_BOT_README.md
  list Neon, Supabase and other PostgreSQL options as setup examples. They do not
  identify the service in use. SDK dependencies and example compliance fixtures
  are not hosting evidence.
- Nondecrypted environment metadata is truncated; missing keys in that response
  are not proof that a production database variable or integration is absent.
- This agent's GitHub workflow dispatch/run-list CLI requests return Forbidden.
  A known run can be inspected through the connected job tools, as #2 was.
  No database-provider control-plane/backup connection is currently available.

## Safe identification through the existing protected runtime

The existing manual read-only preflight now derives a small metadata object from
its configured DATABASE_URL **inside** the protected runtime. It does not print
or export the URL, hostname, database name, username, password, port or query.
It returns a recognized endpoint-provider hint or unknown. Local endpoints and
Prisma Accelerate remain proxies with an unverified backing provider. Domain
lookalikes, userinfo and query parameters cannot supply a provider classification.

A recognized suffix establishes a configured endpoint provider, not the selected
account/resource, backup plan, retention window or equivalence with Vercel's app
DATABASE_URL. The public fields deliberately retain:

- applicationDatabaseBinding: not_verified
- backupStatus: unverified
- restoreStatus: unverified

After the change merges, run **Read-only production auth preflight → main** using
the same protected production environment and existing review controls. No new
secret or credential permission is required. Share only its public-safe summary
or run URL. With the original seven pending migrations, diagnostic exit 2 is
still expected. The report must be produced before claiming a specific host.
No secret-value pull or public diagnostic endpoint is added.

## Backup status ledger

| Item | Current status | Evidence needed |
| --- | --- | --- |
| Configured provider | Neon endpoint confirmed in run #3; candidate project/default branch/database corroborated read-only | Serving application and protected-preflight binding comparison still required |
| Website/maintenance DB target match | Unverified; owner attestation: “Not yet verified” | Private read-only comparison of current production resource bindings |
| Backup/PITR configuration | 21,600-second retention verified; no saved snapshots or schedule entries returned | Usable point and any independent backup still unverified |
| Retention and restore-point range | Configured retention verified; earliest/latest restorable timestamps unverified | Actual recoverable UTC range and fresh pre-repair point |
| Current protected recovery point | Unverified | A successful available backup or valid PITR point covering the intended change |
| Restore procedure | Neon-specific packet prepared; 10/10 branch capacity blocks isolated copy | Separately approved capacity resolution, target isolation and actual restore verification |
| Restore exercise | Not performed | Approved isolated restore with integrity evidence and measured recovery time |
| Production execution approval | Not requested | Verified prerequisites plus explicit approval of exact SQL and ledger step |

## Proposed restore procedure — not yet provider validated

1. Identify the service/resource through read-only metadata. Corroborate that the
   protected maintenance DATABASE_URL selects the same production database as
   the deployed website. Never infer target equality from matching schemas alone.
2. Inspect the actual provider backup/PITR configuration read-only: engine/version,
   retention, latest successful backup or continuous recovery window, restore
   granularity, encryption/access controls, region and any plan restrictions.
   Record status and timestamps without publishing resource IDs or credentials.
3. Choose a recovery point and write the provider-specific restore steps after
   the provider is established. Confirm what a backup includes: schema, data,
   migration ledger, extensions and ownership/role configuration. Define the
   approved recovery-point/data-loss limit and recovery-time target.
4. Prepare a concrete **isolated** restore target and obtain separate approval
   before provisioning, incurring cost or copying production data. Use restricted
   access and retention. Keep application workers, outbound email, Stripe,
   webhooks, schedulers and deployment execution disconnected; do not start the
   normal app against an unreviewed production-data clone.
5. Execute the approved restore only to that isolated target. Privately verify
   restore consistency, required schema/constraints, migration history, identity
   and membership preservation, and financial ledgers/holds. Do not expose account
   rows, password hashes or secrets in logs. Record measured restore duration and
   recovery-point age. An empty-schema rehearsal is not a production-data restore.
6. Review the evidence and cleanup/retention plan. Mark restore readiness verified
   only after the provider-specific exercise succeeds. Keep production untouched
   until explicit approval of the exact auth-recovery SQL and ledger step.
7. If production rollback becomes necessary, prefer leaving additive auth schema
   in place while reverting application code. A production PITR restore, routing
   switch or destructive downgrade requires its own approval, write coordination,
   post-backup write reconciliation and accounting for external Stripe/provider
   outcomes. Never replay financial actions or release uncertain holds because a
   database was restored to an earlier point.

No provider-specific backup command is presented as verified before the provider
and account settings are established. No automatic backup, restore, migration,
ledger reset, credential decryption or production change is performed here.
See PRODUCTION_AUTH_RECOVERY_PLAN.md for the independently rehearsed auth-only
proposal; that rehearsal does not satisfy the production backup/restore gate.

Local validation of the reporting change: 542 Vitest files / 5,390 tests, web and
desktop TypeScript, desktop frontend build, 30 Python CLI tests and mission
coverage checks passed. These tests certify the sanitized reporting boundary,
not the actual provider, production backup availability or restore readiness.
