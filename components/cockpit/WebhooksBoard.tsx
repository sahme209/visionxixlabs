"use client";
import { useCallback, useEffect, useState } from "react";
import { WEBHOOK_EVENT_CATALOG } from "@/lib/webhooks/webhookEventCatalog";

interface Endpoint { id: string; name: string; url: string; subscribedEvents: string[]; consecutiveFailures: number; createdAt: string }
const ERRORS: Record<string, string> = {
  workspace_admin_required: "Only workspace owners and admins can change webhooks.",
  url_wrong_protocol: "Use an https:// address.",
  url_localhost_blocked: "Use a public address; localhost is refused.",
  url_private_ip_blocked: "Use a public address; private and internal addresses are refused.",
  url_url_unparseable: "Enter a valid https:// address.",
  no_valid_events: "Choose at least one event.",
  webhook_limit_reached: "This workspace already has 20 webhooks.",
  governance_enrolled_destination_increase: "Governance enrollment is active, so new outbound destinations are paused.",
};
const groups = [...new Set(WEBHOOK_EVENT_CATALOG.map((e) => e.group))];

/** Workspace webhooks: choose events, get a signing secret once, revoke at any time. */
export function WebhooksBoard() {
  const [data, setData] = useState<{ canEdit: boolean; endpoints: Endpoint[] } | "error" | null>(null);
  const [name, setName] = useState(""); const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["deployment.blocked", "agent_gateway.request_pending"]);
  const [message, setMessage] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; secret: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const res = await fetch("/api/control/webhooks", { cache: "no-store" }); const body = await res.json(); setData(res.ok && body.ok ? body.data : "error"); } catch { setData("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function create() {
    setBusy(true); setMessage(null); setCreated(null);
    try {
      const res = await fetch("/api/control/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), url: url.trim(), events }) });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string; data?: { name: string; secret: string } } | null;
      if (res.ok && body?.ok && body.data) { setCreated({ name: body.data.name, secret: body.data.secret }); setName(""); setUrl(""); await load(); }
      else setMessage(ERRORS[body?.error ?? ""] ?? (body?.error?.startsWith("url_") ? "That address is not allowed. Use a public https:// address." : "The webhook could not be created. Try again."));
    } catch { setMessage("The request could not be reached. Try again."); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setMessage(null);
    try { const res = await fetch("/api/control/webhooks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); if (!res.ok) setMessage("The webhook could not be revoked. Try again."); await load(); }
    finally { setBusy(false); }
  }
  if (data === "error") return <p role="alert" className="mt-8 text-sm text-amber-300">Webhooks could not be loaded. Refresh to try again.</p>;
  if (!data) return <p className="mt-8 text-sm text-zinc-400">Loading webhooks…</p>;
  return (
    <div className="mt-8 space-y-8">
      {data.endpoints.length === 0 ? <p className="text-sm text-zinc-400">No webhooks yet.</p> : (
        <ul aria-label="Webhooks" className="divide-y divide-white/[0.07] rounded-xl border border-white/8">{data.endpoints.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1"><p className="text-zinc-100">{e.name}</p><p className="break-all font-mono text-xs text-zinc-400">{e.url}</p><p className="mt-1 text-xs text-zinc-400">{e.subscribedEvents.join(", ")}{e.consecutiveFailures > 0 ? <span className="text-amber-300"> · {e.consecutiveFailures} failed deliveries in a row</span> : null}</p></div>
            {data.canEdit && <button type="button" disabled={busy} onClick={() => void revoke(e.id)} aria-label={`Revoke webhook ${e.name}`} className="text-xs text-zinc-300 underline underline-offset-2">Revoke</button>}
          </li>))}</ul>)}
      {created && <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm"><p className="text-amber-200">Signing secret for {created.name}. Copy it into your receiver now; it will not be shown again.</p><p className="mt-2 break-all font-mono text-xs text-zinc-100">{created.secret}</p><p className="mt-2 text-xs text-zinc-400">Verify the signature header on every delivery with this secret. See the webhooks section of the SDK README.</p></div>}
      {data.canEdit ? (
        <form className="rounded-xl border border-white/8 bg-[#111111] p-5" onSubmit={(e) => { e.preventDefault(); void create(); }}>
          <h2 className="text-base font-medium">Add a webhook</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">Name<input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Slack bridge" className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100" /></label>
            <label className="text-xs text-zinc-400">Address (https)<input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.example.com/v19" spellCheck={false} className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm text-zinc-100" /></label>
          </div>
          <fieldset className="mt-4"><legend className="text-xs text-zinc-400">Events</legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">{groups.map((g) => (
              <div key={g}><p className="text-xs font-medium text-zinc-300">{g}</p>
                {WEBHOOK_EVENT_CATALOG.filter((e) => e.group === g).map((e) => (
                  <label key={e.kind} className="mt-1.5 flex items-start gap-2 text-xs text-zinc-300"><input type="checkbox" checked={events.includes(e.kind)} onChange={() => setEvents(events.includes(e.kind) ? events.filter((k) => k !== e.kind) : [...events, e.kind])} className="mt-0.5" /><span><span className="font-mono text-zinc-200">{e.kind}</span><br /><span className="text-zinc-400">{e.description}</span></span></label>))}
              </div>))}</div>
          </fieldset>
          <button type="submit" disabled={busy || !name.trim() || !url.trim() || events.length === 0} className="mt-4 inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">Add webhook</button>
          <p aria-live="polite" className="mt-2 text-sm text-amber-300">{message}</p>
        </form>
      ) : <p className="text-sm text-zinc-400">Only workspace owners and admins can change webhooks.</p>}
    </div>);
}
