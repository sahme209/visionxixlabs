import type { Metadata } from "next";
import Link from "next/link";
import { Callout, DocFeedback, DocFooterNav, DocHeader, DocSection, TrustGrid } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
    title: "GCP setup — Axiom Documentation",
    description: "Current GCP preview availability, required configuration, and the work needed before live inventory or execution can be enabled.",
};

export default function GcpSetupPage() {
    return (
        <>
            <DocHeader
                kicker="Connect a cloud · GCP · Preview"
                title="GCP setup."
                summary="Axiom currently provides GCP configuration validation and preview-derived analysis. Live Google Cloud inventory and write execution are not enabled by the verified release."
            />

            <Callout variant="warning" title="Preview is not a live connector">
                The current GCP path validates project and service-account configuration shape and can render preview findings. It must not be presented as a successful live project scan. Live availability requires authenticated Compute, Storage, IAM, networking, and billing reads plus safe integration evidence.
            </Callout>

            <DocSection id="available" title="What is available" kicker="01">
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>Project ID and service-account JSON shape validation</li>
                    <li>Runtime mode and credential-format reporting without exposing secret values</li>
                    <li>Preview snapshots, findings, and recommendations that remain labeled preview</li>
                    <li>An audited scan API that reports whether its source is preview or live</li>
                    <li>Desktop UI states for unavailable, disconnected, and failed connectors</li>
                </ul>
            </DocSection>

            <DocSection id="not-available" title="What is not verified" kicker="02">
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>Live Compute Engine, Cloud Storage, VPC, firewall, IAM, or billing inventory</li>
                    <li>Production topology and drift claims derived from live GCP responses</li>
                    <li>GCP action dispatch, retries, validation, or rollback</li>
                    <li>Provider-side evidence proving a real operation occurred</li>
                </ul>
            </DocSection>

            <DocSection id="planned-setup" title="Configuration required for a future live path" kicker="03">
                <ol className="list-decimal list-inside space-y-1.5 text-zinc-400">
                    <li>Create or select a dedicated non-production Google Cloud project.</li>
                    <li>Create a service account or workload-identity binding with only the required viewer roles.</li>
                    <li>Enable only the APIs needed by the implemented inventory path.</li>
                    <li>Enter the project and approved credential reference in the installed application.</li>
                    <li>Run a connector test and require actual Google Cloud API responses before reporting connected.</li>
                </ol>
                <p>
                    Download Axiom Agent from <Link href="/download">the release page</Link>. Do not provision credentials solely for preview output unless your administrator has supplied an approved evaluation plan.
                </p>
            </DocSection>

            <DocSection id="trust" title="Trust questions" kicker="04">
                <TrustGrid
                    items={[
                        { question: "Is GCP live today?", answer: "Not in the verified release. The current path is configuration validation plus preview-derived analysis." },
                        { question: "Does preview data come from my project?", answer: "No. Preview output must remain labeled and cannot be treated as live provider evidence." },
                        { question: "Can Axiom change GCP resources?", answer: "No verified GCP execution adapter is enabled." },
                        { question: "What should a missing credential show?", answer: "Disconnected or unavailable, never a synthetic success." },
                        { question: "When can the status change?", answer: "After live inventory and action paths are implemented, permission-reviewed, integration-tested, and recorded in the release availability matrix." },
                        { question: "Where do I verify release status?", answer: "Use the download page, release notes, and in-app capability status for the installed version." },
                    ]}
                />
            </DocSection>

            <DocFooterNav
                prev={{ href: "/docs/azure-setup", label: "Azure setup" }}
                next={{ href: "/docs/security-model", label: "Security model" }}
            />
            <DocFeedback />
        </>
    );
}
