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
| Website serving / build | Latest retained read-only alias observation serves manually promoted #138 commit `3df6d03f`; #139–142 main builds READY without custom-domain acceptance | Main build success does not prove domain routing or login; see `mission/vercel-release-inspection.json`. |
| Provider registration | Public `/api/auth/providers` returned HTTP 200 | Configuration discovery only; not OAuth acceptance. |
| Founder identity/workspace records | Protected read-only preflight #3 accountCheck passed | Mapping passed; actual password/OAuth ownership, platform-admin configuration and operational entitlement not verified. |
| Signup + email verification | Route/guard regressions; auth token table/column missing in protected target | Blocked by binding/recovery gates. New production test-account creation is not authorized. |
| Password / Google / GitHub login | Observed P2022 and absent auth schema; handlers/negative cases tested | None verified successfully against production. Require actual sessions and correct workspace access after approved repair. |
| Desktop authentication / pairing | Native CI and rendered recovery tests passed; #132 preserves rejected credentials | Packaged current-source browser approval, consume/replay/revoke, Keychain and return flow unverified. Late canceled responses are guarded; cancellation during already-started native writes and packaged vault acceptance remain open. |
| Cloud connection | Provider validation code / tests; no runtime outbound identities | No customer-owned account connection verified in this runtime. Need scoped sandbox identity and tenant mapping. |
| AI-assisted plan | Existing planning/runtime and cost-identity kernels | Real model response, bounded spend receipt and immutable approved plan not yet traced together. |
| Approvals | Default-deny/prerequisite and role tests | Need an actual distinct authorized approver, version-bound evidence and denied/revoked/cross-tenant cases on the same journey. |
| AWS ECS execution | Bundled four-input workflow restarts existing task definition; truthful receipts/UI and required-promotion denial are undergoing integration | Not a verified source artifact release. Need versioned immutable artifact/provenance, approval binding, independent health receipts and approved sandbox acceptance. Legacy dashboard full governance parity remains unresolved. |
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

## Native release candidate, approval and recovery packet

This is a source-only plan, not permission to build with signing credentials,
submit notarization, create tags, publish installers, change download selection,
or change production routing. The existing release workflow still couples builds
and publication; the separation below is proposed, not implemented or verified.

### Preserve immutable release identity

The fetched `release/desktop-v0.1.20` source at
`22481b570e09a97dc58d23178e437369af2ff716` declares bare `keyring = "3"`.
Keyring 3.6.3 selects its mock backend without native features; see
[the confirmed backend defect and native acceptance gates](DESKTOP_NATIVE_CREDENTIAL_BACKENDS.md).
Current source fixes backend selection but still reports version `0.1.20`.
Do not infer that a published installer contains the fix, or replace existing
`0.1.20` assets in place. Bind each public artifact to its actual recorded source
SHA and checksum before classifying it. A new release needs a new, unused version
and tag, after verifying that neither already exists; `0.1.21` is only a possible
next version, not an approved or verified-available tag.

The source review checkpoint is main merge
`99abab9faf99b0ae91a283db2f86721535187468` (PR #141); a later release candidate must name its full immutable SHA,
including any separately reviewed version-alignment/preparation changes. All
npm package/lock identities, Tauri version, Cargo package and Cargo lock package
identity must agree. Installer filenames alone do not verify embedded versions.

### Proposed minimal candidate and publication separation

1. Retain the existing platform build matrix, macOS checks, SBOM generation and
   artifact upload in `.github/workflows/desktop-release.yml`, but remove its
   public publication path. A tag or manual candidate run produces candidate
   artifacts only. Build the event's exact `github.sha`; assert the requested
   private source tag resolves to that SHA. Record source SHA, workflow/run,
   version, target, installer filenames and SHA-256 hashes, plus the SBOM hash.
2. Use a separate manual publication workflow that consumes the approved
   candidate run ID, expected full source SHA, release tag and approval reference.
   It must reject a different repository/workflow, PR/fork run, unsuccessful run,
   SHA/tag mismatch, missing platform/SBOM artifacts or changed artifact hashes.
   Do not rebuild installer bytes after native acceptance. Detached GPG signing
   may be performed at publication without modifying those bytes; verify every
   signature against the reviewed public-key fingerprint before upload.
3. Fail closed if the public release **or its tag** already exists. Remove the
   existing release-edit/`--clobber` path. Distinguish genuine absence from
   authorization/network errors. Serialize publication attempts without canceling
   an active publication. Create a fresh draft, verify its complete asset set,
   signatures and hashes, then publish only that newly created draft. A partial
   failure leaves a draft for explicit review, not an automatic overwrite retry.
4. Publication requires explicit approval for the exact packet below. A named
   GitHub environment is not evidence of review: inspect actual configured
   required reviewers and protection behavior separately. Those controls remain
   unverified here; keep publication disabled until their evidence and approval
   are recorded. Missing access to verify them blocks publication, not independent
   candidate/source work.

The private source repository and public artifact repository are different.
A tag in `sahme209/axiom-releases` belongs to that repository's history; it does
not prove it points to the private source commit. Bind the private SHA through
candidate metadata, signed hash manifest and public release attestation instead.
Publishing a stable release can change the website's selected download within
its release-manifest cache interval (currently 60 seconds), without a Vercel
promotion. Approval must explicitly cover that distribution consequence and the
compatible serving backend; it must not silently authorize future releases.

### Required evidence before publication approval

| Packet field | Required evidence or stop condition |
| --- | --- |
| Candidate | New version/tag, full source SHA, successful exact-source checks, candidate run ID, every installer/SBOM SHA-256, final release notes and public-key fingerprint. Unresolved fields mean no publication request yet. |
| macOS ARM and Intel | Inspect the app extracted from the actual DMG: bundle identifier, embedded version, Mach-O architecture, Developer ID authority/Team ID, strict signature validation, Gatekeeper result and stapled notarization ticket. Verify the DMG itself and correlate its app with the tested bundle. Record OS/hardware; Intel under emulation is not clean Intel-host evidence. |
| Windows and Linux | Verify installer versions, architecture, hashes and detached GPG signatures. Exercise MSI/EXE and supported Linux package installation on identified hosts. Current workflow declares Windows/Linux OS code signing false; GPG origin verification does not replace Authenticode or Apple notarization. Do not claim configuring an EV secret alone implements a signing pipeline. |
| Native credential persistence | On an isolated authorized OS user/profile, verify the exact package's browser pairing and workspace identity, fully quit the process (closing its window is insufficient), restart and verify the same selected identity. Exercise denied/locked/corrupt vault, expired/revoked session, offline recovery and absence of mock fallback. Linux requires an actual unlocked Secret Service session. |
| Upgrade and legacy recovery | Use synthetic legacy credentials, never customer secrets. Prove a failed native write preserves the legacy value; prove successful migration survives full restart and cleans the legacy copy. Verify selected-credential continuity, sign-out tombstone behavior and cleanup failures. Already-lost mock credentials require authorized fresh pairing/recovery, not invented tokens. Do not expose secret values in logs, screenshots or evidence. |
| Native shell and updates | Verify browser return/deep link, replay/cancel handling, saving-phase behavior, window/tray/Dock/quit and recovery after errors. Test a manual upgrade with retained intended preferences/vault state. Automatic updater delivery remains unwired; the pure manifest kernel is not installed update functionality. |
| Backend compatibility | Name the serving deployment/source and approved schema state. Verify real signup/login, accepted paired membership, workspace isolation and access policy before claiming the desktop journey works. New cloud enrollment/disconnect schema or unavailable backend routes are not authorized by native release approval. |
| Observation and recovery | Named operator, observation interval, abort criteria, exact compatible recovery artifact/hash or reviewed rollforward source, and approval boundaries for any download/routing change. Include honest feature limits and support instructions. |

Build/sign/notarization actions, isolated customer acceptance and public
publication are distinct scopes. No private signing key, password, credential
value or connection string belongs in the packet. Existing source tests, native
CI and builder-selection tests complement this evidence; they do not replace
real platform persistence or customer/provider acceptance.

### Rollback must preserve credential safety

Do not designate the affected `0.1.20` source/artifacts as the automatic rollback
target. Its mock-backend configuration is unsafe for persistence, and older
clients may ignore the new active-selection/sign-out tombstone contract or choose
an inactive legacy credential. Downgrade safety is not established by successful
installation alone. Validate any proposed older artifact against the current
vault format, identity selection, backend API and schema before approval.

Prefer retaining OS-vault data and issuing a reviewed new-version rollforward
when no safe downgrade has been demonstrated. Do not restore plaintext stores,
erase vault entries, fabricate missing credentials, retag/reuse a published
version or overwrite old assets to disguise a fix. Public release withdrawal,
replacement download selection, native credential cleanup and backend/database
rollback each require their specific approval; none is performed by this plan.

### Read-only published-release provenance check

The public `desktop-v0.1.20` release notes identify source
`f72fa7489317e1915b16ebf6ae486f9a8a4d92a3`; that source also declares bare
`keyring = "3"`, preceding the native-backend fix. The API reports fourteen
assets (seven installers and their detached signatures), SHA-256 digests and
`immutable:false`; no SBOM asset is listed. This corroborates the release risk,
not clean-host behavior or cryptographic verification of installer contents.
The separately fetched release branch at `22481b57` is not substituted for the
public release's recorded source. See
`mission/native-published-release-inspection.json`. No assets, release notes,
public tags or download routing were modified. A new immutable version and
separately approved native acceptance/publication remain necessary.
