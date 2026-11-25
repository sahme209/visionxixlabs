import { CircleCheck, CircleDot, CircleX, Clock3 } from "lucide-react";
import { AirflowRunTasks } from "./AirflowRunTasks";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ReleaseBatchDeclarations, ReleaseBatchRunObservation } from "../../../lib/desktop/releaseBatchReadinessContract";
import { desktopClient } from "../lib/desktopClient";

function ObservedRunTime({value}: {value: string | null}) {
  if (!value) return <>Unavailable</>;
  const instant = new Date(value).toISOString();
  return <time dateTime={instant}>{instant.slice(0, 19).replace("T", " ")}</time>;
}

function observedDuration(timing: ReleaseBatchRunObservation["timing"]): string | undefined {
  if (!timing?.startedAt || !timing.endedAt) return undefined;
  const elapsed = Date.parse(timing.endedAt) - Date.parse(timing.startedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) return undefined;
  const totalSeconds = Math.floor(elapsed / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours > 0 ? `${hours}h` : "",
    hours > 0 || minutes > 0 ? `${minutes}m` : "",
    `${seconds}s`,
  ];
  return parts.filter(Boolean).join(" ");
}

const runStateLabels = { queued: "Queued", running: "Running", success: "Succeeded", failed: "Failed" };

const runStateIcons = { queued: Clock3, running: CircleDot, success: CircleCheck, failed: CircleX };

function ObservedRunStatus({state}: {state: ReleaseBatchRunObservation["state"]}) {
  const Icon = runStateIcons[state];
  return <span className="studio-batches-observed-state" data-run-state={state}>
    <Icon size={13} aria-hidden="true" />
    <span>{runStateLabels[state]}</span>
  </span>;
}

type SavedRuns = ReleaseBatchDeclarations["runs"];
const runIdentity = (run: SavedRuns[number]) => JSON.stringify([run.dagId, run.dagRunId]);

function matchRuns(saved: SavedRuns, other: SavedRuns) {
  const identities = new Set(saved.map(runIdentity));
  return saved.length === other.length && other.every(run => identities.delete(runIdentity(run))) && identities.size === 0;
}

const runMismatchMessage = "Observed runs do not match the saved release runs. Check again or reopen release details.";

type SavedRunLookup = {key: string; config: typeof desktopClient.config} & (
  | {state: "ready"; runs: ReleaseBatchDeclarations["runs"]}
  | {state: "retrying" | "unavailable"}
);

export function ReleaseBatchReadiness({ requestId, version, count, inspectTasks = false, renderProgress, releaseClosed = false, onConfirmedClosed }: {
  requestId: string;
  version: number;
  count: number;
  inspectTasks?: boolean;
  releaseClosed?: boolean;
  onConfirmedClosed?: () => void;
  renderProgress?: (status: string, complete: boolean) => ReactNode;
}) {
  const failedRunButton = useRef<HTMLButtonElement>(null);
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const key = JSON.stringify([requestId, version, count, revision]);
  const owner = useRef<string | null>(key); owner.current = key;
  useEffect(() => { owner.current = key; return () => { owner.current = null; }; }, [key]);
  const [read, setRead] = useState<{ key: string; config: typeof desktopClient.config; busy: boolean; message?: string; checkedAt?: string; runs?: ReleaseBatchRunObservation[]; selectionChanged?: boolean; closed?: boolean; complete?: boolean; waiting?: boolean }>();
  const current = read?.key === key && read.config === desktopClient.config ? read : undefined;
  const closed = releaseClosed || current?.closed === true;
  const [saved, setSaved] = useState<SavedRunLookup>();
  const [savedRetry, setSavedRetry] = useState(0);
  const savedForRelease = saved?.key === key && saved.config === desktopClient.config ? saved : undefined;
  const savedRetryButton = useRef<HTMLButtonElement>(null);
  const savedTable = useRef<HTMLTableElement>(null);
  const observedTable = useRef<HTMLTableElement>(null);
  const focusSavedTable = useRef<string | null>(null);
  useEffect(() => {
    if (!inspectTasks || closed) return;
    const config = desktopClient.config;
    let cancelled = false;
    async function load() {
      const result = await desktopClient.releaseBatchDeclarations(requestId, version).catch(() => null);
      if (cancelled || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
      const match = result?.ok && result.data.requestId === requestId && result.data.version === version && result.data.runs.length === count;
      if (match && document.activeElement === savedRetryButton.current) focusSavedTable.current = key;
      setSaved(previous => {
        if (previous?.key === key && previous.config === config && previous.state === "ready") return previous;
        return match ? {key, config, state: "ready", runs: result.data.runs} : {key, config, state: "unavailable"};
      });
    }
    void load();
    return () => { cancelled = true; };
  }, [closed, count, inspectTasks, key, requestId, revision, savedRetry, version]);
  const savedRuns = savedForRelease?.state === "ready" ? savedForRelease.runs : undefined;
  const runMismatch = Boolean(savedRuns && current?.runs && !matchRuns(savedRuns, current.runs));
  const needsSavedRuns = Boolean(inspectTasks && current?.runs && !savedRuns);
  const verifyingSavedRuns = needsSavedRuns && savedForRelease?.state !== "unavailable";
  const observedRuns = closed || runMismatch || needsSavedRuns ? undefined : current?.runs;
  const message = closed ? (current?.closed && !onConfirmedClosed ? current.message : undefined)
    : verifyingSavedRuns ? "Verifying saved run identities…"
    : needsSavedRuns ? "Batch completion could not be verified."
    : runMismatch ? runMismatchMessage : current?.message;
  const showSaved = !closed && inspectTasks && !observedRuns && !current?.selectionChanged;
  const declarations = showSaved && savedForRelease?.state === "ready" ? savedForRelease.runs : undefined;
  useLayoutEffect(() => {
    const table = observedTable.current ?? savedTable.current;
    if (focusSavedTable.current !== key || !table) return;
    focusSavedTable.current = null;
    table.focus();
  }, [declarations, key, observedRuns]);
  const flight = useRef<{ key: string; config: typeof desktopClient.config } | null>(null);
  async function refresh() {
    const config = desktopClient.config, selected = key;
    if (closed || (flight.current?.key === selected && flight.current.config === config)) return;
    const operation = {key: selected, config};
    flight.current = operation;
    let selectionChanged = current?.selectionChanged ?? false;
    setRead({ key: selected, config, busy: true, selectionChanged });
    let message = "Batch completion could not be verified.";
    let runs: ReleaseBatchRunObservation[] | undefined;
    let complete = false;
    let confirmedClosed = false;
    let waiting = false;
    let declared: ReleaseBatchDeclarations["runs"] | undefined;
    try {
      const result = inspectTasks ? await desktopClient.releaseBatchReadiness(requestId, version, true)
        : await desktopClient.releaseBatchReadiness(requestId, version);
      if (result.ok) {
        const observations = result.data.observations;
        const selection = observations ?? result.data.declarations;
        const matches = !selection || (selection.requestId === requestId && selection.version === version && selection.runs.length === count);
        if (inspectTasks && matches) declared = result.data.declarations?.runs;
        if (matches) runs = observations?.runs;
        if (selection && matches) selectionChanged = false;
        if (!matches) {
          selectionChanged = true;
          message = "The batch count or release version changed. Refresh the release.";
        }
        else if (inspectTasks && !observations && (result.data.ready || result.data.reason === "waiting")) {
          message = "Run observations are missing. Check batches again to verify the saved runs.";
        }
        else if (result.data.ready && result.data.requestVersion === version) {
          complete = true;
          message = "Selected batches completed. Release approval is still required.";
        }
        else if (!result.data.ready && result.data.reason === "waiting") {
          waiting = true;
          message = "Selected batches have not all completed yet. This is normal while they run; check again later.";
        }
        else if (!result.data.ready && result.data.reason === "changed") {
          selectionChanged = true;
          confirmedClosed = result.data.closedRelease?.requestId === requestId && result.data.closedRelease.version === version;
          message = confirmedClosed
            ? "This saved release was closed. Refresh the release list to open its recorded closure."
            : "Release or connection changed. Reopen release details.";
        }
        else if (runs?.some(run => run.state === "failed")) message = "A declared run failed, so batch completion is not verified. Review the run in Airflow, then check batches again.";
      }
    } catch { /* Keep the safe unavailable message. */ }
    finally { if (flight.current === operation) flight.current = null; }
    if (owner.current !== selected || config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
    if (declared) {
      if (document.activeElement === savedRetryButton.current) focusSavedTable.current = key;
      const reportedRuns = declared;
      setSaved(previous => previous?.state === "ready" && previous.key === selected && previous.config === config
        ? previous : {key: selected, config, state: "ready", runs: reportedRuns});
    }
    setRead({ key: selected, config, busy: false, message, runs, selectionChanged, closed: confirmedClosed, complete, waiting, checkedAt: new Date().toISOString() });
    if (confirmedClosed) onConfirmedClosed?.();
  }
  const firstFailedRun = inspectTasks ? observedRuns?.find(run => run.state === "failed") : undefined;
  const failedCount = observedRuns?.filter(run => run.state === "failed").length;
  const succeededCount = observedRuns?.filter(run => run.state === "success").length;
  let progress = "Awaiting check";
  if (closed) progress = "Release closed";
  else if (current?.busy) progress = "Checking…";
  else if (verifyingSavedRuns) progress = "Checking…";
  else if (runMismatch || needsSavedRuns) progress = "Unverified";
  else if (current?.selectionChanged) progress = "Release changed";
  else if (succeededCount !== undefined) {
    progress = `${succeededCount} / ${count} completed${failedCount ? ` · ${failedCount} failed` : ""}`;
  } else if (current?.complete) progress = "Completed";
  else if (current?.waiting) progress = "Still waiting";
  else if (current) progress = "Unverified";

  return <>
    {renderProgress?.(progress, Boolean(!closed && current?.complete && !runMismatch && !needsSavedRuns))}
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2">
    <div><p className="text-xs text-zinc-300">{count} specific {count === 1 ? "batch" : "batches"} required</p>{message && <p role="status" className="mt-1 text-xs text-zinc-400">{message}</p>}{!closed && current?.checkedAt && <p className="mt-1 text-[10px] text-zinc-500">Last checked {new Date(current.checkedAt).toLocaleTimeString()} · refresh for current evidence</p>}</div>
    <button type="button" className="btn-secondary shrink-0" aria-disabled={closed || Boolean(current?.busy)} onClick={() => void refresh()}>{!closed && current?.busy ? "Checking batches…" : "Check batches"}</button>
    </div>
    {showSaved && !declarations && <div className="studio-batches-saved-status">
      <p role="status">{savedForRelease?.state === "unavailable" ? "Saved run details could not be verified." : "Loading saved run details…"}</p>
      {savedForRelease && <button type="button" ref={savedRetryButton} className="btn-secondary"
        aria-disabled={savedForRelease.state === "retrying" || Boolean(current?.busy)}
        onClick={() => {
          if (savedForRelease.state !== "unavailable" || current?.busy ||
            savedForRelease.config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
          setSaved({...savedForRelease, state: "retrying"});
          setSavedRetry(value => value + 1);
        }}>Retry saved runs</button>}
    </div>}
    {declarations && <table ref={savedTable} tabIndex={-1} aria-label="Saved Airflow runs" className="mt-3 w-full table-fixed text-left text-xs">
      {inspectTasks && <caption className="studio-batches-run-caption">Saved Airflow runs</caption>}
      <thead className="text-zinc-400"><tr>
        <th scope="col" className="w-[28%] p-2 font-normal">Workflow</th>
        <th scope="col" className="w-[44%] p-2 font-normal">Run</th>
        <th scope="col" className="w-[28%] p-2 font-normal">Status</th>
      </tr></thead>
      <tbody>{declarations.map(run => <tr key={JSON.stringify([run.dagId, run.dagRunId])} className="border-t border-white/10">
        <th scope="row" className="break-all p-2 font-normal text-zinc-200">{run.dagId}</th>
        <td className="break-all p-2 font-mono text-zinc-300">{run.dagRunId}</td>
        <td className="break-words p-2 text-zinc-300">Unverified</td>
      </tr>)}</tbody>
    </table>}
    {inspectTasks && succeededCount !== undefined && count > 0 && <div className="studio-batches-observed-progress">
      <div><span>Observed Airflow runs</span><strong>{succeededCount} of {count} succeeded</strong></div>
      <progress aria-label="Observed Airflow run success" aria-valuetext={`${succeededCount} of ${count} succeeded`}
        value={succeededCount} max={count} />
    </div>}
    {observedRuns && <table ref={observedTable} tabIndex={-1} aria-label="Observed Airflow runs" className="studio-batches-observed-runs mt-3 w-full table-fixed text-left text-xs">
      {inspectTasks && <caption className="studio-batches-run-caption">Observed Airflow runs</caption>}
      <thead className="text-zinc-400"><tr>
        <th scope="col" className="w-[24%] p-2 font-normal">Workflow</th>
        <th scope="col" className="w-[32%] p-2 font-normal">Run</th>
        <th scope="col" className="w-[16%] p-2 font-normal">Status</th>
        <th scope="col" className="w-[28%] p-2 font-normal">Timing (UTC)</th>
      </tr></thead>
      <tbody>
        {observedRuns.map(run => {
          const duration = inspectTasks && (run.state === "success" || run.state === "failed") ? observedDuration(run.timing) : undefined;
          return <Fragment key={JSON.stringify([run.dagId, run.dagRunId])}>
            <tr className="border-t border-white/10">
              <th scope="row" className="break-all p-2 font-normal text-zinc-200">{run.dagId}</th>
              <td className="break-all p-2 font-mono text-zinc-300">{run.dagRunId}</td>
              <td className="break-words p-2 text-zinc-300">{inspectTasks ? <ObservedRunStatus state={run.state} /> : runStateLabels[run.state]}</td>
              <td className="break-words p-2 text-zinc-300">{run.timing ? <dl>
                <div><dt className="text-zinc-400">Started</dt><dd><ObservedRunTime value={run.timing.startedAt} /></dd></div>
                <div className="mt-1"><dt className="text-zinc-400">Ended</dt><dd><ObservedRunTime value={run.timing.endedAt} /></dd></div>
                {duration && <div className="mt-1"><dt className="text-zinc-400">Duration</dt><dd className="font-medium tabular-nums">{duration}</dd></div>}
              </dl> : "Unavailable"}</td>
            </tr>
            {inspectTasks && <tr><td colSpan={4} className="px-2 pb-3">
              <AirflowRunTasks key={key} dagId={run.dagId} runId={run.dagRunId} release={{id: requestId, version}}
                inspectButtonRef={run === firstFailedRun ? failedRunButton : undefined} />
            </td></tr>}
          </Fragment>;
        })}
      </tbody>
    </table>}
    {inspectTasks && failedCount !== undefined && <div className="studio-batches-run-summary">
      <p role="status">{failedCount} failed {failedCount === 1 ? "run" : "runs"}</p>
      {firstFailedRun && <button type="button" className="btn-secondary shrink-0" onClick={() => {
        if (current?.config !== desktopClient.config || revision !== desktopClient.getContextRevision()) return;
        const inspect = failedRunButton.current;
        inspect?.focus();
        inspect?.click();
      }}>Inspect failed run</button>}
    </div>}
  </>;
}
