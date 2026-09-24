import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
    title: "TAURI Access and Pricing",
    description: "TAURI access is scoped with the Vision XIX Labs team. No unverified self-serve price is advertised.",
};

export default function PlansPage() {
    return (
        <main className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-violet-300">Access and pricing</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Start with the sandbox. Scope production access with us.</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
                The repository contains billing infrastructure for several products, but it does not establish a verified public self-serve TAURI price. We therefore do not publish invented tiers or savings claims.
            </p>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.05] p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Fictional sandbox</p>
                    <h2 className="mt-3 text-2xl font-semibold">Explore without production access</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">Review scripted, clearly labeled sample workflows. No cloud account, deployment, billing event, or customer record is created.</p>
                    <Link href="/demo" className="mt-6 inline-block text-sm font-semibold text-sky-200">Open sandbox →</Link>
                </section>
                <section className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Production workspace</p>
                    <h2 className="mt-3 text-2xl font-semibold">Requirements-based access</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">Pricing and rollout depend on tenant setup, integrations, governance requirements, support, and security review. Contact us for a written scope.</p>
                    <Link href="/contact" className="mt-6 inline-block text-sm font-semibold text-violet-200">Discuss production access →</Link>
                </section>
            </div>
            <p className="mt-8 text-sm text-zinc-500">No credit-card checkout or fixed TAURI subscription price is promised on this page.</p>
        </main>
    );
}
