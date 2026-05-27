# ReleaseOps — Getting Started

Zero-touch onboarding for the Axiom ReleaseOps platform. This guide takes
you from "first sign-in" to "first audited release deployed" without
needing to message support.

## TL;DR — the 4-step path

1. **Install the GitHub App.** One click from `/dashboard/github-app`.
2. **Register your first application.** This is the governance unit; releases attach to an application, not a repo.
3. **Track at least one repository.** After install, push/PR/release deliveries auto-register repos on first sight — no manual setup needed.
4. **Cut your first release.** Pins a tag + commit + planned-window to an application.

The dashboard shows this exact checklist on `/dashboard/command-center`
and `/dashboard/releases`. It auto-hides when all 4 items are done.

## What "zero-touch" actually means

Once the GitHub App is installed on your org:

- **Webhooks are auto-configured** — GitHub App installs come with org-wide webhook delivery; you don't paste a URL anywhere.
- **Repositories auto-register** — the first push / pull_request / release / workflow_run webhook for a repo creates the Repository row in your tenant. No `+ Register repository` click needed.
- **Branch protection** can be paste-in JSON today (`/dashboard/branch-protection`); the automated GitHub-API sync ships in a follow-on phase together with the App's private-key configuration.

## Self-hosted setup (one-time deploy env vars)

If you're running Axiom yourself, set these in your deploy environment
before the first sign-in:

```bash
# Required for the GitHub App install flow.
GITHUB_APP_SLUG=axiom-releaseops             # the public app slug
GITHUB_WEBHOOK_SECRET=…                      # shared HMAC secret for /api/webhooks/github

# Required for OAuth callback resolution.
NEXTAUTH_URL=https://your-axiom-deployment.example.com

# Existing platform vars (DATABASE_URL, NEXTAUTH_SECRET, etc.) still apply.
```

After deploy, the install URL on `/dashboard/github-app` reads
`GITHUB_APP_SLUG` and produces a working install link. If the slug is
unset, the page shows an amber "Install URL not yet configured" panel.

## Data model — quick map

| Surface | Model | State machine |
|---|---|---|
| Apps you ship | `Application` | none (registry) |
| Repos backing apps | `Repository` | none (auto-onboarded) |
| Per-release lifecycle | `Release` | draft → ready → deploying → deployed (or rolled_back/failed) |
| Pre-deploy scoring | `ReleaseReadinessSnapshot` | none (read-only snapshots) |
| Post-deploy regressions | `DeploymentIncident` | open → mitigated → resolved \| wont_fix |
| Hand-fixes on prod | `ManualFix` | pending → reconciled \| wont_fix |
| Customer-facing notes | `ReleaseNotesDraft` | draft → reviewed → published |
| Branch posture | `BranchProtectionSnapshot` | strong \| weak \| none |
| Audit | `AuditEvent` | append-only |
| Inbound webhooks | `InboundWebhookDelivery` | idempotent on (provider, deliveryId) |

Every state-changing endpoint best-effort appends to `AuditEvent` so
the `/dashboard/release-audit` inbox is the single source of truth
for compliance exports.

## The cause → effect loop

`ManualFix` (cause: someone hand-edited prod) and `DeploymentIncident`
(effect: a release caused a regression) close the post-deploy
reconciliation loop. Both pin to a `Release`. A reconciled
ManualFix carries the source-of-truth ref (e.g. PR #4123) so an
auditor can trace the catch-up commit.

## Support escalation

This platform is designed for self-serve. If something genuinely
blocks you:

- **Migration drag** — the dashboard shows an amber "Schema migration pending" banner with the next migration's name. Run `prisma migrate deploy`.
- **Install URL missing** — your deploy is missing `GITHUB_APP_SLUG`.
- **Webhook deliveries arriving but marked `ignored`** — the GitHub App isn't installed for that org yet, or the install is suspended. Check `/dashboard/github-app`.
- **Anything else** — file an issue on the platform repo with the
  correlation id you see in any 500 response.

## What's still manual (honest gaps)

- **Branch protection auto-sync** — Phase 499 ships the projector + persistence + paste-in panel. The automated `gh api` fetch lands in a follow-on phase with the App private key.
- **Provider-token-backed repo discovery** — after install, we know the installation_id but don't yet call `/installation/repositories`; that lands together with the private key wiring.
- **Slack notifications for incidents** — the model + responder land first; the Slack hop is a separate phase.

Each gap has the `migration_pending` graceful degradation pattern,
so the UI stays calm until the follow-on phase ships.
