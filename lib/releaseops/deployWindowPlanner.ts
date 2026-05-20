/**
 * Pure deploy-window planner.
 *
 * Services declare allowed weekly deploy windows ("Mon-Fri 09:00-17:00
 * UTC, never on Fri after 14:00"). Given the current UTC time, return
 * which windows are open + the next window start when none is open.
 *
 * Pure / deterministic. UTC-only — caller handles tz conversion.
 */

export interface DeployWindow {
  /** Operator label. */
  label: string;
  /** 0=Sun..6=Sat. */
  daysOfWeek: readonly number[];
  /** Local UTC start time, HH:MM 24h. */
  startUtc: string;
  /** Local UTC end time, HH:MM 24h. Must be > startUtc within the same day. */
  endUtc: string;
}

export interface WindowQuery {
  windows: readonly DeployWindow[];
  /** ISO timestamp to check. Defaults to "now". */
  atIso?: string;
}

export interface WindowDecision {
  isOpen: boolean;
  openWindows: DeployWindow[];
  /** ISO of the next window start when isOpen=false; null when always open. */
  nextOpenAt: string | null;
}

const HHMM = /^([0-1]\d|2[0-3]):([0-5]\d)$/;

function parseHHMM(s: string): { h: number; m: number } | null {
  const m = HHMM.exec(s);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function minutesIntoDay(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

function windowIsOpenAt(window: DeployWindow, at: Date): boolean {
  const dow = at.getUTCDay();
  if (!window.daysOfWeek.includes(dow)) return false;
  const start = parseHHMM(window.startUtc);
  const end = parseHHMM(window.endUtc);
  if (!start || !end) return false;
  const cur = minutesIntoDay(at);
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;
  if (endMin <= startMin) return false; // disallow inverted windows
  return cur >= startMin && cur < endMin;
}

function nextOpenForWindow(window: DeployWindow, after: Date): Date | null {
  const start = parseHHMM(window.startUtc);
  const end = parseHHMM(window.endUtc);
  if (!start || !end) return null;
  // Probe up to the next 7 days for the soonest matching day.
  for (let offsetDays = 0; offsetDays < 8; offsetDays++) {
    const candidate = new Date(Date.UTC(
      after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate() + offsetDays,
      start.h, start.m, 0, 0,
    ));
    if (!window.daysOfWeek.includes(candidate.getUTCDay())) continue;
    if (candidate <= after) continue;
    return candidate;
  }
  return null;
}

export function evaluateDeployWindows(input: WindowQuery): WindowDecision {
  const at = input.atIso ? new Date(input.atIso) : new Date();
  const openWindows = input.windows.filter((w) => windowIsOpenAt(w, at));
  if (openWindows.length > 0) return { isOpen: true, openWindows, nextOpenAt: null };

  // Find the soonest next-open across all windows.
  const nextCandidates: Date[] = [];
  for (const w of input.windows) {
    const n = nextOpenForWindow(w, at);
    if (n) nextCandidates.push(n);
  }
  nextCandidates.sort((a, b) => a.getTime() - b.getTime());
  return {
    isOpen: false,
    openWindows: [],
    nextOpenAt: nextCandidates[0] ? nextCandidates[0].toISOString() : null,
  };
}
