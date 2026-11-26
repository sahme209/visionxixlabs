"use client";
import { useId, useState } from "react";

/** Synthetic, client-only walk through a two-person policy change. No requests are made. */
type Step = "draft" | "requested" | "applied" | "stale" | "self";
const BEFORE = { key: "prod.change-window", blocking: true };

export function PolicyChangeDemo() {
  const id = useId();
  const [step, setStep] = useState<Step>("draft");
  const [someoneEdited, setSomeoneEdited] = useState(false);
  const status: Record<Step, { tone: string; text: string }> = {
    draft: { tone: "text-zinc-300", text: "Preview: prod.change-window would no longer block releases. That loosens governance." },
    requested: { tone: "text-zinc-200", text: "Change requested by Alex. It waits for a different owner or admin. Nothing has changed yet." },
    applied: { tone: "text-emerald-200", text: "Approved by Sam and applied in one step. The rules now match the reviewed file, and the decision is in the audit log." },
    stale: { tone: "text-amber-200", text: "Someone changed the rules after the request was made, so it was marked stale and nothing was applied. Request it again from the current rules." },
    self: { tone: "text-amber-200", text: "Alex cannot approve Alex's own request. A different owner or admin must decide." },
  };
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-[#111111] p-5" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="text-sm font-medium text-zinc-100">Try it: a governed policy change</p>
      <p className="mt-1 text-xs leading-5 text-zinc-400">Synthetic example. Alex wants production releases to stop being blocked outside the change window.</p>
      <div className="mt-4 rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs text-zinc-300">
        <span className="text-zinc-500">{BEFORE.key}</span> blocking: <span className="text-red-300 line-through">{String(BEFORE.blocking)}</span> → <span className="text-amber-200">false</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <button type="button" disabled={step !== "draft"} onClick={() => setStep("requested")} className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-zinc-200 disabled:opacity-40">Alex: request this change</button>
        <button type="button" disabled={step !== "requested"} onClick={() => setStep("self")} className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-zinc-200 disabled:opacity-40">Alex: approve own request</button>
        <button type="button" disabled={step !== "requested" && step !== "self"} onClick={() => setStep(someoneEdited ? "stale" : "applied")} className="inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 font-medium text-zinc-950 disabled:opacity-40">Sam: approve and apply</button>
        <button type="button" onClick={() => { setStep("draft"); setSomeoneEdited(false); }} className="inline-flex min-h-9 items-center rounded-lg px-3 text-zinc-400 underline underline-offset-2">Start over</button>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={someoneEdited} disabled={step === "applied" || step === "stale"} onChange={(e) => setSomeoneEdited(e.target.checked)} />Someone else edits a rule before Sam decides</label>
      <p aria-live="polite" className={`mt-4 rounded-lg border border-white/10 p-3 text-sm ${status[step].tone}`}>{status[step].text}</p>
    </div>);
}
