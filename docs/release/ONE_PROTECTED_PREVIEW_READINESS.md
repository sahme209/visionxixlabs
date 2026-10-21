# One protected website Preview — consolidated readiness

Source: main `568110c239684dcca9bbd18a082ac8c3a45988cf`, existing Vercel project `visionxixlabs`. No deployment/configuration approval is implied by this document.

## Candidate boundary

Post-merge Test and Desktop CI passed; integration/ready-transition website acceptance passed twelve gates. Preserve this evidence; no new CI needed just to restate it. Current local `e01eacae` adds Airflow task inspection and documentation/demo changes, not a new public website design release. Subsequent local desktop verification fixes are also excluded. The selected website SHA contains the consolidated public website improvements from #199 and ancestors. Never deploy the moving local branch implicitly.

## Current decision: blocked, not deployment-ready

- Complete variable inventory remains unavailable: prior metadata returned 100 records, with 40 names redacted, no pagination/key filter in the connector. Known shared Preview/Production bindings include GitHub, OAuth, AI Gateway and AWS/Azure/GCP. Database/Stripe absence cannot be certified. Do not use value-decrypting calls as a metadata workaround.
- Current budget, remaining credit and effective Pause enforcement remain unavailable through the exposed read tools. Prior owner report: exhausted included credit, over-budget $5 limit, Pause ON. Bounded charge exports are not a present spend-cap guarantee. No additional billing access probing is justified without new access/evidence.
- Vercel Authentication was enabled and owner membership confirmed. Access to a new protected URL cannot be certified before that URL exists. Do not disable protection or create bypass links.
- Repository automatic deployments remain disabled by `git.deploymentEnabled:false`; no new CI/deployment trigger is required for readiness review.

## Smallest safe next configuration proposal

Obtain all names, Preview/Production/custom targets, git-branch overrides and shared-variable references, without values. From that complete inventory prepare an enumerated Preview-only removal/rebinding diff, including integrations and automatically supplied OIDC trust. Production bindings, domains, aliases and existing deployments stay unchanged. Removing only visible keys is insufficient. An empty deployment env object does not prove inheritance is disabled.

Use supported disabled/nonproduction integration paths only. Authentication/onboarding that require a database need an independently approved isolated test database/session configuration; no production OAuth, Stripe, GitHub write, AI/cloud credentials or paid calls. Static public-website-only prebuilt output is an alternative only after actually generated, inspected for functions/middleware/cron/network bindings/secret files and content-hashed. Such an artifact is not currently available, and the known local subprocess restriction remains a build blocker. No fabricated credentials, mock success, or claim of full customer functionality.

## Owner evidence needed once

1. Existing project Settings → Environment Variables: clear search, All Environments, load all rows/shared references; supply names/targets/branch/reference metadata only. Never reveal values or export `.env` into chat.
2. Team Usage and Settings → Billing → Spend Management: sanitized current included credit, spend/limit, Pause state, affected projects and reset period. Do not increase budgets/unpause. If the existing pause blocks deployment, keep it blocked.

After these facts are available: review one exact isolation configuration diff and obtain configuration approval; validate that change without deployment. Only when isolation and permitted cost exposure are known request one concise approval for exactly one protected Preview of the stated SHA/artifact. No new project, production alias, promotion, automatic deployment, budget increase or second deployment. State expected build/upload/request/bandwidth exposure honestly; static/prebuilt does not guarantee zero charges. Record actual owner-access/navigation results in #200 after the separately approved deployment.

## Independent development continuity

Preview access and spend blockers do not stop authorized local source work. Preserve the canonical mission tracker and local-only commits. Installed-Mac, actual-provider, Stripe TEST and cloud/Airflow acceptance remain separate evidence gaps; they are not reasons to exclude already verified public website work.
