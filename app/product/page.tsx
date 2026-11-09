import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { WorkflowEvidenceMap } from "@/components/marketing/WorkflowEvidenceMap";
import { CinematicAxiomDemo } from "@/components/marketing/CinematicAxiomDemo";
import { ControlPlaneModel } from "@/components/marketing/ControlPlaneModel";

export const metadata: Metadata = {
  title: "Axiom Agent product",
  description: "A calm, governed workspace for deployment evidence, human approval, recovery context, and honest connection state.",
};

const BOUNDARIES = [
  ["GitHub", "Repository-scoped, read-only release evidence is the first source of truth."],
  ["Axiom Agent", "The installed workspace validates provider access and holds consequential deployment operations."],
  ["Web companion", "A lighter signed-in space where approved provider consent, profile, help, and connection context begin."],
];

const PILLARS = [
  ["AI", "Use selected repository context to ask questions and inspect proposed actions. Available tools and permissions depend on the installed version and enabled workflow."],
  ["Governance", "Keep the exact proposal, independent review, separate requester execution, and recorded outcome in view where supported. Full Governance Intelligence coverage and activation are not complete."],
  ["Integrations", "GitHub, Airflow, and AWS workflows keep repository scope, dependency evidence, and approval context explicit. Available operations depend on the connected account and validated provider permissions; a preview is not proof of a completed deployment."],
];

export default function ProductPage() {
  return (
    <div className="axiom-canvas min-h-screen text-zinc-100">
      <Navigation />
      <main className="overflow-hidden pt-16">
        <section className="border-b border-white/[0.07] px-5 pb-14 pt-16 sm:px-8 sm:pt-24 lg:px-10 lg:pb-20">
          <div className="mx-auto max-w-[1200px]">
            <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">Axiom Agent · deployment governance</p>
                <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-[1.04] tracking-[-0.045em] text-zinc-100 sm:text-5xl lg:text-6xl">Deployment decisions.<span className="block text-zinc-400">Clear from the start.</span></h1>
              </div>
              <div className="max-w-xl">
                <p className="text-base leading-7 text-zinc-300 sm:text-lg">A workspace for deployment proposals, review, and recorded outcomes. Explore the workflow, then check which controls your installed version supports.</p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:flex-wrap">
                  <Link href="/download" className="inline-flex min-h-12 items-center justify-center rounded-lg bg-zinc-100 px-6 text-sm font-semibold text-zinc-950 transition hover:bg-white">Download Axiom Agent</Link>
                  <Link href="/docs/approval-workflow" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/[0.14] bg-black/20 px-6 text-sm font-medium text-zinc-100 transition hover:bg-white/[0.08]">Read the workflow guide</Link>
                </div>
              </div>
            </div>
            <div aria-labelledby="workflow-overview">
              <h2 id="workflow-overview" className="sr-only">Conceptual release workflow</h2>
              <WorkflowEvidenceMap />
            </div>
          </div>
        </section>

        <ControlPlaneModel />

        <section aria-labelledby="scripted-preview" className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-8 lg:px-10">
          <h2 id="scripted-preview" className="text-xl font-medium tracking-[-0.03em] text-zinc-100">Scripted interactive preview</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Sample data illustrates the workflow. This preview does not run provider actions and does not establish released functionality.</p>
          <CinematicAxiomDemo variant="hero" />
        </section>


        <section className="border-y border-white/[0.07] bg-[#141414] px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1200px]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">AI · Governance · Integrations</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-4xl">Context for the agent. Control for your team.</h2>
            <div className="mt-10 grid gap-3 md:grid-cols-3">{PILLARS.map(([title, detail]) => <article key={title} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-6 sm:p-7"><h3 className="text-lg font-medium tracking-[-0.02em] text-zinc-100">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-400">{detail}</p></article>)}</div>
          </div>
        </section>

        <section className="relative isolate overflow-hidden border-y border-white/[0.07] px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"><div><p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Intentional boundaries</p><h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-4xl">The right surface for each job.</h2><p className="mt-5 max-w-md text-base leading-7 text-zinc-300">The browser handles identity, lightweight account context, and approved provider consent. The installed Agent performs validation and keeps deployment operations deliberate.</p></div><div className="grid gap-3">{BOUNDARIES.map(([title, detail]) => <div key={title} className="rounded-xl border border-white/[0.12] bg-white/[0.025] p-5"><h3 className="text-lg font-medium text-zinc-100">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p></div>)}</div></div>
        </section>

        <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-10"><div className="rounded-xl border border-white/[0.1] bg-white/[0.025] p-7 sm:p-10"><p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Choose your next step</p><div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-4xl">Prove the workflow before you depend on it.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Local previews are not evidence of a shipped release. Check available downloads and their release information for what is offered; confirm version-specific support before depending on an operation.</p></div><Link href="/docs/getting-started" className="shrink-0 rounded-lg bg-zinc-100 px-5 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-white">Get started</Link></div><div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-300"><Link href="/docs/approval-workflow" className="underline underline-offset-4">Read the approval guide</Link><Link href="/integrations" className="underline underline-offset-4">Explore integrations</Link><Link href="/demo" className="underline underline-offset-4">Explore the scripted demo</Link></div></div></section>
      </main>
      <Footer />
    </div>
  );
}
