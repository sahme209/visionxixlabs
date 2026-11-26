"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VARIABLE_ERROR_TEXT, type VariableInputError } from "@/lib/releaseops/scopedVariableMessages";

interface Env { id: string; name: string; slug: string; tier: string }
interface Stored { key: string; value: string; scopeKey: string; description: string | null; version: number }
interface Board { canEdit: boolean; environments: Env[]; variables: Stored[]; resolved: Array<{ environmentId: string; digest: string }>; gaps: Array<{ key: string; missingIn: string[] }> }
type Draft = { key: string; environmentId: string; value: string; description: string; expectedVersion?: number };
const EMPTY: Draft = { key: "", environmentId: "", value: "", description: "" };

const ERROR_TEXT: Record<string, string> = {
  workspace_admin_required: "Only workspace owners and admins can change variables.",
  variable_exists: "This variable already exists in that scope. Edit it instead.",
  variable_changed: "Someone changed or removed this variable after you loaded it. The list has been reloaded.",
  variable_limit_reached: "This workspace has reached its variable limit.",
  environment_not_found: "That environment no longer exists.",
};

export function VariablesBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/control/variables", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error();
      setBoard(body.data); setLoadError(false);
    } catch { setLoadError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const keys = useMemo(() => [...new Set((board?.variables ?? []).map((v) => v.key))].sort(), [board]);
  const cell = (key: string, scopeKey: string) => board?.variables.find((v) => v.key === key && v.scopeKey === scopeKey);

  async function send(method: "POST" | "DELETE", payload: Record<string, unknown>) {
    setBusy(true); setMessages([]);
    try {
      const res = await fetch("/api/control/variables", { method, body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string; issues?: VariableInputError[] } | null;
      if (res.ok && body?.ok) { setDraft(EMPTY); await load(); return; }
      if (body?.issues?.length) setMessages(body.issues.map((i) => VARIABLE_ERROR_TEXT[i] ?? i));
      else setMessages([ERROR_TEXT[body?.error ?? ""] ?? "The change could not be saved. Try again."]);
      if (body?.error === "variable_changed") await load();
    } catch { setMessages(["The change could not be reached. Try again."]); }
    finally { setBusy(false); }
  }

  if (loadError) return <p role="alert" className="mt-8 text-sm text-amber-300">Variables could not be loaded. Refresh to try again.</p>;
  if (!board) return <p className="mt-8 text-sm text-zinc-400">Loading variables…</p>;
  const columns = [{ id: "", label: "Workspace default", scopeKey: "workspace" }, ...board.environments.map((e) => ({ id: e.id, label: e.name, scopeKey: `env:${e.id}` }))];
  const editing = draft.expectedVersion !== undefined;

  return (
    <div className="mt-8 space-y-8">
      {board.gaps.length > 0 && <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
        <p className="font-medium text-amber-200">Set only in some environments</p>
        <ul className="mt-1 list-disc pl-5 text-amber-100/90">{board.gaps.map((g) => <li key={g.key}><span className="font-mono">{g.key}</span> has no workspace default and is missing in {g.missingIn.map((id) => board.environments.find((e) => e.id === id)?.name ?? id).join(", ")}.</li>)}</ul>
      </div>}

      {keys.length === 0 ? <p className="text-sm text-zinc-400">No variables yet.{board.canEdit ? " Add a workspace default below." : ""}</p> : (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Variables by scope. Environment cells without an override inherit the workspace default.</caption>
            <thead className="bg-white/[0.03] text-xs text-zinc-400"><tr><th scope="col" className="px-4 py-3 font-medium">Name</th>{columns.map((c) => <th key={c.scopeKey} scope="col" className="px-4 py-3 font-medium">{c.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/[0.07]">{keys.map((key) => (
              <tr key={key}>
                <th scope="row" className="px-4 py-3 font-mono text-xs font-normal text-zinc-200">{key}</th>
                {columns.map((c) => { const v = cell(key, c.scopeKey); const inherited = !v && c.id && cell(key, "workspace");
                  return <td key={c.scopeKey} className="px-4 py-3 align-top">
                    {v ? <div className="flex items-start gap-2"><span className="break-all font-mono text-xs text-zinc-100">{v.value || <em className="text-zinc-400">empty</em>}</span>
                      {board.canEdit && <span className="ml-auto flex shrink-0 gap-2 text-xs">
                        <button type="button" className="text-zinc-300 underline-offset-2 hover:underline" aria-label={`Edit ${key} in ${c.label}`} onClick={() => setDraft({ key, environmentId: c.id, value: v.value, description: v.description ?? "", expectedVersion: v.version })}>Edit</button>
                        <button type="button" className="text-zinc-300 underline-offset-2 hover:underline" aria-label={`Remove ${key} from ${c.label}`} disabled={busy} onClick={() => void send("DELETE", { key, environmentId: c.id || null, expectedVersion: v.version })}>Remove</button>
                      </span>}</div>
                      : <span className="text-xs text-zinc-400">{inherited ? "Inherits default" : "Not set"}</span>}
                  </td>; })}
              </tr>))}
            </tbody>
          </table>
        </div>)}

      {board.resolved.length > 0 && <div>
        <h2 className="text-base font-medium">Resolved fingerprints</h2>
        <p className="mt-1 text-sm text-zinc-400">A short fingerprint of what each environment resolves to. It changes whenever any value that environment sees changes, so it can be compared with a release record.</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{board.resolved.map((r) => <div key={r.environmentId} className="rounded-xl border border-white/8 bg-[#111111] p-4"><dt className="text-xs text-zinc-400">{board.environments.find((e) => e.id === r.environmentId)?.name}</dt><dd className="mt-2 font-mono text-sm text-zinc-200">{r.digest.slice(0, 12)}</dd></div>)}</dl>
      </div>}

      {board.canEdit ? (
        <form className="rounded-xl border border-white/8 bg-[#111111] p-5" onSubmit={(e) => { e.preventDefault(); void send("POST", { key: draft.key.trim(), value: draft.value, environmentId: draft.environmentId || null, description: draft.description.trim() || null, ...(editing ? { expectedVersion: draft.expectedVersion } : {}) }); }}>
          <h2 className="text-base font-medium">{editing ? `Edit ${draft.key}` : "Add a variable"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">Name<input required value={draft.key} readOnly={editing} onChange={(e) => setDraft({ ...draft, key: e.target.value.toUpperCase() })} placeholder="API_BASE_URL" className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100" /></label>
            <label className="text-xs text-zinc-400">Scope<select value={draft.environmentId} disabled={editing} onChange={(e) => setDraft({ ...draft, environmentId: e.target.value })} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100">
              {columns.map((c) => <option key={c.scopeKey} value={c.id}>{c.label}</option>)}</select></label>
            <label className="text-xs text-zinc-400 sm:col-span-2">Value<input value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} spellCheck={false} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100" /></label>
            <label className="text-xs text-zinc-400 sm:col-span-2">Description (optional)<input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100" /></label>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={busy || !draft.key.trim()} className="inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">{busy ? "Saving…" : editing ? "Save change" : "Add variable"}</button>
            {editing && <button type="button" onClick={() => { setDraft(EMPTY); setMessages([]); }} className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200">Cancel</button>}
          </div>
          <div aria-live="polite">{messages.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-amber-300">{messages.map((m) => <li key={m}>{m}</li>)}</ul>}</div>
        </form>
      ) : <p className="text-sm text-zinc-400">Only workspace owners and admins can change variables.</p>}
      <p className="text-xs leading-5 text-zinc-400">Variables are recorded configuration. Passing them into deployment workflows is a separate step that is not yet connected; this page does not change any running service.</p>
    </div>
  );
}
