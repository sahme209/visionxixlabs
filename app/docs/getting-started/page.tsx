import type { Metadata } from "next";
import Link from "next/link";
import {
    Callout,
    DocFeedback,
    DocFooterNav,
    DocHeader,
    DocSection,
    Step,
    TrustGrid,
} from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
    title: "Getting started — Axiom Documentation",
    description: "Download, install, authenticate, and configure Axiom Agent for your first guided workflow.",
};

export default function GettingStartedPage() {
    return (
        <>
            <DocHeader
                kicker="Start here"
                title="Getting started with Axiom Agent."
                summary="Download the desktop application, verify the installer, complete browser-assisted desktop authentication, and configure only the integrations your workflow needs."
            />

            <Callout variant="safe" title="The installed app is the product">
                The website provides product information, documentation, a sample-data sandbox, and verified release downloads. Operational work happens in Axiom Agent. Browser pages used during identity-provider approval are part of desktop authentication and are not a separate web application.
            </Callout>

            <DocSection id="prereqs" title="Prerequisites" kicker="00 · Before you begin">
                <ul className="list-disc list-inside space-y-1.5 text-zinc-400">
                    <li>A supported macOS, Windows, or Linux system listed on the <Link href="/download">download page</Link></li>
                    <li>Permission to install software on the workstation</li>
                    <li>HTTPS access to the configured Axiom API and any integrations you enable</li>
                    <li>An organization identity and connector accounts supplied by your administrator</li>
                </ul>
            </DocSection>

            <DocSection id="install" title="Step 1 — Download and install" kicker="01">
                <Step number={1} title="Choose a manifest-backed installer">
                    <p>
                        Open <Link href="/download">Download Axiom Agent</Link>. An operating-system button is enabled only when the current public release contains a matching installer. Select the architecture that matches your device.
                    </p>
                </Step>
                <Step number={2} title="Check release and signing information">
                    <p>
                        Confirm the displayed version and read the platform-specific signing or notarization status. Detached GPG signatures verify release origin, but they do not replace operating-system code signing. Follow your organization&apos;s software-installation policy.
                    </p>
                </Step>
                <Step number={3} title="Install and launch">
                    <p>
                        Follow the <Link href="/docs/desktop-install">desktop installation guide</Link> for macOS, Windows, or Linux. If the release is marked unsigned, expect the operating system to warn you; do not bypass that warning where policy forbids unsigned software.
                    </p>
                </Step>
            </DocSection>

            <DocSection id="authenticate" title="Step 2 — Authenticate the desktop" kicker="02">
                <Step number={1} title="Start browser sign-in from Axiom Agent">
                    <p>
                        The app opens a short-lived pairing flow in your browser. Sign in with the organization identity your administrator configured, review the request, and approve it.
                    </p>
                </Step>
                <Step number={2} title="Return to the installed application">
                    <p>
                        Axiom Agent polls the pairing status and receives a scoped desktop session after approval. A failed, expired, or rejected request remains visible and must not be reported as connected.
                    </p>
                </Step>
            </DocSection>

            <DocSection id="configure" title="Step 3 — Configure integrations" kicker="03">
                <Step number={1} title="Begin with an empty workspace">
                    <p>
                        A fresh installation should show useful empty states. Add only the repositories, applications, environments, clients, and connectors required for the deployment workflow you intend to run.
                    </p>
                </Step>
                <Step number={2} title="Grant least-privilege access">
                    <p>
                        AWS inventory paths require a read-only role and External ID. Azure, GCP, GitHub, communication, and identity features require their own configured credentials and feature availability. The app must show disconnected or unavailable states when those dependencies are absent.
                    </p>
                </Step>
                <Step number={3} title="Test each connector">
                    <p>
                        Use the connector test inside the desktop app. A successful status must come from the real configured integration response; sample connectors and the website sandbox are never presented as live.
                    </p>
                </Step>
            </DocSection>

            <DocSection id="workflow" title="Step 4 — Complete a deployment workflow" kicker="04">
                <ol className="list-decimal list-inside space-y-2 text-zinc-400">
                    <li>Capture deployment intake and required operational context.</li>
                    <li>Resolve readiness checks, missing permissions, and dependencies.</li>
                    <li>Generate or select the versioned playbook.</li>
                    <li>Collect required approvals and separation-of-duties decisions.</li>
                    <li>Follow guided execution; unavailable or failed adapters remain explicit.</li>
                    <li>Run validation or schedule deferred validation with an owner.</li>
                    <li>Collect evidence, review audit history, and close only when exit criteria pass.</li>
                </ol>
                <p>
                    Local Terraform apply is disabled in the current desktop safety contract. Review generated plans and commands, then use an approved execution path for any real change.
                </p>
            </DocSection>

            <DocSection id="trust" title="Trust questions for first launch" kicker="05 · Verify before use">
                <TrustGrid
                    items={[
                        { question: "Where does the product run?", answer: "Operational product screens run in the installed Axiom Agent application. The public site distributes and documents it." },
                        { question: "Why did a browser open?", answer: "The browser is used to authenticate and approve a scoped desktop pairing request. It is not the production application." },
                        { question: "What happens without credentials?", answer: "The relevant connector remains disconnected or unavailable. It must not silently return a mock success." },
                        { question: "Can the sandbox touch production?", answer: "No. The website sandbox uses labeled fictional sample data and cannot execute production operations." },
                        { question: "How are updates installed?", answer: "Updates are currently manual. Check the download page and release notes for a newer verified installer." },
                        { question: "What should I do when a step fails?", answer: "Keep the failure visible, preserve its evidence, correct the dependency or permission, and retry only the affected step." },
                    ]}
                />
            </DocSection>

            <DocSection id="next" title="Next steps">
                <ul className="space-y-2">
                    <li>
                        <Link href="/docs/desktop-install" className="text-violet-300 hover:text-violet-200 font-medium">→ Desktop installation details</Link>
                    </li>
                    <li>
                        <Link href="/docs/aws-setup" className="text-violet-300 hover:text-violet-200 font-medium">→ AWS setup and permissions</Link>
                    </li>
                    <li>
                        <Link href="/demo" className="text-violet-300 hover:text-violet-200 font-medium">→ Explore the isolated product sandbox</Link>
                    </li>
                </ul>
            </DocSection>

            <DocFooterNav
                prev={{ href: "/docs", label: "Documentation overview" }}
                next={{ href: "/docs/desktop-install", label: "Desktop installation" }}
            />
            <DocFeedback />
        </>
    );
}
