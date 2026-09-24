import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
    title: "Azure setup — Axiom Documentation",
    description: "Current Azure preview availability, required configuration, and the work needed before live inventory or execution can be enabled.",
};

export default function AzureSetupPage() {
    return (
        <>
            <DocHeader
                kicker="Connect a cloud · Azure · Preview"
                title="Azure setup."
                summary="Axiom currently provides Azure configuration validation and preview-derived analysis. Live Azure inventory and write execution are not enabled by the verified release."
            />

            <Callout variant="warning" title="Preview is not a live connector">
                The current Azure path validates configuration shape and can render preview findings. It must not be presented as a successful live subscription scan. Before live availability, the product needs authenticated Azure Resource Manager inventory traversal, least-privilege verification, tenant-scoped persistence, error handling, and safe integration tests.
            </Callout>

            <DocSection id="available" title="What is available" kicker="01">
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>Azure credential and configuration-shape validation</li>
                    <li>Runtime mode and credential-presence reporting without exposing secrets</li>
                    <li>Preview snapshots, findings, and recommendations that remain labeled preview</li>
                    <li>An audited scan API that reports whether its source is preview or live</li>
                    <li>Desktop UI states for unavailable, disconnected, and failed connectors</li>
                </ul>
            </DocSection>

            <DocSection id="not-available" title="What is not verified" kicker="02">
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>Live VM, Storage, VNet, NSG, SQL, IAM, or cost inventory</li>
                    <li>Production topology and drift claims derived from live Azure responses</li>
                    <li>Azure action dispatch, retries, validation, or rollback</li>
                    <li>Provider-side evidence proving a real operation occurred</li>
                </ul>
            </DocSection>

            <DocSection id="planned-setup" title="Configuration required for a future live path" kicker="03">
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-400">
                    <li>Register an application in the organization&apos;s Microsoft Entra tenant.</li>
                    <li>Create a service principal and prefer workload identity federation over a long-lived client secret.</li>
                    <li>Grant only the read permissions needed at subscription or resource-group scope.</li>
                    <li>Enter the Tenant ID, Subscription ID, and Application ID in the installed application.</li>
                    <li>Run a connector test in a dedicated non-production subscription and require an actual ARM response before reporting connected.</li>
                </ol>
                <p>
                    Download Axiom Agent from <Link href="/download">the release page</Link>. Do not create Azure credentials solely for the preview path unless your administrator has supplied an approved evaluation plan.
                </p>
            </DocSection>

            <DocSection id="trust" title="Trust questions" kicker="04">
                <TrustGrid
                    items={[
                        { question: "Is Azure live today?", answer: "Not in the verified release. The current path is configuration validation plus preview-derived analysis." },
                        { question: "Does preview data come from my tenant?", answer: "No. Preview output must remain labeled and cannot be treated as live provider evidence." },
                        { question: "Can Axiom change Azure resources?", answer: "No verified Azure execution adapter is enabled." },
                        { question: "What should a missing credential show?", answer: "Disconnected or unavailable, never a synthetic success." },
                        { question: "When can the status change?", answer: "After live inventory and action paths are implemented, permission-reviewed, integration-tested, and recorded in the release availability matrix." },
                        { question: "Where do I verify release status?", answer: "Use the download page, release notes, and in-app capability status for the installed version." },
                    ]}
                />
            </DocSection>

            <DocFooterNav
                prev={{ href: "/docs/aws-setup", label: "AWS setup" }}
                next={{ href: "/docs/gcp-setup", label: "GCP setup" }}
            />
            <DocFeedback />
        </>
    );
}
