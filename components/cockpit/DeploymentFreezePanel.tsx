"use client";
import { useCallback, useEffect, useState } from "react";

interface FreezeData { canEdit: boolean; environments: Array<{ id: string; name: string; tier: string }>; freezes: Array<{ reason: string; until: string; environments: string[] }>; unreadable: string[] }
const ERRORS: Record<string, string> = {
  workspace_admin_required: "Only workspace owners and admins can freeze deployments.",
  no_environments_to_freeze: "There is no environment in that scope to freeze.",
  no_matching_freeze: "No active freeze has that reason any more.",
  environments_changed: "An environment changed while saving. Nothing was changed; try again.",
  governance_configuration_mutation_unavailable: "Governance enrollment is active, so environment changes are paused.",
};
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Stop deployments now: freeze production or every environment for a set time with a reason, and end a
 * freeze early. The freeze is enforced by the change window gate for people and AI agents alike.
 */
export function DeploymentFreezePanel() {
  const [data, setData] = useState<FreezeData | "error" | null>(null);
  const [scope, setScope] = useState<"production" | "all">("production");
  const [hours, setHours] = useState(4);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const res = await fetch("/api/control/environments/freeze", { cache: "no-store" }); const body = await res.json(); setData(res.ok && body.ok ? body.data : "error"); } catch { setData("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function send(payload: Record<string, unknown>, done: (names: string[], skipped: string[]) => string) {
    setBusy(true); setMessage(null);
    try {
      const res = await fetch("/api/control/environments/freeze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string; data?: { environments: string[]; skipped: string[] } } | null;
      if (res.ok && body?.data) { setMessage(done(body.data.environments, body.data.skipped)); setReason(""); await load(); }
      else setMessage(ERRORS[body?.error ?? ""] ?? "The freeze could not be saved. Try again.");
    } catch { setMessage("The request could not be reached. Try again."); }
    finally { setBusy(false); }
  }
  if (!data) return null;
  if (data === "error") return <p role="alert" className="mt-6 text-sm text-amber-300">Deployment freeze status could not be loaded. Refresh to try again.</p>;
  const prodCount = data.environments.filter((e) => e.tier === "prod").length;
  return (
    <section aria-labelledby="deployment-freeze-heading" className="mt-6 rounded-2xl bg-[#111111] p-4">
      <h2 id="deployment-freeze-heading" className="text-xs font-normal text-zinc-400">Deployment freeze</h2>
      {data.freezes.length === 0 ? <p className="mt-3 text-sm text-zinc-300">No environment is frozen right now.</p> : (
        <ul aria-label="Active freezes" className="mt-3 space-y-2 text-sm">{data.freezes.map((f) => (
          <li key={`${f.reason}-${f.until}`} className="flex flex-wrap items-center gap-3 text-zinc-200">
            <span>{f.environments.join(", ")} frozen: {f.reason}, until {when(f.until)}.</span>
            {data.canEdit && <button type="button" disabled={busy} onClick={() => void send({ action: "end", reason: f.reason }, (names) => `Freeze ended for ${names.join(", ")}. Deployments there follow their change windows again.`)} className="text-xs text-zinc-300 underline underline-offset-2">End freeze now</button>}
          </li>))}</ul>)}
      {data.unreadable.length > 0 && <p className="mt-2 text-xs text-amber-300">Change window unreadable, so deployments are refused: {data.unreadable.join(", ")}.</p>}
      {data.canEdit && data.environments.length > 0 && (
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void send({ action: "start", scope, hours, reason: reason.trim() }, (names, skipped) => `Frozen: ${names.join(", ")}.${skipped.length ? ` Not changed: ${skipped.join("; ")}.` : ""}`); }}>
          <label className="text-xs text-zinc-400">Environments
            <select value={scope} onChange={(e) => setScope(e.target.value as "production" | "all")} className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-zinc-100">
              <option value="production" disabled={prodCount === 0}>Production ({prodCount})</option>
              <option value="all">All ({data.environments.length})</option>
            </select></label>
          <label className="text-xs text-zinc-400">For
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-zinc-100">
              {[1, 4, 12, 24, 72, 168].map((h) => <option key={h} value={h}>{h < 24 ? `${h} ${h === 1 ? "hour" : "hours"}` : `${h / 24} ${h === 24 ? "day" : "days"}`}</option>)}
            </select></label>
          <label className="min-w-56 flex-1 text-xs text-zinc-400">Reason
            <input required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Incident 42: checkout errors" className="mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-zinc-100" /></label>
          <button type="submit" disabled={busy || reason.trim().length < 3} className="inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">Freeze deployments</button>
        </form>)}
      <p aria-live="polite" className="mt-2 text-sm text-zinc-300">{message}</p>
      <p className="mt-2 text-xs text-zinc-500">A freeze refuses every deployment to those environments, including ones an AI agent requests. Ending it early returns them to their change windows.</p>
    </section>);
}
