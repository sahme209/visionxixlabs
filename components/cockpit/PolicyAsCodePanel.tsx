"use client";
import { useState } from "react";
import type { PolicyDiff } from "@/lib/releaseops/policyAsCode";

/** Export policy rules for Git, and preview what a proposed file would change. Nothing here applies a change. */
export function PolicyAsCodePanel() {
  const [text, setText] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "diff"; diff: PolicyDiff } | { kind: "error"; messages: string[] }>({ kind: "idle" });
  async function compare() {
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/control/policy/diff", { method: "POST", body: text, headers: { "Content-Type": "application/json" } });
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: PolicyDiff; issues?: string[]; error?: string } | null;
      if (res.ok && body?.ok && body.data) setState({ kind: "diff", diff: body.data });
      else setState({ kind: "error", messages: body?.issues ?? [body?.error === "workspace_admin_required" ? "Only workspace owners and admins can compare policy files." : "The file could not be compared. Try again."] });
    } catch { setState({ kind: "error", messages: ["The comparison could not be reached. Try again."] }); }
  }
  const d = state.kind === "diff" ? state.diff : null;
  return (
    <section aria-labelledby="policy-as-code-heading" className="border-t border-white/8 py-7">
      <h2 id="policy-as-code-heading" className="text-base font-medium">Policy as code</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Download this workspace’s policy rules as a file to review and version in Git. Paste a changed file to preview its effect. Previewing never changes a rule.</p>
      <a href="/api/control/policy/export" className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200 hover:bg-white/5">Download policy file</a>
      <label className="mt-5 block text-xs text-zinc-400" htmlFor="policy-file-text">Proposed policy file (JSON)</label>
      <textarea id="policy-file-text" value={text} onChange={(e) => setText(e.target.value)} rows={6} spellCheck={false}
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-zinc-200" placeholder='{"kind":"v19.policy","version":1,"rules":[…]}' />
      <button type="button" onClick={() => void compare()} disabled={!text.trim() || state.kind === "busy"} className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">
        {state.kind === "busy" ? "Comparing…" : "Preview changes"}
      </button>
      <div aria-live="polite" className="mt-4 text-sm">
        {state.kind === "error" && <ul className="list-disc pl-5 text-amber-300">{state.messages.map((m) => <li key={m}>{m}</li>)}</ul>}
        {d && <div className="space-y-3 text-zinc-300">
          <p>{d.added.length} added · {d.changed.length} changed · {d.removed.length} removed · {d.unchanged} unchanged</p>
          {d.loosening.length > 0 && <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3"><p className="font-medium text-amber-200">Loosens governance</p><ul className="mt-1 list-disc pl-5 text-amber-100/90">{d.loosening.map((l) => <li key={l}>{l}</li>)}</ul></div>}
          {d.changed.length > 0 && <ul className="space-y-1 font-mono text-xs">{d.changed.map((c) => <li key={c.key}>{c.key}: {c.fields.map((f) => `${f.field} ${JSON.stringify(f.from)} → ${JSON.stringify(f.to)}`).join(", ")}</li>)}</ul>}
          {d.added.length > 0 && <p className="text-xs">Added: {d.added.map((r) => r.key).join(", ")}</p>}
          {d.removed.length > 0 && <p className="text-xs">Removed: {d.removed.join(", ")}</p>}
          <p className="text-xs text-zinc-400">This is a preview. Applying policy changes stays a reviewed action.</p>
        </div>}
      </div>
    </section>
  );
}
