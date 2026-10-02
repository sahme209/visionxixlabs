import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Axiom Agent Pilot Access",
  description: "Axiom Agent design-partner access is currently no-charge and invite-only while the governed deployment workflow is validated with real teams.",
};

const PILOT_INCLUDES = [
  "A guided deployment workspace for request, readiness, approval, validation, recovery, and closure.",
  "A browser companion for account settings, help, and connection context.",
  "Read-only GitHub evidence collection scoped to the repositories your team selects.",
  "A documented security and governance review before any production-connected workflow.",
];

const PILOT_BOUNDARIES = [
  "No credit card or self-serve checkout.",
  "No promise that every catalog integration is live.",
  "No autonomous production deployment or bypass of your existing controls.",
  "No use of a sandbox result as proof of a production connection.",
];

export default function PlansPage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center opacity-25" style={{ backgroundImage: "url('/images/axiom-hero-landscape-v1.png')" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(12,13,12,0.66),rgba(12,13,12,0.94)_38%,#0c0d0c)]" />
      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-300">Axiom Agent · design-partner access</p>
          <h1 className="mt-5 max-w-3xl text-[clamp(2.8rem,5vw,5.25rem)] font-medium leading-[0.98] tracking-[-0.055em] text-zinc-100">Start with a no-charge pilot.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">We are proving Axiom&apos;s governed deployment workflow with real teams before publishing paid plans. Pilot workspaces are invite-only, no-charge, and deliberately scoped.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/contact?topic=axiom-pilot" className="inline-flex min-h-12 items-center justify-center rounded-full bg-zinc-100 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-white">Request pilot access</Link>
            <Link href="/demo" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] px-6 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]">Explore the isolated demo</Link>
          </div>
        </div>
        <aside className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.05] p-6 sm:p-7">
          <p className="text-[10px] uppercase tracking-[0.18em] text-violet-200">Current access</p>
          <p className="mt-4 text-2xl font-medium tracking-[-0.035em] text-zinc-100">No charge. No credit card.</p>
          <p className="mt-3 text-sm leading-6 text-zinc-400">We scope each pilot around the release workflow you actually need, then validate what is working before it becomes a production dependency.</p>
        </aside>
      </section>

      <section className="mt-20 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
          <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300">What a pilot includes</p>
          <ul className="mt-6 space-y-4">
            {PILOT_INCLUDES.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-300"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />{item}</li>)}
          </ul>
        </article>
        <article className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-8">
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">What we do not claim yet</p>
          <ul className="mt-6 space-y-4">
            {PILOT_BOUNDARIES.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-400"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />{item}</li>)}
          </ul>
        </article>
      </section>

      <section className="mt-16 rounded-2xl border border-white/[0.08] bg-[#151613] p-6 sm:p-8">
        <p className="text-[10px] uppercase tracking-[0.18em] text-orange-300">The path to a paid workspace</p>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {["Validate the workflow", "Prove repeat value", "Agree the production scope"].map((title, index) => <div key={title}><p className="text-xs text-zinc-600">0{index + 1}</p><h2 className="mt-2 text-lg font-medium text-zinc-100">{title}</h2><p className="mt-2 text-sm leading-6 text-zinc-500">{index === 0 ? "Use the system with real release evidence and explicit guardrails." : index === 1 ? "Confirm it improves clarity, speed, and safety for your operators." : "Only then define support, access, and commercial terms in writing."}</p></div>)}
        </div>
      </section>
      </main>
    </div>
  );
}
