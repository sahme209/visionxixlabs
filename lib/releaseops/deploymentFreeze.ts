/**
 * Workspace deployment freezes (parity: Octopus deployment freezes, incident "stop the line"). Pure.
 *
 * Starting a freeze adds one freeze period to each chosen environment's change window rule; ending it
 * early shortens only the active freezes with exactly that reason. Existing windows and other freezes
 * are preserved, so a freeze never loosens anything it did not add. Enforcement is the existing change
 * window gate, which already applies to people and AI agents alike.
 */
import { evaluateChangeWindow, parseChangeWindowRule, WEEKDAYS, type ChangeWindowRule } from "./environmentChangeWindow";

export const MAX_FREEZE_HOURS = 14 * 24;
export const MAX_FREEZES_PER_RULE = 50;
export type FreezeEditError = "rule_unreadable" | "too_many_freezes";

const toJson = (rule: ChangeWindowRule): ChangeWindowRule => ({ weekdays: [...rule.weekdays], utcWindows: rule.utcWindows.map((w) => ({ ...w })), freezes: rule.freezes.map((f) => ({ ...f })) });

/** Adds a freeze to a stored rule (or to no rule). Expired freezes are dropped to make room, never active ones. */
export function addFreeze(stored: unknown, freeze: { startUtc: string; endUtc: string; reason: string }, now: Date): { ok: true; rule: ChangeWindowRule } | { ok: false; error: FreezeEditError } {
  const parsed = parseChangeWindowRule(stored);
  if (parsed.kind === "unreadable") return { ok: false, error: "rule_unreadable" };
  const base: ChangeWindowRule = parsed.kind === "rule" ? toJson(parsed.rule) : { weekdays: [...WEEKDAYS], utcWindows: [], freezes: [] };
  const live = base.freezes.filter((f) => Date.parse(f.endUtc) > now.getTime());
  if (live.length >= MAX_FREEZES_PER_RULE) return { ok: false, error: "too_many_freezes" };
  return { ok: true, rule: { ...base, freezes: [...live, { ...freeze }] } };
}

/** Ends active freezes with exactly this reason at `now`. Returns null when none matched. */
export function endFreezeEarly(stored: unknown, reason: string, now: Date): { ok: true; rule: ChangeWindowRule | null; ended: number } | { ok: false; error: "rule_unreadable" } {
  const parsed = parseChangeWindowRule(stored);
  if (parsed.kind === "unreadable") return { ok: false, error: "rule_unreadable" };
  if (parsed.kind === "none") return { ok: true, rule: null, ended: 0 };
  const t = now.getTime();
  let ended = 0;
  const freezes = parsed.rule.freezes.flatMap((f) => {
    const s = Date.parse(f.startUtc), e = Date.parse(f.endUtc);
    if (f.reason !== reason || e <= t) return [f];
    ended += 1;
    if (s >= t) return []; // scheduled with this reason but not started: drop it
    return [{ ...f, endUtc: new Date(t).toISOString() }];
  });
  if (!ended) return { ok: true, rule: toJson(parsed.rule), ended: 0 };
  const rule = { ...toJson(parsed.rule), freezes };
  return { ok: true, rule: rule.utcWindows.length === 0 && rule.freezes.length === 0 ? null : rule, ended };
}

export interface FreezeEnvironment { id: string; name: string; tier: string; changeWindowRuleJson: unknown }
export interface ActiveFreeze { reason: string; until: string; environments: string[] }

/** Active freezes across environments, grouped by reason and end time. Unreadable rules are reported separately. */
export function activeFreezes(envs: readonly FreezeEnvironment[], now: Date): { freezes: ActiveFreeze[]; unreadable: string[] } {
  const groups = new Map<string, ActiveFreeze>(); const unreadable: string[] = [];
  for (const e of envs) {
    const parsed = parseChangeWindowRule(e.changeWindowRuleJson);
    if (parsed.kind === "unreadable") { unreadable.push(e.name); continue; }
    const d = evaluateChangeWindow(parsed, now);
    if (d.open || d.reason !== "freeze") continue;
    const key = `${d.freezeReason}\u0000${d.freezeEndsAt}`;
    const g = groups.get(key) ?? { reason: d.freezeReason, until: d.freezeEndsAt, environments: [] };
    g.environments.push(e.name); groups.set(key, g);
  }
  return { freezes: [...groups.values()].sort((a, b) => (a.until < b.until ? -1 : 1)), unreadable };
}
