import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { releaseAirflowDependencySchema, type ReleaseAirflowDependency } from "../../../lib/integrations/airflow/releaseDependencySchema";
import { desktopClient, type AirflowDagRun } from "../lib/desktopClient";

type Connection = { connectionId: string; connectionUpdatedAt: string };
/** Select observed runs only. Completion never grants release approval. */
export function ReleaseBatchSelection({ value, onChange, onIssueChange }: {
  value?: ReleaseAirflowDependency; onChange: (value: ReleaseAirflowDependency | undefined) => void; onIssueChange: (issue: string | undefined) => void;
}) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const [dagId, setDagId] = useState("");
  const [selection, setSelection] = useState("");
  const [status, setStatus] = useState<string>();
  const [busyOwner, setBusyOwner] = useState<{ key: string; config: typeof desktopClient.config }>();
  const [connection, setConnection] = useState<{ data: Connection; config: typeof desktopClient.config; revision: number }>();
  const [observed, setObserved] = useState<{ key: string; config: typeof desktopClient.config; runs: AirflowDagRun[] }>();
  const key = JSON.stringify([dagId, revision]);
  const busy = busyOwner?.key === key && busyOwner.config === desktopClient.config;
  const current = useRef<string | null>(key); current.current = key;
  useEffect(() => { current.current = key; return () => { current.current = null; }; }, [key]);
  const active = connection?.config === desktopClient.config && connection.revision === revision ? connection.data : undefined;
  const runs = observed?.key === key && observed.config === desktopClient.config ? observed.runs : [];
  const mismatched = Boolean(value && (!active || value.connectionId !== active.connectionId || value.connectionUpdatedAt !== active.connectionUpdatedAt));
  const issue = busy ? "Batch observations are being read." : mismatched ? "Read the current Airflow connection before continuing with selected batches." : undefined;
  useEffect(() => { onIssueChange(issue); }, [issue, onIssueChange]);
  async function read(kind: "connection" | "runs") {
    if (busy || (kind === "runs" && (!active || !dagId.trim()))) return;
    const owner = key, config = desktopClient.config;
    setBusyOwner({ key: owner, config }); setStatus(undefined);
    try {
      if (kind === "connection") {
        const result = await desktopClient.airflowConnection();
        if (current.current !== owner || config !== desktopClient.config) return;
        const data = result.ok ? result.data : undefined;
        if (!data?.connected || !data.connectionId || !data.connectionUpdatedAt || !Number.isFinite(Date.parse(data.connectionUpdatedAt))) {
          setConnection(undefined); setStatus("Airflow is not connected to this workspace."); return;
        }
        setConnection({ data: { connectionId: data.connectionId, connectionUpdatedAt: data.connectionUpdatedAt }, config, revision });
        setObserved(undefined); setSelection("");
      } else {
        const result = await desktopClient.listAirflowDagRuns(dagId.trim());
        if (current.current !== owner || config !== desktopClient.config) return;
        if (!result.ok || new Set(result.data.runs.map(run => run.dagRunId)).size !== result.data.runs.length
          || result.data.runs.some(run => run.dagId !== dagId.trim() || !releaseAirflowDependencySchema.safeParse({ ...active, runs: [{ dagId: run.dagId, dagRunId: run.dagRunId, logicalDate: run.logicalDate }] }).success)) {
          setObserved(undefined); setStatus("Batch runs could not be verified."); return;
        }
        setObserved({ key: owner, config, runs: result.data.runs }); setSelection("");
      }
    } catch { if (current.current === owner && config === desktopClient.config) setStatus("Batch observations could not be read."); }
    finally { if (current.current === owner && config === desktopClient.config) setBusyOwner(undefined); }
  }
  const selected = runs.find(run => run.dagRunId === selection);
  const duplicate = value?.runs.some(run => run.dagId === selected?.dagId && run.dagRunId === selected?.dagRunId);
  const wrongConnection = Boolean(value && active && (value.connectionId !== active.connectionId || value.connectionUpdatedAt !== active.connectionUpdatedAt));
  function useBatch() {
    if (!active || !selected?.logicalDate || duplicate || wrongConnection || (value?.runs.length ?? 0) >= 25) return;
    onChange({ ...active, runs: [...(value?.runs ?? []), { dagId: selected.dagId, dagRunId: selected.dagRunId, logicalDate: selected.logicalDate }] });
  }
  return <section className="col-span-2 space-y-3 rounded-lg border border-white/10 p-3">
    <div className="flex items-center justify-between gap-3"><div><p className="text-sm text-zinc-200">Required batches</p><p className="text-xs text-zinc-400">Batch completion does not approve a release.</p></div><button type="button" className="btn-secondary" disabled={busy} onClick={() => void read("connection")}>Read Airflow connection</button></div>
    {active && <p className="text-xs text-zinc-400">Airflow connection verified</p>}
    {status && <p role="status" className="text-xs text-amber-300">{status}</p>}
    {wrongConnection && <p role="status" className="text-xs text-amber-300">Remove previously selected batches before using this changed connection.</p>}
    <div className="flex gap-2"><label className="flex-1 text-xs text-zinc-400">Batch DAG<input aria-label="Batch DAG" className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2" value={dagId} disabled={busy} onChange={event => { setDagId(event.target.value); setSelection(""); }} /></label><button type="button" className="btn-secondary self-end" disabled={busy || !active || !dagId.trim()} onClick={() => void read("runs")}>Find batch runs</button></div>
    {observed?.key === key && <div className="flex gap-2"><select aria-label="Exact batch run" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs" value={selection} disabled={busy} onChange={event => setSelection(event.target.value)}><option value="">Choose a specific run</option>{runs.map(run => <option key={run.dagRunId} value={run.dagRunId}>{run.dagRunId} · {run.state}</option>)}</select><button type="button" className="btn-secondary" disabled={busy || !selected || duplicate || wrongConnection || (value?.runs.length ?? 0) >= 25} onClick={useBatch}>Use selected batch</button></div>}
    {value?.runs.map(run => <div key={JSON.stringify([run.dagId, run.dagRunId])} className="flex items-center justify-between gap-2 text-xs text-zinc-300"><span className="break-all">{run.dagId} · {run.dagRunId}<span className="block text-zinc-500">{run.logicalDate}</span></span><button type="button" aria-label={`Remove batch ${run.dagId} ${run.dagRunId}`} onClick={() => { const runs = value.runs.filter(item => item.dagId !== run.dagId || item.dagRunId !== run.dagRunId); onChange(runs.length ? { ...value, runs } : undefined); }}>Remove</button></div>)}
  </section>;
}
