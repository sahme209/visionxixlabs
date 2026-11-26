"use client";
import { useState } from "react";
import type { EnvironmentsPlan } from "@/lib/releaseops/environmentsAsCode";

const ERRORS: Record<string, string> = {
  workspace_admin_required: "Only workspace owners and admins can change environments.",
  environments_unchanged: "The file matches the current environments.",
  environment_limit_reached: "This file would take the workspace past 100 environments.",
  governance_configuration_mutation_unavailable: "Governance enrollment is active, so environment changes are paused.",
};

/**
 * Environments as code: download names, tiers, order, tags and change windows as a file for Git, preview
 * a changed file and apply it. Never deletes an environment or changes an existing tier.
 */
export function EnvironmentsAsCodePanel() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ plan: EnvironmentsPlan; digest: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(apply: boolean) {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch("/api/control/environments/file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apply ? { text, apply: true, expectedDigest: preview?.digest } : { text }) });
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: { plan: EnvironmentsPlan; digest: string; applied?: number }; error?: string; issues?: string[]; detail?: string } | null;
      if (res.ok && body?.ok && body.data) {
        if (apply) { setPreview(null); setMessage({ tone: "ok", text: `Applied ${body.data.applied} ${body.data.applied === 1 ? "change" : "changes"}. Reload to see the environments.` }); }
        else setPreview({ plan: body.data.plan, digest: body.data.digest });
        return;
      }
      setMessage({ tone: "warn", text: body?.issues?.join(" ") ?? body?.detail ?? ERRORS[body?.error ?? ""] ?? "The file could not be processed. Try again." });
    } catch { setMessage({ tone: "warn", text: "The request could not be reached. Try again." }); }
    finally { setBusy(false); }
  }
  const p = preview?.plan;
  const count = (op: string) => p?.ops.filter((o) => o.op === op).length ?? 0;
  return (
    <section aria-labelledby="environments-as-code-heading" className="mt-10 border-t border-white/8 pt-7">
      <h2 id="environments-as-code-heading" className="text-base font-medium">Environments as code</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Keep environments in Git: download their names, tiers, order, tags and change windows as a file, change it in a pull request, then paste it here to preview and apply. A file never deletes an environment and never changes an existing environment&apos;s tier.</p>
      <a href="/api/control/environments/file" className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200 hover:bg-white/5">Download environments file</a>
      <label className="mt-5 block text-xs text-zinc-400" htmlFor="environments-file-text">Environments file (JSON)</label>
      <textarea id="environments-file-text" value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} rows={6} spellCheck={false} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-zinc-200" placeholder='{"kind":"v19.environments","version":1,"environments":[…]}' />
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" disabled={!text.trim() || busy} onClick={() => void send(false)} className="inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">Preview environments file</button>
        {p && p.ops.length > 0 && p.refused.length === 0 && <button type="button" disabled={busy} onClick={() => void send(true)} className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200 disabled:opacity-50">Apply {p.ops.length} {p.ops.length === 1 ? "change" : "changes"}</button>}
      </div>
      <div aria-live="polite" className="mt-3 text-sm">
        {p && <div className="space-y-2 text-zinc-300">
          <p>{count("create")} new · {count("update")} changed · {p.unchanged} unchanged{p.keptOutOfFile.length ? ` · ${p.keptOutOfFile.length} not in the file and kept (${p.keptOutOfFile.join(", ")})` : ""}</p>
          {p.refused.length > 0 && <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3"><p className="font-medium text-amber-200">Cannot be applied</p><ul className="mt-1 list-disc pl-5 text-amber-100/90">{p.refused.map((l) => <li key={l}>{l}</li>)}</ul></div>}
          {p.loosening.length > 0 && <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3"><p className="font-medium text-amber-200">Loosens deployment gates</p><ul className="mt-1 list-disc pl-5 text-amber-100/90">{p.loosening.map((l) => <li key={l}>{l}</li>)}</ul></div>}
        </div>}
        {message && <p className={message.tone === "ok" ? "text-zinc-300" : "text-amber-300"}>{message.text}</p>}
      </div>
    </section>);
}
