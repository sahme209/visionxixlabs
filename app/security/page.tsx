import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Security and governance",
  description: "Understand Axiom's access, review, credential and outcome boundaries, with explicit verification limits.",
  alternates: { canonical: "/security" },
};
const SEQUENCE = [
  ["Current access", "Check the actor, workspace, provider connection and exact target. A connected label is not permission for every action."],
  ["Exact proposal", "Inspect what would change, its source and scope, and the proposed validation and recovery steps."],
  ["Independent review", "Check which review the selected workflow requires, who may decide and whether the exact decision is still valid."],
  ["Deliberate execution", "Confirm the requester and current authority again. A saved plan or approval alone is not a provider outcome."],
  ["Outcome and recovery", "Distinguish confirmed, refused and unknown results. Inspect history before recovery; do not resend an uncertain action."],
] as const;
const AREAS = [
  {title:"Identity and current permissions",detail:"The desktop uses a browser handoff and scoped session. Role and action checks belong in the service; interface visibility does not grant authority.",href:"/docs/permissions-model",label:"Read the permissions model"},
  {title:"Credentials and stored content",detail:"Credential custody differs by connector. Native session-vault and server redaction code exist, but packaged persistence, provider scopes, revocation and recovery need their own verification.",href:"/docs/security-model",label:"Read the security model"},
  {title:"Review and execution boundaries",detail:"Exact review, requester execution and platform checks depend on the operation and installed version. Full Governance Intelligence coverage and activation are not complete.",href:"/docs/approval-workflow",label:"Understand the approval workflow"},
  {title:"Recorded outcomes and audit context",detail:"Supported paths record actors, decisions and outcomes. A saved record, green workflow or rollback instruction does not by itself prove application health or successful recovery.",href:"/docs/audit-logs",label:"Understand recorded activity"},
] as const;
const LIMITS = [
  "Signing, installation, saved sessions and update trust are release- and platform-specific. Check the actual download and installation facts.",
  "AWS validation needs the configured broker and customer IAM setup; inventory/security analysis remains preview-grade. Azure and GCP provider-specific live paths have their own unfinished verification.",
  "Local Terraform apply remains disabled. A generated artifact is for review, not evidence that a change ran.",
  "Tenant isolation, retention, backup/restore, incident response and every relevant permission path need deployment-specific security assessment.",
];
export default function SecurityPage(){
 return <div className="axiom-canvas min-h-screen text-zinc-100"><Navigation/>
  <main className="mx-auto max-w-[1280px] space-y-14 px-5 pb-20 pt-28 sm:px-8 lg:px-10 lg:pt-36">
   <header className="max-w-3xl space-y-5"><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">Axiom · Security</p><h1 className="text-[clamp(2.5rem,5vw,4.5rem)] font-medium leading-[1.05] tracking-[-0.05em]">Know the boundary.<br/><span className="text-zinc-500">Verify the workflow.</span></h1><p className="text-base leading-7 text-zinc-400 sm:text-lg">Understand the access, decision and evidence behind an action. Assess the exact workflow and version instead of relying on a badge or a broad promise.</p><p className="text-sm leading-6 text-zinc-500">This page describes source-level controls and known limits. It is not a completed security assessment or proof that every deployment path is qualified.</p></header>
   <section aria-labelledby="action-assessment"><h2 id="action-assessment" className="text-xl font-medium tracking-tight">How to assess an action</h2><ol aria-label="How to assess an action" className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{SEQUENCE.map(([title,detail],i)=><li key={title} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-xs tabular-nums text-zinc-500">{String(i+1).padStart(2,"0")}</p><h3 className="mt-4 text-sm font-medium text-zinc-100">{title}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p></li>)}</ol></section>
   <section aria-labelledby="control-areas"><div className="max-w-2xl"><h2 id="control-areas" className="text-2xl font-medium tracking-tight">Inspect a specific control.</h2><p className="mt-3 text-sm leading-6 text-zinc-400">Implementation notes are not independent assurance. Follow the relevant guide, then verify the configured operation.</p></div><div className="mt-6 grid gap-3 md:grid-cols-2">{AREAS.map(area=><article key={area.title} className="flex flex-col rounded-2xl border border-white/10 p-6"><h3 className="text-base font-medium">{area.title}</h3><p className="mb-4 mt-3 text-sm leading-6 text-zinc-400">{area.detail}</p><Link href={area.href} className="mt-auto inline-flex min-h-11 items-center text-sm text-zinc-200 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300">{area.label} →</Link></article>)}</div></section>
   <section aria-labelledby="ai-data-boundary" className="max-w-3xl border-t border-white/10 pt-7"><h2 id="ai-data-boundary" className="text-xl font-medium">Data and AI boundaries</h2><p className="mt-3 text-sm leading-7 text-zinc-400">Before sharing context with an AI provider, verify the selected provider, data sent and applicable policy. This page makes no guarantee about provider retention or model training, and does not establish an offline or no-egress deployment. Local-AI and enterprise offline work remain separate acceptance requirements.</p><p className="mt-3 text-sm leading-7 text-zinc-400">Redaction utilities on selected paths are not proof that arbitrary input is free of secrets. Do not include credentials or sensitive execution data in a support request.</p></section>
   <section aria-labelledby="current-security-limits" className="rounded-2xl border border-white/15 bg-white/[0.025] p-6"><h2 id="current-security-limits" className="text-xl font-medium">Current limits</h2><ul className="mt-5 space-y-3 text-sm leading-7 text-zinc-400">{LIMITS.map(x=><li key={x} className="flex gap-3"><span aria-hidden="true">—</span><span>{x}</span></li>)}</ul><p className="mt-5 border-t border-white/10 pt-5 text-sm leading-7 text-zinc-400">No independent certification is claimed. Product design principles are not SOC 2, ISO 27001, HIPAA, CMMC or FedRAMP assurance, a customer risk assessment, or a guarantee against vulnerabilities. Required agreements, vendor review and independent evidence remain deployment-specific.</p></section>
   <section className="flex flex-col items-start justify-between gap-5 border-t border-white/10 pt-7 sm:flex-row"><div><h2 className="text-xl font-medium">Need a boundary explained?</h2><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">Read the security guide or use the published contact route. Share the affected surface and version without sending secrets.</p></div><Link href="/contact" className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-white/20 px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300">Contact the team →</Link></section>
  </main><Footer/>
 </div>;
}
