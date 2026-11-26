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
              <p>In the cockpit, <strong>Checks</strong> lets owners and admins attach checks to each release stage (Plan, Validate, Approve, Deploy, Verify and Recover): smoke tests with an expected status and latency, health checks against a metric threshold, migration dry runs in a named workflow job, custom scripts in your repository and manual checklists. Each check is blocking or advisory and keeps a version that increases with every edit, so a release can record exactly which checks applied.</p>
              <p>V19 never runs a check. Checks run in your CI or runners, and generating their CI job, collecting results and enforcing blocking checks at stage transitions are the next steps. The page warns when nothing is checked at Verify, because a release could then be marked complete without recorded proof that it works.</p>
            </DocSection>

            <DocFooterNav
                prev={{ href: "/docs/rollback", label: "Rollback strategy" }}
                next={{ href: "/docs/releaseops/connectors", label: "CI/CD connectors" }}
            />
            <DocFeedback />
        </>
    );
}
