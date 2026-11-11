import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { desktopClient } from "../lib/desktopClient";
import type { ReleaseBatchWaitState } from "../lib/releaseBatchWaitContract";

export function ReleaseBatchMonitor({ requestId, version }: { requestId: string; version: number }) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const key = JSON.stringify([requestId, version, revision]);
  const owner = useRef<string | null>(key); owner.current = key;
  useEffect(() => { owner.current = key; return () => { owner.current = null; }; }, [key]);
  type Entry = { key: string; config: typeof desktopClient.config; busy: boolean; data?: ReleaseBatchWaitState; error?: string };
  const [entry, setEntry] = useState<Entry>();
  const [minutes, setMinutes] = useState(60);
  const flight = useRef<{ key: string; config: typeof desktopClient.config } | null>(null);
  const current = entry?.key === key && entry.config === desktopClient.config ? entry : undefined;
  async function perform(mode: "read" | "start" | "cancel") {
    const config = desktopClient.config, selected = key, data = current?.data;
    if (flight.current?.key === selected && flight.current.config === config) return;
    if (mode === "start" && (!data?.canStart || !data.monitoringEnabled)) return;
    if (mode === "cancel" && (!data?.canCancel || !data.wait)) return;
    const operation = { key: selected, config }; flight.current = operation;
    const owned = () => owner.current === selected && desktopClient.config === config;
    setEntry({ key: selected, config, busy: true, data });
    try {
      let unconfirmed = false;
      if (mode === "start") unconfirmed = !(await desktopClient.startReleaseBatchWait(requestId, version, Date.now() + minutes * 60_000)).ok;
      if (mode === "cancel" && data?.wait) unconfirmed = !(await desktopClient.cancelReleaseBatchWait(requestId, data.wait.id, data.wait.version)).ok;
      if (!owned()) return;
      const result = await desktopClient.releaseBatchWait(requestId, version);
      if (!owned()) return;
      if (result.ok && result.data.requestVersion === version) setEntry({ key: selected, config, busy: false, data: result.data,
        error: unconfirmed ? "The action was unconfirmed. The saved status has been refreshed." : undefined });
      else setEntry({ key: selected, config, busy: false, error: "Monitor status is unavailable. Refresh before trying again." });
    } catch {
      if (owned()) setEntry({ key: selected, config, busy: false, error: "Monitor status is unavailable. Refresh before trying again." });
    } finally { if (flight.current === operation) flight.current = null; }
  }
  const data = current?.data, wait = data?.wait;
  let message = "";
  if (data) {
    if (wait?.status === "cancelled") message = "Batch monitoring stopped.";
    else if (wait?.phase === "preflight_required") message = "Last observation: batches finished. Release approval is still required.";
    else if (wait?.phase === "expired") message = "Batch monitoring expired. Check batches manually.";
    else if (wait?.status === "failed") message = "Batch monitoring stopped. Check batches manually.";
    else if (!data.monitoringEnabled) message = wait ? "Background monitoring is paused by the workspace." : "Background checks are unavailable. You can still check batches manually.";
    else if (wait) message = "Batch monitor saved. Refresh for current status.";
    else if (!data.canStart) message = "A deployment operator can start background checks.";
  }
  return <section aria-label="Batch monitor" className="mt-2 flex flex-wrap items-center gap-2 text-xs">
    <button type="button" className="btn-secondary" disabled={current?.busy} onClick={() => void perform("read")}>{current?.busy ? "Loading monitor…" : current ? "Refresh monitor" : "Monitor batches"}</button>
    {message && <p role="status" className="text-zinc-400">{message}</p>}
    {current?.error && <p role="alert" className="text-amber-300">{current.error}</p>}
    {data?.canStart && data.monitoringEnabled && <><label className="text-zinc-400">Watch for <select aria-label="Watch duration" value={minutes} disabled={current?.busy} onChange={event => setMinutes(Number(event.target.value))} className="ml-1 rounded-sm border border-white/10 bg-zinc-900 px-2 py-1"><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={240}>4 hours</option><option value={1440}>24 hours</option></select></label><button type="button" className="btn-secondary" disabled={current?.busy} onClick={() => void perform("start")}>Start watching</button></>}
    {data?.canCancel && wait && <button type="button" className="btn-secondary" disabled={current?.busy} onClick={() => void perform("cancel")}>Stop watching</button>}
  </section>;
}
