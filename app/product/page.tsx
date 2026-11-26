import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { WorkflowEvidenceMap } from "@/components/marketing/WorkflowEvidenceMap";
import { CinematicAxiomDemo } from "@/components/marketing/CinematicAxiomDemo";
import { PublicFeaturePanel } from "@/components/marketing/PublicFeaturePanel";
import { PageHero } from "@/components/marketing/PageHero";
import { ControlPlaneModel } from "@/components/marketing/ControlPlaneModel";
import { ProductTour } from "@/components/marketing/ProductTour";
import { ArchitectureMap } from "@/components/docs/ArchitectureMap";
import { GovernedDeploymentModel } from "@/components/marketing/GovernedDeploymentModel";
import { GovernanceAssembly } from "@/components/marketing/GovernanceAssembly";
import { ProductDisclosure } from "@/components/marketing/ProductDisclosure";

export const metadata: Metadata = {
  title: "V19 product",
  description: "A calm, governed workspace for deployment evidence, human approval, recovery context, and honest connection state.",
};

const BOUNDARIES = [
  ["GitHub", "Read-only, repository-scoped release evidence. The first source of truth."],
  ["V19", "The installed workspace. Validates provider access and holds every consequential operation."],
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
            <PageHero eyebrow="V19 · deployment governance" title="Deployment decisions." muted="Clear from the start." lead="A workspace for deployment proposals, review, and recorded outcomes. Explore the workflow, then check which controls your installed version supports." actions={<>
              <Link href="/download" className="orbit-primary">Download V19</Link>
              <Link href="/docs/approval-workflow" className="orbit-secondary">Read the workflow guide <span aria-hidden="true">↗</span></Link>
            </>} />
            <div role="group" aria-labelledby="workflow-overview">
              <h2 id="workflow-overview" className="sr-only">Conceptual release workflow</h2>
              <WorkflowEvidenceMap />
            </div>
          </div>
        </section>

        <section className="public-feature-section public-product-features" aria-label="Product surfaces and agent governance">
          <PublicFeaturePanel eyebrow="Intentional boundaries" title="The right surface for each job." headingLevel="h2" visualLabel="Product surfaces · explanatory diagram"
            copy="The browser handles identity and consent. The installed Agent validates access and keeps operations deliberate."
            visual={<div className="public-boundary-list">{BOUNDARIES.map(([title, detail]) => <div key={title}><h3>{title}</h3><p>{detail}</p></div>)}</div>}
            action={{ href: "/docs/surfaces", label: "Compare product surfaces" }} />
          <PublicFeaturePanel reverse eyebrow="Agent governance gateway" title="Govern any AI agent, not just ours." titleId="govern-any-agent" headingLevel="h2" visualLabel="Cooperative workflow · explanatory diagram"
            copy="Add V19 to Cursor, Claude Code, Codex or your own agent as an MCP server. Before a consequential action, the agent asks; a person approves the exact change; the outcome is recorded."
            visual={<ol aria-label="How an agent asks V19" className="public-boundary-list">
              {[
                ["Check", "The agent describes the action. V19 answers allow, needs approval or deny, with reasons."],
                ["Request", "Deploys, merges, infrastructure, migrations and secrets wait for a workspace admin."],
                ["Approve", "Someone other than the key's creator approves the exact change. It expires in 24 hours."],
                ["Record", "The agent reports what happened. Each step lands in the audit log."],
              ].map(([title, detail], i) => <li key={title}><span>{String(i + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{detail}</p></li>)}
            </ol>}
            action={{ href: "/docs/agent-gateway", label: "Read the gateway guide" }}>
            <p className="public-feature-note">Agents report their own actions, so this is a cooperative control point, not a sandbox. Requires an API key with governance scopes.</p>
          </PublicFeaturePanel>
        </section>

        <ProductDisclosure id="deployment-model" title="Inspect deployment scenarios and stages">
          <p>Explore sample approved, blocked, rejected, unknown and recovery paths. This model performs no live action and does not establish production enforcement.</p>
          <GovernedDeploymentModel />
        </ProductDisclosure>
        <ProductDisclosure id="decision-records" title="Inspect the records behind a decision">
          <p>Follow scope, proposal, independent review, separate execution and recorded evidence. These are conceptual records, not permission or a provider receipt.</p>
          <section aria-label="Inside a deployment decision" className="px-5 pb-8 sm:px-8"><GovernanceAssembly /></section>
        </ProductDisclosure>

        <ControlPlaneModel />
        <ProductTour heading="Walk through the desktop app" />
        <section aria-label="How V19 fits together" className="mx-auto max-w-[1080px] px-5 pt-12 sm:px-8"><ArchitectureMap /></section>

        <section aria-labelledby="scripted-preview" className="mx-auto max-w-[1280px] px-5 pt-12 sm:px-8 lg:px-10">
          <h2 id="scripted-preview" className="text-xl font-medium tracking-[-0.03em] text-zinc-100">Scripted interactive preview</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Sample data illustrates the workflow. This preview does not run provider actions and does not establish released functionality.</p>
          <CinematicAxiomDemo variant="hero" />
        </section>


        <section className="border-y border-white/[0.07] bg-brand-ink px-5 py-16 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-[1200px]">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">AI · Governance · Integrations</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-4xl">Context for the agent. Control for your team.</h2>
            <div className="mt-10 grid gap-3 md:grid-cols-3">{PILLARS.map(([title, detail]) => <article key={title} className="rounded-xl border border-white/8 bg-white/2.5 p-6 sm:p-7"><h3 className="text-lg font-medium tracking-[-0.02em] text-zinc-100">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-400">{detail}</p></article>)}</div>
          </div>
        </section>



        <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-10"><div className="rounded-xl border border-white/10 bg-white/2.5 p-7 sm:p-10"><p className="text-[10px] uppercase tracking-[0.22em] text-zinc-400">Choose your next step</p><div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-3xl font-medium tracking-[-0.045em] text-zinc-100 sm:text-4xl">Prove it before you depend on it.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Local previews are not evidence of a shipped release. Check the downloads and release notes, then confirm support for your version.</p></div><Link href="/docs/getting-started" className="shrink-0 rounded-lg bg-zinc-100 px-5 py-3 text-center text-sm font-semibold text-zinc-950 transition hover:bg-white">Read the setup guide</Link></div><div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-300"><Link href="/docs/approval-workflow" className="underline underline-offset-4">Read the approval guide</Link><Link href="/integrations" className="underline underline-offset-4">Explore integrations</Link><Link href="/demo" className="underline underline-offset-4">Explore the scripted demo</Link></div></div></section>
      </main>
      <Footer showCta={false} />
    </div>
  );
}
