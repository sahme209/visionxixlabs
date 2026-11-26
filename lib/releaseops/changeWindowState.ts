/** Where "now" sits relative to a release's recorded change window. Pure; the caller supplies the clock. */
export type ChangeWindowPhase = "upcoming" | "open" | "ended" | "unreadable";
export interface ChangeWindowState {
  phase: ChangeWindowPhase;
  /** Milliseconds until the next boundary (opens or closes); null when ended or unreadable. */
  msToBoundary: number | null;
  /** 0..1 progress through the window while open; 0 before, 1 after. */
  progress: number;
  durationMs: number;
}

export function changeWindowState(window: { startUtc: string; endUtc: string }, now: Date): ChangeWindowState {
  const start = Date.parse(window.startUtc), end = Date.parse(window.endUtc), t = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { phase: "unreadable", msToBoundary: null, progress: 0, durationMs: 0 };
  const durationMs = end - start;
  if (t < start) return { phase: "upcoming", msToBoundary: start - t, progress: 0, durationMs };
  if (t < end) return { phase: "open", msToBoundary: end - t, progress: (t - start) / durationMs, durationMs };
  return { phase: "ended", msToBoundary: null, progress: 1, durationMs };
}

export function formatCountdown(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440), hours = Math.floor((minutes % 1440) / 60), mins = minutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return mins ? `${hours}h ${mins}m` : `${hours}h`;
  return minutes ? `${mins}m` : "under a minute";
}
