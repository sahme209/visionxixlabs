import { useEffect, useRef, useState, type RefObject } from "react";
import { observedAirflowInstant } from "../../../lib/desktop/releaseBatchReadinessContract";
import { desktopClient, type AirflowTaskPage } from "../lib/desktopClient";

function taskInstant(value: string | null) {
  return observedAirflowInstant.safeParse(value).success && value ? new Date(value).toISOString() : null;
}

function TaskTiming({ task }: { task: AirflowTaskPage["tasks"][number] }) {
  const started = taskInstant(task.startedAt);
  const reportedEnd = taskInstant(task.endedAt);
  const ended = started && reportedEnd && reportedEnd < started ? null : reportedEnd;
  return <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-zinc-400">
    {[["Started", started], ["Ended", ended]].map(([label, instant]) => <div key={label} className="flex flex-wrap gap-x-1">
      <dt>{label} (UTC)</dt>
      <dd>{instant ? <time dateTime={instant}>{instant.slice(0, 19).replace("T", " ")}</time> : "Unavailable"}</dd>
    </div>)}
  </dl>;
}

/** Read-only observations. Task state never grants deployment authority. */
export function AirflowRunTasks({ dagId, runId, release, inspectButtonRef }: {
  dagId: string;
  runId: string;
  release?: { id: string; version: number };
  inspectButtonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const generation = useRef(0);
  const inFlight = useRef(false);
  const localButton = useRef<HTMLButtonElement>(null);
  const primaryButton = inspectButtonRef ?? localButton;
  const [revision] = useState(desktopClient.getContextRevision);
  const [page, setPage] = useState<AirflowTaskPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [offsets, setOffsets] = useState([0]);
  const [failed, setFailed] = useState(false);
  useEffect(() => { const request = generation; return () => { request.current++; }; }, []);
  async function load(trail: number[]) {
    if (inFlight.current || revision !== desktopClient.getContextRevision()) return;
    inFlight.current = true;
    const request = ++generation.current;
    const offset = trail[trail.length - 1];
    setBusy(true);
    setOffsets(trail);
    setFailed(false);
    setPage(null);
    const current = () => request === generation.current && revision === desktopClient.getContextRevision();
    try {
      const result = await (release ? desktopClient.releaseBatchTasks(release.id, release.version, dagId, runId, offset)
        : desktopClient.listAirflowTaskInstances(dagId, runId, offset));
      if (!current()) return;
      if (result.ok && result.data.offset === offset) setPage(result.data); else setFailed(true);
    } catch { if (current()) setFailed(true); }
    finally { inFlight.current = false; if (current()) setBusy(false); }
  }
  function changePage(button: HTMLButtonElement, trail: number[]) {
    if (inFlight.current || revision !== desktopClient.getContextRevision()) return;
    if (button === document.activeElement) primaryButton.current?.focus();
    void load(trail);
  }

  const runLabel = release ? `${dagId} / ${runId}` : runId;
  return <section aria-label={`Tasks for ${runLabel}`} className="mt-2 rounded-lg border border-white/10 p-3 text-xs">
    {release && <h4 className="mb-2 break-all text-zinc-300">Tasks for {runLabel}</h4>}
    <button ref={primaryButton} type="button" aria-disabled={busy} onClick={() => void load(offsets)} className="underline aria-disabled:opacity-40">
      {busy ? "Loading tasks…" : failed ? "Retry tasks" : page ? "Refresh tasks" : "Inspect tasks"}
    </button>
    {failed && <p role="alert">Task state could not be loaded. No execution outcome is confirmed.</p>}
    <p role="status" className={page ? "mt-2 text-zinc-400" : "sr-only"}>
      {page && `${page.tasks.length ? `${page.offset + 1}–${page.offset + page.tasks.length}` : "0"} of ${page.totalEntries} tasks · observed state only`}
    </p>
    {page && <>
      <ul>{page.tasks.map((task) => <li key={JSON.stringify([task.taskId, task.mapIndex])} className="mt-2 wrap-break-word">
        <span>{task.taskId}{task.mapIndex >= 0 ? ` [${task.mapIndex}]` : ""} · {task.state ?? "Not scheduled"} · try {task.tryNumber}</span>
        {release && <TaskTiming task={task} />}
      </li>)}</ul>
      {offsets.length > 1 && <button disabled={busy} onClick={event => changePage(event.currentTarget, offsets.slice(0, -1))} className="mr-3 mt-2 underline">Previous task page</button>}
      {page.tasks.length > 0 && page.offset + page.tasks.length < page.totalEntries && <button disabled={busy} onClick={event => changePage(event.currentTarget, [...offsets, page.offset + page.tasks.length])} className="mt-2 underline">Next task page</button>}
    </>}
  </section>;
}
