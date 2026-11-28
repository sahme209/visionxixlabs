"use client";
import { useCallback, useEffect, useState } from "react";
import { CAPABILITY_CATALOG, type CatalogCapability } from "@/lib/desktop/customRoleCapabilities";

interface Role { id: string; name: string; description: string; removedCapabilities: string[] }
interface Member { userId: string; email: string; role: string }
const ASSIGNABLE = new Set(["operator", "security_reviewer", "finance_viewer", "read_only"]);
const ERRORS: Record<string, string> = {
  name_invalid: "Give the role a name of up to 60 characters.", nothing_removed: "Remove at least one capability; otherwise use the built-in role.",
  role_name_taken: "A role with that name already exists.", role_limit_reached: "This workspace has 25 custom roles, the most allowed.",
  role_not_assignable_to_owner_or_admin: "Owners and admins keep their full role; custom roles apply to operators, security reviewers, finance viewers and read-only members.",
  workspace_admin_required: "Only owners and admins can change roles.",
};

/**
 * Custom roles: a built-in role with capabilities removed. They can only take away, never add, and
 * apply to operators, security reviewers, finance viewers and read-only members.
 */
export function CustomRolesPanel({ members }: { members: Member[] }) {
  const [data, setData] = useState<{ canEdit: boolean; roles: Role[]; members: Array<{ userId: string; role: string; customRoleId: string | null }> } | "error" | null>(null);
  const [draft, setDraft] = useState<{ id?: string; name: string; description: string; removed: Set<CatalogCapability> }>({ name: "", description: "", removed: new Set() });
  const [message, setMessage] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const r = await fetch("/api/control/roles", { cache: "no-store" }); const b = await r.json(); setData(r.ok && b.ok ? b.data : "error"); } catch { setData("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function send(method: string, url: string, payload: unknown, done: string) {
    setBusy(true); setMessage(null);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const b = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (r.ok && b?.ok) { setMessage({ tone: "ok", text: done }); await load(); return true; }
      setMessage({ tone: "warn", text: ERRORS[b?.error ?? ""] ?? "That could not be saved. Try again." }); return false;
    } catch { setMessage({ tone: "warn", text: "The request could not be reached. Try again." }); return false; }
    finally { setBusy(false); }
  }
  if (data === null) return <p className="text-sm text-zinc-400">Loading custom roles…</p>;
  if (data === "error") return <p role="alert" className="text-sm text-amber-300">Custom roles could not be loaded.</p>;
  const assignment = new Map(data.members.map((m) => [m.userId, m.customRoleId]));
  const input = "mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100";
  return (
    <div className="space-y-5">
      <p className="text-xs leading-5 text-zinc-400">A custom role starts from a member&apos;s built-in role and removes capabilities from it. It never adds any. Owners and admins keep their full role. Changes apply to the member&apos;s next request from the desktop app.</p>
      {data.roles.length === 0 ? <p className="text-sm text-zinc-400">No custom roles yet.</p> : (
        <ul className="divide-y divide-white/[0.07] rounded-xl border border-white/8">{data.roles.map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="text-sm text-zinc-100">{r.name}</p>{r.description && <p className="text-xs text-zinc-400">{r.description}</p>}<p className="mt-1 text-xs text-zinc-400">Removes: {r.removedCapabilities.map((c) => CAPABILITY_CATALOG.find((x) => x.id === c)?.label ?? c).join(", ")}</p></div>
            {data.canEdit && <div className="flex gap-3 text-xs"><button type="button" onClick={() => setDraft({ id: r.id, name: r.name, description: r.description, removed: new Set(r.removedCapabilities as CatalogCapability[]) })} className="text-zinc-200 underline underline-offset-2">Edit</button><button type="button" disabled={busy} aria-label={`Delete ${r.name}`} onClick={() => void send("DELETE", "/api/control/roles", { id: r.id }, `Deleted ${r.name}. Members who had it are back on their built-in role.`)} className="text-zinc-400 underline underline-offset-2">Delete</button></div>}
          </li>))}</ul>)}
      {data.canEdit && (
        <form className="rounded-xl border border-white/8 p-4" onSubmit={(e) => { e.preventDefault(); const payload = { ...(draft.id ? { id: draft.id } : {}), name: draft.name, description: draft.description, removedCapabilities: [...draft.removed] }; void send(draft.id ? "PATCH" : "POST", "/api/control/roles", payload, draft.id ? "Role updated." : "Role created.").then((ok) => { if (ok) setDraft({ name: "", description: "", removed: new Set() }); }); }}>
          <h3 className="text-sm font-medium text-zinc-100">{draft.id ? `Edit ${draft.name}` : "New custom role"}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">Name<input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Release operator, no production bypass" className={input} /></label>
            <label className="text-xs text-zinc-400">Description<input value={draft.description} maxLength={300} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={input} /></label>
          </div>
          <fieldset className="mt-3"><legend className="text-xs text-zinc-400">Remove these capabilities</legend>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">{CAPABILITY_CATALOG.map((c) => <li key={c.id}><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={draft.removed.has(c.id)} onChange={(e) => { const next = new Set(draft.removed); if (e.target.checked) next.add(c.id); else next.delete(c.id); setDraft({ ...draft, removed: next }); }} className="mt-0.5" /><span><span className="block text-zinc-100">{c.label}</span><span className="block text-zinc-500">{c.help}</span></span></label></li>)}</ul>
          </fieldset>
          <div className="mt-3 flex gap-3"><button type="submit" disabled={busy} className="inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">{draft.id ? "Save role" : "Create role"}</button>{draft.id && <button type="button" onClick={() => setDraft({ name: "", description: "", removed: new Set() })} className="text-sm text-zinc-300">Cancel</button>}</div>
        </form>)}
      {data.roles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-zinc-100">Assign to members</h3>
          <ul className="mt-2 space-y-1.5">{members.filter((m) => ASSIGNABLE.has(m.role)).map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 text-xs"><span className="min-w-0 flex-1 truncate text-zinc-200">{m.email} <span className="text-zinc-500">· {m.role.replaceAll("_", " ")}</span></span>
              <label className="sr-only" htmlFor={`custom-role-${m.userId}`}>Custom role for {m.email}</label>
              <select id={`custom-role-${m.userId}`} disabled={!data.canEdit || busy} value={assignment.get(m.userId) ?? ""} onChange={(e) => void send("POST", "/api/control/roles/assign", { userId: m.userId, customRoleId: e.target.value || null }, `Updated ${m.email}.`)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-100"><option value="">Built-in role only</option>{data.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            </li>))}</ul>
          {members.every((m) => !ASSIGNABLE.has(m.role)) && <p className="text-xs text-zinc-500">No members with a role that custom roles apply to.</p>}
        </div>)}
      <p aria-live="polite" className={`text-sm ${message?.tone === "warn" ? "text-amber-300" : "text-zinc-300"}`}>{message?.text ?? ""}</p>
    </div>
  );
}
