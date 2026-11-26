/** Waterfall layout for observed Airflow task instances: each bar spans its recorded start to end on a shared axis. */
export type WaterfallTone = "green" | "red" | "blue" | "amber" | "neutral";
export interface WaterfallBar { key: string; label: string; state: string; tone: WaterfallTone; left: number; width: number; open: boolean; seconds: number | null }

export function taskTone(state: string | null): WaterfallTone {
  if (state === "success") return "green";
  if (state === "failed" || state === "upstream_failed") return "red";
  if (state === "running" || state === "restarting" || state === "deferred") return "blue";
  if (state === "queued" || state === "scheduled" || state === "up_for_retry" || state === "up_for_reschedule") return "amber";
  return "neutral";
}

/**
 * Bars only for tasks with a valid recorded start. A task still running (or with an end before its start)
 * extends to the latest recorded instant on the page and is marked open; nothing uses the wall clock.
 */
export function layoutWaterfall(tasks: ReadonlyArray<{ taskId: string; mapIndex: number; state: string | null; startedAt: string | null; endedAt: string | null }>): { bars: WaterfallBar[]; spanSeconds: number } {
  const parsed = tasks.map((task) => {
    const start = task.startedAt ? Date.parse(task.startedAt) : NaN;
    const rawEnd = task.endedAt ? Date.parse(task.endedAt) : NaN;
    const end = Number.isFinite(rawEnd) && Number.isFinite(start) && rawEnd >= start ? rawEnd : NaN;
    return { task, start, end };
  }).filter((row) => Number.isFinite(row.start));
  if (!parsed.length) return { bars: [], spanSeconds: 0 };
  const min = Math.min(...parsed.map((r) => r.start));
  const max = Math.max(...parsed.map((r) => (Number.isFinite(r.end) ? r.end : r.start)));
  const span = Math.max(1, max - min);
  const bars = parsed.sort((a, b) => a.start - b.start).map(({ task, start, end }) => {
    const open = !Number.isFinite(end);
    const stop = open ? max : end;
    return {
      key: JSON.stringify([task.taskId, task.mapIndex]),
      label: `${task.taskId}${task.mapIndex >= 0 ? ` [${task.mapIndex}]` : ""}`,
      state: task.state ?? "not scheduled",
      tone: taskTone(task.state),
      left: (start - min) / span,
      width: Math.max(0.004, (stop - start) / span),
      open,
      seconds: open ? null : Math.round((end - start) / 1000),
    };
  });
  return { bars, spanSeconds: Math.round(span / 1000) };
}
