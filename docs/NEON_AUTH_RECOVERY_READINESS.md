# Neon authentication recovery readiness — proposed, not authorized

Evidence date: 2026-10-15. Protected read-only [run #3](https://github.com/sahme209/visionxixlabs/actions/runs/38796959412)
checked main `7e5eaf2117c371912e45276a8e43840d3a02557c`.
It identifies a Neon endpoint, seven pending migrations, the unfinished agent
identity migration referencing absent Organization, and absent email verification
schema. Founder mapping passed; actual authentication and platform administration
are not established. Diagnostic exit 2 is expected. No production change occurred.

## Gate 1: establish the actual production target privately

An authorized operator needs read-only Neon project metadata and permission to
inspect production configuration privately in its secure runtime. No connection
strings, passwords, endpoint/resource identifiers or account rows belong in chat,
GitHub logs or this repository. Neon control-plane access is now available and metadata inspection is complete;
see `docs/mission/neon-readiness-inspection.json`. The serving application and
protected workflow resource bindings remain unverified. Do not retrieve decrypted
Vercel secrets through connector outputs.

1. Resolve the deployment currently serving visionxixlabs.com; distinguish it from
   the newest main deployment and from previews. Record its deployment reference
   and build revision. Identify its effective DATABASE_URL binding, including
   deployment-time environment scope and any domain/branch overrides. A current
   dashboard variable alone does not prove an older deployment's runtime binding.
2. Privately map that binding's Neon compute endpoint to its owning project and
   branch, and its database name. Map the protected preflight DATABASE_URL the same
   way. Compare project, branch and database, not complete URL strings: application
   and maintenance roles can differ, and pooled versus direct hosts can differ.
   Confirm both endpoints belong to the same intended branch through Neon metadata.
3. Confirm that branch is the intended production resource with the owner. A name
   of main/production, a matching schema, a founder row or a Neon suffix alone is
   insufficient. Verify datasource indirection/proxy configuration if present.
4. Record only targetMatch passed/failed/unverified, checkedAt, serving deployment,
   and the private evidence location. On mismatch, stop recovery; propose the
   precise configuration correction separately. Do not repoint the app or copy data.

## Gate 2: account-specific backup/PITR inspection, read-only

Inspect the verified project's actual plan, Postgres version, region, branch
protection, configured history window and currently available recoverable range.
Record earliest/latest restorable UTC times and observation time, not a marketing
maximum or assumed plan default. Confirm a point immediately before the proposed
repair is recoverable and remains inside the window through review/execution.
Recheck immediately before execution; an old diagnostic is not a recovery point.
Do not enlarge retention, change a plan, create a snapshot or provision a branch
as part of read-only inspection. If the available range is insufficient, record a
blocker and propose the exact separately approved protection action and cost.

Inventory any existing logical backups separately: last successful completion,
coverage, encryption/access, retention, artifact integrity and tested restore.
PITR and an independent logical backup have different failure coverage. Confirm
what restoration includes and any separately managed roles, extensions, secrets
or integrations; do not assume a database restore reinstates all external systems.

## Gate 3: separately approved isolated restore rehearsal

Prepare an approval packet naming privately the source branch, UTC point within
its observed history range, isolated target name, access restrictions, expected
cost, expiry/cleanup owner, RPO/RTO targets and exact verification steps. This
packet authorizes neither production branch restore nor routing changes.

After explicit approval only:

1. Use Neon's New branch flow, explicitly choose the verified source parent and
   **Past data** at the approved timestamp. Do not use restore/reset on the source,
   change the default branch or attach this clone to Vercel. Confirm the target is
   a different branch before connecting. Set the approved expiry explicitly;
   console and API defaults can differ. Branch creation copies production data and
   may incur charges even though it leaves parent data unchanged.
2. Restrict access before use. Neon branches can inherit parent roles/passwords;
   isolation is not guaranteed merely by a new branch name. Review protection and
   approved target-only access controls without rotating production credentials.
   If safe isolation cannot be achieved, stop. No app, cron, mailer, Stripe worker,
   webhook consumer, Airflow executor or deployment agent may run on the clone.
3. Record creation/recovery duration. On the isolated target, privately inspect
   schema, constraints, migration checksums/failed state, founder identity and
   workspace membership, financial ledgers, reservations and outstanding holds.
   Compare to an appropriately time-aligned baseline; production may have new
   writes after the chosen point. Output aggregate pass/fail only, no user rows.
4. Separately approve any clone writes used to rehearse the exact auth-only SQL
   and subsequent exact auth migration resolve from PRODUCTION_AUTH_RECOVERY_PLAN.md.
   Verify nullable verification timestamps remain unbackfilled, token constraints,
   unchanged identity/membership/financial data and unchanged failed agent history.
   The local fixture harness deliberately refuses populated/nonlocal databases:
   **do not weaken or point it at this clone**. Use a reviewed clone-only procedure.
5. Verify rollback/abort behavior on the clone and record measured RTO/RPO,
   limitations and access/cleanup evidence. Follow the approved retention/deletion
   policy; cleanup is not permission to delete any existing production branch.

## Production decision remains separate

All three gates need evidence before approval of exact production changes:
`ops/recovery/20261015_auth_schema_only.sql`, followed only after postcondition
verification by resolving `20261014120000_add_email_verification` as applied.
No blanket deploy, agent-migration history reset, fabricated Organization table,
verification backfill, billing activation or financial migration is included.
Original hashes, SQL guards, risk analysis and regression evidence remain in
PRODUCTION_AUTH_RECOVERY_PLAN.md. Existing isolated PostgreSQL tests establish
SQL behavior, not Neon backup readiness or actual production login.

After approved repair: rerun protected preflight (six pending and the original
agent failure remain expected), then validate legitimate founder password/email
proof, Google and GitHub OAuth callbacks, workspace access and desktop pairing.
Keep additive schema on application rollback where possible. A production PITR
restore/routing switch requires separate approval, write coordination and
reconciliation of post-point writes and external financial outcomes.

## Current evidence ledger

| Gate | Status |
| --- | --- |
| Protected endpoint provider | Neon, confirmed run #3 |
| Intended serving application target match | Unverified; private binding + control-plane evidence required |
| Configured history retention | Owner reports 6 hours from Neon console; actual recoverable range still unverified |
| Usable pre-repair point | Unverified; account-specific recovery range required |
| Isolated restore | Not approved or performed |
| Local auth-only regression rehearsal | Passed previously; not a production-data restore |
| Production execution | Not requested or approved |
| Production login / native pairing | Not verified |

Provider documentation reviewed 2026-10-15:
[branch creation, past data, role inheritance and expiry](https://neon.com/docs/manage/branches),
[backup strategies](https://neon.com/docs/postgres/backup-restore/backups),
[connection pooling](https://neon.com/docs/connect/connection-pooling).
These describe capabilities; they do not attest to this account's configuration.

Owner-provided console evidence identifies the candidate project and main branch,
one database, PostgreSQL 17, AWS US East 1 and Free plan with six-hour history
retention. This does not prove the serving deployment binding or a usable point.

## Current read-only evidence and capacity gate

Agent inspection confirms the reported project/default main branch/database,
PostgreSQL 17, Free plan, six-hour retention, no snapshots returned and no snapshot
schedule entries. There are ten branches at the reported ten-branch limit; nine
were created by Vercel, including three archived branches. No branch was deleted,
plan upgraded, retention changed or infrastructure provisioned. Review actual
dependencies before proposing cleanup; archived/preview naming is not proof that
a branch is unused. Capacity must be resolved before an isolated restore copy.

SELECT-only catalog/history inspection finds 99 completed migrations, the same
seven pending migrations, five pre-existing historical rolled-back attempts and
no checksum differences for completed/active migration source. WorkspaceAgentIdentity
and Organization are absent, as are auth verification schema objects. The active
failed migration started 2026-10-14T12:36:08.531Z, outside the configured six-hour
maximum. A pre-failure healthy PITR point cannot be assumed; independent backups
remain unverified. Prepare a fresh recoverable pre-repair baseline that preserves
current data, rather than restoring an old timeline and discarding later writes.

Current Neon Time Travel documentation states that historical read-only queries
create temporary branch/compute resources. Metadata access does not authorize
that provisioning. A usable timestamp, target isolation, cost and cleanup must
be reviewed and separately approved; the existing restore rehearsal gate remains.
Matching schema/history fingerprints do not prove the serving Vercel binding.


## Capacity resolution review packet — no action authorized

The recovery sequence is binding attestation → reviewed capacity resolution →
approved isolated recovery-point verification/restore → exact authentication-only
repair approval. Do not combine these approvals or delete a preview as an implicit
side effect of a login repair.

Before proposing removal of any one of the nine integration-created branches,
privately inventory its parent/children, endpoint usage, Vercel integration and
deployment references, active pull request, branch-specific configuration, other
clients and unique data. Archived state or an old PR is insufficient. Record the
selected resource privately, its dependents, rollback/export requirements and
expected integration behavior. If dependency absence cannot be established, do
not select it for deletion. A paid capacity change is an alternative requiring
explicit cost/infrastructure approval; no plan change is implied here.

After capacity is available, present a separate resource-creation packet: exact
source identity matching the serving deployment, freshly verified recoverable
timestamp, isolated target name, no application binding, restricted access,
expected compute/storage cost, lifetime and cleanup approval. Never include a
source restore/reset or connection-string replacement. Preserve current writes;
the failed migration predates the configured history window. Stop if the requested
point cannot actually be restored. The existing isolated rehearsal checks and
artifact hashes remain mandatory before proposing production DDL.
