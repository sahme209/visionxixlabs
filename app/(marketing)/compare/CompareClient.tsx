"use client";

import Link from "next/link";
import {useState} from "react";
import {PageHero} from "@/components/marketing/PageHero";

type EvidenceRow = readonly [question:string,axiom:string,alternative:string];
const OPTIONS = [
  {
    id:"team",label:"A team",alternative:"Your team",lead:"Compare responsibilities and evidence for the work you actually need done.",
    rows:[
      ["Cost","Check the current plan, model rates and actual usage. Purchases may be unavailable.","Use your own hiring, compensation, tooling and operating costs."],
      ["Time to a useful proposal","Measure setup and review time on a representative repository.","Measure onboarding and delivery time for the same bounded task."],
      ["Continuity","Inspect retained records, authorship and recovery when someone leaves.","Inspect your team's documentation, handoffs and ownership coverage."],
      ["Availability","Verify the supported workflow, service dependencies and failure behavior.","Check staffing, on-call commitments and escalation arrangements."],
      ["Domain depth","Test a specific problem with a qualified reviewer. AI output still needs review.","Assess the relevant expertise and who handles unusual cases."],
      ["Provenance","Inspect the actual audit records and their integrity limits for your version.","Inspect the records retained by your team's process and tools."],
      ["Independent approval","Verify the exact action, reviewer separation and currently supported gate. Full Governance is incomplete.","Verify the approval policy and how your team enforces separation."],
      ["Onboarding","Follow the setup guide and check required connections and permissions.","Check training, access provisioning and documentation effort."],
    ] satisfies readonly EvidenceRow[],
  },
  {
    id:"ai_tools",label:"AI tools",alternative:"Your chosen AI tool",lead:"Compare the same tool version, permissions, repository and task. Capabilities vary with configuration.",
    rows:[
      ["Code changes","Check editing, saving and publishing support in your installed version.","Check the editor, review and publishing workflow you would use."],
      ["Cloud evidence","Verify supported connector operations and the scope of their access.","Verify available connectors and the permissions each operation needs."],
      ["Incident analysis","Check evidence freshness, cited sources and uncertainty in the response.","Check the same evidence and uncertainty on the same incident."],
      ["Change previews","A configuration or simulation preview does not prove a production-equivalent rehearsal.","Establish what the preview actually runs and what remains untested."],
      ["Decision rules","Inspect the configured decision rules; a model vote is not a human approval.","Inspect the chosen tool's decision and approval boundaries."],
      ["Approval context","Inspect the proposed action, target, reviewer and expiry in the supported workflow.","Check what the approver sees and which exact effect is authorized."],
      ["Validation","Check runtime validation as well as types. Compilation is not universal execution admission.","Check validation at the actual tool and execution boundaries."],
      ["Recorded outcomes","Inspect retained decisions and results. A record does not make an action safe to replay.","Check persistence, outcome verification and handling of uncertain results."],
      ["IDE integration","Check the cooperative agent gateway and its scopes; it is not an execution sandbox.","Check the native editor experience and external tool boundaries."],
    ] satisfies readonly EvidenceRow[],
  },
  {
    id:"saas_stack",label:"A SaaS stack",alternative:"Your configured stack",lead:"Compare integration work and verified workflow behavior. A shared interface does not replace every specialist tool.",
    rows:[
      ["Total cost","Use the current V19 rates and the costs of any connected services.","Use actual vendor quotes, usage charges and integration maintenance."],
      ["Change scope","Inspect classification and policy support for the exact operation.","Inspect each tool's scope, policy and handoff responsibilities."],
      ["Timeline","Check which records are correlated and whether timestamps and sources are current.","Check how your stack correlates the same source events."],
      ["Compliance assistance","Control mapping is not certification; verify current evidence coverage.","Verify the controls and evidence actually supplied by each service."],
      ["Execution and recovery","A proposal or accepted dispatch does not verify execution, health or recovery.","Verify those outcomes through your own configured deployment workflow."],
      ["Approval boundaries","Inspect current roles, reviewer separation and exact action limits.","Inspect cross-tool roles, approval policy and bypass paths."],
      ["Model availability","Check enabled providers, rate limits and credits. Do not assume a free fallback.","Check provider availability, model selection and billing limits."],
      ["Observability","Verify the evidence surfaced by V19 and retain specialist tools where needed.","Evaluate your required telemetry, dashboards, alerting and retention."],
    ] satisfies readonly EvidenceRow[],
  },
] as const;

export function CompareClient() {
  const [selected,setSelected]=useState<string>(OPTIONS[0].id);
  const active=OPTIONS.find(option=>option.id===selected)??OPTIONS[0];
  return <div className="public-detail-page public-compare-page">
    <section className="public-detail-header">
      <PageHero eyebrow="V19 · Evaluation" title="Compare the evidence." muted="Choose for your workflow."
        lead="Use concrete questions to evaluate V19 alongside a team, an AI tool or your current stack."
        note="This is an evaluation checklist, not a measured benchmark or a claim of feature parity. Verify the current version and your configured permissions." />
    </section>
    <section className="pb-12">
      <div role="group" aria-label="Choose an alternative" className="flex flex-wrap gap-2">
        {OPTIONS.map(option=><button key={option.id} type="button" aria-pressed={option.id===selected} onClick={()=>setSelected(option.id)}
          className="min-h-11 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">{option.label}</button>)}
      </div>
      <p className="my-6 max-w-2xl text-sm leading-6 text-zinc-400">{active.lead}</p>
      <p id="comparison-scroll-hint" className="mb-3 text-xs leading-5 text-zinc-400">Scroll horizontally to compare all columns. With the table focused, use Left and Right, or Home and End.</p>
      <div role="region" aria-label="Evaluation checklist" aria-describedby="comparison-scroll-hint" tabIndex={0}
        onKeyDown={event=>{
          if(event.target!==event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode===229) return;
          const frame=event.currentTarget;
          const max=Math.max(0,frame.scrollWidth-frame.clientWidth);
          if(!max) return;
          const next=event.key==="ArrowLeft" ? frame.scrollLeft-80 : event.key==="ArrowRight" ? frame.scrollLeft+80 : event.key==="Home" ? 0 : event.key==="End" ? max : null;
          if(next===null) return;
          event.preventDefault();
          frame.scrollLeft=Math.max(0,Math.min(max,next));
        }}
        className="public-comparison-frame rounded-xl border border-white/10 bg-[#171615]">
        <table className="public-evaluation-table w-full text-left">
          <caption className="sr-only">Questions for V19 and {active.alternative}</caption>
          <thead><tr><th scope="col">Evaluate</th><th scope="col">V19 evidence to inspect</th><th scope="col">{active.alternative}</th></tr></thead>
          <tbody>{active.rows.map(([question,axiom,alternative])=><tr key={question}><th scope="row">{question}</th><td>{axiom}</td><td>{alternative}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
    <section className="pb-20">
      <h2 className="text-2xl">Try one representative workflow.</h2>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">Compare the exact released workflow, connector configuration, authorization, persistence and recovery behavior. Use the same task and evidence for each option.</p>
      <div className="mt-6 flex flex-wrap gap-6"><Link href="/plans" className="orbit-primary">See plans</Link><Link href="/faq" className="orbit-secondary">Read the FAQ</Link></div>
    </section>
  </div>;
}
