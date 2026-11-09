"use client";
import { useCallback, useEffect, useState } from "react";

const SCOPES = [
  { id: "governance:request", label: "Request approvals and report outcomes (agents, CI)" },
  { id: "governance:read", label: "Check policy and read approval status" },
  { id: "pipeline:read", label: "Read pipeline runs" },
  { id: "release_gate:read", label: "Read the release gate" },
  { id: "webhook:read", label: "Read webhook endpoints" },
] as const;
type Key = { id: string; name: string; prefix: string; env: string; scopes: string[]; createdBy: string; lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null; createdAt: string };

/** Create and revoke this workspace's API keys. The secret is shown exactly once. */
export function ApiKeysManager() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [name, setName] = useState(""); const [scopes, setScopes] = useState<string[]>(["governance:read", "governance:request"]); const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [secret, setSecret] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/control/api-keys").then((x) => x.json()).catch(() => null);
    setKeys(r?.ok ? r.apiKeys : []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    setBusy(true); setError(null); setSecret(null);
    const r = await fetch("/api/control/api-keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, scopes, expiresInDays: days }) }).then((x) => x.json()).catch(() => null);
    if (r?.ok) { setSecret(r.apiKey.plaintext); setName(""); await load(); } else setError(r?.error === "too_many_keys" ? "This workspace already has 20 active keys. Revoke one first." : `Could not create the key (${r?.error ?? "error"}).`);
    setBusy(false);
  }
  async function revoke(id: string) {
    setBusy(true);
    await fetch(`/api/control/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    await load(); setBusy(false);
  }
  const now = Date.now();
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section aria-label="Create an API key" className="rounded-xl border border-white/[0.08] p-5">
        <h2 className="text-sm font-medium text-zinc-100">Create a key</h2>
        <label htmlFor="key-name" className="mt-4 block text-xs text-zinc-400">Name</label>
        <input id="key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="cursor-ci" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm" />
        <fieldset className="mt-4"><legend className="text-xs text-zinc-400">Permissions</legend>
          {SCOPES.map((s) => <label key={s.id} className="mt-2 flex items-start gap-2 text-sm text-zinc-300"><input type="checkbox" checked={scopes.includes(s.id)} onChange={(e) => setScopes((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} className="mt-1" /><span>{s.label} <span className="font-mono text-xs text-zinc-500">{s.id}</span></span></label>)}
        </fieldset>
        <label htmlFor="key-days" className="mt-4 block text-xs text-zinc-400">Expires after</label>
        <select id="key-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm">{[7, 30, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
        <button type="button" disabled={busy || !name.trim() || scopes.length === 0} onClick={() => void create()} className="mt-4 rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50">Create key</button>
        {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
        {secret && <div role="status" className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/[0.05] p-3"><p className="text-xs text-amber-200">Copy this key now. It will not be shown again.</p><code className="mt-2 block break-all font-mono text-xs text-zinc-100">{secret}</code></div>}
      </section>
      <section aria-label="Workspace API keys" className="rounded-xl border border-white/[0.08] p-5">
        <h2 className="text-sm font-medium text-zinc-100">Keys</h2>
        {keys === null ? <p className="mt-3 text-sm text-zinc-500">Loading…</p> : keys.length === 0 ? <p className="mt-3 text-sm text-zinc-500">No keys yet.</p> :
          <ul className="mt-3 divide-y divide-white/[0.06]">{keys.map((k) => {
            const state = k.revokedAt ? "revoked" : k.expiresAt && new Date(k.expiresAt).getTime() <= now ? "expired" : "active";
            return <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div><p className="text-zinc-100">{k.name} <span className="font-mono text-xs text-zinc-500">{k.prefix}…</span></p><p className="text-xs text-zinc-500">{k.scopes.join(", ")} · by {k.createdBy} · {state === "active" && k.expiresAt ? `expires ${k.expiresAt.slice(0, 10)}` : state}{k.lastUsedAt ? ` · last used ${k.lastUsedAt.slice(0, 10)}` : ""}</p></div>
              {state === "active" && <button type="button" disabled={busy} onClick={() => void revoke(k.id)} className="rounded-md border border-white/15 px-3 py-1 text-xs text-zinc-200">Revoke</button>}
            </li>;
          })}</ul>}
      </section>
    </div>
  );
}
