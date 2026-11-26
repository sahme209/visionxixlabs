/**
 * Environment change windows (parity item: scheduled deploys inside change windows). Pure.
 *
 * Reads Environment.changeWindowRuleJson, which has existed in the schema with this documented shape:
 *   { "weekdays": ["Mon","Tue"], "utcWindows": [{"start":"22:00","end":"06:00"}],
 *     "freezes": [{"startUtc":"2026-12-20T00:00:00Z","endUtc":"2027-01-03T00:00:00Z","reason":"Holiday freeze"}] }
 * A window whose end is not after its start crosses midnight; "weekdays" names the day it starts.
 * No rule means no window restriction. Freezes always win over windows.
 */

export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export interface ChangeWindowRule {
  weekdays: Weekday[];
  utcWindows: Array<{ start: string; end: string }>;
  freezes: Array<{ startUtc: string; endUtc: string; reason: string }>;
}
/** endUtc is null when only freezes are configured and no later freeze is known. */
export type NextOpen = { startUtc: string; endUtc: string | null };
export type ParsedRule = { kind: "none" } | { kind: "rule"; rule: ChangeWindowRule } | { kind: "unreadable"; error: string };
export type WindowDecision =
  | { open: true; reason: "no_rule" | "inside_window"; closesAt: string | null }
  | { open: false; reason: "outside_window"; nextOpen: NextOpen | null }
  | { open: false; reason: "freeze"; freezeReason: string; freezeEndsAt: string; nextOpen: NextOpen | null };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const minutes = (hhmm: string) => { const m = HHMM.exec(hhmm)!; return Number(m[1]) * 60 + Number(m[2]); };
const DAY = 86_400_000;

export function parseChangeWindowRule(json: unknown): ParsedRule {
  if (json === null || json === undefined) return { kind: "none" };
  if (typeof json !== "object" || Array.isArray(json)) return { kind: "unreadable", error: "Change window must be an object." };
  const r = json as Record<string, unknown>;
  const weekdays = r.weekdays === undefined ? [...WEEKDAYS] : r.weekdays;
  if (!Array.isArray(weekdays) || weekdays.length === 0 || !weekdays.every((d) => (WEEKDAYS as readonly string[]).includes(d as string))) return { kind: "unreadable", error: "weekdays must list day names such as Mon and Tue." };
  const windows = r.utcWindows === undefined ? [] : r.utcWindows;
  if (!Array.isArray(windows) || windows.length > 14 || !windows.every((w) => w && typeof w === "object" && HHMM.test((w as { start?: unknown }).start as string) && HHMM.test((w as { end?: unknown }).end as string))) return { kind: "unreadable", error: "utcWindows must list up to 14 windows with HH:MM start and end times in UTC." };
  const freezes = r.freezes === undefined ? [] : r.freezes;
  if (!Array.isArray(freezes) || freezes.length > 50) return { kind: "unreadable", error: "freezes must list up to 50 periods." };
  for (const f of freezes) {
    const x = f as Record<string, unknown> | null;
    const s = Date.parse(String(x?.startUtc)), e = Date.parse(String(x?.endUtc));
    if (!x || !Number.isFinite(s) || !Number.isFinite(e) || e <= s || typeof x.reason !== "string" || !x.reason.trim() || x.reason.length > 200) return { kind: "unreadable", error: "Each freeze needs startUtc, a later endUtc and a reason." };
  }
  if (windows.length === 0 && freezes.length === 0) return { kind: "none" };
  return { kind: "rule", rule: {
    weekdays: [...new Set(weekdays as Weekday[])],
    utcWindows: (windows as Array<{ start: string; end: string }>).map((w) => ({ start: w.start, end: w.end })),
    freezes: (freezes as Array<{ startUtc: string; endUtc: string; reason: string }>).map((f) => ({ startUtc: new Date(f.startUtc).toISOString(), endUtc: new Date(f.endUtc).toISOString(), reason: f.reason.trim() })),
  } };
}

/** Concrete window occurrences overlapping [from, from + days). */
function occurrences(rule: ChangeWindowRule, from: number, days: number): Array<{ start: number; end: number }> {
  if (rule.utcWindows.length === 0) return [{ start: from - DAY, end: from + days * DAY }]; // freezes only: always open otherwise
  const out: Array<{ start: number; end: number }> = [];
  const day0 = Math.floor(from / DAY) * DAY - DAY; // include yesterday for windows crossing midnight
  for (let d = 0; d <= days + 1; d++) {
    const dayStart = day0 + d * DAY;
    if (!rule.weekdays.includes(WEEKDAYS[new Date(dayStart).getUTCDay()])) continue;
    for (const w of rule.utcWindows) {
      const s = minutes(w.start), e = minutes(w.end);
      const start = dayStart + s * 60_000, end = dayStart + (e > s ? e : e + 1440) * 60_000;
      if (end > from) out.push({ start, end });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function freezeAt(rule: ChangeWindowRule, t: number) {
  return rule.freezes.find((f) => Date.parse(f.startUtc) <= t && t < Date.parse(f.endUtc));
}

/** Earliest moment at or after t that is inside a window and outside every freeze, searching 31 days. */
function nextOpen(rule: ChangeWindowRule, t: number): NextOpen | null {
  for (const occ of occurrences(rule, t, 31)) {
    let start = Math.max(occ.start, t);
    for (let guard = 0; guard < 60 && start < occ.end; guard++) {
      const f = freezeAt(rule, start);
      if (!f) {
        const nextFreeze = rule.freezes.map((x) => Date.parse(x.startUtc)).filter((s) => s > start && s < occ.end).sort((a, b) => a - b)[0];
        const end = nextFreeze ?? occ.end;
        return { startUtc: new Date(start).toISOString(), endUtc: rule.utcWindows.length === 0 && !nextFreeze ? null : new Date(end).toISOString() };
      }
      start = Date.parse(f.endUtc);
    }
  }
  return null;
}

export function evaluateChangeWindow(parsed: ParsedRule, now: Date): WindowDecision {
  if (parsed.kind !== "rule") return { open: true, reason: "no_rule", closesAt: null };
  const { rule } = parsed;
  const t = now.getTime();
  const freeze = freezeAt(rule, t);
  if (freeze) return { open: false, reason: "freeze", freezeReason: freeze.reason, freezeEndsAt: freeze.endUtc, nextOpen: nextOpen(rule, Date.parse(freeze.endUtc)) };
  if (rule.utcWindows.length === 0) return { open: true, reason: "inside_window", closesAt: rule.freezes.map((f) => Date.parse(f.startUtc)).filter((s) => s > t).sort((a, b) => a - b).map((s) => new Date(s).toISOString())[0] ?? null };
  const current = occurrences(rule, t, 1).find((o) => o.start <= t && t < o.end);
  if (current) {
    const freezeStart = rule.freezes.map((f) => Date.parse(f.startUtc)).filter((s) => s > t && s < current.end).sort((a, b) => a - b)[0];
    return { open: true, reason: "inside_window", closesAt: new Date(freezeStart ?? current.end).toISOString() };
  }
  return { open: false, reason: "outside_window", nextOpen: nextOpen(rule, t) };
}

/** Stable JSON for comparing what the caller read with what is stored. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value as object).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}

/** Editable text form used by the desktop editor. */
export interface ChangeWindowForm { weekdays: Weekday[]; windowsText: string; freezesText: string }

export function ruleToForm(stored: unknown): ChangeWindowForm {
  const parsed = parseChangeWindowRule(stored);
  if (parsed.kind !== "rule") return { weekdays: [...WEEKDAYS], windowsText: "", freezesText: "" };
  const { rule } = parsed;
  return {
    weekdays: rule.weekdays,
    windowsText: rule.utcWindows.map((w) => `${w.start}-${w.end}`).join(", "),
    freezesText: rule.freezes.map((f) => `${f.startUtc.replace(":00.000Z", "Z")} to ${f.endUtc.replace(":00.000Z", "Z")}: ${f.reason}`).join("\n"),
  };
}

/** Text form → stored rule (null when nothing is set), or an error to show next to the form. */
export function formToRule(form: ChangeWindowForm): { ok: true; rule: ChangeWindowRule | null } | { ok: false; error: string } {
  const windows = form.windowsText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean).map((s) => /^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/.exec(s));
  if (windows.some((w) => !w)) return { ok: false, error: "Write windows as HH:MM-HH:MM in UTC, separated by commas." };
  const freezes = form.freezesText.split("\n").map((s) => s.trim()).filter(Boolean).map((line) => /^(\S+)\s+to\s+(\S+)\s*:\s*(.+)$/.exec(line));
  if (freezes.some((f) => !f)) return { ok: false, error: "Write each freeze as: 2026-12-20 to 2027-01-02: reason" };
  const iso = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00Z` : v);
  const candidate = {
    weekdays: form.weekdays,
    utcWindows: windows.map((w) => ({ start: w![1], end: w![2] })),
    freezes: freezes.map((f) => ({ startUtc: iso(f![1]), endUtc: iso(f![2]), reason: f![3] })),
  };
  const parsed = parseChangeWindowRule(candidate);
  if (parsed.kind === "unreadable") return { ok: false, error: parsed.error };
  return { ok: true, rule: parsed.kind === "rule" ? parsed.rule : null };
}
