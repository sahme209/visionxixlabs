import Link from "next/link";
import {
    ArrowRightIcon,
    CheckCircleIcon,
    BeakerIcon,
    ClockIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import {
    capabilityStateLabel,
    integrationInventory,
    tauriCapabilities,
    type CapabilityState,
} from "@/lib/product/tauriCapabilityInventory";

const stateStyle: Record<CapabilityState, { icon: typeof CheckCircleIcon; className: string }> = {
    working_tested: { icon: CheckCircleIcon, className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" },
    demo_sandbox: { icon: BeakerIcon, className: "border-sky-500/30 bg-sky-500/10 text-sky-200" },
    planned_blocked: { icon: ClockIcon, className: "border-amber-500/30 bg-amber-500/10 text-amber-200" },
};

const workflow = [
    ["1", "Capture the request", "Record scope, window, repository, approvals, validation, rollback, and ownership."],
    ["2", "Build the playbook", "Turn confirmed facts into ordered steps. Missing inputs remain blockers instead of invented details."],
    ["3", "Review the change", "Use approval queues and change context before any governed action can proceed."],
    ["4", "Guide execution", "Walk the operator through one step at a time. The TAURI workflow is currently a sandbox and performs no production command."],
    ["5", "Validate and preserve evidence", "Capture outcomes in the authenticated evidence and audit surfaces when work is performed in the product."],
] as const;

export default function HomePage() {
    return (
        <div className="min-h-screen bg-[#09090b] text-white">
            <Navigation />
            <main>
                <section className="border-b border-white/[0.07] px-5 pb-20 pt-32 sm:px-8 sm:pt-40">
                    <div className="mx-auto max-w-6xl">
                        <p className="mb-5 font-mono text-xs uppercase tracking-[0.24em] text-violet-300">TAURI · deployment operations</p>
                        <div className="grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
                            <div>
                                <h1 className="max-w-4xl text-5xl font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
                                    Turn a deployment request into a governed playbook.
                                </h1>
                                <p className="mt-7 max-w-3xl text-lg leading-8 text-zinc-300">
                                    TAURI is a web application for structured deployment intake, approval and change tracking,
                                    guided execution, validation, evidence, audit history, and runbooks. It keeps unknowns visible
                                    and requires people to approve consequential work.
                                </p>
                                <div className="mt-9 flex flex-wrap gap-3">
                                    <Link href="/auth/signup?redirect=/dashboard" className="inline-flex items-center gap-2 rounded-full bg-violet-500 px-6 py-3 text-sm font-semibold hover:bg-violet-400">
                                        Create a web workspace <ArrowRightIcon className="h-4 w-4" />
                                    </Link>
                                    <Link href="/demo" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-zinc-200 hover:bg-white/5">
                                        Explore the labeled sandbox
                                    </Link>
                                </div>
                            </div>
                            <aside className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-5 text-sm leading-6 text-amber-100">
                                <p className="font-semibold">Web access is the supported customer path.</p>
                                <p className="mt-2 text-amber-100/75">
                                    No current desktop installer has been verified for customer distribution. Historical developer
                                    artifacts are not presented as a supported download.
                                </p>
                            </aside>
                        </div>
                    </div>
                </section>

                <section id="workflow" className="px-5 py-20 sm:px-8">
                    <div className="mx-auto max-w-6xl">
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">How the verified workflow works</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From request to evidence, without hidden automation.</h2>
                        <div className="mt-10 grid gap-3 lg:grid-cols-5">
                            {workflow.map(([number, title, description]) => (
                                <article key={number} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-5">
                                    <p className="font-mono text-xs text-violet-300">{number.padStart(2, "0")}</p>
                                    <h3 className="mt-4 font-semibold">{title}</h3>
                                    <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="capabilities" className="border-y border-white/[0.07] bg-white/[0.015] px-5 py-20 sm:px-8">
                    <div className="mx-auto max-w-6xl">
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Capability inventory</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">What works today—and what does not.</h2>
                        <p className="mt-4 max-w-3xl text-zinc-400">Every capability is labeled from repository evidence. Sandbox interactions never represent production activity.</p>
                        <div className="mt-10 grid gap-4 md:grid-cols-2">
                            {tauriCapabilities.map((capability) => {
                                const style = stateStyle[capability.state];
                                const Icon = style.icon;
                                return (
                                    <article key={capability.id} className="rounded-2xl border border-white/[0.08] bg-[#0d0d11] p-6">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <h3 className="text-lg font-semibold">{capability.name}</h3>
                                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${style.className}`}>
                                                <Icon className="h-3.5 w-3.5" /> {capabilityStateLabel[capability.state]}
                                            </span>
                                        </div>
                                        <p className="mt-4 text-sm leading-6 text-zinc-300">{capability.publicDescription}</p>
                                        <p className="mt-3 text-xs leading-5 text-zinc-500"><span className="text-zinc-400">Current limitation:</span> {capability.limitation}</p>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section id="integrations" className="px-5 py-20 sm:px-8">
                    <div className="mx-auto max-w-6xl">
                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Integrations</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Connected only after your workspace is configured.</h2>
                        <div className="mt-9 overflow-hidden rounded-2xl border border-white/[0.08]">
                            {integrationInventory.map((integration) => (
                                <div key={integration.name} className="grid gap-2 border-b border-white/[0.07] p-5 last:border-b-0 sm:grid-cols-[180px_220px_1fr]">
                                    <strong className="text-sm">{integration.name}</strong>
                                    <span className="text-sm text-violet-300">{integration.level}</span>
                                    <span className="text-sm leading-6 text-zinc-400">{integration.note}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-t border-white/[0.07] px-5 py-20 text-center sm:px-8">
                    <h2 className="text-3xl font-semibold tracking-tight">See the real product boundary.</h2>
                    <p className="mx-auto mt-4 max-w-2xl text-zinc-400">Use the fictional sandbox to understand the flow, or create a workspace for tenant-scoped records and honest empty states.</p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <Link href="/demo" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold hover:bg-white/5">Open sandbox demo</Link>
                        <Link href="/auth/signin" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-200">Sign in to the web app</Link>
                        <Link href="/contact" className="rounded-full border border-violet-500/40 px-6 py-3 text-sm font-semibold text-violet-200 hover:bg-violet-500/10">Contact the team</Link>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
