# Website-only Preview — preparation, not deployment approval

Status: owner confirms automatic Agent reviews OFF, Vercel Pro, and the $20
included credit exhausted. Spend enforcement and an acceptable incremental cost
remain unresolved. Feature development
paused. No provisioning, build, deployment, PR or production setting change.

## Frozen source and minimal package

Use public website source/assets from GitHub snapshot
`4db11e37775ff0f50646f85afabaa54f02ffd5ca`. Preserve later local commits.
Prepare a separate static-export entry/package; do not deploy the full application
or reuse its root layout. Reuse public design/components/assets, but omit
SessionProvider, AIChatWidget, account controls, transactional support/checkout,
API routes, middleware, server functions, scheduled jobs and all cloud/provider
code. Auth/payment/operational actions must be clearly unavailable in this Preview;
no links or automatic navigation into production workflows. Retain informational
copy only without changing the working production support integration.

First scope: homepage and its local assets/interactive simulated demonstrations;
include other public navigation pages only if their dependency review establishes
that they are static and isolated. Otherwise show a clear unavailable-in-preview
state. No fake login or operational success. Use local image/font assets; no
image-optimization function or external analytics/AI/telemetry. Restrict network
policy to self-hosted assets/navigation. Ensure all /api and protected paths have
no handlers and return a static404. Application environment-variable allowlist is
EMPTY; there is no database or test-auth dependency in this first package.

After confirmations, prepare/review the exact static artifact and digest before
the single final approval request. The static entry/package is not built yet.
Review artifact contents for absence of functions, secrets, backend bundles,
production links/requests and cron configuration. Local static/browser checks
must prove the visible site needs no session, DB, Stripe, AI or cloud access.
This does not establish operational application acceptance.

## Owner-side confirmations — read-only; do not change production settings

Team: `samir-ahmeds-projects-bc8e3c73`.

1. Team Billing/Usage: active team plan and billing-cycle dates, remaining included
   allocation relevant to builds/static hosting/transfer, any on-demand usage
   enabled, and any applicable limit/overage behavior. Share only sanitized values.
   Prior invoices and a personal account plan do not establish remaining team
   allowance. An alert threshold is not an enforced no-charge guarantee.
2. Team spend-management controls: current amount and behavior when exceeded
   (notification versus enforced restriction), plus whether the owner permits any
   incremental charge. Do not adjust a team-wide pause/limit that could interrupt
   the live website. If an enforceable applicable ceiling/included entitlement
   cannot be verified, remain blocked; do not advertise expected cost as$0.
3. Dashboard Agent (top-right) → Code Review → repository
   `sahme209/visionxixlabs`: confirm whether automatic reviews on PR creation/code
   pushes are enabled, and whether manual-only operation is supported. The exact
   toggle label/value is not exposed by the connector or verified documentation;
   ask for its displayed label and sanitized status rather than guess. Do not
   disconnect GitHub, alter required CI/review controls or trigger @vercel to test.
   No PR/push is part of this Preview proposal.
4. New Preview project: confirm the intended protection option is included in the
   team plan, no inherited/shared env variables or Marketplace services will be
   attached, and no automatic Agent review/investigation is configured for it.
   If an automatic paid service cannot be excluded, stop before creation.

Relevant official references: https://vercel.com/docs/agent and
https://vercel.com/docs/agent/pricing . The connector's Agent-runs API describes
application/eve traces, not platform Code Review settings. Current documentation
search did not verify the missing UI labels; no undocumented setting will be used.

## One final approval request, only after readiness

Name the reviewed source SHA AND static artifact digest, new protected project
name/ID, exact included pages, zero application env variables, target=Preview,
protection mode, verified expected incremental cost/maximum permitted cost and
rollback/cleanup scope. Explicitly include any required project creation in that
approval. Proposed name: `axiom-public-preview` (not yet created or reserved).

Prefer one already-built static artifact deployment with no remote build if the
approved environment can produce it safely; otherwise obtain explicit approval
for exactly one bounded remote static build. Never run both gratuitously. No
Git integration import, automatic deployments, production alias, custom domain,
PR, Actions run, retries, database, payment/provider calls or installer publishing.
Existing production project is untouched. Failed readiness checks return to the
owner with evidence; no automatic second build. Do not request deployment approval
until confirmations and local artifact/isolation checks are complete.

Expected incremental cost: UNKNOWN until owner evidence is available. Nothing
has been built/provisioned/deployed under this plan.


## Latest owner confirmation and concrete candidate — 2026-10-20

Accepted owner attestation: automatic Vercel Agent Code Reviews are OFF; team Pro;
$20 included credit exhausted. Do not ask again for these facts. Paid Agent work
must not be invoked by this preparation. No new Git push/PR/CI event is needed.

Candidate project: axiom-public-preview, separate from visionxixlabs. Provisioning
is NOT authorized yet. Intended deployment is Preview only with Vercel
Authentication protecting its deployment URL (infrastructure protection, not
application login). Protection must be set and read back before any upload;
anonymous requests must be denied in acceptance. No password add-on, purchase,
bypass link, production domain or modification of the existing project.
Current tools cannot verify the entitlement or new-project setting before that
project exists. If desired protection requires an upgrade, stop.

Build/deployment configuration to review with the eventual artifact:
- Static-only output: HTML/CSS/JS/assets; no functions, middleware, API handlers,
  image-optimization service, cron or integration configuration.
- No Next.js application auto-detection/deploy of the full repository. Deploy
  only the reviewed static artifact, framework=Other/static, application envs empty.
- Preserve source appearance/animations from4db11e37 via a separate static entry;
  no SessionProvider, AI widget, auth, DB, Stripe, cloud or provider dependency.
  Empty credentials alone are insufficient because Vercel OIDC can enable Gateway.
- No connected Git repository/deploy hooks for the new project, no GitHub PR or
  workflow dispatch; existing repository connection/CI/production stay unchanged.
- Prefer one local/prebuilt artifact and one manual Preview upload, zero remote
  builds. Current local build feasibility still needs validation; only547MiB was
  free at the last check. Do not switch silently to a chargeable remote build.
- No automatic paid reviews, investigations, retries, analytics or Marketplace
  services. Record actual static artifact hash and file inventory before approval.

Spend findings: official documentation search confirms50%/75%/100% notification
thresholds and that automated pausing is an action distinct from a notification.
It does NOT establish this team's configured pause behavior or a strict no-overage
cap. The read-only team tool exposes metadata, not the effective spend settings.
Direct official docs retrieval is blocked403 by the environment. Thus no claim
that Spend Management blocks all overages is justified. Even pause behavior must
be checked for timing, scope and which usage it covers; a project-pause API by
itself is not a verified Preview/build/total-billing cutoff. Never enable or adjust
team-wide pausing that could disrupt the production website.

Required owner action: inspect team Settings/Billing → Spend Management and share
only its configured spend amount, notification/automatic-pause action, scope and
any displayed enforcement/delay caveat. No setting change requested. Specify the
acceptable incremental budget for one Preview and its visual-review hosting
window. With included credit exhausted, potential build/static request/transfer
charges must be treated as billable unless a specific SKU allowance proves
otherwise. No zero-cost guarantee or enforceable exact ceiling is currently known.

Protection and final cost remain readiness blockers. After owner evidence and a
reviewed static artifact exist, present ONE final request identifying project
creation/protection, exact source/artifact, Preview-only target, one upload/build
count, expected incremental charge and permitted budget. Do not provision to
resolve these unknowns without that approval. No final deployment approval is
being requested now.

## Superseding owner spend update — deployment remains held

Owner confirms team budget$5, Pause ON, Webhook OFF, displayed spend$181.05 /
Over Budget, and automatic Agent Code Reviews OFF. No increase, unpause, billing
change or workaround is authorized or proposed. Earlier requests for an incremental
budget are superseded by this hold. No final deployment approval requested.

Read-only inspection of team metadata exposes name/slug/id/SAML only, not an
account build restriction, enforcement timestamp, budget action or scope. Project
metadata reports live=false and latest deployment READY; these projected fields
cannot prove Spend Management enforcement. READY is historical deployment build
state, not current serving status or permission to start a new build. Latest
returned deployments are the existing hotfix/older releases; no fresh rejection
record proves what a new build would do. No deploy/build was submitted as a probe.

Accessible official docs establish that project pausing stops production traffic
and paused deployment access can return503 DEPLOYMENT_PAUSED. They do not prove
that this team's over-budget Pause currently rejects new builds/deployments or
covers every Preview, in-flight build, provider or separately billed service.
Do not conflate a project pause endpoint with an account-wide monetary hard cap.
Exact platform build restriction/code is UNVERIFIED with available access.
Operational decision: treat new hosted work as BLOCKED while over budget/Pause ON;
uncertainty is not permission to test or bypass enforcement.

Charges: a pause cannot reverse accrued usage or prevent prior usage appearing in
later metering/invoices. It is not subscription cancellation; recurring Pro/seat
charges or other contractual commitments are not proven stopped. Coverage of
in-flight builds, previews, storage/Marketplace and manual Agent/provider use
remains unverified here. Never promise total bill=$5 or zero additional invoices.
Webhook OFF means no configured budget webhook action; it does not establish that
the built-in Pause is ineffective. Automatic review OFF blocks that configured
review trigger, not all platform billing.

Safest next action: leave controls untouched and keep the static candidate offline.
Owner may inspect the team's/project's paused/restriction banners or ask Vercel
Support for read-only confirmation of (1) whether new build/deployment requests
are currently rejected and the restriction code, (2) whether Preview and in-flight
builds are covered, (3) what usage/subscriptions can still accrue and metering lag,
and (4) current pause scope. Do not submit a trial deployment, create a project,
unpause, change limits, migrate to another team or bypass protection to diagnose.
Website-only source4db11e37, all later local commits and existing PRs preserved.
