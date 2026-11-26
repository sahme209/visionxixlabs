"use client";
import { useId, useState, type KeyboardEvent } from "react";

/**
 * Interactive governed release flow: choose a stage to see what V19 records there, who signs off and
 * which gates apply. Works with a keyboard (arrow keys move between stages), needs no animation, and
 * the server render already shows the first stage, so it reads without JavaScript.
 */
export const RELEASE_FLOW = [
  { id: "plan", label: "Plan", records: ["The change request and the exact commit or tag", "A change passport when an AI agent prepared it: agent, model, tools and owner"], signOff: "The person who asks for the change owns it.", gates: ["Plan-stage checks, if you add any"] },
  { id: "validate", label: "Validate", records: ["Check results your CI reports for the exact commit, at each check's current version", "Database migration changes since the last good deployment"], signOff: "Your CI reports results; V19 never runs a check itself.", gates: ["Blocking Validate checks must pass for this commit"] },
  { id: "approve", label: "Approve", records: ["Who approved, when, and the digest of what they approved", "Review lane chosen by blast radius"], signOff: "An owner or admin who did not create the agent's key; two different people for wide or sensitive production changes.", gates: ["Approval policy for the environment", "Manual checklists confirmed for the full commit SHA"] },
  { id: "deploy", label: "Deploy", records: ["The workflow run dispatched in your CI", "A fingerprint of the configuration the environment resolved to"], signOff: "Dispatch happens only after every gate passes; an AI agent gets no bypass.", gates: ["Change window and freezes", "Rings: the previous ring must have deployed this commit", "A stated reason while the stability warning is active"] },
  { id: "verify", label: "Verify", records: ["Verify-stage check results", "Release health from connected tools: incidents, new errors, monitors, stale flags"], signOff: "Health is a recorded verdict with reasons; missing signals are named, never assumed healthy.", gates: ["Blocking Verify checks"] },
  { id: "recover", label: "Recover", records: ["Rollback to the last good version, deployed through the same gates", "Incidents linked to the release, and the evidence pack for audit"], signOff: "Rollback is an ordinary governed deployment.", gates: ["The same gates as any deployment"] },
] as const;

export function ReleaseFlowDiagram() {
  const id = useId();
  const [index, setIndex] = useState(0);
  const stage = RELEASE_FLOW[index];
  function onKey(event: KeyboardEvent<HTMLButtonElement>) {
    const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? RELEASE_FLOW.length - 1 : null;
    if (next === null || next < 0 || next >= RELEASE_FLOW.length) return;
    event.preventDefault();
    setIndex(next);
    document.getElementById(`${id}-stage-${RELEASE_FLOW[next].id}`)?.focus();
  }
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-[#111111] p-5">
      <div role="tablist" aria-label="Release stages" className="flex flex-wrap items-center gap-2">
        {RELEASE_FLOW.map((s, i) => (
          <span key={s.id} className="flex items-center gap-2">
            <button id={`${id}-stage-${s.id}`} role="tab" type="button" aria-selected={i === index} aria-controls={`${id}-panel`} tabIndex={i === index ? 0 : -1} onKeyDown={onKey} onClick={() => setIndex(i)}
              className={`min-h-9 rounded-full border px-3 text-sm ${i === index ? "border-zinc-200 bg-zinc-100 text-zinc-950" : "border-white/15 text-zinc-300 hover:bg-white/5"}`}>{s.label}</button>
            {i < RELEASE_FLOW.length - 1 && <span aria-hidden="true" className="text-zinc-600">→</span>}
          </span>))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-stage-${stage.id}`} className="mt-5 grid gap-5 text-sm sm:grid-cols-3">
        <div><p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">What V19 records</p><ul className="mt-2 space-y-1.5 text-zinc-200">{stage.records.map((r) => <li key={r}>{r}</li>)}</ul></div>
        <div><p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Who signs off</p><p className="mt-2 text-zinc-200">{stage.signOff}</p></div>
        <div><p className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Gates</p><ul className="mt-2 space-y-1.5 text-zinc-200">{stage.gates.map((g) => <li key={g}>{g}</li>)}</ul></div>
      </div>
    </div>);
}
