import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { observedAirflowInstant } from "../../../lib/desktop/releaseBatchReadinessContract";
import { desktopClient, type AirflowTaskPage } from "../lib/desktopClient";
import { AirflowTaskWaterfall } from "./AirflowTaskWaterfall";

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

type AirflowRunTasksProps = {
  dagId: string;
  runId: string;
  release?: { id: string; version: number };
  inspectButtonRef?: RefObject<HTMLButtonElement | null>;
};

/** Read-only observations. Task state never grants deployment authority. */
export function AirflowRunTasks(props: AirflowRunTasksProps) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const { dagId, runId, release } = props;
  return <AirflowRunTaskPages key={JSON.stringify([release?.id, release?.version, dagId, runId, revision])}
    {...props} revision={revision} />;
}

function AirflowRunTaskPages({ dagId, runId, release, inspectButtonRef, revision }: AirflowRunTasksProps & { revision: number }) {
  const generation = useRef(0);
  const inFlight = useRef(false);
  const localButton = useRef<HTMLButtonElement>(null);
  const primaryButton = inspectButtonRef ?? localButton;
  const [page, setPage] = useState<AirflowTaskPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [offsets, setOffsets] = useState([0]);
  const [failure, setFailure] = useState<"unavailable" | "missing-page">();
  useEffect(() => { const request = generation; return () => { request.current++; }; }, []);
  async function load(trail: number[]) {
    if (inFlight.current || revision !== desktopClient.getContextRevision()) return;
    inFlight.current = true;
    const request = ++generation.current;
    const offset = trail[trail.length - 1];
    setBusy(true);
    setOffsets(trail);
    setFailure(undefined);
    setPage(null);
    const current = () => request === generation.current && revision === desktopClient.getContextRevision();
    try {
      const result = await (release ? desktopClient.releaseBatchTasks(release.id, release.version, dagId, runId, offset)
        : desktopClient.listAirflowTaskInstances(dagId, runId, offset));
      if (!current()) return;
      if (!result.ok || result.data.offset !== offset) {
        setFailure("unavailable");
      } else if (release && result.data.tasks.length === 0 && offset > 0 && offset >= result.data.totalEntries) {
        setFailure("missing-page");
      } else if (release && result.data.tasks.length === 0 && result.data.totalEntries > 0) {
        setFailure("unavailable");
      } else {
        setPage(result.data);
      }
    } catch { if (current()) setFailure("unavailable"); }
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
      {busy ? "Loading tasks…" : failure ? "Retry tasks" : page ? "Refresh tasks" : "Inspect tasks"}
    </button>
    {failure && <p role="alert">{failure === "missing-page"
      ? "This task page is no longer available. Return to a previous page or retry this offset."
      : "Task state could not be loaded. No execution outcome is confirmed."}</p>}
    <p role="status" className={page ? "mt-2 text-zinc-400" : "sr-only"}>
      {page && (release && page.totalEntries === 0 ? "No task instances were observed for this run."
        : `${page.tasks.length ? `${page.offset + 1}–${page.offset + page.tasks.length}` : "0"} of ${page.totalEntries} tasks · observed state only`)}
    </p>
    {page && release && page.tasks.length > 0 && <AirflowTaskWaterfall tasks={page.tasks}/>}
    {page && (release ? page.tasks.length > 0 && (
      <table aria-label="Observed task states" className="mt-2 w-full table-fixed text-start text-xs">
        <thead className="text-zinc-400"><tr>
          <th scope="col" className="w-[30%] p-2 text-start font-normal">Task</th>
          <th scope="col" className="w-[22%] p-2 text-start font-normal">Status</th>
          <th scope="col" className="w-[10%] p-2 text-start font-normal">Try</th>
          <th scope="col" className="w-[38%] p-2 text-start font-normal">Timing</th>
        </tr></thead>
        <tbody>{page.tasks.map(task => <tr key={JSON.stringify([task.taskId, task.mapIndex])} className="border-t border-white/10 align-top">
          <th scope="row" className="wrap-break-word p-2 text-start font-normal">
            {task.taskId}{task.mapIndex >= 0 ? ` [${task.mapIndex}]` : ""}
          </th>
          <td className="wrap-break-word p-2">{task.state ?? "Not scheduled"}</td>
          <td className="wrap-break-word p-2">{task.tryNumber}</td>
          <td className="wrap-break-word p-2"><TaskTiming task={task}/></td>
        </tr>)}</tbody>
      </table>
    ) : <ul>{page.tasks.map(task => <li key={JSON.stringify([task.taskId, task.mapIndex])} className="mt-2 wrap-break-word">
      {task.taskId}{task.mapIndex >= 0 ? ` [${task.mapIndex}]` : ""} · {task.state ?? "Not scheduled"} · try {task.tryNumber}
    </li>)}</ul>)}
    {offsets.length > 1 && <button type="button" aria-disabled={busy}
      onClick={event => changePage(event.currentTarget, offsets.slice(0, -1))}
      className="mr-3 mt-2 underline aria-disabled:opacity-40">Previous task page</button>}
    {page && page.tasks.length > 0 && page.offset + page.tasks.length < page.totalEntries &&
      <button type="button" onClick={event => changePage(event.currentTarget, [...offsets, page.offset + page.tasks.length])}
        className="mt-2 underline">Next task page</button>}
  </section>;
}
