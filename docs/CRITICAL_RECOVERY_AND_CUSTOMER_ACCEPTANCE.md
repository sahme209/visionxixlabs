# Critical recovery and customer acceptance — execution checkpoint

Evidence date: 2026-10-15. Baseline main: `153bacd4665149b4afe738397be8281d02b25753`
(PR #134). This replaces neither the unified mission nor its requirement register.
No major visual redesign is started. No production SQL, secrets, routing, live
billing or infrastructure changes are authorized by this document.

## What actually works, and what has not been demonstrated

No complete real-customer journey from signup through deployed/rolled-back
workload and reconciled test invoice has been verified. Passing tests and READY
builds must not be reported as that acceptance.

| Journey or component | Actual evidence | Status / next exit criterion |
| --- | --- | --- |
| Website serving / build | #130–134 main builds READY; fresh domain lookup now serves #134 commit `153bacd4` | Previous older-alias observation superseded; actual authentication remains unverified. |
| Provider registration | Public `/api/auth/providers` returned HTTP 200 | Configuration discovery only; not OAuth acceptance. |
| Founder identity/workspace records | Protected read-only preflight #3 accountCheck passed | Mapping passed; actual password/OAuth ownership, platform-admin configuration and operational entitlement not verified. |
| Signup + email verification | Route/guard regressions; auth token table/column missing in protected target | Blocked by binding/recovery gates. New production test-account creation is not authorized. |
| Password / Google / GitHub login | Observed P2022 and absent auth schema; handlers/negative cases tested | None verified successfully against production. Require actual sessions and correct workspace access after approved repair. |
| Desktop authentication / pairing | Native CI and rendered recovery tests passed; #132 preserves rejected credentials | Packaged current-source browser approval, consume/replay/revoke, Keychain and return flow unverified. Late canceled responses are guarded; cancellation during already-started native writes and packaged vault acceptance remain open. |
| Cloud connection | Provider validation code / tests; no runtime outbound identities | No customer-owned account connection verified in this runtime. Need scoped sandbox identity and tenant mapping. |
| AI-assisted plan | Existing planning/runtime and cost-identity kernels | Real model response, bounded spend receipt and immutable approved plan not yet traced together. |
| Approvals | Default-deny/prerequisite and role tests | Need an actual distinct authorized approver, version-bound evidence and denied/revoked/cross-tenant cases on the same journey. |
| AWS ECS execution | Checked-in workflow and template parity, target serialization and stabilization/rollback commands | Not dispatched. Need reviewed target, OIDC role/trust, approval binding and cost limit; prove no direct-dispatch bypass before acceptance. |
| Rollback | Decision tests and workflow recovery commands | Actual controlled failure, rollback stabilization and independent health evidence unverified. A rollback plan is not executed recovery. |
| Airflow dependencies | Client and automation tests | Real Airflow 3 DAG/dependency/retry observation unverified. Include only if the selected customer workflow requires it. |
| Azure / GCP execution | Existing read/inventory paths; adapter apply/rollback TODOs | Missing generic write/rollback implementation; credentials alone cannot close this gap. |
| Terraform | Existing integration/plan surfaces | No approved sandbox plan/apply/state-lock/rollback-or-forward-recovery evidence. Do not infer acceptance from SDK presence. |
| Stripe test billing | Signature/gating/idempotency/budget/queue tests and synthetic SQL fixtures | No actual test customer/subscription/invoice/refund/webhook-replay acceptance. Live billing remains disabled by this plan. |

## Priority 1: database recovery gate sequence

Existing authoritative proposal: `PRODUCTION_AUTH_RECOVERY_PLAN.md`.
Neon-specific procedure: `NEON_AUTH_RECOVERY_READINESS.md`.

1. **Read-only metadata access is established.** Neon tools now confirm the
   reported project/default branch/database and preflight schema fingerprint.
   See `docs/mission/neon-readiness-inspection.json`. This does not prove serving
   or workflow bindings, a usable recovery point, or authorize mutation. No secret
   values belong in chat or artifacts.
2. **Prove the target.** Privately map the *serving deployment's effective*
   DATABASE_URL and the protected preflight's DATABASE_URL to the same intended
   Neon project, branch and database. Different roles and pooled/direct endpoints
   can be legitimate. Current Vercel project settings alone do not prove the old
   deployment's binding. The connector's encrypted env response is truncated;
   its single-variable endpoint decrypts secrets, so it must not be used here.
   If a safe private comparison capability is unavailable, an authorized operator
   must attest only match/failed/unverified plus observation time and private
   evidence location. Matching schema or founder records is insufficient.
3. **Read actual recovery settings.** Read-only Neon metadata corroborates the
   candidate main database, PostgreSQL 17, US East 1, Free plan and 21,600-second
   retention. No snapshots or schedules were returned; the project is at 10/10
   branches. Serving/preflight binding, earliest/latest restorable timestamps
   and a usable pre-repair point remain unverified. Resolve isolated-copy capacity
   only with separate approval; recheck recovery availability before any repair.
4. **Prepare exact isolated-restore approval.** Name the source privately, chosen
   timestamp, isolated target, access restrictions, cost cap, expiry and cleanup
   owner. No branch creation, data copy, plan change or restore before approval.
   Branches can inherit credentials; detach all application workers, email,
   Stripe, webhooks, schedulers and deployment execution. Do not start the app on
   copied production data. Validate integrity privately and record measured RPO/RTO.
   This restores the current broken baseline; it is not proof that six-hour
   history includes a healthy database from before the older migration failure.
5. **Only after evidence, request exact production repair approval.** Guarded SQL
   SHA-256 `3b447f657b20293132b0d39926737314b0ac4776a97cb5a2eeedfb5313d839e6`:
   nullable User.emailVerifiedAt and EmailVerificationToken table/indexes/FK,
   no verification backfill or account/financial edits. Verify postconditions,
   then separately execute the approved auth-only migrate-resolve step from the
   existing proposal. No blanket migrate-deploy, fabricated Organization table,
   failed-history reset or unrelated financial migrations.
6. **Accept login rather than infer it.** Protected preflight must show auth schema
   present. The pinned seven-file baseline leaves six pending; a checkout with
   `20261016010000_cloud_account_enrollment` expects eight before repair and seven
   afterward; including `20261016020000_cloud_account_credential_revocation`
   expects nine before and eight afterward. Compare exact pending names; both
   AWS proposals stay unapplied and
   separately approved, and the original failed Agent record remains expected.
   Verify legitimate password/email proof, Google and GitHub sessions,
   founder account/workspace identity and denied access. No admin bootstrap grants.

Auth-only repair does not prepare every Agent/workflow/billing table. The failed
workspace-agent migration and its intended policy backfill need a reviewed
clone-first correction before the full operational customer journey can pass.
Do not bulk-enable tools from memberships. Review each dependent migration and
financial mutation separately. Restore, production repair and later migration
batches are different approvals; none has been requested for execution yet.

## Priority 2: one complete acceptance exercise

First target: one isolated customer test workspace, GitHub and AWS ECS. Preserve
all provider scope; validate Azure/GCP read connections separately and implement
missing write contracts before claiming their execution journeys complete.

Before asking for execution approval, prepare an exact packet with:

- Test tenant/account and test actors (customer, approver, denied actor), email
  delivery target, exact desktop build commit/artifact and supported OS.
- Nonproduction GitHub repository/ref/workflow and AWS account/region/cluster/
  service, current baseline, least-privilege OIDC trust, maximum cost and cleanup.
- Actual bounded AI model/cost budget; provider receipt and immutable plan version.
- Approval record binding to tenant, target, inputs, plan digest and expiry; prove
  direct workflow dispatch cannot bypass the intended authority boundary.
- Approved happy path and controlled failure; stable deployment, independent
  health verification, rollback target, stable rollback and audit correlation.
- Stripe **test** customer/products/prices and isolated webhook sink, spend cap,
  subscription/invoice expectations, replay and refund cases. No live key or
  live-price activation; test-mode provider calls and test-data writes still
  require explicit permission and an isolated runtime.
- Expected cleanup and evidence retention. Do not publish account identifiers,
  credentials, session cookies, account rows or raw financial payloads.

Acceptance must trace the same actor/workspace/request/plan/approval/provider run
through signup, email proof, login, desktop pairing, cloud connection, planning,
approval, execution, health validation, controlled failure/rollback and test-billing
reconciliation. Record provider receipts and sanitized outcomes; stop the exercise
on tenant/identity mismatch, missing approval, unknown provider acceptance or
unexpected charges. Do not replay an unknown outcome or release its hold.

PR #136 corrected legacy website-builder provider misrouting: unsupported
AWS/Azure/GCP selections now reject before generation/outbound calls. This does
not implement those cloud adapters or establish deployment acceptance. Admin
preview/publish APIs now enforce their existing configured administrator guard;
public signed-token lead flows retain their separate capability boundary.

## Priority 3: safe website release

Fresh read-only Vercel alias inspection now resolves `visionxixlabs.com` to
`dpl_DdQu4nKjbsETe61AwFPPwMwfvacH`, READY production Git deployment at main
`3df6d03f92d2eaa198ba021adfda86825c2c1a32` (#138). This supersedes the earlier
#123 and #134 alias observations. No routing or promotion action was performed
by this work. Operator attribution and future assignment policy remain
unverified. Fresh project-filtered events identify a manual
promotion to #138 at 22:27:11 UTC. Per-deployment alias lists confirm the custom
domain belongs to #138; the later READY #139 owns two other aliases only. This
explains current source lag without attributing the operator. No rolling release
or template is returned. See `mission/vercel-release-inspection.json`. A READY
serving build does not prove authentication.

Vercel documents rollback/promotion effects on automatic assignment. The current
manual pin is evidenced; future assignment settings still need review. Preserve
the approval process below for
any deliberate release or routing change.

Proposed reviewed process:

1. Inspect actual automatic-assignment/rollback policy and record whether a future
   promotion would also enable future pushes to go live. A one-time release
   approval must not silently authorize ongoing automatic production releases.
2. Pin one READY **production** deployment by immutable commit and ID; confirm its
   effective configuration privately. Do not promote a preview that would rebuild
   with different production variables. Gate on exact-head CI, schema compatibility
   and the actual customer acceptance results above.
3. Review additive-schema compatibility with the serving rollback candidate. Define
   expected auth/schema checks, health criteria, observation period and rollback
   trigger. Code rollback does not undo database writes or external provider effects.
4. Present exact candidate, current serving deployment, affected domains, future
   assignment behavior and rollback candidate for explicit routing/release approval.
5. Only after approval, promote that already-tested build. Verify custom-domain
   deployment identity, callbacks, real login/workspace and error/monitoring results.
   Any rollback/routing action follows its separate approved boundary. Preserve
   additive auth schema by default; destructive DB rollback remains separately gated.

Reference: https://vercel.com/docs/deployments/promoting-a-deployment

## Current validation and requested access

Targeted current-main run: 11 files / 78 tests passed (auth recovery/login gates,
desktop recovery UI, governed prerequisites, ECS template, Airflow client,
rollback decision, Stripe helpers). These complement the earlier full 5,409-test
run; they are not real customer acceptance or a Neon restore rehearsal.
This earlier validation checkpoint predates the connected Neon read-only inspection
below. Neon metadata and schema access now work; serving runtime binding, actual
recoverability and real customer acceptance remain unverified.

**Essential next action now:** privately attest whether the serving deployment and
protected preflight target match the inspected Neon resource. Neon is already
authorized; reinstalling it is unnecessary. Actual restorable range remains a
separate readiness gate. We do not need passwords or connection strings in chat.
If Neon metadata alone cannot establish the Vercel binding, the private comparison
remains a separate required attestation. Isolated restore, SQL repair, sandbox
execution/test billing, native publication and website promotion each need their
own concrete approval packet after their prerequisites are verified.

## Fresh Neon readiness checkpoint

The project is at its reported branch limit (10/10, nine Vercel-created preview
branches). This blocks new branch creation and the proposed isolated restore
copy; it is a likely explanation for preview provisioning failure, without a
per-deployment provider trace. No cleanup/upgrade/retention change is authorized.
Six-hour retention and empty snapshot/schedule inventory are verified; actual
recoverable range and independent backups are not. Historical Time Travel itself
creates ephemeral resources and needs its own reviewed scope. The failed migration
is older than the configured window. Preserve current data through a fresh
pre-repair recovery point; do not assume an old healthy timeline is recoverable.
