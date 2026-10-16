# Vercel Git suppression and manual deployment plan

Evidence reviewed 2026-10-16 UTC. The owner's latest instruction authorizes the repository-only manual-deployment control and a GitHub compilation check. Root has prepared that candidate separately; this document does not apply it. No Vercel setting, Git link, integration, secret, domain, deployment, database, build machine or billing configuration was changed by this investigation. Manual deployment, promotion, dashboard/API settings and resource changes still require explicit approval.

## Current evidence and scope

Before this change, the inspected `vercel.json` contained `git.deploymentEnabled: { "codex/ai-agent-governance": false }`. It does not disable other branches. It also defines the existing install/build commands and 29 cron entries, including five-minute AI cost reconciliation and Airflow automation. Every field and cron must be retained. `package.json` builds through `check:vercel-build`, Prisma client generation and Next.js; the build contract rejects migration commands. That guard is not a guarantee that arbitrary dependency scripts, static rendering or integration hooks have no external effects.

Repository workflow inspection found normal GitHub CI, native release and protected database workflows, but no checked-in Vercel CLI/API deployment workflow. `scripts/setup-vercel-env.mjs` and `scripts/setup-oauth.sh` are existing standalone mutating utilities, not safe manual release entry points; no workflow/package invocation was found, and neither was run for this plan. The owner privately confirmed no configured Deploy Hooks in this project’s Settings → Git on 2026-10-16. This is sanitized operator evidence; no hook URL was requested. Other effective provider settings, projects attached to this repository and external callers remain unverified. The official deploy-hook page explicitly documents suppression for deprecated `github.enabled: false`; it does not explicitly specify the replacement `git.deploymentEnabled: false` hook semantics. Do not infer either hook suppression or bypass from that ambiguity. The sanitized inventory is now confirmed empty by the owner, so no hook change is proposed. The safe project projection exposed no Git-link, provider, auto-assignment or ignored-build fields; their absence from the response is not proof that they are unset.

Fresh read-only deployment inspection classifies the latest main deployment `dpl_6cv75StHTFg1enN1xPYRuLEcXzoX` (READY, production, main SHA `fef79a0eed15c8251dd46560e2e42f140b8c7177`) and the latest preview `dpl_BQ3AMcWkaxGT31k3obcaWwBqxYmZ` (ERROR, `codex/ecs-workflow-evidence`, SHA `5ee141bf2a747c246537b7b3f2650b92308cca12`) as `source: git`. The preview's recorded error is resource provisioning. This establishes provider-classified Git-sourced creation; a specific webhook delivery ID or deploy-hook inventory was not exposed, so no absent-hook claim is made. These are observed deployments, not proof of which commit currently serves the custom domain.

A fresh read-only alias lookup now maps `visionxixlabs.com` to `dpl_6cv75StHTFg1enN1xPYRuLEcXzoX` (#143 main). This supersedes older #138 serving observations; no routing mutation was made for this audit. Preserve this baseline and inspect the alias again after suppression and before any approved release. This plan does not assume newest main is serving, alter the current alias, solve production authentication, or establish database binding. Neon metadata confirms six-hour configured history and 10/10 branch capacity; usable recovery timestamps, serving/preflight target equality and actual restore readiness remain separate unresolved gates. Existing preview branches are not implicitly approved for deletion.

## Options and recommendation

| Option | Documented behavior | Fit and material limitations |
| --- | --- | --- |
| `git.deploymentEnabled: false` | Disables automatic Git deployments for all branches; unspecified branches otherwise default true. | Preferred versioned control: retain GitHub repository connection, pushes, PRs, CI and normal merges. It governs Git-triggered creation, not CLI/API/deploy-hook permissions, running deployments, runtime requests or cron costs. Configuration is evaluated from source; inventory old branches/forks and confirm coverage before claiming a project-wide stop. |
| Ignored Build Step / `ignoreCommand` | Exit 0 aborts; exit 1 builds. Runs after the deployment enters BUILDING. Canceled attempts still consume deployment quota and concurrent slots. | Not the preferred cost/trigger control. “Don't build anything” or `exit 0` is a build-time cancellation, not prevention of deployment creation or integration provisioning. It can also obstruct approved redeploys unless explicitly overridden. |
| Disconnect the Git repository | Removes the linked Vercel project's Git-provider connection. | Broader integration change, not proposed. It can disrupt Git-source deployment, PR feedback and workflows relying on that link; reconnection must be explicitly reviewed. Do not confuse it with deleting the Vercel project or disconnecting Neon resources. |
| Disable auto-assignment / rely on rollback state | Controls production promotion/aliasing rather than whether builds are created. | Keeps building and may continue preview resource allocation. Not sufficient for manual-only build creation or cost control. Promotion can restore auto-assignment after rollback; preserve that distinction. |

Official Vercel Git configuration specifies boolean false and the per-branch default; project-settings documentation confirms ignored-build quota/concurrency costs [1–2]. The CLI documents connection/disconnection separately [3]. No option is a promise of zero cost: live traffic/functions, storage, integrations and existing cron jobs continue. Current build-machine documentation describes billable paid-team CPU/build usage and on-demand concurrency; actual team tier, selected machine, contract and usage must be inspected before quoting savings [4]. No paid machine, concurrency, spend-control or plan changes are included.

## Deploy-hook and dashboard control limits

The official [Deploy Hooks page](https://vercel.com/docs/deploy-hooks) explicitly documents legacy `github.enabled: false` suppression. Its replacement flag's hook behavior is not explicit there. Do not add the deprecated setting, assume a hook bypass, or trigger a hook as an unauthorized probe. Prefer authoritative read-only clarification.

The reviewed [Git settings page](https://vercel.com/docs/project-configuration/git-settings) documents Disconnect, Git LFS, Deploy Hooks and Verified Commits, but no separate project-wide Git-off toggle retaining the connection. This is a documentation finding, not proof that an account-specific control does not exist. No exposed provider setting is proposed for mutation.

## Exact authorized repository-only candidate

This repository change replaces only the value under the existing `git` block and adds the compilation-only CI step below. Repository authorization does not authorize provider settings or deployment actions:

```diff
   "git": {
-    "deploymentEnabled": {
-      "codex/ai-agent-governance": false
-    }
+    "deploymentEnabled": false
   },
```

The companion addition to the existing `.github/workflows/test.yml` is a final `npm run build` step with `NODE_OPTIONS: --max-old-space-size=6144`, after the required suite. It compiles the production website in GitHub and does not invoke Vercel deployment, load production deployment credentials or apply migrations. Existing checks remain required. No `ignoreCommand`, production branch, Vercel build/install command, runtime, environment, cron, security, domain or integration change accompanies the candidate. Keep the GitHub App and repository connected. Do not set deprecated `github.enabled`, disable required CI, disconnect Neon, create a deploy hook or change auto-assignment as an incidental step.

During repository rollout, inventory active refs and the project's effective Git/ignored-build/deploy-hook settings through a non-secret view. The exposed project projection lacks those fields and no dedicated deploy-hook inventory getter was found; an outbound webhook listing is not a deploy-hook inventory. Record unexposed effective settings as unverified. The owner confirms no deploy hooks exist; no hook change is needed. A new `main` commit does not retroactively rewrite other branches' `vercel.json`: commits lacking the new control cannot be assumed covered. Propose a reviewed configuration-only propagation to active branches or document the coverage limitation; do not merge unrelated branch code or claim a global dashboard toggle has been verified. Use normal authorized development pushes to observe suppression; do not create artificial production deployments or integration resources as a probe. Manual deployment and resource creation require separate approval.

The setting affects future eligible Git events; it does not cancel already queued/building deployments or delete existing preview resources. Those require a separately identified action. Check whether required GitHub statuses expect automatic Vercel checks; suppressed deployments must not be reported as passed preview validation. Retain mandatory GitHub tests and normal merge protection; any necessary status-policy change needs separate review/approval.

## Manual exact-commit release path, not executed

Manual deployments are documented platform capabilities [5–7]; their acceptance with this project's effective settings and Neon integration is unverified. Use a reviewed exact CLI version, intended existing team/project IDs and preconfigured least-privilege authentication in a secure runtime. Do not perform interactive login, fetch/decrypt secrets through chat tools or create a new project to work around access. Credential setup is a separate authorized action.

1. Select an immutable full commit from reviewed main with required exact-head CI. Record source SHA, scope, current serving deployment, rollback candidate, cost cap and environment. Use a clean isolated checkout; verify HEAD and tracked package/lock/config bytes. Inspect ignored files and uploads so metadata cannot substitute for actual source provenance. Never deploy a dirty working tree or use “latest main” after approval.
2. Review the existing project's environment and integration effects privately before invoking any deploy/build command. Preview and production use different variables and resource bindings. A preview can create a Neon branch or other integration resources; capacity and isolation must be approved first. Do not let a preview share production writes, live Stripe, email, schedulers or cloud-execution authority. Do not reconfigure those resources under deployment approval.
3. For an approved preview only, deploy that clean checkout with the normal CLI preview target; capture deployment ID, verified commit, environment and resolved resource identity privately. Do not use a deploy hook as an exact-commit substitute: documented hooks target a branch, which can move [8]. Do not silently use a dashboard “redeploy latest” operation.
4. For an independently approved production candidate, the documented staging command is `vercel deploy --prod --skip-domain` [5]. This suppresses automatic production-domain assignment; it is still a **production-target deployment**, with production configuration and potential integration/build/runtime effects, not a read-only preview. It does not itself guarantee database isolation, absence of cron/integration effects or safety from invoking its unique URL. Review cron ownership/activation and candidate runtime access before creation; preserve all existing cron definitions and do not probe mutation endpoints. This plan authorizes neither creation nor such probes.
5. An optional prebuilt route uses `vercel pull --environment=production`, `vercel build --prod`, then `vercel deploy --prebuilt --prod --skip-domain`. Pulling materializes sensitive environment files locally; never log or upload them. Dependency installation and build execute reviewed code with those variables. Confirm output target/inputs and clean source before upload. Prebuilt output has documented system-variable and Skew Protection caveats [5]; it is not automatically equivalent to a remote build. No prebuilt pipeline is implemented here.
6. Inspect READY state, immutable source, production target, effective bindings, logs, protected access, pricing/download routes and approved read-only security checks. Require auth/schema/recovery readiness before customer authentication acceptance; a green build or provider list is insufficient. Any signup, OAuth/account-pairing, cloud connection or Stripe journey can create records and belongs to a separately approved test scope.
7. Present a **second approval** for promotion of the exact tested production deployment ID, current alias mapping and verified rollback ID. `vercel promote <id>` assigns production domains [6]. Do not promote a preview assuming identical production output: environment differences can require a new build. Verify current auto-assignment/rollback state and disclose whether promotion re-enables future automatic aliasing. No domain, callback or authentication-secret change is part of this plan.

REST API deployment creation is another possible operator path: `POST /v13/deployments` accepts Git-source or uploaded-file inputs and starts a new build; redeployment inherits prior settings unless overridden, while `withLatestCommit: true` deliberately discards the original SHA [7]. This plan does **not** supply an executable API body: verify the actual GitHub `gitSource` variant and an expressly supported no-alias option against the current schema before proposing it. Do not copy the documentation's other-provider example, infer an undocumented `skipAutoAssignDomains` field, override project settings or trust arbitrary `gitMetadata.commitSha` as source proof. Prefer the documented CLI staging path until an exact API request and postconditions have been reviewed.

## Resource and safety gates

Neon's official integration documentation distinguishes Vercel-managed and Neon-managed preview branching and their different cleanup triggers [9]. Retaining a Git link and suppressing automatic deployments does not establish that all resource-provisioning triggers are disabled. Existing capacity, archived branches, external GitHub integration, hooks and manually requested candidates remain relevant. No cleanup, paid upgrade, retention increase, branch creation, source restore or integration disconnect is included.

Manual-only build creation does not disable the currently serving application, billing safeguards, OAuth callbacks, worker authorization, runtime monitoring, or its existing crons. It also does not repair login: the protected read-only preflight, private target attestation, usable recovery point, approved isolated restore and exact auth-only SQL/ledger approval remain required. Preserve the auth-only boundary; no blanket migration, AWS proposal or financial migration is implied by a web release.

## Verification, rollback and re-enable

After the authorized repository candidate is merged, verify the exact configuration commit's GitHub CI and separately observe whether subsequent covered pushes/PRs produce Vercel deployments or integration resources. Record unverified contexts and do not deliberately trigger a production probe. Do not treat absence from a truncated/list response as proof of suppression. No cost saving is considered demonstrated until actual build/resource usage is compared over a bounded interval.

If manual staging fails or has uncertain external outcome, inspect/reconcile the known deployment ID before retrying; do not force new builds or auto-clean resources. Before promotion, the live alias stays on the current deployment. After an approved promotion, an approved rollback to a recorded eligible deployment can restore application routing; it does not reverse database writes, billing/provider actions or environment changes. Vercel documents that rollback disables automatic domain assignment until another promotion [10]. Keep additive database schema where required by the independently reviewed recovery plan.

To re-enable Git deployments, separately approve restoring the original per-branch map shown above (or an explicitly reviewed replacement). Re-enabling builds is not permission to promote accumulated commits. Recheck domain auto-assignment/rollback state and active-branch coverage first, then observe one approved bounded trigger. Do not disconnect/reconnect integrations, rotate credentials, delete databases or use `vercel promote` just to reset a setting.

## Proposed approvals and outstanding evidence

- **Repository-only authorization received:** exact `git.deploymentEnabled` diff plus existing CI's compilation-only step. Implementation/merge and passive observation stay separate from deployment or settings approval; active-ref coverage remains to be confirmed.
- **Candidate approval:** exact commit, existing project, target environment, permitted integration resources/cost, secret-bearing runtime and read-only verification scope; no alias move.
- **Promotion/rollback approval:** exact deployment and rollback IDs, current aliases, auth/security acceptance and automatic-assignment implications.
- **Separate access/resource actions:** private effective-setting/binding inspection, branch-capacity resolution or secret configuration only when specifically required and reviewed. Never ask for connection strings or tokens in chat.

Currently verified: inspected source configuration, provider `source: git` on the exact recent main/preview deployments above, absence of Vercel deploy commands in checked-in Actions/package scripts, build migration guard, and the official capabilities/caveats above. Currently unverified: effective Git/ignore settings, covered-ref suppression behavior, private serving/preflight binding, integration provisioning behavior for manual candidates, exact API no-alias contract, current paid usage and real manual deployment acceptance. Repository suppression is being validated; a fully verified manual-only deployment state has not yet been established.

## Official evidence

Reviewed through official documentation search and direct page retrieval; no authenticated deployment mutation was performed.

1. [Git deployment configuration](https://vercel.com/docs/project-configuration/git-configuration) — boolean/per-branch controls and deprecated alternatives.
2. [Project settings: Ignored Build Step](https://vercel.com/docs/project-configuration/project-settings#ignored-build-step) — exit semantics, timing, quotas and concurrency.
3. [Vercel CLI Git commands](https://vercel.com/docs/cli/git) — connection/disconnection scope.
4. [Managing builds](https://vercel.com/docs/builds/managing-builds) — current machine/concurrency billing; actual account pricing not inspected.
5. [Deploy CLI](https://vercel.com/docs/cli/deploy) — preview/production/prebuilt behavior and `--skip-domain`.
6. [Promote CLI](https://vercel.com/docs/cli/promote) — promotion is a separate domain-affecting operation.
7. [Create deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment) — source, redeployment inheritance and latest-commit semantics.
8. [Deploy hooks CLI](https://vercel.com/docs/cli/deploy-hooks) — hooks select branch refs.
9. [Neon/Vercel integration comparison](https://neon.com/docs/guides/vercel-overview) — preview resource creation/cleanup paths differ.
10. [Instant Rollback](https://vercel.com/docs/instant-rollback) — production-domain reassignment and auto-assignment consequences.

11. [Deploy hook behavior](https://vercel.com/docs/deploy-hooks) — legacy-setting suppression is documented; replacement-setting behavior remains unverified.

Local validation: 580 files / 5,972 tests, web and desktop TypeScript, optimized website build (293 pages), desktop production build and 30 Python tests passed. Independent review found no blocker in the two-file executable change. All 29 crons and build/install fields are unchanged. New GitHub compilation and provider suppression require exact-head CI and post-merge observation; no fully-disabled claim is made.
