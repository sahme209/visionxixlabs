"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

const WORKFLOW = [
  ["01", "Repository context", "Start with the repository, branch, environment, and requested outcome so the work has a clear scope."],
  ["02", "Exact proposal", "Inspect the specific change, its expected effect, the validation plan, and recovery context before making a decision."],
  ["03", "Independent review", "Where supported, an authorized reviewer assesses the exact proposal separately from the requester."],
  ["04", "Separate requester execution", "Where supported, the requester deliberately asks to execute after review. Approval and execution are separate steps."],
  ["05", "Recorded outcome and recovery", "Inspect the recorded result and available evidence. Keep refused or unknown outcomes visible alongside recovery context; a plan is not proof of recovery."],
];


const RECORDS = [
  ["Scope record", "Repository / branch / environment", "Context gives a proposal its boundaries. It does not grant permission to act."],
  ["Proposal record", "Change / expected effect / validation", "Review is meaningful only when it refers to the specific proposed change."],
  ["Review record", "Exact proposal / authorized reviewer", "A review belongs to the exact proposal. It is not a request to execute."],
  ["Intent record", "Requester / deliberate execution request", "Requester intent is a separate step after review, where the workflow supports it."],
  ["Outcome record", "Recorded result / evidence / recovery", "Confirmed requires recorded evidence. Refused means the action was declined. Unknown remains unresolved; a recovery plan does not confirm recovery."],
];

/** A conceptual teaching surface: only the selected explanation changes. */
export function WorkflowEvidenceMap() {
  const prefix = useId();
  const [selected, setSelected] = useState(0);
  const controls = useRef<(HTMLButtonElement | null)[]>([]);
  const panelId = `${prefix}-record`;
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": case "ArrowDown": next = (index + 1) % WORKFLOW.length; break;
      case "ArrowLeft": case "ArrowUp": next = (index + WORKFLOW.length - 1) % WORKFLOW.length; break;
      case "Home": next = 0; break;
      case "End": next = WORKFLOW.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setSelected(next);
    controls.current[next]?.focus();
  }
  return (
    <div className="mt-10 min-w-0">
      <p id={`${prefix}-help`} className="text-xs leading-6 text-zinc-400">Conceptual illustration · local explanation only. Choose a stage to inspect the record it describes.</p>
      <div className="mt-5 grid min-w-0 overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.02] lg:grid-cols-[1fr_1.1fr]">
        <ol aria-label="Conceptual workflow" aria-describedby={`${prefix}-help`} className="m-0 list-none p-3 sm:p-5">
          {WORKFLOW.map(([number, title], index) => (
            <li key={number} className="relative min-w-0">
              {index < WORKFLOW.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[26px] top-12 w-px bg-white/[0.12]" />}
              <h3 className="m-0">
                <button id={`${prefix}-stage-${index + 1}`} ref={node => { controls.current[index] = node; }} type="button" aria-pressed={selected === index} aria-controls={panelId} onClick={() => setSelected(index)} onKeyDown={event => navigate(event, index)} className={`relative my-1 flex min-h-[60px] w-full items-center gap-4 rounded-lg border px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 ${selected === index ? "border-white/20 bg-white/[0.07] text-zinc-100" : "border-transparent text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"}`}>
                  <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-[#141414] font-mono text-[10px] ${selected === index ? "border-sky-300/60 text-sky-200" : "border-white/15 text-zinc-500"}`}>{number}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-5 tracking-[-0.01em]">{title}</span>
                  <span aria-hidden="true" className="w-3 shrink-0 text-xs">{selected === index ? "→" : ""}</span>
                </button>
              </h3>
            </li>
          ))}
        </ol>
        <div id={panelId} role="region" aria-labelledby={`${prefix}-stage-${selected + 1}`} className="flex min-w-0 flex-col border-t border-white/[0.1] bg-black/15 p-6 sm:p-8 lg:border-l lg:border-t-0">
          <div aria-hidden="true" className="flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-zinc-500"><span>Record / {WORKFLOW[selected][0]}</span><span className="h-px flex-1 bg-white/10" /><span>Concept</span></div>
          <p className="mt-8 text-2xl font-medium tracking-[-0.035em] text-zinc-100">{RECORDS[selected][0]}</p>
          <p className="mt-3 font-mono text-[11px] leading-6 text-sky-200/80">{RECORDS[selected][1]}</p>
          <p className="mt-5 text-sm leading-7 text-zinc-300">{WORKFLOW[selected][2]}</p>
          <p className="mt-6 border-t border-dashed border-white/15 pt-5 text-xs leading-6 text-zinc-400">{RECORDS[selected][2]}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-1 text-xs leading-6 text-zinc-400">
        <p>Check your installed version and enabled workflow for available controls.</p>
        <p>Governance Intelligence remains incomplete; this illustration does not establish activation or action coverage.</p>
      </div>
    </div>
  );
}
