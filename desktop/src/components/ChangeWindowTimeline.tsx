import { useEffect, useState } from "react";
import { changeWindowState, formatCountdown } from "../../../lib/releaseops/changeWindowState";
import { StatusIconChip } from "./StatusBadge";

const fmt = (iso: string, timeZone: string) => {
  try { return new Date(iso).toLocaleString([], { timeZone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return new Date(iso).toLocaleString(); }
};

/** Live position of "now" against the recorded change window. The window is recorded; the clock is this device's. */
export function ChangeWindowTimeline({ window, now: fixedNow }: { window: { startUtc: string; endUtc: string; displayTimeZone: string }; now?: Date }) {
  const [tick, setTick] = useState(() => fixedNow ?? new Date());
  useEffect(() => {
    if (fixedNow) return;
    const id = setInterval(() => setTick(new Date()), 30_000);
    return () => clearInterval(id);
  }, [fixedNow]);
  const state = changeWindowState(window, fixedNow ?? tick);
  if (state.phase === "unreadable") return <p className="change-window-timeline-note" role="status">The recorded change window could not be read.</p>;
  const headline = state.phase === "upcoming" ? `Opens in ${formatCountdown(state.msToBoundary!)}`
    : state.phase === "open" ? `Open now · closes in ${formatCountdown(state.msToBoundary!)}` : "Window ended";
  const look = state.phase === "open" ? { tone: "green" as const, shape: "running" as const } : state.phase === "upcoming" ? { tone: "blue" as const, shape: "waiting" as const } : { tone: "red" as const, shape: "closed" as const };
  return (
    <section className="change-window-timeline" data-phase={state.phase} aria-label="Change window">
      <div className="change-window-timeline-head">
        <StatusIconChip tone={look.tone} shape={look.shape} size={12} />
        <strong>{headline}</strong>
        <span>{formatCountdown(state.durationMs)} window · {window.displayTimeZone}</span>
      </div>
      <div className="change-window-timeline-track" aria-hidden="true">
        <span className="change-window-timeline-fill" style={{ width: `${state.progress * 100}%` }} />
        {state.phase === "open" && <span className="change-window-timeline-now" style={{ left: `${state.progress * 100}%` }} />}
      </div>
      <div className="change-window-timeline-ends">
        <time dateTime={window.startUtc}>{fmt(window.startUtc, window.displayTimeZone)}</time>
        <time dateTime={window.endUtc}>{fmt(window.endUtc, window.displayTimeZone)}</time>
      </div>
      <p className="change-window-timeline-note">Times come from the recorded window; the countdown uses this device’s clock. Being inside the window does not approve a deployment.</p>
    </section>
  );
}
