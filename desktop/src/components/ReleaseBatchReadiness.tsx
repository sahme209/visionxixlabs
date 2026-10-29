import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { desktopClient } from "../lib/desktopClient";

export function ReleaseBatchReadiness({ requestId, version, count }: { requestId: string; version: number; count: number }) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const key = JSON.stringify([requestId, version, revision]);
  const owner = useRef<string | null>(key); owner.current = key;
  useEffect(() => { owner.current = key; return () => { owner.current = null; }; }, [key]);
  const [read, setRead] = useState<{ key: string; config: typeof desktopClient.config; busy: boolean; message?: string; checkedAt?: string }>();
  const current = read?.key === key && read.config === desktopClient.config ? read : undefined;
  async function refresh() {
    if (current?.busy) return;
    const config = desktopClient.config, selected = key;
    setRead({ key: selected, config, busy: true });
    let message = "Batch completion could not be verified.";
    try {
      const result = await desktopClient.releaseBatchReadiness(requestId, version);
      if (result.ok) {
        if (result.data.ready && result.data.requestVersion === version) message = "Selected batches completed. Release approval is still required.";
        else if (!result.data.ready && result.data.reason === "waiting") message = "Selected batches are not ready. Refresh to check again.";
        else if (!result.data.ready && result.data.reason === "changed") message = "Release or connection changed. Reopen release details.";
      }
    } catch { /* Keep the safe unavailable message. */ }
    if (owner.current === selected && config === desktopClient.config) setRead({ key: selected, config, busy: false, message, checkedAt: new Date().toISOString() });
  }
  return <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
    <div><p className="text-xs text-zinc-300">{count} specific {count === 1 ? "batch" : "batches"} required</p>{current?.message && <p role="status" className="mt-1 text-xs text-zinc-400">{current.message}</p>}{current?.checkedAt && <p className="mt-1 text-[10px] text-zinc-500">Last checked {new Date(current.checkedAt).toLocaleTimeString()} · refresh for current evidence</p>}</div>
    <button type="button" className="btn-secondary shrink-0" disabled={current?.busy} onClick={() => void refresh()}>{current?.busy ? "Checking batches…" : "Check batches"}</button>
  </div>;
}
