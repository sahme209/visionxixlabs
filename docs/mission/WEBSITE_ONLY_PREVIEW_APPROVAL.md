# Website-only Preview — preparation, not deployment approval

Status: waiting for owner-side cost/control confirmations. Feature development
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
