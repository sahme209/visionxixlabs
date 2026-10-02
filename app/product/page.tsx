import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Axiom Agent product",
  description: "A calm, governed workspace for deployment evidence, human approval, recovery context, and honest connection state.",
};

const WORKFLOW = [
  ["01", "Intent", "Bring the requested outcome, repository, environment, and accountable owner into one release record."],
  ["02", "Playbook", "Keep the intended steps, readiness evidence, validation plan, and recovery context together before review."],
  ["03", "Govern", "Surface risk and require the right human authority. A green state never substitutes for an approval."],
  ["04", "Execute", "Guide the approved handoff while keeping a recorded plan distinct from a verified provider action."],
  ["05", "Prove", "Preserve validation, evidence, and closure context so the release remains explainable after production."],
];

const BOUNDARIES = [
  ["GitHub", "Repository-scoped, read-only release evidence is the first source of truth."],
  ["Axiom Agent", "The installed workspace validates provider access and holds consequential deployment operations."],
  ["Web companion", "A lighter signed-in space where approved provider consent, profile, help, and connection context begin."],
];

export default function ProductPage() {
  return (
    <div className="axiom-canvas min-h-screen text-zinc-100">
      <Navigation />
      <main className="overflow-hidden pt-16">
        <section className="border-b border-white/[0.07] px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:px-12 lg:pb-28">
          <div className="mx-auto max-w-6xl">
            <p className="text-[10px] uppercase tracking-[0.22em] text-violet-200">Axiom Agent · governed deployment operations</p>
            <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_0.92fr] lg:items-end">
              <div>
                <h1 className="max-w-3xl text-4xl font-medium leading-[1.02] tracking-[-0.05em] text-zinc-100 sm:text-5xl lg:text-6xl">A quiet place to make releases clear.</h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-zinc-300 sm:text-lg">Axiom brings release facts, readiness, human approval, recovery context, and evidence into one governed record—without pretending a connector or a plan is already a safe deployment.</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/download" className="inline-flex min-h-12 items-center justify-center rounded-full bg-zinc-100 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-white">Download Axiom Agent</Link>
                  <Link href="/plans" className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.14] bg-black/20 px-6 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08]">Explore pilot access</Link>
                </div>
              </div>
              <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-white/[0.13] bg-[#11130f]/85 p-4 shadow-2xl shadow-black/40 sm:p-5">
                <div aria-hidden className="absolute inset-0 -z-20 bg-cover bg-center opacity-60" style={{ backgroundImage: "url('/images/axiom-hero-landscape-v1.png')" }} />
                <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,11,10,0.28),rgba(10,11,10,0.74))]" />
                <div className="rounded-[1rem] border border-white/[0.08] bg-black/25 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Release workspace</p><p className="mt-2 text-lg font-medium text-zinc-100">Production configuration rollout</p></div><span className="rounded-full border border-amber-200/20 bg-amber-200/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-amber-100">Human approval</span></div>
                  <div className="mt-7 grid gap-3 sm:grid-cols-3">{[["Intent", "Repository evidence"], ["Playbook", "Awaiting review"], ["Recovery", "Plan recorded"]].map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">{label}</p><p className="mt-2 text-sm text-zinc-300">{value}</p></div>)}</div>
                  <p className="mt-6 border-t border-white/[0.07] pt-4 text-xs leading-5 text-zinc-500">An illustrative record. Axiom separates recorded evidence from verified live state.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-xl"><p className="text-[10px] uppercase tracking-[0.22em] text-emerald-300">The release, made legible</p><h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-5xl">Intent. Playbook. Govern. Execute. Prove.</h2></div>
          <div className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{WORKFLOW.map(([number, title, detail]) => <article key={number} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7"><p className="text-[10px] tracking-[0.16em] text-violet-300">{number}</p><h3 className="mt-8 text-xl font-medium tracking-[-0.03em] text-zinc-100">{title}</h3><p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">{detail}</p></article>)}</div>
        </section>

        <section className="relative isolate overflow-hidden border-y border-white/[0.07] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div aria-hidden className="absolute inset-0 -z-20 bg-cover bg-center opacity-34" style={{ backgroundImage: "url('/images/axiom-history-landscape-v1.png')" }} />
          <div className="absolute inset-0 -z-10 bg-[#11120f]/78" />
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"><div><p className="text-[10px] uppercase tracking-[0.22em] text-orange-200">Intentional boundaries</p><h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-5xl">The right surface for each job.</h2><p className="mt-5 max-w-md text-base leading-7 text-zinc-300">The browser handles identity, lightweight account context, and approved provider consent. The installed Agent performs validation and keeps deployment operations deliberate.</p></div><div className="grid gap-3">{BOUNDARIES.map(([title, detail]) => <div key={title} className="rounded-2xl border border-white/[0.12] bg-[#10110e]/70 p-5 backdrop-blur-md"><h3 className="text-lg font-medium text-zinc-100">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p></div>)}</div></div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-28"><div className="rounded-3xl border border-violet-300/15 bg-violet-300/[0.045] p-7 sm:p-10"><p className="text-[10px] uppercase tracking-[0.22em] text-violet-200">Design-partner pilot</p><div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-5xl">Prove the workflow before you depend on it.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Pilot access is invite-only and no-charge while Axiom validates the governed release workflow with real teams.</p></div><Link href="/plans" className="shrink-0 rounded-full bg-zinc-100 px-5 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-white">See pilot access</Link></div></div></section>
      </main>
      <Footer />
    </div>
  );
}
