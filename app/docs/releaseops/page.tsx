import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
    title: "ReleaseOps overview — Axiom Documentation",
    description: "How the installed Axiom Agent coordinates deployment intake, readiness, approval, execution, validation, evidence, and closure.",
};

export default function ReleaseOpsDocOverviewPage() {
    return (
        <>
            <DocHeader
                kicker="ReleaseOps"
                title="ReleaseOps overview."
                summary="ReleaseOps is the deployment-governance workflow inside Axiom Agent. It records and coordinates work around existing source-control, CI/CD, infrastructure, change-management, and communication systems."
            />

            <Callout variant="safe" title="Coordinate existing tools; do not impersonate them">
                A connector logo is not proof of availability. Each configured adapter must report its real connection state and source. Preview adapters cannot execute, and an approval in Axiom does not prove an external deployment occurred without provider evidence.
            </Callout>

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
                        { question: "Where do users work?", answer: "In the installed Axiom Agent application." },
                        { question: "Can a preview adapter execute?", answer: "No. Preview must remain labeled and must not return synthetic success." },
                        { question: "What proves execution?", answer: "An actual adapter response plus persisted validation and audit evidence." },
                        { question: "Can validation be deferred?", answer: "Yes, when policy allows it and an owner, deadline, and follow-up state are recorded." },
                        { question: "When is a request closed?", answer: "Only after required approvals, execution or manual steps, validation, evidence, and closure criteria are satisfied." },
                    ]}
                />
            </DocSection>

            <DocFooterNav
                prev={{ href: "/docs/rollback", label: "Rollback strategy" }}
                next={{ href: "/docs/releaseops/connectors", label: "CI/CD connectors" }}
            />
            <DocFeedback />
        </>
    );
}
