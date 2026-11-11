import { useEffect, useRef, useState } from "react";
import { desktopClient, type AirflowTaskPage } from "../lib/desktopClient";

/** Read-only observations. Task state never grants deployment authority. */
export function AirflowRunTasks({ dagId, runId }: { dagId: string; runId: string }) {
  const generation = useRef(0);
  const [revision] = useState(desktopClient.getContextRevision);
  const [page, setPage] = useState<AirflowTaskPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { const request = generation; return () => { request.current++; }; }, []);
  async function load(offset: number) {
    if (revision !== desktopClient.getContextRevision()) return;
    const request = ++generation.current;
    setBusy(true); setError(false); setPage(null);
    const current = () => request === generation.current && revision === desktopClient.getContextRevision();
    try {
      const result = await desktopClient.listAirflowTaskInstances(dagId, runId, offset);
      if (!current()) return;
      if (result.ok) setPage(result.data); else setError(true);
    } catch { if (current()) setError(true); }
    finally { if (current()) setBusy(false); }
  }
  return <section aria-label={`Tasks for ${runId}`} className="mt-2 rounded-lg border border-white/10 p-3 text-xs">
    <button disabled={busy} onClick={() => void load(0)} className="underline disabled:opacity-40">{busy ? "Loading tasks…" : page ? "Refresh tasks" : "Inspect tasks"}</button>
    {error && <p role="alert">Task state could not be loaded. No execution outcome is confirmed.</p>}
    {page && <><p className="mt-2 text-zinc-400">{page.tasks.length ? `${page.offset + 1}–${page.offset + page.tasks.length}` : "0"} of {page.totalEntries} tasks · observed state only</p>
      <ul>{page.tasks.map((task) => <li key={`${task.taskId}:${task.mapIndex}`} className="mt-2 wrap-break-word">{task.taskId}{task.mapIndex >= 0 ? ` [${task.mapIndex}]` : ""} · {task.state ?? "Not scheduled"} · try {task.tryNumber}</li>)}</ul>
      {page.offset > 0 && <button disabled={busy} onClick={() => void load(Math.max(0, page.offset - 100))} className="mr-3 mt-2 underline">Previous task page</button>}
      {page.tasks.length > 0 && page.offset + page.tasks.length < page.totalEntries && <button disabled={busy} onClick={() => void load(page.offset + page.tasks.length)} className="mt-2 underline">Next task page</button>}
    </>}
  </section>;
}
