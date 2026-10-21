# Consolidated draft PR and Preview decision

Prepared locally on 2026-10-21. **Not pushed, published, merged or deployed.**

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

- Fresh focused checkpoint: **340 tests / 22 suites passed**.
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

Local validation: 340 focused cases, desktop TypeScript/frontend build and source
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
