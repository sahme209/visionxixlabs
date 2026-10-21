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

## Additional verified access and connector audit

The paginated project-connector inventory completed with `pagination.next:null`. One GitHub connector (`visionxixlabs-github`) is enabled for Development, Preview and Production; it supports app/user subjects, has stored-token authority, and pull-request triggers target `/triggers/github`. Therefore stripping environment variables alone cannot establish isolation. Proposed additional configuration change, pending approval: remove only Preview from this project-connector connection's enabled environments; preserve Development/Production and the separate native Git connection. Confirm Vercel's semantics and effective OIDC denial before treating this as enforced. Do not delete the connector, revoke production tokens or alter trigger destinations globally.

Supported fallback attempted once per new hypothesis: Vercel CLI65.0.0 was installed in temporary storage without repository/dependency changes or hosted resources. Existing `VERCEL_TOKEN` and standard local auth-file locations were absent. Login with isolated temporary config failed before device authorization (`fetch failed`); the proxy-aware retry also failed. A separate read-only public Vercel request through Node's configured proxy returned cancellation. No login token was acquired and no credentials were decrypted. The connected Desktop Commander Mac is offline (last seen113h), so its browser session cannot currently supply authentication. These are concrete alternate-path findings, not evidence that a budget is safe or that the owner denied access.

The project read confirms Vercel Authentication remains enabled (`all_except_custom_domains`); project/team responses omit spend/Pause/budget fields. The raw env response contains literal redaction placeholders in40 of100 records, with no cursor/filter in its exposed contract. Shared-variable detail endpoints decrypt values and were deliberately not used. Current spend/Pause eligibility cannot be inferred from successful metadata requests, prior invoice records or the generic project pause API. AI Gateway budget documentation describes a different control from team Spend Management and must not be substituted.

Next access requirement: a supported authenticated raw metadata/Spend Management reader or working authorized CLI login network path. Do not bypass managed network restrictions or repurpose a production credential to obtain it. Once available, the prepared read-only route can collect the complete inventory directly; no need to ask the owner to copy secret values or repeatedly export the same dashboard checklist. Deployment remains unauthorized and NO-GO until actual configuration and cost facts are verified.

### Prepared connector operation — not executed

Supported operation replaces environments on the existing project connection:

```json
{
  "connector": "scl_Z6iSqRBbrZwtCRRgJCFg",
  "projectId": "prj_BwKc7V1daPJ938ZW2QKYxZsTkZnp",
  "teamId": "team_j0CEiAAorasdEVQyeAJjpNfm",
  "requestBody": { "environments": ["development", "production"] }
}
```

Rollback would restore `["development", "preview", "production"]` on this same connection. This proposal changes Preview permissions only; it is not sufficient without the full environment inventory and other resource/OIDC trust verification. It must be included in the final combined configuration approval, not applied now or used to claim complete isolation.

The dependency-free local `scripts/audit-vercel-preview-metadata.mjs` accepts an authorized raw environment metadata response on standard input and emits only variable names/targets/branch metadata and shared Production/Preview names. It never emits values/comments/IDs, never grants deployment approval, rejects redaction/pagination/unresolved shared/custom gaps, and returns diagnostic exit2 for incomplete input. Input is bounded to4MiB; parse failures do not echo input. Ten focused fixture tests passed after independent review identified malformed pagination metadata as an additional incomplete-input case. Root TypeScript and lint pass. This tool does not obtain authentication, lift network restrictions or prove resource isolation.
