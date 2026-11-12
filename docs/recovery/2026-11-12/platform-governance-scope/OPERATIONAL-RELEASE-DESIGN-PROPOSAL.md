# Platform operational releases — proposed local authority extension

Status: owner approved LOCAL implementation and isolated tests November12. This supersedes only the original exclusion on changing these administrative source entrypoints within the complete replacement batch. No actual run, credential, production, IAM, flag, deployment or spending authority is granted. Existing root owner-click/cost/PR rules remain.

## Source findings

- `.github/workflows/axiom-deploy-aws-ecs.yml` accepts free-form role/region/cluster/service, obtains OIDC credentials, captures the current task definition, forces a deployment and automatically updates the service back when a waiter fails. Its serialization/retry limits are useful, but they do not supply exact independently reviewed action/source authority. A waiter error is not proof that rollback is safe.
- `scripts/setup-vercel-env.mjs` reads broker/Vercel secrets, upserts nine settings into production+preview+development, then redeploys the latest production deployment. It combines secret distribution, live feature enablement and release in one unreviewed operation.
- `scripts/setup-oauth.sh` removes/re-adds configured secrets across all three environments and invokes `vercel --prod --yes`. That violates the standing owner-click-only production procedure if treated as an authorized Axiom default.
- Axiom's actual production procedure is an explicit owner click on exact green main, after production schema/driver compatibility. An application cannot prevent a privileged person from using an external dashboard. This trust boundary must remain visible rather than marketed as technical prevention.

Inspection only; no workflow/script, account, credential, provider or deployment was run or changed.

## Approaches and recommendation

1. Leave the scripts/workflow as implicit exceptions and call P01 complete: reject; the owner included them in scope and current authority is missing.
2. Permanently disable all operations: containment only, not the requested usable governance.
3. Recommended: retire the unmanaged entrypoints only as part of a connected local replacement design. Keep Axiom production manual/owner-click, with exact preparation/review/handoff/verified-result evidence. Managed ECS/settings replacements require their own authenticated workload/private credential/one-attempt composition. No default allow until real suppliers qualify.

This is a recommendation for owner review, not an already selected exception or an assertion these paths are safe. Implementation may be staged on the same coherent branch, but retirement alone never earns coverage.

## Axiom own production release — preserve manual execution

Prepare an immutable release evidence record for the exact repository/main commit, exact project/team/production target, workflow/build/config/lock/schema source hashes, exact applicable CI result references and production compatibility/recovery receipts. Source commit alone is NOT a running-issuer/artifact identity. Reuse existing qualified readers/receipt suppliers where they really exist; missing/unverified suppliers refuse readiness rather than accepting user-entered green booleans, screenshots, stale branch heads or test doubles in production composition.

Current platform requester prepares; a distinct current reviewer inspects/approves the exact evidence. The original requester may record only a one-use manual handoff NOTICE under current authority/expiry. Current platform-admin membership does not identify the owner. There is no trusted owner-ID supplier in the inspected source; do not add an allowlist/default/env setting or call any admin the owner. Owner permission remains the existing external human decision. The record must label owner authorization external_not_verified/owner_attested as applicable, never programmatically verified or a token authorizing deployment. The app does NOT dispatch Vercel, create a preview, redeploy, change settings or authorize spending. The handoff is not provider confirmation. Owner still separately gives the exact production/cost approval and clicks the production dashboard.

Later read-only reconciliation may bind only a qualified exact deployment ID to the reviewed project/team/source/target and its actual provider state. Accepted/BUILDING remains pending; READY needs source/target proof and the required smoke/compatibility evidence. Owner-entered observations remain labelled owner_attested, never verified READY or a controlled provider send. Lost/contradictory results remain unknown; no implicit second handoff/redeploy or approval renewal.

Expose the external administrative boundary: privileged dashboard/CLI/IAM users can act outside Axiom. Such an out-of-band operation is not a verified governed release merely because someone later records its ID. Do not weaken existing owner rules or claim universal dashboard prevention.

## ECS deployment and rollback replacement

Prepare exact account/region/cluster/service ARN, task-definition ARN, requested force/rollback operation, role/workflow revision and captured prior deployment provenance. Read-only source/current target qualification is mandatory. Final force sends the reviewed task definition explicitly; never force whichever revision happens to be current after review.

The existing human paired-session supplier is NOT GitHub workload authentication. A replacement workflow must accept an exact saved action reference, not arbitrary role/target inputs. Before credential exchange it must authenticate through a separately qualified GitHub Actions identity profile: fixed issuer/audience/repository/commit/workflow/run/attempt, short lifetime and replay protection. The profile's actual signed claims must be source-verified before any allow path; do not assume environment variables or caller JSON prove them. No static shared token, forwarded human session token or caller-supplied requester identity fallback.

Builder choice proposed for owner approval: require an ALREADY CREATED exact GitHub run ID and attempt. Its preparation phase has no provider credential exchange or mutation and can only present qualified identity/metadata. Only after that actual run/attempt is known may the plan be prepared, independently reviewed and explicitly delegated. The credential-bearing phase stays blocked until those exact references/current approvals qualify; it cannot poll or mint broad credentials while waiting. A different run/attempt needs a new exact decision. Do not use a first-matching-run redemption rule or a public workflow nonce as a capability. Live creation/dispatch of even this preparation run remains separately owner-authorized; local tests simulate it. This is the proposed secure sequence, not an already granted workflow-run permission.

The original requester explicitly authorizes one exact delegation to that reviewed workflow/run purpose. This introduces a distinct workload execution principal; it can never propose/review itself or inherit a generic platform-admin role. Preserve actual human requester/reviewer IDs separately, validate their current roles/sessions/expiry and the delegation before credential exchange/final send, and bind any issued credential lease to the exact claim with unknown lifetime retained. No real OIDC/IAM/key/grant changes are included here. Unsupported actual supplier/runtime qualification keeps execution unavailable.

Reserve the native service target across actions, operations and retries before dispatch. Unknown/unfinished result blocks fresh action IDs and rollback. Typed immutable private provider receipts bind request/target/task definition/deployment reference and reservation generation. Qualified read-only observation distinguishes acceptance, verified stability, verified terminal failure and unknown. Existing deployment-recovery machinery may be reused only after its own pending design is approved; this document does not implicitly approve it.

Rollback is a distinct exact reviewed action/conditional child binding its actual prior task definition and qualified triggering evidence. It may be reviewed before the first send to avoid a timed human handoff, but a mere timeout/waiter error/transport loss must NEVER satisfy its condition. Unknown force result halts all later effects. Fresh current authority, expiry, known target generation and actual source-backed failure are mandatory before its own single update. Expired or unsupported rollback returns a clear waiting-for-review state, not automatic compensation.

Keep maxAttempts1 and no automatic write retry. Read-only polling must have an explicit bounded qualified profile, no authorization-denial loop, and cannot substitute for provider terminal proof. Record observations after expiry without restoring execution authority. Final workflow/source/credential/CI/lease/caller coverage and real provider acceptance remain mandatory.

## Vercel settings/secret setup replacement

Settings and release are separate independently reviewed plans. No automatic deploy follows a setting change. No implicit production+preview+development expansion; review an exact environment allowlist, project/team, setting names, sensitivity/type, current setting identities/revisions, per-effect source and operation order. Live flags/billing/provider access remain separately owner-approved at execution time.

Do not put secret values, ciphertext, URL credentials or public hashes of secrets into plan/history/log data. Sensitive values use protected, context-authenticated private artifacts with predetermined opaque references; plan settingsDigest hashes only the NONSECRET manifest/reference/profile, not values. Private envelope context binds artifact, exact setting/target/environment, creator and reviewed action/plan/effect. Actual key/custody qualification is separate; local tests use synthetic values/keys. Copying an artifact across targets/actions must fail.

Each physical setting write is a separately claimed child with exact private transport authorization and an immutable bounded result. Do not retain the legacy remove-then-add pattern as an unreviewed pre-step. A concrete provider update/currentness/idempotency profile must be source-qualified; unsupported conditional semantics cannot be invented. If no safe qualified write profile exists, keep that managed operation unavailable and seek a changed owner-reviewed design, rather than silently broadening it or claiming complete settings coverage.

Cross-action native setting identity excludes random parent/reference/profile IDs. Pending/unknown effects hold liability; no new action, reconnect, changed environment list or secret-artifact clone can reset it. Every independently reviewed environment/setting is explicit; unrelated settings are not touched. After one unknown child, stop all later writes and any release. Inspect only original metadata/qualified readback; no automatic re-send or migration-history repair.

## Retirement and composed acceptance

After source implementation/review, unmanaged setup scripts and direct ECS workflow entrypoints must refuse BEFORE reading secrets, launching CLI/configure-credentials, exchanging OIDC or contacting providers. Runtime denial says which governed preparation flow replaces them. Do not remove unrelated CI, verification, free-runner or manual publication controls. Do not run GitHub workflows under this local approval.

The same batch must provide connected local preparation, genuine review, requester/delegation confirmation, bounded result history and non-replay recovery for supported operations. Test the actual default compositions and old entrypoints with synthetic transports/keys/actors: current source/role/session/expiry changes, forked action/reference/workload identities, concurrency, lost claim/send/receipt, stale/cross-target ciphertext, unknown force versus conditional rollback, secret/log exclusion and no credential/provider call on denial. Actual isolated PostgreSQL remains distinguished from simulated provider/workload/CI claims.

Source completeness requires a default caller/operation inventory audit, no uncovered path or claimed exception hidden by a coverage-list edit, current full tests/types/build, one fresh whole-source review and exact green PR. Production/native/service/clock/key/provider/workload qualification and complete P01 acceptance remain separate. Existing image/template/deployment design decisions are not inferred.

## Authority requested

Approve LOCAL source/schema preparation, changing the named administrative source entrypoints as part of the complete governed replacement, synthetic crypto/workload/provider tests and the existing owned isolated PostgreSQL fixture. No real credentials/secret intake, OIDC/IAM/grant/role change, workflow dispatch, privileged service/install/signing action, production database/setting/flag/billing change, actual provider request/post/deployment, new paid CI or spending. Owner still performs every production click and separately approves real effects.

## Independent design check

A fresh source/design builder check identified two consequential ambiguities. The revised design explicitly keeps owner authorization external/attested rather than inventing an owner identity from the platform-admin list. It also chooses an already-created exact credential-free run/attempt, with no first-matching-run/public-nonce redemption. These proposed choices preserve existing security/owner boundaries and are part of the requested design approval. Follow-up found nothing important unanswered for planning local implementation. No source implementation, execution, test, database/provider action or authority grant occurred during review.


## Owner local implementation decision — November12

Owner selected “Approve local implementation and isolated tests” for this exact reviewed design. Continue inline under docs/superpowers/plans/2026-11-12-operational-platform-releases.md; no redundant execution checkpoint. This does not approve any other pending image/template/deployment design, actual workflow run, credential/grant/provider action or production change.
