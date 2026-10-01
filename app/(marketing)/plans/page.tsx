import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Axiom Agent Access and Pricing",
  description: "Axiom Agent design-partner access is currently no-charge and scoped with the Vision XIX Labs team. No unverified self-serve price is advertised.",
};

export default function PlansPage() {
    return (
        <main className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-violet-300">Access and pricing</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">Start with a no-charge pilot. Scope production access with us.</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">
                Axiom Agent is in its design-partner phase. We are not charging pilot customers or publishing a self-serve price while we validate the governed deployment workflow with real users.
            </p>
            <div className="mt-12 grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.05] p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-300">Fictional sandbox</p>
                    <h2 className="mt-3 text-2xl font-semibold">Explore without production access</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">Review scripted, clearly labeled sample workflows. No cloud account, deployment, billing event, or customer record is created.</p>
                    <Link href="/demo" className="mt-6 inline-block text-sm font-semibold text-sky-200">Open sandbox →</Link>
                </section>
                <section className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">Design-partner pilot</p>
                    <h2 className="mt-3 text-2xl font-semibold">Free, invite-only, and governed</h2>
                    <p className="mt-3 text-sm leading-6 text-zinc-400">Pilot workspaces are explicitly provisioned after a fit, integration, governance, and security review. No credit card is required, and pilot access does not weaken approval or production safeguards.</p>
                    <Link href="/contact?topic=axiom-pilot" className="mt-6 inline-block text-sm font-semibold text-violet-200">Apply for pilot access →</Link>
                </section>
            </div>
            <p className="mt-8 text-sm text-zinc-500">No credit-card checkout, fixed price, or promise of unrestricted production access is made on this page.</p>
        </main>
    );
}
