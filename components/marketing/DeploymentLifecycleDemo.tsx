"use client";

import { useEffect, useState } from "react";
import {
  ArchiveBoxIcon,
  ClipboardDocumentListIcon,
  ClipboardDocumentCheckIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  PlayCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

const STAGES = [
  {
    id: "intent",
    label: "Intent",
    title: "Start with the change the team is trying to make.",
    detail: "Axiom keeps the outcome, affected scope, change window, and owner in one governed request instead of spreading context across tools.",
    status: "Revision 4 recorded",
    icon: ClipboardDocumentCheckIcon,
  },
  {
    id: "readiness",
    label: "Readiness",
    title: "Make missing evidence visible before review.",
    detail: "Development, production, validation, and recovery signals remain facts to check—not assumptions Axiom makes on the operator's behalf.",
    status: "Signals need review",
    icon: SparklesIcon,
  },
  {
    id: "playbook",
    label: "Playbook",
    title: "Turn the request into the plan people can follow.",
    detail: "The runbook holds the intended steps, required evidence, validation plan, and rollback context together before anyone treats it as executable.",
    status: "Playbook prepared",
    icon: ClipboardDocumentListIcon,
  },
  {
    id: "risk",
    label: "Risk",
    title: "Show the risk and recovery path in the decision.",
    detail: "Axiom surfaces affected scope and recorded rollback context so an approver can assess the consequence of proceeding—not just the happy path.",
    status: "Risk review required",
    icon: ExclamationTriangleIcon,
  },
  {
    id: "approval",
    label: "Approval",
    title: "A human decides whether the change may proceed.",
    detail: "Approval is an explicit record with an owner and rationale. It is never a decorative green light or a substitute for authority.",
    status: "Human gate required",
    icon: ShieldCheckIcon,
  },
  {
    id: "execution",
    label: "Execution",
    title: "The approved playbook guides the release.",
    detail: "Axiom records the operational handoff and keeps the documented recovery path close to the action.",
    status: "Guided, not autonomous",
    icon: PlayCircleIcon,
  },
  {
    id: "validation",
    label: "Validation",
    title: "Production evidence is distinct from a successful trigger.",
    detail: "Technical and functional validation remain visible after the workflow runs, so the record stays honest.",
    status: "Evidence requested",
    icon: DocumentCheckIcon,
  },
  {
    id: "evidence",
    label: "Evidence",
    title: "Keep the facts that supported the decision.",
    detail: "Axiom preserves the relevant approval, validation notes, and recovery context so the release can be understood after the moment has passed.",
    status: "Evidence requested",
    icon: ArchiveBoxIcon,
  },
  {
    id: "closure",
    label: "Closure",
    title: "Closure comes after evidence, not after a button click.",
    detail: "The final record retains the decision, validation notes, recovery context, and immutable revision history.",
    status: "Audit-ready closure",
    icon: ArchiveBoxIcon,
  },
] as const;

export function DeploymentLifecycleDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % STAGES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  const active = STAGES[activeIndex];
  const Icon = active.icon;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.09] bg-[#0f100f] shadow-2xl shadow-black/40">
      <div aria-hidden className="pointer-events-none absolute -inset-12 opacity-70 blur-3xl" style={{ background: "radial-gradient(50% 58% at 66% 18%, rgba(124,58,237,.24), transparent 72%), radial-gradient(40% 42% at 18% 88%, rgba(6,182,212,.12), transparent 72%)" }} />
      <div className="relative flex h-10 items-center justify-between border-b border-white/[0.06] px-4 text-[11px] text-zinc-500">
        <span>Axiom Agent · release workspace</span>
        <span>Illustrative flow · no live action</span>
      </div>
      <div className="relative grid min-h-[480px] lg:grid-cols-[238px_minmax(0,1fr)_260px]">
        <aside className="border-b border-white/[0.06] bg-black/10 p-4 lg:border-b-0 lg:border-r">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Release lifecycle</p>
          <div className="mt-3 space-y-1.5" role="tablist" aria-label="Illustrative release lifecycle">
            {STAGES.map((stage, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={stage.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition ${selected ? "border-violet-400/25 bg-violet-400/[0.1] text-white" : "border-transparent text-zinc-500 hover:border-white/[0.07] hover:bg-white/[0.035] hover:text-zinc-200"}`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${selected ? "border-violet-300/40 bg-violet-300/15 text-violet-100" : "border-white/[0.1] text-zinc-600"}`}>{index + 1}</span>
                  <span className="text-xs font-medium">{stage.label}</span>
                  {index < activeIndex ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-300" aria-label="Completed illustrative stage" /> : null}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-w-0 flex-col justify-between p-5 sm:p-7" role="tabpanel">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-zinc-500">Production change · illustrative record</p>
                <h3 className="mt-2 text-2xl font-medium tracking-tight text-white">Checkout release</h3>
              </div>
              <span className="rounded-full border border-violet-300/20 bg-violet-300/[0.08] px-3 py-1 text-xs text-violet-100">{active.status}</span>
            </div>

            <div className="mt-10 max-w-xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.05]">
                <Icon className="h-5 w-5 text-violet-200" />
              </div>
              <h4 className="mt-5 text-xl font-medium leading-7 text-zinc-100">{active.title}</h4>
              <p className="mt-3 text-sm leading-6 text-zinc-400">{active.detail}</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-2" aria-label="Playbook story">
            {[
              ["Intent", "What is changing"],
              ["Playbook", "How it will proceed"],
              ["Proof", "What makes it true"],
            ].map(([label, detail]) => (
              <div key={label} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
                <p className="text-[10px] text-zinc-600">{label}</p>
                <p className="mt-1.5 text-xs text-zinc-300">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="border-t border-white/[0.06] bg-black/10 p-5 lg:border-l lg:border-t-0">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Record integrity</p>
          <Metric label="Request version" value="4" />
          <Metric label="Approval authority" value="Human" />
          <Metric label="Rollback context" value="Recorded" />
          <Metric label="Live health" value="Not connected" />
          <div className="mt-5 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] p-3.5 text-xs leading-5 text-emerald-100">The preview makes unknown states visible. It does not claim a production result.</div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="mt-4 border-b border-white/[0.06] pb-4"><p className="text-xs text-zinc-600">{label}</p><p className="mt-1 text-sm text-zinc-200">{value}</p></div>;
}
