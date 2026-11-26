import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid, DocFigure } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
    title: "ReleaseOps overview — V19 Documentation",
    description: "How the installed V19 coordinates deployment intake, readiness, approval, execution, validation, evidence, and closure.",
};

export default function ReleaseOpsDocOverviewPage() {
    return (
        <>
            <DocHeader
                kicker="ReleaseOps"
                title="ReleaseOps overview."
                summary="ReleaseOps is the deployment-governance workflow inside V19 Agent. It records and coordinates work around existing source-control, CI/CD, infrastructure, change-management, and communication systems."
            />

            <Callout variant="safe" title="Coordinate existing tools; do not impersonate them">
                A connector logo is not proof of availability. Each configured adapter must report its real connection state and source. Preview adapters cannot execute, and an approval in V19 does not prove an external deployment occurred without provider evidence.
            </Callout>

            <DocFigure src="/docs/desktop/deployments.webp" alt="The Deployments view in the V19 desktop app" caption="Deployments with a selected release, its lifecycle and readiness, shown with synthetic example records." width={1600} height={1067} />
            <DocSection id="lifecycle" title="The deployment lifecycle" kicker="01">
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-400">
                    <li>Capture deployment intake, ownership, scope, dependencies, and timing.</li>
                    <li>Run readiness checks and surface missing permissions or evidence.</li>
                    <li>Create or select a versioned playbook with validation and rollback expectations.</li>
                    <li>Collect approval gates and enforce separation of duties.</li>
                    <li>Guide execution through an available adapter or an explicitly manual step.</li>
                    <li>Validate the observed result or assign deferred validation with an owner and deadline.</li>
                    <li>Collect evidence, update audit history, communicate status, and close only when exit criteria pass.</li>
                </ol>
            </DocSection>

            <DocSection id="catalogs" title="What users manage" kicker="02">
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>Deployment requests and their version history</li>
                    <li>Repositories, applications, clients, environments, and dependencies</li>
                    <li>Playbooks, approval policies, schedules, retries, and rollback expectations</li>
                    <li>Change records, knowledge-transfer sessions, and extracted evidence</li>
                    <li>Validation results, deferred follow-ups, audit history, reports, and exports</li>
                    <li>Connector configuration and actual availability state</li>
                </ul>
            </DocSection>

            <DocSection id="availability" title="Availability rules" kicker="03">
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>GitHub and AWS live paths require configured, scoped credentials and safe test accounts.</li>
                    <li>Azure and GCP analysis remain preview until live inventory is implemented and verified.</li>
                    <li>Terraform and CLI artifacts can be reviewed; local Terraform apply remains disabled by the desktop safety contract.</li>
                    <li>Communication actions require configured adapters and must surface delivery failures.</li>
                    <li>Every external operation needs resulting evidence before it is marked successful.</li>
                </ul>
                <p>Use the <Link href="/download">download page</Link> for the current installer and release status.</p>
            </DocSection>

            <DocSection id="trust" title="Trust questions" kicker="04">
                <TrustGrid
                    items={[
                        { question: "Does ReleaseOps replace CI/CD?", answer: "No. It coordinates governance and evidence around existing systems." },
                        { question: "Where do users work?", answer: "In the installed V19 application." },
                        { question: "Can a preview adapter execute?", answer: "No. Preview must remain labeled and must not return synthetic success." },
                        { question: "What proves execution?", answer: "An actual adapter response plus persisted validation and audit evidence." },
                        { question: "Can validation be deferred?", answer: "Yes, when policy allows it and an owner, deadline, and follow-up state are recorded." },
                        { question: "When is a request closed?", answer: "Only after required approvals, execution or manual steps, validation, evidence, and closure criteria are satisfied." },
                    ]}
                />
            </DocSection>
            <DocSection id="deployment-checks" title="Deployment checks per stage" kicker="05">
              <DocFigure src="/docs/cockpit/checks.webp" alt="The Deployment checks page with per-stage counts and four checks" caption="Deployment checks for a synthetic workspace: counts per stage and checks at Validate, Deploy and Verify." width={1600} height={1000} />
              <p>In the cockpit, <strong>Checks</strong> lets owners and admins attach checks to each release stage (Plan, Validate, Approve, Deploy, Verify and Recover): smoke tests with an expected status and latency, health checks against a metric threshold, migration dry runs in a named workflow job, custom scripts in your repository, manual checklists, security scans (your scanner, with the most critical and high findings allowed) supply-chain evidence (an SBOM, SLSA provenance or both, verified by your tool) and resilience experiments (for example a chaos test with AWS FIS or Chaos Mesh, run under your own safeguards). Owners and admins can also describe a check in plain language under <em>Draft with AI</em>; the workspace&apos;s governed AI fills the form with a draft that passes the same validation, and nothing is saved until they add it. Each check is blocking or advisory and keeps a version that increases with every edit, so a release can record exactly which checks applied.</p>
              <p>V19 never runs a check. Under <em>CI workflow for these checks</em>, the page generates a GitHub Actions workflow (<code>.github/workflows/v19-deployment-checks.yml</code>) that runs the smoke tests and repository scripts for a chosen stage; copy or download it and add it through a pull request. Health checks, migration dry runs and manual checklists are listed with the reason they are not in that file. Each generated job ends by reporting its result to V19 when the repository has a <code>V19_API_KEY</code> secret (an API key with the <code>checks:report</code> scope, kept separate from agent keys so an agent cannot certify its own checks; it is available to the whole check job, including your scripts) and an optional <code>V19_URL</code> variable. The Checks page then shows each check&apos;s last result, and says when it ran an older version of the check. Results are evidence only.</p>
              <p>Before the desktop app dispatches a deployment, every enabled blocking check at an earlier stage (Plan, Validate or Approve) must have a passing result for that exact commit, at the check&apos;s current version, reported within the last 72 hours. Otherwise nothing is dispatched and the app says why. If checks cannot be read, nothing is dispatched either. A manual checklist counts once an owner, admin, operator or security reviewer ticks every item and confirms it for the full commit SHA under <em>Confirm for a commit</em>; the confirmation is recorded with their name. A security scan, supply-chain check or resilience experiment counts once your pipeline reports a pass or fail for the commit, using the settings on the check. A health check counts once your monitoring evaluates it and reports the result for the commit through <code>POST /api/v1/checks/results</code>; until then a blocking health check blocks. An audited emergency production bypass skips the checks, as it skips branch policy. The desktop deploy form lists the blocking checks that must pass, with the commit once readiness has resolved it. The page warns when nothing is checked at Verify, because a release could then be marked complete without recorded proof that it works.</p>
              <p>Under <strong>Checks as code</strong>, choose <em>Download checks file</em> to keep checks in Git. To change them, paste an edited file and choose <em>Preview checks file</em>. The preview lists new, changed and disabled checks, and anything that loosens deployment gates. Owners and admins can then apply it. Applying only goes ahead if the checks have not changed since the preview, and it changes all of them or none. Checks the file leaves out are disabled rather than deleted, so past results keep their meaning.</p>
            </DocSection>

            <DocSection id="tenant-fan-out" title="Tenants, tags and fan-out" kicker="06">
              <p>In the desktop app, under Settings → Environments, owners and admins can tag each environment with lowercase <code>key:value</code> labels such as <code>tenant:acme</code>, <code>region:eu</code> or <code>ring:1</code>. Saving uses the same governed configuration path as creating an environment, and an edit is refused if someone changed the tags in the meantime.</p>
              <p><em>Tenant fan-out preview</em> takes a selector (all terms must match, and <code>key:*</code> matches any value) and lists the matching environments in ring order, with untagged rings last. It is a plan only: each environment still deploys on its own with its own policy, checks and approvals.</p>
              <p>Rings are enforced: before the desktop app dispatches to an environment tagged <code>ring:N</code> (N above 0), at least one environment tagged <code>ring:N-1</code> must have completed a successful deployment of the same repository and commit. Otherwise nothing is dispatched. Untagged environments and ring 0 are not gated, and the audited emergency bypass skips the ring check.</p>
              <p>To keep environments in Git, open <strong>Variables</strong> in the cockpit and choose <em>Download environments file</em> under <strong>Environments as code</strong>. The file lists each environment's name, tier, order, tags and change window. Paste an edited file and choose <em>Preview environments file</em> to see new and changed environments, environments the file leaves out (they are kept, never deleted) and anything that loosens deployment gates, such as removing a change window, a freeze or a ring tag. An existing environment's tier cannot be changed from a file. Owners and admins can apply the preview; it only goes ahead if nothing changed since the preview, and it changes all of the environments or none.</p>
            </DocSection>

            <DocSection id="database-changes" title="Database changes in a deployment" kicker="07">
              <p>When you check readiness for a deployment in the desktop app, V19 compares the commit with the last successful deployment of the same repository to the same environment and lists any changed migration files (for example Prisma, Rails, Alembic, Flyway, Liquibase, Supabase or Drizzle migrations). Review the migration and its rollback before dispatching.</p>
              <p>This is advisory evidence: custom layouts may not be recognised, a comparison lists at most 300 files, and the first deployment to an environment cannot be compared. To make a migration review mandatory, attach a blocking migration dry run check.</p>
            </DocSection>

            <DocSection id="change-windows" title="Change windows and freezes" kicker="08">
              <p>In the desktop app, under Settings → Environments, owners and admins can give an environment a change window: the days it opens on and one or more times in UTC (for example <code>22:00-02:00</code>, which crosses midnight from the day it starts), plus freezes written as <code>2026-12-20 to 2027-01-02: Holiday freeze</code>. The editor shows whether deployments are allowed right now and when the window next opens. Saving uses the governed configuration path, and an edit is refused if someone changed the window in the meantime.</p>
              <p>The desktop app refuses to dispatch outside the window or during a freeze, before any GitHub work starts. A freeze always wins over a window. A rule that cannot be read refuses deployments until it is fixed, rather than silently allowing them. The audited production emergency bypass still works. Queuing a deployment to run automatically when the window opens is not available yet; dispatch it once the window is open. Every refusal at a release gate (window, freeze, stability warning, checks or rings) also sends a <code>deployment.blocked</code> webhook, so a Slack or pager bridge can tell the team.</p>
              <DocFigure src="/docs/cockpit/deployment-freeze.webp" alt="The Deployment freeze panel on the cockpit Overview with production frozen for an incident" caption="A synthetic workspace with production frozen for an incident: the freeze, its end time and End freeze now." width={1600} height={1000} />
              <p>To stop deployments quickly, for example during an incident, owners and admins can use <strong>Deployment freeze</strong> on the cockpit Overview. Choose production (environments with the prod tier) or every environment, how long (1 hour to 7 days) and a reason, then choose <em>Freeze deployments</em>. V19 adds that freeze to each environment's change window and keeps its existing windows and freezes. Members see every active freeze. <em>End freeze now</em> ends active freezes with that reason; the freeze stays on record with its shortened end time. Freezes apply to AI agents as well as people. Webhooks subscribed to <code>deployment.freeze_started</code> and <code>deployment.freeze_ended</code> are told when a freeze starts or ends early. An incident tool can start a freeze with an API key that has the <code>freeze:start</code> permission (<code>POST /api/v1/environments/freeze</code>, up to 24 hours); it cannot end one.</p>
            </DocSection>

            <DocSection id="kubernetes-templates" title="Kubernetes rolling, blue/green and canary" kicker="09">
              <p>In the cockpit, <strong>Services</strong> generates a GitHub Actions workflow for a Kubernetes rolling update, a blue/green switch or a canary. Commit it to your repository and add a <code>KUBE_CONFIG</code> repository secret scoped to the namespace: cluster access stays in your CI, and V19 never holds it. V19 dispatches the workflow only after the environment&apos;s policy, checks, rings, change window and approvals pass.</p>
              <p>A rolling update undoes itself if the rollout does not become ready. Blue/green deploys to the idle colour, waits for it, then switches the Service selector; the previous colour keeps running so you can switch back. A canary runs the new image in a small canary Deployment, watches readiness and restarts for the minutes you choose, promotes to the main Deployment, and always scales the canary back to zero. The workflow uses only kubectl and checks the image reference before using it.</p>
            </DocSection>

            <DocSection id="evidence-pack" title="Release evidence pack" kicker="10">
              <p>In the cockpit, <strong>Insights → Export release evidence</strong> downloads one JSON file for a repository commit: every recorded deployment of it (environment, who, when, policy, reviewed pull request, configuration fingerprint and outcome), every check result CI reported for it, and audit events on those deployments. Configuration values are not included, only their fingerprints. Missing evidence is listed under <code>gaps</code> rather than invented.</p>
              <p>The file carries a SHA-256 digest of its canonical JSON (sorted keys, without the export time), so exporting the same records again gives the same digest and an auditor can recompute it. Every export is recorded in the audit log.</p>
            </DocSection>

            <DocSection id="gitops" title="Argo CD and Flux" kicker="11">
              <p>V19 includes read-only clients for Argo CD (applications in one project) and Flux (Kustomizations in one namespace through the Kubernetes API). They compare the commit the GitOps controller reports as applied with the commit V19 recorded for the environment, and explain whether they match, the controller is behind, it applied something V19 did not deploy, it is unhealthy, or reconciliation is suspended. V19 never syncs, reconciles, rolls back or suspends. Connect them under Release signals (see below); live acceptance with a real Argo CD instance or cluster is still pending.</p>
            </DocSection>

            <DocSection id="stability-warning" title="Stability early warning" kicker="12">
              <p>V19 compares the change failure rate of releases finished in the last 7 days with the 90 days before. When at least three recent releases failed, rolled back or had an incident reported against them, and the recent rate is at least 20% and well above the earlier rate, Overview and Insights show a stability warning. While it is active, the desktop app asks for a reason before a production deployment and records that reason in the audit log. If release records cannot be read, nothing is blocked.</p>
            </DocSection>

            <DocSection id="serverless-templates" title="Lambda, Cloud Run and Azure Functions" kicker="13">
              <p>In the cockpit, <strong>Services</strong> also generates serverless deploy workflows. For AWS Lambda, it publishes a new version, sends it a share of traffic on an alias named <code>live</code>, and moves all traffic back if that version reports errors. For Google Cloud Run, it deploys a revision with no traffic, sends it a share, watches readiness, then moves all traffic to it. For Azure Functions, it deploys to a <code>staging</code> slot, checks a health path, and swaps it into production.</p>
              <p>Each workflow signs in to your cloud with short-lived OIDC federation that you configure in your account. The workflow reads the role, service account or client IDs from repository variables, so no cloud keys are stored in GitHub or V19. The official sign-in actions are pinned to exact commits. As with every template, V19 dispatches the workflow only after the environment&apos;s gates pass.</p>
            </DocSection>

            <DocSection id="verification-signals" title="Verification signals from Sentry and Datadog" kicker="14">
              <p>V19 includes read-only clients for Sentry (unresolved issues first seen in a release) and Datadog (monitor states for a service tag). A verification step combines them with Verify-stage check results into one verdict: healthy, investigate or unhealthy, with the reasons. Signals that are not connected are listed as missing, never assumed healthy. V19 never resolves, mutes or edits anything in those tools. Connect them under Release signals (see below); live acceptance with real accounts is still pending.</p>
            </DocSection>

            <DocSection id="release-signals" title="Connect release signals" kicker="15">
              <p>In the desktop app, under Settings, <strong>Release signals</strong> connects Argo CD, Flux, PagerDuty, Opsgenie, Sentry, Datadog, LaunchDarkly, Unleash and Jenkins. Each card asks only for what that tool needs, for example the Datadog site, a monitor tag and read-only keys. When you connect, V19 checks the credential with one small read before saving it, then stores it encrypted for this workspace. Secret fields are cleared after every attempt and are never shown again.</p>
              <p>Every connection is read-only. Use the least access each tool offers: a read-only token, a reader role, or a scope such as <code>monitors_read</code>. V19 never syncs, pages, acknowledges, resolves, mutes or toggles anything. You can replace or disconnect a connection at any time.</p>
              <p>After a deployment, the desktop deploy form offers <em>Check release health</em>. Enter the release name your tools use (it starts as the deployed tag or branch). V19 then reads every connected signal at once: open PagerDuty and Opsgenie incidents, new Sentry issues first seen in that release, alerting Datadog monitors, LaunchDarkly temporary flags still on after 30 days or Unleash flags marked stale but still on, and Verify-stage check results for the commit. It shows one verdict with the reasons. A tool that is not connected, or does not answer, is listed as not available and never counted as healthy. The Agent can read the same release health with its read-only <code>read_release_health</code> tool when you ask how a release is doing, the state of connected Argo CD and Flux applications with <code>read_gitops_state</code>, and Jenkins jobs with <code>read_ci_jobs</code>.</p>
            </DocSection>

            <DocFooterNav
                prev={{ href: "/docs/rollback", label: "Rollback strategy" }}
                next={{ href: "/docs/releaseops/connectors", label: "CI/CD connectors" }}
            />
            <DocFeedback />
        </>
    );
}
