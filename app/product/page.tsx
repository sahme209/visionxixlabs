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
  ["GitHub", "Read-only, repository-scoped release evidence. The first source of truth."],
  ["Axiom Agent", "The installed workspace. Validates provider access and holds every consequential operation."],
  ["Web companion", "A lighter signed-in space for consent, profile, help and connection context."],
];

const PILLARS = [
  ["AI", "Ask about a selected repository and inspect proposed actions. Tools and permissions depend on your version and workflow."],
  ["Governance", "The exact proposal, an independent review, separate execution and the recorded outcome, kept in view. Full Governance Intelligence coverage and activation are not complete."],
  ["Integrations", "GitHub, Airflow and AWS keep scope, dependency evidence and approval context explicit. Operations depend on validated permissions; a preview is not proof of a deployment."],
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
          <div className="mx-auto grid max-w-[1200px] gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center"><div><p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Intentional boundaries</p><h2 className="mt-4 text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-4xl">The right surface for each job.</h2><p className="mt-5 max-w-md text-base leading-7 text-zinc-300">The browser handles identity and consent. The installed Agent validates access and keeps operations deliberate.</p></div><div className="grid gap-3">{BOUNDARIES.map(([title, detail]) => <div key={title} className="rounded-xl border border-white/[0.12] bg-white/[0.025] p-5"><h3 className="text-lg font-medium text-zinc-100">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p></div>)}</div></div>
        </section>

        <section aria-labelledby="govern-any-agent" className="border-y border-white/[0.07] px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Agent governance gateway</p>
              <h2 id="govern-any-agent" className="mt-4 text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-4xl">Govern any AI agent, not just ours.</h2>
              <p className="mt-5 max-w-md text-base leading-7 text-zinc-300">Add Axiom to Cursor, Claude Code, Codex or your own agent as an MCP server. Before a consequential action, the agent asks; a person approves the exact change; the outcome is recorded.</p>
              <p className="mt-4 max-w-md text-sm leading-6 text-zinc-500">Agents report their own actions, so this is a cooperative control point, not a sandbox. Requires an API key with governance scopes.</p>
            </div>
            <ol aria-label="How an agent asks Axiom" className="grid gap-3 sm:grid-cols-2">
              {[
                ["Check", "The agent describes the action. Axiom answers allow, needs approval or deny, with reasons."],
                ["Request", "Deploys, merges, infrastructure, migrations and secrets wait for a workspace admin."],
                ["Approve", "Someone other than the key's creator approves the exact change. It expires in 24 hours."],
                ["Record", "The agent reports what happened. Each step lands in the audit log."],
              ].map(([title, detail], i) => <li key={title} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-5"><p className="font-mono text-xs text-zinc-500">{String(i + 1).padStart(2, "0")}</p><h3 className="mt-2 text-base font-medium text-zinc-100">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-10"><div className="rounded-xl border border-white/[0.1] bg-white/[0.025] p-7 sm:p-10"><p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Choose your next step</p><div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-4xl">Prove it before you depend on it.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Local previews are not evidence of a shipped release. Check the downloads and release notes, then confirm support for your version.</p></div><Link href="/docs/getting-started" className="shrink-0 rounded-lg bg-zinc-100 px-5 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-white">Read the setup guide</Link></div><div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-300"><Link href="/docs/approval-workflow" className="underline underline-offset-4">Read the approval guide</Link><Link href="/integrations" className="underline underline-offset-4">Explore integrations</Link><Link href="/demo" className="underline underline-offset-4">Explore the scripted demo</Link></div></div></section>
      </main>
      <Footer />
    </div>
  );
}
