# Authentication recovery: private operator evidence packet

Status: evidence collection only. Target binding, usable recovery point, isolated
restore and production authentication remain unverified. This packet grants no
production mutation, deployment, routing, credential, infrastructure or billing
authority. Existing protected read-only preflight authorization remains bounded
to that workflow and its normal production review controls.

## Dated observations and their limits

At 2026-10-16 11:05 UTC, the custom-domain alias `visionxixlabs.com` resolved to
Vercel deployment `dpl_6cv75StHTFg1enN1xPYRuLEcXzoX`, READY, target production,
main commit `fef79a0eed15c8251dd46560e2e42f140b8c7177`. Deployment creation was
2026-10-15T23:54:19.624Z; ready time 2026-10-15T23:57:25.101Z; alias update
2026-10-16T00:03:06.398Z. These fields identify the observed serving deployment,
not today's merged source, its effective datasource, or successful authentication.

Three new read-only control-plane requests were made: Neon get_branch, Vercel
get_alias, and Vercel get_deployment for the alias's deployment. No production SQL,
environment-value lookup, new preflight or resource change occurred. Neither
Vercel response exposes the effective database mapping. Neon reports the default
branch ready, primary/default true, protected false, with separate integration
restrictions against deletion and read-write compute deletion/movement. This is
not backup or recovery-point proof. No recoverable timestamp range is exposed.
See [the sanitized receipt](mission/auth-readiness-follow-up-2026-10-16.json).

The previous six-hour retention, 10/10 branch capacity and empty snapshot/schedule
inventory remain observations dated 2026-10-15. They were not re-queried here.
Current managed-environment policy/readiness does not supply the missing runtime
binding: configured secrets, runtime variables and outbound identities were
reported empty by the coordinating session, not re-inspected in this follow-up.

## Read-only binding attestation

1. In the existing private production operations context, resolve the domain's
   actual serving deployment at comparison time. Record deployment reference,
   commit, target and UTC check time. The dated observation above may change.
2. Inspect authoritative configuration for **that deployment's effective
   datasource**, including deployment-time scope, branch/domain overrides and
   any proxy indirection. Today's project variable list or the newest main
   deployment cannot establish an older serving deployment's binding. Keep
   connection strings and identities private; do not retrieve decrypted values
   through chat-connected tools or publish endpoint hashes. If the existing
   private context cannot establish this evidence, retain unverified status.
3. Privately map the serving compute through Neon metadata to its owning
   project, branch and database. Map the protected production preflight's
   existing datasource the same way in its authorized secure context. Compare
   project + branch + database; pooled/direct hosts and role names may differ.
   Trace a proxy to its backing target. Obtain intended-target owner attestation
   separately. This resource comparison needs no production SQL or new secrets.
4. Record only `targetMatch: passed/failed/unverified`, `checkedAtUTC`, serving
   deployment reference/commit, protected preflight run URL/revision, and a
   private evidence reference. The reference must not embed an account/resource
   identifier, credential or token. On mismatch or missing deployment-time
   evidence, stop recovery. Matching schema or founder membership is insufficient.

## Protected inspection and recovery evidence

The reviewed preflight is manual-only, main-only, contents:read, uses environment
production, and serializes with migration jobs. It installs locked tooling with
lifecycle scripts disabled, generates the client without database credentials,
and gives existing secrets only to the inspection step. The script enforces a
read-only RepeatableRead transaction and bounded queries. `--public-summary`
keeps account metadata out of public logs. Source inspection does not prove the
environment's current reviewers, actual secret target, or Actions permissions.

After binding verification, an operator with existing Actions access may use
**Read-only production auth preflight → reviewed main** under its existing
protected controls. Verify the workflow and selected revision first. A full
diagnostic exit 2 remains expected for pending/failed migrations. The current
catalog exposes no dispatch tool; previous CLI Forbidden is historical evidence.
Do not substitute a migration workflow or unrelated job rerun, broaden access,
or bypass protection. This packet is not a repeated access request.

Compare exact pending names from the selected checkout. With the unchanged
historical database baseline, current main source expects ten before auth-only
repair and nine afterward; the historical seven/six and intermediate eight/seven
and nine/eight counts remain valid for their earlier source sets. These are
source-derived expectations, not a new production inspection. All three newer
proposals remain outside auth-only repair.

Inspect existing recovery/backup console metadata for the verified source,
without starting Time Travel, creating snapshots/branches, or restoring. Record
actual earliest/latest recoverable UTC times and observation time only if the
platform reports them. Six-hour configured retention does not prove a usable
now-minus-six-hours point. Record existing independent-backup completion,
integrity and restore evidence separately. If verifying a point requires
resource creation, retain unverified status and use the separate bounded
capacity/isolation/cost/expiry approval packet in
[Neon readiness](NEON_AUTH_RECOVERY_READINESS.md).

Capacity resolution, any production-data clone, isolated restore verification,
auth DDL and migration-ledger resolution remain separately gated. Archived or
preview naming does not prove a branch can be deleted. Do not repoint the app,
change protection/retention, rotate credentials, or change live billing.

Founder canonical/personal membership mapping passed protected preflight #3.
It proves neither external identity ownership, successful Google/GitHub/password
authentication, platform administration, paid entitlement nor native pairing.
The workflow does not supply ADMIN_EMAILS, so configuration_unavailable is not
an admin denial or grant. Actual acceptance follows only after separately
approved schema recovery and the distinct authentication/access checks in
[the recovery plan](PRODUCTION_AUTH_RECOVERY_PLAN.md).
