import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { DocHeader, Callout, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Documentation — Axiom",
  alternates: { canonical: "/docs" },
  description: "Find setup guides, task instructions, control references and recovery guidance for Axiom. Check each guide's version and availability.",
};

const PATHS = [
  { title: "Get started", description: "Set up your workspace, then check what is ready.", items: [
    ["/docs/getting-started", "Start with Axiom", "Understand the setup sequence and prerequisites."],
    ["/docs/desktop-install", "Install the desktop app", "Check platform and installation guidance."],
    ["/docs/quickstart-checklist", "Follow the quickstart checklist", "Separate installation from workflow readiness."],
  ] },
  { title: "Complete a task", description: "Find the workflow, its access requirements and its outcome.", items: [
    ["/docs/approval-workflow", "Understand approval and execution", "Check review and execution steps for your version."],
    ["/docs/releaseops", "Explore ReleaseOps", "Inspect the release workflow and its boundaries."],
    ["/docs/integration-setup", "Set up an integration", "Check connection-specific setup and permissions."],
    ["/docs/source-modes", "Choose a source mode", "Understand where repository context comes from."],
  ] },
  { title: "Look up a control", description: "Understand permissions, plans, surfaces and saved records.", items: [
    ["/docs/permissions-model", "Check the permissions model", "Understand roles and operation-specific access."],
    ["/docs/execution-plans", "Read about execution plans", "Distinguish a recorded plan from an authorized action."],
    ["/docs/surfaces", "Find the right product surface", "Compare where a workflow is presented."],
    ["/docs/glossary", "Look up a term", "Find the vocabulary used in the guides."],
    ["/docs/audit-logs", "Inspect recorded activity", "Understand the scope of saved outcome records."],
  ] },
  { title: "Resolve a problem", description: "Inspect the current state before deciding what to do next.", items: [
    ["/docs/troubleshooting", "Find troubleshooting guidance", "Start with the symptom and inspect existing records."],
    ["/docs/faq", "Read frequently asked questions", "Find answers about setup and product behavior."],
    ["/docs/releaseops/readiness", "Understand release readiness", "Check readiness signals and their limitations."],
  ] },
] as const;

export default function DocsIndexPage() {
  return <>
    <DocHeader number="01" kicker="Axiom documentation" title="Find your next step."
      summary="Start with setup, follow a task, understand a control or investigate an outcome. Choose the guide that matches the work in front of you." />
    <Callout variant="info" title="Version and scope">
      Guides describe different surfaces and stages of availability. Check the installed version, current access and each guide’s preview or supported-scope notes. A guide’s presence does not establish that every operation is available or production-activated.
    </Callout>
    <div className="grid gap-5 md:grid-cols-2 my-10">
      {PATHS.map((group,index)=><section key={group.title} aria-labelledby={`docs-path-${index}`} className="surface-glass rounded-2xl border border-white/[0.08] p-5 sm:p-6">
        <p aria-hidden="true" className="mb-4 font-mono text-[11px] tracking-widest text-brand-coral">0{index+1}</p>
        <h2 id={`docs-path-${index}`} className="text-xl font-semibold tracking-tight text-white">{group.title}</h2>
        <p className="mt-2 mb-5 text-sm leading-relaxed text-zinc-400">{group.description}</p>
        <ul className="space-y-1">{group.items.map(([href,label,description])=><li key={href}>
          <Link href={href} className="group flex items-start justify-between gap-4 rounded-lg px-3 py-3 -mx-3 transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950">
            <span><span className="block text-sm font-medium text-zinc-200 group-hover:text-white">{label}</span><span className="mt-1 block text-xs leading-relaxed text-zinc-400">{description}</span></span>
            <ArrowRightIcon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-zinc-500 group-hover:text-brand-coral" />
          </Link>
        </li>)}</ul>
      </section>)}
    </div>
    <Callout variant="warning" title="When an outcome is unknown">
      Do not resend an uncertain or consumed action. Use the workflow’s read-only history or recovery guidance to inspect the original request. An approval, dispatch acknowledgment or saved plan does not prove a successful deployment, application health or verified rollback.
    </Callout>
    <DocFeedback />
  </>;
}
