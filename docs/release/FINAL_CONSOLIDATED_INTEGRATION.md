# Final consolidated integration decision

Source candidate: `fe98cb41926c28ac8f52902b85646413e39fbf8c`.
Branch: `codex/zero-spend-integration-local`.
The final checkpoint adds this release record without changing reviewed source.
Remote backup remains `9e8f0203b5450a61a0a50759318f047500184927`.

## Integrated scope

All #195/#196/#198 heads and merged #197/main are ancestors, not duplicated
implementations or cherry-picked replacements. Remote heads/main were rechecked
and are unchanged. Native no-overwrite creation and direct streaming sources
match the reviewed original checkpoints. Subsequent Agent storage recovery,
Airflow independent loading, stale target/history guards, branch verification,
explicit retry and credential-form recovery remain included. Required approvals,
tenant/credential checks, usage controls, diagnostic schemas and CI gates remain.

Final review found no new blocking source-integration finding. No speculative
feature expansion was added to this release pass. Existing tracker scope remains
active; integration completion does not mean the whole product is release-ready.

## Essential acceptance

| Gate | Evidence / result |
| --- | --- |
| Focused integration suites |350 tests across22 suites passed in one final run |
| Root TypeScript | Passed |
| Desktop TypeScript | Passed |
| Changed source lint | Zero errors; one pre-existing RepositoryWorkspaceView ref-cleanup warning |
| Desktop frontend build | Passed; ~604 KB chunk warning retained |
| Independent source/security/integration review | No blocking finding; reviewed source/history/approval boundaries retained |
| Combined website build | Environment-blocked; preserved generic child-output-loss and Next configuration-output evidence; not rerun |
| Owned browser acceptance | Environment-blocked by generic synchronous subprocess EPERM; not bypassed or rerun |
| Historical #195 navigation | Initial CDP navigation timeout remains unresolved; receipt retained, not retried |
| Native/macOS installed app | Unverified; local Rust/macOS unavailable, parent native CI is not combined-head acceptance |
| Real provider, billing, cloud/Airflow customer journey | Unverified; no paid/provider/Stripe/cloud operation authorized |

Full immutable-artifact ECS promotion, rollout/health and rollback readiness must
not be inferred from existing service-restart, inactive provenance readers or
fixture tests. Those release capabilities and customer acceptance remain incomplete
or unverified per the master tracker. Actual installed coding/file/process/pairing
and self-serve customer workflows remain required. No unsupported completeness
or deployment claim is made.

## One prepared draft PR (not published)

**Title:** Consolidate governed desktop coding, streaming and Airflow reliability

**Body:**

Consolidate #195, #196 and #198 on main while preserving merged #197 and original
history. Include consented no-overwrite new-file creation, direct OpenAI/xAI token
streaming/cancellation, both browser diagnostic schemas, Agent preference-storage
recovery and reviewed Airflow context, selection, history and connection-form
reliability repairs. Preserve server authorization, explicit approvals, billing
boundaries and manual-only Vercel control.

Final local checkpoint:350 focused cases passed; desktop types/frontend build,
changed-source lint (zero errors/one existing warning) and independent review
passed; root TypeScript passed. Website production build
and browser acceptance remain environment-blocked; historical #195 navigation is
unresolved. Installed Mac, combined native, real-provider/accounting and governed
cloud/customer acceptance remain unverified. Keep draft and unmerged until exact-
head required CI and reviews pass and owner authorizes merge. No deployment,
Stripe change, installer release or production operation is included.

## Minimal GitHub sequence

1. Confirm owner allowance/cost decision. Existing billing read was Forbidden;
   do not retry access without changed permissions. No $5 balance is assumed.
2. Separately authorize the final exact SHA fast-forward to the existing backup
   branch and creation of this one draft PR. Recheck remote is still exact9e8f0203
   and an ancestor before pushing; stop on unexpected changes, never force.
3. Opening the PR starts Test, Desktop CI (Linux and macOS) and website acceptance:
   three workflows/four jobs, timeout exposure70 Ubuntu+30 macOS minutes, not a
   price or spending cap. Required checks remain. No blind retries or unnecessary
   ready transition. New source changes require renewed exact push approval.
4. After all exact-head checks/reviews and explicit owner merge approval, merge
   **only the consolidated PR** into main using permitted history-preserving
   integration. Verify resulting main and included heads, then obtain/observe
   closure authorization and close #195/#196/#198 as superseded. Do not merge
   those overlapping PRs separately. #197 is already merged and untouched.

## Actual website Preview: blocked, no deployment approval requested yet

Existing project protection was rechecked read-only: Vercel Authentication is
enabled for all except custom domains; password protection is disabled. Owner
access therefore needs the authorized Vercel account; it has not been tested.
No protection, project, domain or environment setting was changed.

The preserved encrypted-name/scope inventory identifies production-shared Preview
GitHub, AI Gateway, cloud and OAuth credentials; truncated metadata does not prove
complete database/payment isolation. Current team budget/pause is not exposed.
Owner's prior over-budget Pause ON attestation remains controlling; no budget
increase, bypass or new project is proposed.

A normal full-app Preview is unsafe. Before any deploy request, require a complete
sanitized Preview inventory and a reviewed, supported isolation method for the
existing project: no production service bindings or inherited credential-bearing
execution. The website-only static-artifact proposal in
`CONSOLIDATED_PR_PREPARATION.md` is a design, not a deployable or verified artifact.
It must render actual public components, explicitly disable external actions,
exclude functions/cron/credential files, and pass build/output/network checks.
Provider auto-provisioning and owner protected access must also be checked.
Static/prebuilt output does not guarantee free bandwidth or requests.

Required owner actions are budget/isolation access or sanitized attestations,
approval of exact Preview-only configuration changes once verifiable, then
separate exact deployment approval. Do not alter shared configuration speculatively
or request an unsafe deployment merely to achieve a visible URL. Preview remains
on hold until cost, isolation, reliable build and protection gates are satisfied.
