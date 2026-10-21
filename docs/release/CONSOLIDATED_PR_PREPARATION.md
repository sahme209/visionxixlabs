# Consolidated draft PR and Preview decision

Updated on 2026-10-21. **Push-only backup completed for exact9e8f0203. No PR, merge or deployment.**

The remote `codex/zero-spend-integration-local` branch now points to
`9e8f0203b5450a61a0a50759318f047500184927`. Earlier absent-ref/publication plans
below are historical. Later local changes require separate exact push approval.

Current delta: accepted baseline `8f3375831f4d8acbccbe9d863d188888bdd06881`
retains its 345-test/type/build evidence. A subsequent stale-DAG guard passed37
focused Airflow/demo cases, desktop TypeScript, targeted lint and independent
review. The entire345-case suite, root types and frontend builds were not repeated
for this small desktop delta; prior passes are not fresh full-head acceptance.

## Exact branch and ancestry

Use the existing `codex/zero-spend-integration-local` branch. Its remote ref is
absent at inspection. Current main fetched from GitHub is
`49cd7dc559bd196a9a91e8e695ef748ed4cc8a1e`; no reconciliation against a newer main
is needed. The final checkpoint is this document's commit (`git rev-parse HEAD`).
Preserve merge history, not a squash or replacement of existing PR heads.

Verified ancestors:

| Source | Exact head | Current remote state |
| --- | --- | --- |
| #197 / main | `49cd7dc559bd196a9a91e8e695ef748ed4cc8a1e` | Already merged |
| #196 | `e43e4a0b9a3ac9275bd765a125517254ef38cb6d` | Open, ready, mergeable |
| #198 | `58a64bfbd1eada1259424214c750ace2b93df00e` | Open, draft, conflicts against main |
| #195 | `6a89410d5a142c152b274f39b2adb63ffcd5d197` | Open, draft, conflicts and failed website acceptance |
| Earlier integration | `5d8d6049f7f1a57be687c6df64af9a09158238e3` | Local only |

Local source checkpoint `2767a6ac4c8313e1d6daa4461f86ebfcf78a8b90` additionally
preserves reviewed Airflow loading/history race repairs. Earlier local merge
commits resolved seven #196/#198 diagnostic paths and incorporated #195 without
losing #197 cancellation. No new source conflict appeared during this preparation.
No old PR is closed or represented as having passed current combined acceptance.

## Local validation and review

- Latest focused checkpoint: **345 tests / 22 suites passed**, retaining the
  original 340 cases and adding five actual Airflow setup regressions.
- Desktop TypeScript and frontend production build passed. This is not native
  Rust compilation or installed-Mac acceptance. Existing ~603 KB bundle warning
  remains, without threshold suppression.
- Changed production TypeScript/TSX lint: zero errors, one existing
  `RepositoryWorkspaceView.tsx` ref-cleanup warning also present in current main.
- Fresh repository TypeScript passed. Cached Next, TypeScript, React/ReactDOM,
  Prisma and Vitest versions match the lockfile; no version workaround was used.
- Independent final integration review found no new source blocker: both browser
  schemas/source hashing, #198 streaming/abort behavior, #195 exclusive writer
  and ABI correction, #197 native cancellation, Agent preference recovery and
  Airflow ownership safeguards remain cohesive.
- No dependency downloads, migration, provider request or cloud operation used.

**Website production build did not pass.** The unchanged build contract passed
(web/desktop type boundaries, no migration command, 38 externalized cloud SDKs),
then Next.js failed parsing TypeScript `--showConfig` output. Direct TypeScript
produced valid JSON. Invoking Next's own `runTypeScriptCli` with the same config
returned exit code 0 and empty stdout/stderr. This identifies the child-output
boundary, not an application TypeScript defect or a proven underlying host cause.
No speculative source change or trust-control bypass was made.

Owned-browser preparation failed at managed `spawnSync git EPERM`, before any
browser acceptance. The fixture's required manifest path was corrected after an
initial usage-only refusal. Neither attempt constitutes a browser test pass.

## #195 acceptance evidence retained

Re-read existing run **39524856726**, job **118976992929**, without retrying it.
Setup, manifest binding, sanitized collection and artifact retention succeeded;
the bounded fixture failed. Its receipt reports:

- exact head `6a89410d5a142c152b274f39b2adb63ffcd5d197`;
- `currentInteraction: setup`, no completed interaction evidence;
- `captureFailure: website_driver_operation_timeout`;
- `timedOutOperation: cdp.Page.navigate`, zero allowed/denied script requests;
- source unchanged and `cleanup: owned_groups_empty`.

This failure occurred at initial navigation, before documentation click or native
file creation. It does not implicate or validate the writer. Startup/browser/
proxy mechanism remains unresolved; later passing parent receipts do not repair
it. Historical stale-coordinate click and intermittent five-second Git preflight
failures remain separately documented and unresolved. Keep all gates unchanged.

## GitHub publication cost and triggers

No account billing/Actions allowance endpoint is exposed by this connection.
Remaining allowance is unknown; do not assume $5 remains available. Read-only
fetching and local validation did not trigger Actions.

Against current main, a new draft PR would trigger:

| Workflow | Jobs / timeout limits |
| --- | --- |
| Test | Ubuntu, 20 minutes |
| Desktop CI | Ubuntu 30 minutes + macOS 30 minutes |
| Isolated website acceptance | Ubuntu container, 20 minutes |

These are timeout limits, not duration predictions or a spending cap. Existing
auth-rehearsal and commercial PostgreSQL path filters do not match this diff.
The development-branch push alone matches no current push workflow; opening the
draft PR triggers the three above. A later ready transition triggers website
acceptance again, so do not transition merely for presentation. No tags or
dispatch are planned. Required protections/checks remain unchanged.

The local Test concurrency change cancels superseded PR validation and uses
unique run IDs outside PR events. It does not remove required jobs, triggers,
permissions or timeouts, and cannot guarantee monetary savings. Website evidence
retention concurrency stays unchanged.

## Existing Vercel project: Preview currently unsafe/unverified

Read-only tools identify existing project `visionxixlabs`, Next.js, Node 24.x.
No new project is proposed. Repo `vercel.json` retains
`git.deploymentEnabled: false`; no deployment commands are introduced in Actions.
Project metadata exposes SSO protection enabled for
`all_except_custom_domains`. This would normally require the owner to authenticate
with an authorized Vercel account on a generated Preview URL; actual access has
not been tested. Do not generate bypass links or weaken protection.

Environment inventory was requested with **decrypt=false** and only names/scopes
were inspected. Preview includes production-shared cloud credentials, a GitHub
PAT, AI Gateway credentials and OAuth credentials. The response is truncated, so
it cannot certify a complete allowlist or database/billing isolation. A normal
Preview build of this full repository is **not an approved isolated preview**.
Do not copy, pull, decrypt or expose these values.

Team/project tools return limited metadata, not current spend limits, usage
balance or effective pause state. Owner's last attestation remains Pro, credit
exhausted, $5 budget / Pause ON / over budget, automatic Agent reviews OFF. It is
not a fresh API verification. No $0 deployment claim or budget bypass is justified.

Potential later safe strategy, requiring a new exact approval: one locally built
website-only static artifact on this existing project's protected Preview target,
without functions, backend routes, cron definitions, external integration calls,
production aliases or imported environment values. Marketplace/provider resource
creation on deployment must also be ruled out. Before approval, prove the
artifact isolation and supported per-deployment configuration behavior, verify
current budget/pause and charge exposure, and confirm owner protected access.
Static/prebuilt delivery may reduce remote build CPU but does not establish free
upload, bandwidth, requests, protection or other billable usage. Do not deploy
the full integrated application merely to work around the build blocker.

## Prepared draft PR text (not submitted)

**Title:** Consolidate desktop coding, direct streaming and browser diagnostics

Combine the outstanding #195/#196/#198 work while preserving #197 cancellation
and commit history. Retain explicit new-file consent and no-overwrite writes,
direct OpenAI/xAI streaming, both browser diagnostic schemas, Agent storage
recovery and Airflow loading/history ownership fixes. Preserve billing,
authorization, approvals and manual-only Vercel deployment restrictions.

Local validation: 345 focused cases, root/desktop TypeScript, frontend build and source
review passed; lint has zero errors and one main-existing warning. Combined
website build and local browser acceptance are blocked at the documented runtime
boundaries. #195 initial CDP navigation failure remains unresolved. Native Mac,
real providers, Stripe and cloud/customer acceptance are unverified. Keep draft
and unmerged pending fresh required checks, reviews and owner authorization.

## Approval sequence

1. Resolve or explicitly decide the build/browser validation environment blocker;
   do not present local validation as fully green.
2. Verify available GitHub allowance; obtain exact branch/SHA push plus one draft
   PR/required-check checkpoint approval. Recheck absent remote ref immediately
   before publishing, with no force-push or blind retries.
3. Leave #195/#196/#198 open until combined required checks and reviews establish
   inclusion; closure/merge need separate authority.
4. Preview remains blocked on isolation, spend/pause verification and explicit
   deployment approval. No production domain, routing, settings, secrets, Stripe,
   infrastructure or installer changes are included.


## Final local validation refinement

The next local checkpoint contains a real Airflow automation setup repair. Before
implementation, three component regressions failed: a pending branch lookup did
not prevent creation; a failed lookup silently retained a default branch; and a
late repository catalog visually selected an option absent from form state.
A repository-scoped branch-result snapshot now distinguishes verified data from
loading/error, with explicit placeholders and a guarded retry. Creation requires
current DAG/dependency membership, a verified selected repository/branch for
GitHub/cloud actions, and a current environment for a restart proposal. Explicit
retry reloads branch evidence only; it does not send, create or replay an action.
Two more regressions verify that old branch results cannot change the current
payload and that a removed environment disables another proposal after refresh.
Server authorization, required human approvals and mutation boundaries are intact.

Latest evidence:345 cases/22 suites passed; root+desktop TypeScript, targeted
Airflow source/test lint (zero errors/warnings), desktop frontend build and
independent source/security review passed. The broader changed-file lint result
still has one pre-existing main ref-cleanup warning; no new error is hidden.
An intermediate effect-reset implementation failed lint and was replaced with
repository-scoped derived state; no rule was disabled. Frontend bundle warning
is ~603 KB and remains unsuppressed. Neither a native app nor real Airflow was run.

### Validation blocker classification

| Issue | Classification | Focused evidence / disposition |
| --- | --- | --- |
| Next production build | Reproducible, environment-blocked | Next child helper receives empty stdout with exit0. A generic Node child outside Axiom writes its file marker but returns zero captured stdout despite explicitly writing stdout. Direct top-level TypeScript emits valid configuration and typechecks. Child-output failure is independent of application code; underlying host implementation is not repaired. |
| Browser prepare | Reproducible, environment-blocked | Generic synchronous Git and Node probes outside Axiom report EPERM; Git even returns version bytes with status0 alongside that error. Owned fixture refuses preflight. No guard stripping, monkey-patching, timeout change or acceptance bypass. |
| Historical195 | Unresolved | Preserved initialcdp.Page.navigate receipt; no new failing browser receipt distinguishes startup, transport or proxy. No rerun or speculative fix. |

Supported runtime status is current/running, restricted network policy enforced,
with no configured credentials, runtime variables or outbound identities. It
provides no evidence resolving local subprocess semantics. Do not change the
application or managed trust selectors to compensate. A normal permitted runtime
is required to validate full build/browser/native boundaries; no free hosted
runner is assumed or provisioned.

### Preview isolation design — proposal only

The existing project is not safe for a normal full-app Preview: production-shared
Preview names include GitHub PAT, AI Gateway, AWS broker credentials, Azure/GCP
credentials, Cognito/Google OAuth and LinkedIn credentials. Values were not read
or copied. Truncated inventory leaves database/payment bindings unverified.

A future website-only profile must satisfy all these before deployment approval:

- Build locally from the approved checkpoint with no credential input; allowlist
  public pages/assets only. Do not upload `.env`, `.vercel` credential files,
  source maps with secrets, database state, functions, middleware or cron entries.
- Disable auth/payment/cloud/AI actions explicitly in the preview interface;
  inspect output for backend calls, production API origins and automatic side
  effects. Label simulations and unavailable actions honestly.
- Verify a supported existing-project deployment mechanism cannot execute with
  inherited secrets or provision marketplace/provider resources. Static output
  alone does not certify project configuration isolation. No clearing shared
  Preview settings, environment copying or new project is authorized here.
- Retain protection and Preview target; never assign production/custom domains.
  Owner needs an authorized Vercel session; current account access is untested.
- Obtain a fresh sanitized budget/pause attestation and supported charge behavior;
  upload/requests/bandwidth may cost even with no remote build. Respect the pause;
  wait for included allowance/reset if necessary, without raising budgets.

No deployable isolated artifact or $0 hosted guarantee is claimed. Preview stays
blocked. GitHub account allowance remains inaccessible through current tools.
Existing three PR workflows/four jobs and main histories remain unchanged.

### Exact publication preparation

One consolidated branch only, expected remote ref absent. Recheck with
`git ls-remote origin refs/heads/codex/zero-spend-integration-local` immediately
before any authorized publication. The exact commit-specific push command is
reported alongside the final checkpoint SHA; its form is
`git push origin APPROVED_FULL_SHA:refs/heads/codex/zero-spend-integration-local`.
Do not use force, tags, merge or workflow dispatch. Opening the one prepared draft
PR is a separate external action and starts the three documented workflows;
include that scope in the eventual exact owner approval and budget decision.
This preparation does not execute either action. Old PRs remain open/unmodified.


## Publication decision and bounded billing investigation

One existing CLI read attempted
`GET /users/sahme209/settings/billing/usage?year=2026&month=10` and returned
**Forbidden**. No billing/allowance tools are exposed by the GitHub connector.
This demonstrates unavailable access, not exhausted allowance, failed payment or
an exact missing token scope. Do not investigate access again without a change
in permissions or new evidence. Do not print tokens or change spending limits.

### Safest available routes

1. **Preferred $0 route:** hold both push and PR until an owner-side sanitized
   allowance/spending attestation or a verified reset establishes capacity. Then
   obtain exact-SHA approval for one push plus one draft PR and its known check
   set. No new proof of remaining allowance exists now.
2. **Optional backup only:** separately approve the exact new-branch push without
   creating a PR. Current push triggers do not match this development branch.
   This is not a published draft PR and provides no required CI result. Recheck
   remote absence, workflow definitions and known third-party review/deployment
   restrictions immediately before the authorized action.

Draft status does not suppress these workflows. Under the existing gates there
is no verified CI-free draft-PR publication path. No workflow disabling, skip
markers, source-history rewrite or relaxed required checks is proposed.

### Review of CI optimizations (no new workflow edits)

- Already implemented: no feature-branch push+PR duplication; Test supersedes old
  PR runs and preserves distinct main runs; Desktop supersedes obsolete refs;
  npm dependency caches exist in both desktop jobs. Batch updates and avoid an
  unnecessary ready transition, which starts website acceptance again.
- Preserve both Linux and macOS native tests/clippy and frontend build steps.
  Platform-specific ABI failures previously occurred; TypeScript is no substitute.
- Consider a reviewed Cargo cache after budget is available: key by OS/target,
  exact toolchain and lock/config inputs; use trusted, immutable action references
  and assess PR cache scope before allowing restored executable/build output.
  Cache absence must fall back to the same locked test/clippy commands. No cache
  action or dependency was added here; savings are unmeasured.
- Do not add a Linux-success condition that silently skips the macOS check while
  policy details are inaccessible. Skipped-job semantics could alter required
  validation. Do not narrow path filters without dependency evidence.
- One PR still means three workflows/four jobs: three Ubuntu jobs with configured
  limits totaling70 minutes, and one macOS job limited to30 minutes. These are
  timeout exposure bounds, not a cost cap or prediction. Rates, billable rounding,
  credits and remaining allowance are unverified; no dollar estimate is justified.

### Additional local product progress

A refreshed DAG catalog could remove the selected DAG while Run now stayed
active and old history remained visible/readable. A failing actual component
regression reproduced this. The view now derives the actionable DAG from the
current catalog, shows an explicit placeholder, refuses a missing/paused trigger,
clears stale history from presentation and stops history reads for retired IDs.
Request-generation and credential fences are retained.37 focused cases across
Airflow/demo suites, desktop TypeScript, targeted lint and independent review
passed. The accepted345-case baseline remains preserved, not needlessly rerun.

### Final publication contract

Target remains `sahme209/visionxixlabs`, existing local branch
`codex/zero-spend-integration-local`, base main. Expected remote branch: absent at
last read; verify just before a future authorized push and stop on unexpected
remote state. Push exactly the approved full checkpoint SHA with no force.
Prepare one draft PR using the title above and describe baseline345-case evidence
separately from the focused37-case delta, source reviews and all environment/
native/provider/billing/Preview limitations. No merge/closure authorization.

Environment-failure evidence and historical195 receipts remain unchanged; no
build, browser or navigation reprobe was repeated. Current website build/browser,
installed-Mac/native, real provider/Stripe/cloud, owner Preview access, credential
isolation and cost readiness remain unverified/blocked as previously recorded.


## Authorized push-only backup outcome

Owner approved repository/branch/exact9e8f0203. Immediately before pushing, local
HEAD and branch matched, tree was clean and remote ref was absent. The pasted
refspec omitted the colon/refs separator; used the canonical approved target
`SHA:refs/heads/codex/zero-spend-integration-local`, with followTags=false,
remote.origin.mirror=false and recurse-submodules=no. One normal push created
only that branch; remote SHA was then verified exactly. No force, tag, PR,
workflow dispatch, merge or production action occurred.

Post-push observations: exact-head and branch Actions lists both returned zero;
exact-head check-runs returned zero. Vercel existing-project lists filtered by
exact SHA and then branch returned zero deployments. GitHub's separate deployment
history URL was rejected by the connector allowlist, so that check is unavailable.
No automatic CI/deployment or related cost exposure was observed; unavailable
account billing and potential delayed/third-party charges prevent an invoice-level
$0 guarantee. No new billing access attempt was made.

### Local-only continuation after backup

Research found successful connection saves leave submitted password/token fields
populated. Two actual view regressions failed first. Confirmed save now clears
only values still equal to the submitted snapshot; corrections typed while the
request is pending survive. Failed validation preserves the editable draft and
never retries automatically. The original save result, backend credential storage,
context guards and approval behavior are unchanged. Clearing form state is not
secure erasure of JavaScript memory or a change to stored service credentials.

41 focused Airflow/demo cases, desktop TypeScript, targeted lint and independent
source/security review passed. The full345-case baseline/builds were not rerun.
This continuation is local only, one commit after the remote backup. No subsequent
push is authorized. Preserve the existing native/provider/billing/browser gates.
