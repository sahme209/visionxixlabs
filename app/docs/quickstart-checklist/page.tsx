import type { Metadata } from "next";
import Link from "next/link";
import {
    ArrowRightIcon,
    CheckCircleIcon,
    CloudIcon,
    CommandLineIcon,
    CpuChipIcon,
    ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Callout, DocFeedback, DocHeader } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
    title: "Quickstart Checklist — Axiom Agent | VisionXIXLabs",
    description: "A verified checklist for installing Axiom Agent and completing a first non-production deployment workflow.",
};

interface ChecklistItem {
    num: string;
    title: string;
    body: string;
    status: string;
    link?: { href: string; label: string };
}

const STEPS: readonly ChecklistItem[] = [
    {
        num: "01",
        title: "Download the correct installer",
        body: "Use the live release manifest to choose the build matching your operating system and architecture. Review the displayed signing or notarization status before installing.",
        status: "release-backed",
        link: { href: "/download", label: "Download Axiom Agent" },
    },
    {
        num: "02",
        title: "Install and launch Axiom Agent",
        body: "Follow the platform instructions. Do not bypass an unsigned-software warning where your organization forbids unsigned applications.",
        status: "platform-specific",
        link: { href: "/docs/desktop-install", label: "Installation guide" },
    },
    {
        num: "03",
        title: "Complete desktop authentication",
        body: "Start sign-in from the installed app. Approve the short-lived pairing request in your browser, then return to Axiom Agent. The browser flow authenticates the desktop; it is not a hosted product.",
        status: "identity required",
    },
    {
        num: "04",
        title: "Confirm the empty workspace",
        body: "Before adding data, verify that catalogs, requests, approvals, evidence, and integrations show explicit empty or disconnected states instead of fictional records.",
        status: "no sample fallback",
    },
    {
        num: "05",
        title: "Configure one safe integration",
        body: "Use a dedicated non-production account and least-privilege credentials. AWS has a read-only inventory path; Azure, GCP, GitHub, communication, and identity paths depend on configuration and verified availability.",
        status: "connector-dependent",
        link: { href: "/docs/aws-setup", label: "AWS setup guide" },
    },
    {
        num: "06",
        title: "Create and review a deployment request",
        body: "Capture intake, resolve readiness checks, choose the versioned playbook, and collect the required approvals. Missing permissions or rejected approvals must block progression.",
        status: "approval-gated",
        link: { href: "/docs/approval-workflow", label: "Approval workflow" },
    },
    {
        num: "07",
        title: "Validate, collect evidence, and close",
        body: "Use only a safe execution path, record observed validation, preserve evidence, and close when exit criteria pass. Local Terraform apply is disabled in the current desktop safety contract.",
        status: "human-confirmed",
        link: { href: "/docs/execution-plans", label: "Execution plans" },
    },
];

export default function QuickstartChecklistPage() {
    return (
        <>
            <DocHeader
                number="02"
                kicker="Quickstart"
                title="Install, configure, and verify your first workflow."
                summary="Seven concrete steps for the downloadable application. Timing depends on your operating system, identity provider, connector permissions, and deployment scope."
            />

            <Callout variant="safe" title="Use a non-production environment first">
                This checklist does not authorize production changes. Use dedicated test accounts and least-privilege credentials. The website sandbox is isolated sample data; the installed app must display actual connection and operation results.
            </Callout>

            <ol className="relative space-y-3 mb-12">
                <span aria-hidden className="absolute left-[26px] top-3 bottom-3 w-px bg-gradient-to-b from-brand-coral/40 via-brand-violet/30 to-transparent" />
                {STEPS.map((step) => (
                    <li key={step.num} className="relative rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 pl-16 hover:border-brand-coral/25 hover:bg-brand-coral/[0.02] transition-all">
                        <span className="absolute left-4 top-5 w-9 h-9 rounded-full bg-gradient-to-br from-brand-coral/15 to-brand-violet/15 border border-brand-coral/30 flex items-center justify-center text-[11px] font-mono font-semibold text-brand-coral tabular-nums">
                            {step.num}
                        </span>
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className="text-[15px] font-semibold text-white leading-tight">{step.title}</h3>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 whitespace-nowrap mt-1">{step.status}</span>
                        </div>
                        <p className="text-[13.5px] text-zinc-400 leading-relaxed mb-3">{step.body}</p>
                        {step.link && (
                            <Link
                                href={step.link.href}
                                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-coral/90 hover:text-brand-coral transition-colors"
                            >
                                {step.link.label}
                                <ArrowRightIcon className="h-3 w-3" />
                            </Link>
                        )}
                    </li>
                ))}
            </ol>

            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6 mb-12">
                <header className="flex items-center gap-2 mb-3">
                    <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                    <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-400">
                        Completion evidence
                    </p>
                </header>
                <ul className="space-y-2 text-[13.5px] text-zinc-300 leading-relaxed">
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Installed version and architecture recorded.</li>
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Desktop pairing approved and session state visible.</li>
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Connector result reflects the real configured service.</li>
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Request, approval, validation, evidence, and closure states persisted.</li>
                    <li className="flex items-start gap-2"><span className="text-emerald-400 mt-0.5">✓</span> Any blocked or unavailable capability remains explicitly labeled.</li>
                </ul>
            </section>

            <section>
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500 mb-4">Read next</p>
                <div className="grid sm:grid-cols-2 gap-3">
                    {[
                        { href: "/docs/security-model", icon: ShieldCheckIcon, title: "Security model", desc: "Access, storage, tenant boundaries, and revocation." },
                        { href: "/docs/best-practices", icon: CpuChipIcon, title: "Best practices", desc: "Readiness, approval, validation, and operational safeguards." },
                        { href: "/docs/scanning", icon: CloudIcon, title: "Scanning", desc: "Available provider paths, evidence sources, and failure states." },
                        { href: "/docs/desktop-install", icon: CommandLineIcon, title: "Desktop installation", desc: "Platform requirements, signing status, first launch, and updates." },
                    ].map((card) => {
                        const Icon = card.icon;
                        return (
                            <Link key={card.href} href={card.href} className="group rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 hover:border-brand-coral/25 hover:bg-brand-coral/[0.03] transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon className="h-4 w-4 text-brand-coral/70 group-hover:text-brand-coral transition-colors" />
                                    <p className="text-[14px] font-semibold text-white">{card.title}</p>
                                </div>
                                <p className="text-[12.5px] text-zinc-400 leading-snug">{card.desc}</p>
                            </Link>
                        );
                    })}
                </div>
            </section>

            <DocFeedback />
        </>
    );
}
