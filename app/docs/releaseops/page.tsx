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
              <p>In the cockpit, <strong>Checks</strong> lets owners and admins attach checks to each release stage (Plan, Validate, Approve, Deploy, Verify and Recover): smoke tests with an expected status and latency, health checks against a metric threshold, migration dry runs in a named workflow job, custom scripts in your repository, manual checklists, security scans (your scanner, with the most critical and high findings allowed) and supply-chain evidence (an SBOM, SLSA provenance or both, verified by your tool). Owners and admins can also describe a check in plain language under <em>Draft with AI</em>; the workspace&apos;s governed AI fills the form with a draft that passes the same validation, and nothing is saved until they add it. Each check is blocking or advisory and keeps a version that increases with every edit, so a release can record exactly which checks applied.</p>
              <p>V19 never runs a check. Under <em>CI workflow for these checks</em>, the page generates a GitHub Actions workflow (<code>.github/workflows/v19-deployment-checks.yml</code>) that runs the smoke tests and repository scripts for a chosen stage; copy or download it and add it through a pull request. Health checks, migration dry runs and manual checklists are listed with the reason they are not in that file. Each generated job ends by reporting its result to V19 when the repository has a <code>V19_API_KEY</code> secret (an API key with the <code>governance:request</code> scope; it is available to the whole check job, including your scripts) and an optional <code>V19_URL</code> variable. The Checks page then shows each check&apos;s last result, and says when it ran an older version of the check. Results are evidence only.</p>
              <p>Before the desktop app dispatches a deployment, every enabled blocking check at an earlier stage (Plan, Validate or Approve) must have a passing result for that exact commit, at the check&apos;s current version, reported within the last 72 hours. Otherwise nothing is dispatched and the app says why. If checks cannot be read, nothing is dispatched either. A manual checklist counts once an owner, admin, operator or security reviewer ticks every item and confirms it for the full commit SHA under <em>Confirm for a commit</em>; the confirmation is recorded with their name. A security scan or supply-chain check counts once your pipeline reports a pass or fail for the commit, using the settings on the check. A health check counts once your monitoring evaluates it and reports the result for the commit through <code>POST /api/v1/checks/results</code>; until then a blocking health check blocks. An audited emergency production bypass skips the checks, as it skips branch policy. The desktop deploy form lists the blocking checks that must pass, with the commit once readiness has resolved it. The page warns when nothing is checked at Verify, because a release could then be marked complete without recorded proof that it works.</p>
            </DocSection>

            <DocSection id="tenant-fan-out" title="Tenants, tags and fan-out" kicker="06">
              <p>In the desktop app, under Settings → Environments, owners and admins can tag each environment with lowercase <code>key:value</code> labels such as <code>tenant:acme</code>, <code>region:eu</code> or <code>ring:1</code>. Saving uses the same governed configuration path as creating an environment, and an edit is refused if someone changed the tags in the meantime.</p>
              <p><em>Tenant fan-out preview</em> takes a selector (all terms must match, and <code>key:*</code> matches any value) and lists the matching environments in ring order, with untagged rings last. It is a plan only: each environment still deploys on its own with its own policy, checks and approvals.</p>
              <p>Rings are enforced: before the desktop app dispatches to an environment tagged <code>ring:N</code> (N above 0), at least one environment tagged <code>ring:N-1</code> must have completed a successful deployment of the same repository and commit. Otherwise nothing is dispatched. Untagged environments and ring 0 are not gated, and the audited emergency bypass skips the ring check.</p>
            </DocSection>

            <DocSection id="database-changes" title="Database changes in a deployment" kicker="07">
              <p>When you check readiness for a deployment in the desktop app, V19 compares the commit with the last successful deployment of the same repository to the same environment and lists any changed migration files (for example Prisma, Rails, Alembic, Flyway, Liquibase, Supabase or Drizzle migrations). Review the migration and its rollback before dispatching.</p>
              <p>This is advisory evidence: custom layouts may not be recognised, a comparison lists at most 300 files, and the first deployment to an environment cannot be compared. To make a migration review mandatory, attach a blocking migration dry run check.</p>
            </DocSection>

            <DocFooterNav
                prev={{ href: "/docs/rollback", label: "Rollback strategy" }}
                next={{ href: "/docs/releaseops/connectors", label: "CI/CD connectors" }}
            />
            <DocFeedback />
        </>
    );
}
