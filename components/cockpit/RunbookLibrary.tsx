"use client";
import { useCallback, useEffect, useState } from "react";
import { APPROVAL_LABEL, RUNBOOK_TEMPLATES, RUNBOOK_TRIGGERS, STEP_APPROVALS, TRIGGER_LABEL, approvalSummary, type RunbookSpec, type RunbookTrigger, type StepApproval } from "@/lib/releaseops/runbookLibrary";

interface Stored extends RunbookSpec { version: number; updatedAt: string }
type Draft = RunbookSpec & { expectedVersion?: number };
const EMPTY: Draft = { key: "", title: "", trigger: "manual", enabled: true, steps: [{ title: "", detail: "", approval: "none" }] };
const ERRORS: Record<string, string> = {
  workspace_admin_required: "Only workspace owners and admins can change runbooks.",
  runbook_exists: "A runbook with this key already exists. Edit it instead.",
  runbook_changed: "Someone changed this runbook after you loaded it. The list has been reloaded.",
  runbook_limit_reached: "This workspace has reached its runbook limit.",
};
const APPROVAL_TONE: Record<StepApproval, string> = { none: "text-zinc-500", one_admin: "text-amber-300", two_admins: "text-rose-300" };

export function RunbookLibrary() {
  const [data, setData] = useState<{ canEdit: boolean; runbooks: Stored[] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<{ kind: "busy" } | { kind: "error"; message: string; issues?: string[] } | { kind: "saved"; key: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/control/runbooks", { cache: "no-store" });
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: { canEdit: boolean; runbooks: Stored[] } } | null;
      if (body?.ok && body.data) { setData(body.data); setLoadError(false); } else setLoadError(true);
    } catch { setLoadError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!draft) return;
    setStatus({ kind: "busy" });
    const { expectedVersion, ...runbook } = draft;
    try {
      const res = await fetch("/api/control/runbooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runbook, ...(expectedVersion ? { expectedVersion } : {}) }) });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string; issues?: string[] } | null;
      if (res.ok && body?.ok) { setStatus({ kind: "saved", key: runbook.key }); setDraft(null); await load(); return; }
      if (body?.error === "runbook_changed") await load();
      setStatus({ kind: "error", message: ERRORS[body?.error ?? ""] ?? (body?.error === "runbook_invalid" ? "The runbook has problems:" : "The runbook could not be saved. Try again."), issues: body?.issues });
    } catch { setStatus({ kind: "error", message: "The runbook could not be reached. Try again." }); }
  }

  const setStep = (i: number, patch: Partial<Draft["steps"][number]>) => setDraft((d) => d && { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const existing = new Set((data?.runbooks ?? []).map((r) => r.key));

  return (
    <section aria-labelledby="runbooks-heading" className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="runbooks-heading" className="text-base font-medium">Library</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <a href="/api/control/runbooks/export" className="inline-flex min-h-9 items-center rounded-full border border-white/15 px-4 text-zinc-200 hover:bg-white/5">Download runbooks file</a>
          {data?.canEdit && !draft && <button type="button" onClick={() => { setDraft({ ...EMPTY, steps: [...EMPTY.steps] }); setStatus(null); }} className="inline-flex min-h-9 items-center rounded-full bg-[#f3f3f3] px-4 text-black hover:bg-white">New runbook</button>}
        </div>
      </div>
      {loadError && <p role="status" className="mt-3 text-sm text-zinc-400">Runbooks could not be read.</p>}
      {status?.kind === "saved" && <p role="status" className="mt-3 text-sm text-emerald-300">Saved {status.key}.</p>}
      {data && data.runbooks.length === 0 && !draft && <p className="mt-3 text-sm text-zinc-400">No runbooks yet.{data.canEdit ? " Start from a template below or write your own." : ""}</p>}

      {data?.canEdit && !draft && RUNBOOK_TEMPLATES.some((t) => !existing.has(t.key)) && (
        <div className="mt-4">
          <p className="text-xs text-zinc-500">Start from a template (nothing is saved until you choose Save)</p>
          <ul className="mt-2 flex flex-wrap gap-2">{RUNBOOK_TEMPLATES.filter((t) => !existing.has(t.key)).map((t) => (
            <li key={t.key}><button type="button" onClick={() => { setDraft(structuredClone(t)); setStatus(null); }} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5">{t.title}</button></li>))}</ul>
        </div>)}

      {draft && (
        <form onSubmit={(e) => { e.preventDefault(); void save(); }} aria-label={draft.expectedVersion ? `Edit ${draft.key}` : "New runbook"} className="mt-4 space-y-4 rounded-xl border border-white/10 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-zinc-400">Title<input required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100" /></label>
            <label className="text-xs text-zinc-400">Key<input required disabled={Boolean(draft.expectedVersion)} pattern="[a-z0-9][a-z0-9-]{0,62}" value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100 disabled:opacity-60" /></label>
            <label className="text-xs text-zinc-400">When<select value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value as RunbookTrigger })} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100">{RUNBOOK_TRIGGERS.map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}</select></label>
          </div>
          <ol className="space-y-3">{draft.steps.map((s, i) => (
            <li key={i} className="rounded-lg border border-white/8 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-0 flex-1 text-xs text-zinc-400">Step {i + 1}<input required maxLength={160} value={s.title} onChange={(e) => setStep(i, { title: e.target.value })} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100" /></label>
                <label className="text-xs text-zinc-400">Approval<select value={s.approval} onChange={(e) => setStep(i, { approval: e.target.value as StepApproval })} className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100">{STEP_APPROVALS.map((a) => <option key={a} value={a}>{APPROVAL_LABEL[a]}</option>)}</select></label>
                <button type="button" disabled={draft.steps.length === 1} onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, j) => j !== i) })} aria-label={`Remove step ${i + 1}`} className="min-h-9 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 disabled:opacity-40">Remove</button>
              </div>
              <label className="mt-2 block text-xs text-zinc-400">What to do<textarea maxLength={2000} rows={2} value={s.detail} onChange={(e) => setStep(i, { detail: e.target.value })} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100" /></label>
            </li>))}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={draft.steps.length >= 30} onClick={() => setDraft({ ...draft, steps: [...draft.steps, { title: "", detail: "", approval: "none" }] })} className="min-h-9 rounded-full border border-white/15 px-4 text-sm text-zinc-200 disabled:opacity-40">Add step</button>
            <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />Enabled</label>
            <span className="flex-1" />
            <button type="button" onClick={() => { setDraft(null); setStatus(null); }} className="min-h-9 rounded-full px-4 text-sm text-zinc-300">Cancel</button>
            <button type="submit" disabled={status?.kind === "busy"} className="min-h-9 rounded-full bg-[#f3f3f3] px-4 text-sm text-black disabled:opacity-50">Save</button>
          </div>
          {status?.kind === "error" && <div role="alert" className="text-sm text-rose-300">{status.message}{status.issues && <ul className="mt-1 list-disc pl-5 text-xs">{status.issues.map((x) => <li key={x}>{x}</li>)}</ul>}</div>}
        </form>)}

      {data && data.runbooks.length > 0 && (
        <ul className="mt-4 space-y-3">{data.runbooks.map((r) => {
          const a = approvalSummary(r);
          return (
            <li key={r.key} className={`rounded-xl border p-4 ${r.enabled ? "border-white/8" : "border-white/5 opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm text-zinc-100">{r.title}{!r.enabled && <span className="ml-2 text-xs text-zinc-500">disabled</span>}</p><p className="font-mono text-[11px] text-zinc-500">{r.key} · version {r.version} · {TRIGGER_LABEL[r.trigger as RunbookTrigger] ?? r.trigger}</p></div>
                <div className="flex items-center gap-3 text-xs"><span className="text-zinc-400">{r.steps.length} steps · {a.gated ? `${a.gated} need${a.gated === 1 ? "s" : ""} approval` : "no approvals"}</span>
                  {data.canEdit && !draft && <button type="button" onClick={() => { setDraft({ key: r.key, title: r.title, trigger: r.trigger, enabled: r.enabled, steps: r.steps.map((s) => ({ ...s })), expectedVersion: r.version }); setStatus(null); }} className="rounded-full border border-white/10 px-3 py-1 text-zinc-200">Edit</button>}</div>
              </div>
              <ol className="mt-3 space-y-1.5 text-sm">{r.steps.map((s, i) => (
                <li key={i} className="flex gap-3"><span className="w-5 shrink-0 text-right tabular-nums text-zinc-500">{i + 1}</span><span className="min-w-0 flex-1"><span className="text-zinc-200">{s.title}</span>{s.detail && <span className="block text-xs text-zinc-400">{s.detail}</span>}</span><span className={`shrink-0 text-xs ${APPROVAL_TONE[s.approval]}`}>{s.approval === "none" ? "" : APPROVAL_LABEL[s.approval]}</span></li>))}
              </ol>
            </li>);
        })}</ul>)}
    </section>
  );
}
