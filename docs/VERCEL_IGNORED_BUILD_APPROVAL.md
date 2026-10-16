# Optional Vercel project setting — awaiting approval

Project: existing `visionxixlabs`, `prj_BwKc7V1daPJ938ZW2QKYxZsTkZnp`. No settings change is authorized or applied.

## Owner-preferred ignored-build fallback and explicit manual bypass

The latest owner preference is an Ignored Build Step or equivalent with an explicit approved manual bypass. The repository-only `git.deploymentEnabled: false` candidate remains separately authorized and under CI; it is not permission to edit project settings. The following is the exact **additional settings proposal**, not an executed change:

| Setting | Before | Proposed after separate approval |
| --- | --- | --- |
| Existing project's Build and Deployment → Ignored Build Step | Unverified; inspect privately first | Custom command: `exit 0` |
| Git connection, production branch, domains, environment variables, integrations, protection, install/build commands and crons | Existing values | Preserve exactly |

The setting stops the build when reached; it does not prevent deployment creation, quota/concurrency usage or earlier integration provisioning. `vercel.json` can override it for a given deployment, including on active branches. No claim of an absolute settings-enforced release lock is made. Inventory source overrides and confirm no other authorized caller is deploying automatically. Owner reports no deploy hooks; the provider's hook inventory remains independently unverified and no bearer URL was requested.

Two documented per-deployment bypass mechanisms are available:

1. **Dashboard redeployment:** project settings documentation explicitly permits unchecking **Use project's Ignore Build Step** on the Redeploy dialog. Verify the selected existing deployment's exact commit/environment; do not select an advancing latest-source option or promote as an incidental action. This is a redeployment control, not an instruction to change the saved global ignore command. A new approved commit without an existing deployment needs the CLI path below.
2. **CLI configuration overlay:** the official CLI [global options](https://vercel.com/docs/cli/global-options#local-config) support `--local-config /path/to/vercel.json`; official [ignoreCommand documentation](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand) says this field overrides the project's Ignored Build Step **for a given deployment**, and exit 1 continues. Prepare a full copy of the exact approved commit's `vercel.json` outside the checkout, add or replace only `ignoreCommand` with `exit 1`, and review its hash and structural diff before approval. Preserve `git.deploymentEnabled`, all 29 cron entries and every other field. This is a complete alternate config, not a partial patch to be merged by the CLI. Do not commit `exit 1` as the general repository default.

After exact deployment approval only, the documented command composition is `vercel deploy --local-config <reviewed-full-config>` for preview, or separately approved `vercel deploy --prod --skip-domain --local-config <reviewed-full-config>` for a production candidate. Set the intended existing project/team through established secure runtime selection; refuse prompts to create/link a different project, install integrations or update settings. A metadata SHA alone cannot represent the configuration overlay: record original commit, overlay hash and the single intentional override separately. **Do not use `--force` as an ignored-build bypass**: its documented effect concerns deployment/build caching, not this approval gate.

The supported documentation describes source `ignoreCommand` as a per-deployment override, not a dashboard-setting mutation. However, the exact pinned CLI/project combination has not been exercised. Verify the saved setting before and after the approved bounded deployment through a non-secret view; do not claim global persistence behavior was runtime-tested. Avoid a REST request with `projectSettings.commandForIgnoringBuildStep` as a substitute: create-deployment API documentation explicitly warns that supplied project settings can be saved for following deployments. No such API settings override is proposed. If the actual tool cannot establish source/config selection or preserve the existing project setting, stop and obtain provider clarification rather than testing against production.

Review configuration and resource risks before enabling either bypass: preview integration allocation, production variables/cron behavior, build-time code, current alias and the separate promotion gate remain unchanged. No CLI invocation, settings update, dashboard redeployment or production probe occurred during this investigation. The documented flag composition is a prepared capability, not real manual deployment acceptance.

