"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { VARIABLE_ERROR_TEXT, type VariableInputError } from "@/lib/releaseops/scopedVariableMessages";
import { compareResolved } from "@/lib/releaseops/scopedVariableCompare";
import { parseSecretReference, SECRET_PROVIDERS } from "@/lib/releaseops/secretReferences";

interface Env { id: string; name: string; slug: string; tier: string }
interface Stored { key: string; value: string; scopeKey: string; description: string | null; version: number }
interface VariableSet { slug: string; name: string; selector: string; description: string | null; version: number }
interface Board { canEdit: boolean; environments: Env[]; variables: Stored[]; sets?: VariableSet[]; resolved: Array<{ environmentId: string; digest: string; variables: Array<{ key: string; value: string; source?: string; set?: string }>; appliedSets?: string[]; conflicts?: Array<{ key: string; sets: string[] }>; lastDeployment?: { digest: string; at: string; changedSince: boolean } | "unavailable" | null }>; gaps: Array<{ key: string; missingIn: string[] }> }
/** scope: "workspace", "env:<id>" or "set:<slug>". */
type Draft = { key: string; scope: string; value: string; description: string; expectedVersion?: number };
const EMPTY: Draft = { key: "", scope: "workspace", value: "", description: "" };
const scopePayload = (scope: string) => scope.startsWith("set:") ? { environmentId: null, setSlug: scope.slice(4) } : { environmentId: scope.startsWith("env:") ? scope.slice(4) : null };

const ERROR_TEXT: Record<string, string> = {
  workspace_admin_required: "Only workspace owners and admins can change variables.",
  variable_exists: "This variable already exists in that scope. Edit it instead.",
  variable_changed: "Someone changed or removed this variable after you loaded it. The list has been reloaded.",
  variable_limit_reached: "This workspace has reached its variable limit.",
  environment_not_found: "That environment no longer exists.",
  variable_set_not_found: "That variable set no longer exists.",
};

export function VariablesBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [compare, setCompare] = useState<{ from: string; to: string }>({ from: "", to: "" });

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
  const columns = [{ id: "", label: "Workspace default", scopeKey: "workspace" }, ...(board.sets ?? []).map((v) => ({ id: "", label: `Set: ${v.name}`, scopeKey: `set:${v.slug}` })), ...board.environments.map((e) => ({ id: e.id, label: e.name, scopeKey: `env:${e.id}` }))];
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
                {columns.map((c) => { const v = cell(key, c.scopeKey); const fromSet = !v && c.id ? board.resolved.find((r) => r.environmentId === c.id)?.variables.find((x) => x.key === key && x.source === "set")?.set : undefined; const inherited = !v && c.id && cell(key, "workspace");
                  return <td key={c.scopeKey} className="px-4 py-3 align-top">
                    {v ? <div className="flex items-start gap-2"><span className="break-all font-mono text-xs text-zinc-100">{v.value || <em className="text-zinc-400">empty</em>}{(() => { const ref = parseSecretReference(v.value); return ref ? <span className="mt-1 block font-sans text-[11px] text-zinc-400">Secret reference · {SECRET_PROVIDERS[ref.provider]} · resolved in your CI, never by V19</span> : null; })()}</span>
                      {board.canEdit && <span className="ml-auto flex shrink-0 gap-2 text-xs">
                        <button type="button" className="text-zinc-300 underline-offset-2 hover:underline" aria-label={`Edit ${key} in ${c.label}`} onClick={() => setDraft({ key, scope: c.scopeKey, value: v.value, description: v.description ?? "", expectedVersion: v.version })}>Edit</button>
                        <button type="button" className="text-zinc-300 underline-offset-2 hover:underline" aria-label={`Remove ${key} from ${c.label}`} disabled={busy} onClick={() => void send("DELETE", { key, ...scopePayload(c.scopeKey), expectedVersion: v.version })}>Remove</button>
                      </span>}</div>
                      : <span className="text-xs text-zinc-400">{fromSet ? `From set ${board.sets?.find((x) => x.slug === fromSet)?.name ?? fromSet}` : inherited ? "Inherits default" : "Not set"}</span>}
                  </td>; })}
              </tr>))}
            </tbody>
          </table>
        </div>)}

      {board.resolved.length > 0 && <div>
        <h2 className="text-base font-medium">Resolved fingerprints</h2>
        <p className="mt-1 text-sm text-zinc-400">A short fingerprint of what each environment resolves to. Each deployment from the desktop app records the fingerprint it was dispatched with, so you can see when configuration has changed since an environment was last deployed.</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{board.resolved.map((r) => <div key={r.environmentId} className="rounded-xl border border-white/8 bg-[#111111] p-4"><dt className="text-xs text-zinc-400">{board.environments.find((e) => e.id === r.environmentId)?.name}</dt><dd className="mt-2 font-mono text-sm text-zinc-200">{r.digest.slice(0, 12)}</dd><dd className="mt-2 text-xs"><DeployedNote last={r.lastDeployment} /></dd></div>)}</dl>
      </div>}

      <VariableSetsPanel board={board} onChanged={load} />

      <FeatureSwitches board={board} />

      {board.environments.length >= 2 && <ComparePanel board={board} compare={compare} setCompare={setCompare} />}

      {board.canEdit ? (
        <form className="rounded-xl border border-white/8 bg-[#111111] p-5" onSubmit={(e) => { e.preventDefault(); void send("POST", { key: draft.key.trim(), value: draft.value, ...scopePayload(draft.scope), description: draft.description.trim() || null, ...(editing ? { expectedVersion: draft.expectedVersion } : {}) }); }}>
          <h2 className="text-base font-medium">{editing ? `Edit ${draft.key}` : "Add a variable"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">Name<input required value={draft.key} readOnly={editing} onChange={(e) => setDraft({ ...draft, key: e.target.value.toUpperCase() })} placeholder="API_BASE_URL" className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100" /></label>
            <label className="text-xs text-zinc-400">Scope<select value={draft.scope} disabled={editing} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100">
              {columns.map((c) => <option key={c.scopeKey} value={c.scopeKey}>{c.label}</option>)}</select></label>
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
      <p className="text-xs leading-5 text-zinc-400">Variables are recorded configuration. Desktop deployments record which fingerprint they were dispatched with; passing the values into deployment workflows is not connected yet, so this page does not change any running service.</p>
    </div>
  );
}

function ComparePanel({ board, compare, setCompare }: { board: Board; compare: { from: string; to: string }; setCompare: (c: { from: string; to: string }) => void }) {
  const envs = board.environments;
  const from = compare.from || envs[envs.length - 2].id, to = compare.to || envs[envs.length - 1].id;
  const pick = (id: string) => board.resolved.find((r) => r.environmentId === id)?.variables ?? [];
  const name = (id: string) => envs.find((e) => e.id === id)?.name ?? id;
  const diff = compareResolved(pick(from), pick(to));
  const nothing = !diff.changed.length && !diff.onlyInFrom.length && !diff.onlyInTo.length;
  const select = (label: string, value: string, key: "from" | "to") => (
    <label className="text-xs text-zinc-400">{label}<select value={value} onChange={(e) => setCompare({ from, to, [key]: e.target.value })} className="mt-1 block w-48 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100">
      {envs.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>);
  return (
    <section aria-labelledby="variables-compare-heading">
      <h2 id="variables-compare-heading" className="text-base font-medium">Compare before promoting</h2>
      <p className="mt-1 text-sm text-zinc-400">What configuration changes when a release moves from one environment to the next.</p>
      <div className="mt-3 flex flex-wrap items-end gap-4">{select("From", from, "from")}<span aria-hidden="true" className="pb-2 text-zinc-500">→</span>{select("To", to, "to")}</div>
      <div aria-live="polite" className="mt-4 text-sm">
        {from === to ? <p className="text-zinc-400">Choose two different environments.</p>
          : nothing ? <p className="text-zinc-300">{name(from)} and {name(to)} resolve to the same configuration ({diff.same} {diff.same === 1 ? "variable" : "variables"}).</p>
          : <ul className="space-y-1.5 font-mono text-xs text-zinc-200">
              {diff.changed.map((c) => <li key={c.key}><span className="text-zinc-400">changes</span> {c.key}: {JSON.stringify(c.from)} → {JSON.stringify(c.to)}</li>)}
              {diff.onlyInTo.map((k) => <li key={k}><span className="text-zinc-400">only in {name(to)}</span> {k}</li>)}
              {diff.onlyInFrom.map((k) => <li key={k} className="text-amber-200"><span className="text-amber-300/80">missing in {name(to)}</span> {k}</li>)}
              {diff.same > 0 && <li className="font-sans text-zinc-400">{diff.same} unchanged</li>}
            </ul>}
      </div>
    </section>);
}

function DeployedNote({ last }: { last: { digest: string; at: string; changedSince: boolean } | "unavailable" | null | undefined }) {
  if (last === "unavailable") return <span className="text-zinc-400">Last deployment could not be read.</span>;
  if (!last) return <span className="text-zinc-400">No deployment recorded with a fingerprint yet.</span>;
  const when = new Date(last.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return last.changedSince
    ? <span className="text-amber-300">Changed since the last deployment ({when}, {last.digest.slice(0, 12)}).</span>
    : <span className="text-zinc-300">Matches the last deployment ({when}).</span>;
}

const SWITCH_ON = new Set(["on", "true", "1", "yes", "enabled"]);
const SWITCH_OFF = new Set(["off", "false", "0", "no", "disabled"]);
/** Variables named FEATURE_* read as switches: where each is on, off or set to something else, per environment. */
function FeatureSwitches({ board }: { board: Board }) {
  const keys = [...new Set(board.resolved.flatMap((r) => r.variables.map((v) => v.key)).filter((k) => k.startsWith("FEATURE_")))].sort();
  if (keys.length === 0 || board.environments.length === 0) return null;
  const valueOf = (envId: string, key: string) => board.resolved.find((r) => r.environmentId === envId)?.variables.find((v) => v.key === key)?.value;
  const chip = (v: string | undefined) => {
    if (v === undefined) return <span className="text-zinc-500">not set</span>;
    const n = v.trim().toLowerCase();
    if (SWITCH_ON.has(n)) return <span className="rounded-md border border-emerald-400/30 px-1.5 py-0.5 text-emerald-200">on</span>;
    if (SWITCH_OFF.has(n)) return <span className="rounded-md border border-white/15 px-1.5 py-0.5 text-zinc-300">off</span>;
    return <span className="font-mono text-zinc-200">{v}</span>;
  };
  return (
    <section aria-labelledby="feature-switches-heading">
      <h2 id="feature-switches-heading" className="text-base font-medium">Feature switches</h2>
      <p className="mt-1 text-sm text-zinc-400">Variables named FEATURE_… as each environment resolves them. A switch that is on in an earlier environment and off in production is staged exposure; this view only reads the values.</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full min-w-[480px] text-left text-xs">
          <caption className="sr-only">Feature switches per environment</caption>
          <thead className="bg-white/[0.03] text-zinc-400"><tr><th scope="col" className="px-4 py-2 font-medium">Switch</th>{board.environments.map((e) => <th key={e.id} scope="col" className="px-4 py-2 font-medium">{e.name}</th>)}</tr></thead>
          <tbody className="divide-y divide-white/[0.07]">{keys.map((k) => <tr key={k}><th scope="row" className="px-4 py-2 font-mono font-normal text-zinc-200">{k}</th>{board.environments.map((e) => <td key={e.id} className="px-4 py-2">{chip(valueOf(e.id, k))}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>);
}

const SET_ERROR_TEXT: Record<string, string> = {
  workspace_admin_required: "Only workspace owners and admins can change variable sets.",
  variable_set_exists: "A set with that short name already exists.",
  variable_set_changed: "Someone changed or removed this set after you loaded it. The list has been reloaded.",
  variable_set_limit_reached: "This workspace has reached its limit of 50 variable sets.",
  variable_set_invalid: "Check the short name (lowercase letters, digits, hyphens), the name, and the tag selector (for example region:eu).",
};
/** Variable sets: shared groups of variables attached to environments by tag selector. */
function VariableSetsPanel({ board, onChanged }: { board: Board; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState<{ slug: string; name: string; selector: string; expectedVersion?: number }>({ slug: "", name: "", selector: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sets = board.sets ?? [];
  const envName = (id: string) => board.environments.find((e) => e.id === id)?.name ?? id;
  const matched = (slug: string) => board.resolved.filter((r) => r.appliedSets?.includes(slug)).map((r) => envName(r.environmentId));
  const conflicts = board.resolved.flatMap((r) => (r.conflicts ?? []).map((c) => ({ env: envName(r.environmentId), ...c })));
  async function send(method: "POST" | "DELETE", payload: Record<string, unknown>) {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch("/api/control/variables/sets", { method, body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) { setDraft({ slug: "", name: "", selector: "" }); await onChanged(); return; }
      setMessage(SET_ERROR_TEXT[body?.error ?? ""] ?? "The set could not be saved. Try again.");
      if (body?.error === "variable_set_changed") await onChanged();
    } catch { setMessage("The set could not be reached. Try again."); }
    finally { setBusy(false); }
  }
  const editing = draft.expectedVersion !== undefined;
  return (
    <section aria-labelledby="variable-sets-heading">
      <h2 id="variable-sets-heading" className="text-base font-medium">Variable sets</h2>
      <p className="mt-1 text-sm text-zinc-400">A set is a shared group of variables. It applies to every environment whose tags match its selector, so a new environment tagged region:eu picks up the EU set without copying values. An environment override still wins over a set; a set wins over the workspace default.</p>
      {conflicts.length > 0 && <ul className="mt-3 list-disc rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 pl-8 text-sm text-amber-100/90">{conflicts.map((c) => <li key={`${c.env}-${c.key}`}><span className="font-mono">{c.key}</span> has different values in sets {c.sets.join(" and ")} for {c.env}; the set listed last applies. Add an environment override or remove one value.</li>)}</ul>}
      {sets.length === 0 ? <p className="mt-3 text-sm text-zinc-400">No variable sets yet.</p> : (
        <ul className="mt-3 divide-y divide-white/[0.07] rounded-xl border border-white/8">{sets.map((v) => (
          <li key={v.slug} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1"><p className="text-zinc-100">{v.name} <span className="font-mono text-xs text-zinc-400">set:{v.slug}</span></p>
              <p className="mt-1 text-xs text-zinc-400">Applies to environments tagged <span className="font-mono text-zinc-300">{v.selector}</span>: {matched(v.slug).join(", ") || "none yet"}</p></div>
            {board.canEdit && <span className="flex gap-3 text-xs">
              <button type="button" className="text-zinc-300 hover:underline" aria-label={`Edit set ${v.name}`} onClick={() => setDraft({ slug: v.slug, name: v.name, selector: v.selector, expectedVersion: v.version })}>Edit</button>
              <button type="button" className="text-zinc-300 hover:underline" aria-label={`Delete set ${v.name} and its variables`} disabled={busy} onClick={() => void send("DELETE", { slug: v.slug, expectedVersion: v.version })}>Delete</button>
            </span>}
          </li>))}</ul>)}
      {board.canEdit && <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void send("POST", { slug: draft.slug.trim(), name: draft.name, selector: draft.selector, ...(editing ? { expectedVersion: draft.expectedVersion } : {}) }); }}>
        <label className="text-xs text-zinc-400">Set short name<input required value={draft.slug} readOnly={editing} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })} placeholder="eu" className="mt-1 block w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100" /></label>
        <label className="text-xs text-zinc-400">Set name<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="EU region" className="mt-1 block w-44 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100" /></label>
        <label className="text-xs text-zinc-400">Environment tags<input required value={draft.selector} onChange={(e) => setDraft({ ...draft, selector: e.target.value })} placeholder="region:eu" spellCheck={false} className="mt-1 block w-44 rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100" /></label>
        <button type="submit" disabled={busy} className="inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">{editing ? "Save set" : "Add set"}</button>
        {editing && <button type="button" onClick={() => setDraft({ slug: "", name: "", selector: "" })} className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200">Cancel</button>}
        <p aria-live="polite" className="basis-full text-sm text-amber-300">{message}</p>
      </form>}
    </section>);
}
