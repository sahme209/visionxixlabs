"use client";
import { useState } from "react";
import type { ChecksPlan } from "@/lib/releaseops/checksAsCode";

/** Download the workspace's checks as a file for Git, preview a changed file, and apply it. Owners and admins apply. */
export function ChecksAsCodePanel() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<{ plan: ChecksPlan; digest: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function send(apply: boolean) {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch("/api/control/checks/file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apply ? { text, apply: true, expectedDigest: preview?.digest } : { text }) });
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: { plan: ChecksPlan; digest: string; applied?: number }; error?: string; issues?: string[]; detail?: string } | null;
      if (res.ok && body?.ok && body.data) {
        if (apply) { setPreview(null); setMessage({ tone: "ok", text: `Applied ${body.data.applied} ${body.data.applied === 1 ? "change" : "changes"}. Reload to see the checks.` }); }
        else setPreview({ plan: body.data.plan, digest: body.data.digest });
        return;
      }
      setMessage({ tone: "warn", text: body?.issues?.join(" ") ?? body?.detail ?? (body?.error === "workspace_admin_required" ? "Only workspace owners and admins can change checks." : body?.error === "checks_unchanged" ? "The file matches the current checks." : "The file could not be processed. Try again.") });
    } catch { setMessage({ tone: "warn", text: "The request could not be reached. Try again." }); }
    finally { setBusy(false); }
  }
  const p = preview?.plan;
  const count = (op: string) => p?.ops.filter((o) => o.op === op).length ?? 0;
  return (
    <section aria-labelledby="checks-as-code-heading" className="mt-10 border-t border-white/8 pt-7">
      <h2 id="checks-as-code-heading" className="text-base font-medium">Checks as code</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-400">Keep checks in Git: download them as a file, change it in a pull request, then paste it here to preview and apply. Checks the file leaves out are disabled, not deleted, so past results keep their meaning.</p>
      <a href="/api/control/checks/file" className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200 hover:bg-white/5">Download checks file</a>
      <label className="mt-5 block text-xs text-zinc-400" htmlFor="checks-file-text">Checks file (JSON)</label>
      <textarea id="checks-file-text" value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} rows={6} spellCheck={false} className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-zinc-200" placeholder='{"kind":"v19.checks","version":1,"checks":[…]}' />
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" disabled={!text.trim() || busy} onClick={() => void send(false)} className="inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">Preview checks file</button>
        {p && p.ops.length > 0 && <button type="button" disabled={busy} onClick={() => void send(true)} className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200 disabled:opacity-50">Apply {p.ops.length} {p.ops.length === 1 ? "change" : "changes"}</button>}
      </div>
      <div aria-live="polite" className="mt-3 text-sm">
        {p && <div className="space-y-2 text-zinc-300">
          <p>{count("create")} new · {count("update")} changed · {count("disable")} disabled · {p.unchanged} unchanged</p>
          {p.loosening.length > 0 && <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3"><p className="font-medium text-amber-200">Loosens deployment gates</p><ul className="mt-1 list-disc pl-5 text-amber-100/90">{p.loosening.map((l) => <li key={l}>{l}</li>)}</ul></div>}
        </div>}
        {message && <p className={message.tone === "ok" ? "text-zinc-300" : "text-amber-300"}>{message.text}</p>}
      </div>
    </section>);
}
