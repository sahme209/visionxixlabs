import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { desktopClient } from "../lib/desktopClient";
import type { ReleaseBatchWaitState } from "../lib/releaseBatchWaitContract";
import { RecordedUtcTime } from "./RecordedReleaseWindow";

const unconfirmedAction = "The monitoring action was unconfirmed.";

export function ReleaseBatchMonitor({ requestId, version, readOnly = false, releaseClosed = false, onConfirmedClosed }: {
  requestId: string; version: number; readOnly?: boolean; releaseClosed?: boolean; onConfirmedClosed?: () => void;
}) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const config = desktopClient.config;
  const key = JSON.stringify([requestId, version, revision]);
  const owner = useRef<string | null>(key); owner.current = key;
  useEffect(() => { owner.current = key; return () => { owner.current = null; }; }, [key]);
  type Entry = { key: string; config: typeof desktopClient.config; busy: boolean; data?: ReleaseBatchWaitState; error?: string };
  const [entry, setEntry] = useState<Entry>();
  const [minutes, setMinutes] = useState(60);
  const flight = useRef<{ key: string; config: typeof desktopClient.config } | null>(null);
  const current = entry?.key === key && entry.config === config ? entry : undefined;
  const confirmedClosed = current?.data?.closedRelease?.requestId === requestId && current.data.closedRelease.version === version;
  const closed = releaseClosed || confirmedClosed;
  const closedRef = useRef(closed);
  closedRef.current = closed;
  async function perform(mode: "read" | "start" | "cancel") {
    const selected = key, data = current?.data;
    const owned = () => owner.current === selected && desktopClient.config === config
      && desktopClient.getContextRevision() === revision;
    if (!owned() || closedRef.current || (readOnly && mode !== "read")) return;
    if (flight.current?.key === selected && flight.current.config === config) return;
    if (mode === "start" && (!data?.canStart || !data.monitoringEnabled)) return;
    if (mode === "cancel" && (!data?.canCancel || !data.wait)) return;
    const operation = { key: selected, config }; flight.current = operation;
    setEntry({ key: selected, config, busy: true, data });
    try {
      let unconfirmed = false;
      try {
        if (mode === "start") unconfirmed = !(await desktopClient.startReleaseBatchWait(requestId, version, Date.now() + minutes * 60_000)).ok;
        if (mode === "cancel" && data?.wait) unconfirmed = !(await desktopClient.cancelReleaseBatchWait(requestId, data.wait.id, data.wait.version)).ok;
      } catch {
        unconfirmed = true;
      }
      if (!owned()) return;
      if (closedRef.current) {
        setEntry({ key: selected, config, busy: false, error: unconfirmed ? unconfirmedAction : undefined });
        return;
      }
      const result = await desktopClient.releaseBatchWait(requestId, version);
      if (!owned()) return;
      if (result.ok && result.data.requestVersion === version) {
        const observedClosure = result.data.closedRelease?.requestId === requestId && result.data.closedRelease.version === version;
        const confirmation = observedClosure
          ? unconfirmedAction
          : "The action was unconfirmed. The saved status has been refreshed.";
        setEntry({ key: selected, config, busy: false, data: result.data, error: unconfirmed ? confirmation : undefined });
        if (observedClosure) onConfirmedClosed?.();
      } else setEntry({ key: selected, config, busy: false, error: "Monitor status is unavailable. Refresh before trying again." });
    } catch {
      if (owned()) setEntry({ key: selected, config, busy: false, error: "Monitor status is unavailable. Refresh before trying again." });
    } finally { if (flight.current === operation) flight.current = null; }
  }
  const data = closed || (readOnly && current?.busy) ? undefined : current?.data;
  const wait = data?.wait;
  let message = "";
  if (confirmedClosed && !onConfirmedClosed) message = "This saved release is closed. Refresh the release list to review its recorded closure.";
  else if (data) {
    if (wait?.status === "cancelled") message = "Batch monitoring stopped.";
    else if (wait?.phase === "preflight_required") message = "Last observation: batches finished. Release approval is still required.";
    else if (wait?.phase === "expired") message = "Batch monitoring expired. Check batches manually.";
    else if (wait?.status === "failed") message = "Batch monitoring stopped. Check batches manually.";
    else if (!data.monitoringEnabled) message = wait ? "Background monitoring is paused by the workspace." : "Background checks are unavailable. You can still check batches manually.";
    else if (wait) message = "Batch monitor saved. Refresh for current status.";
    else if (readOnly) message = "No monitoring record is saved for this release version.";
    else if (!data.canStart) message = "A deployment operator can start background checks.";
  }
  return <section aria-label="Batch monitor" className={readOnly ? "studio-batches-monitor-content" : "mt-2 flex flex-wrap items-center gap-2 text-xs"}>
    <button type="button" className="btn-secondary" aria-disabled={closed || Boolean(current?.busy)}
      onClick={() => { if (!current?.busy) void perform("read"); }}>{!closed && current?.busy ? "Loading monitor…" : current ? "Refresh monitor" : readOnly ? "View monitor status" : "Monitor batches"}</button>
    {readOnly && wait && <p className="studio-batches-monitor-state">Recorded monitor status · {wait.status.replaceAll("_", " ")}</p>}
    {message && <p role="status" className="text-zinc-400">{message}</p>}
    {readOnly && wait && <dl className="studio-batches-monitor-timing">
      <div><dt>Recorded deadline</dt><dd><RecordedUtcTime value={wait.deadlineAt}/></dd></div>
      <div><dt>Recorded next observation</dt><dd><RecordedUtcTime value={wait.nextObservationAt}/></dd></div>
    </dl>}
    {current?.error && (!closed || current.error === unconfirmedAction) && <p role="alert" className="text-amber-300">{current.error}</p>}
    {!readOnly && data?.canStart && data.monitoringEnabled && <><label className="text-zinc-400">Watch for <select aria-label="Watch duration" value={minutes} disabled={current?.busy} onChange={event => setMinutes(Number(event.target.value))} className="ml-1 rounded-sm border border-white/10 bg-zinc-900 px-2 py-1"><option value={15}>15 minutes</option><option value={60}>1 hour</option><option value={240}>4 hours</option><option value={1440}>24 hours</option></select></label><button type="button" className="btn-secondary" disabled={current?.busy} onClick={() => void perform("start")}>Start watching</button></>}
    {!readOnly && data?.canCancel && wait && <button type="button" className="btn-secondary" disabled={current?.busy} onClick={() => void perform("cancel")}>Stop watching</button>}
  </section>;
}
