import { evaluateChangeWindow, parseChangeWindowRule } from "./environmentChangeWindow";

/** Whether the change window gate would allow a deployment right now, for the agent to plan around. */
export function deploymentWindowNow(rule: unknown, now: Date): Record<string, unknown> {
  const parsed = parseChangeWindowRule(rule);
  if (parsed.kind === "unreadable") return { status: "refused_unreadable_rule" };
  const d = evaluateChangeWindow(parsed, now);
  if (d.open) return { status: "open", ...(d.closesAt ? { closesAt: d.closesAt } : {}) };
  if (d.reason === "freeze") return { status: "frozen", freezeReason: d.freezeReason, until: d.freezeEndsAt, nextOpen: d.nextOpen?.startUtc ?? null };
  return { status: "outside_window", nextOpen: d.nextOpen?.startUtc ?? null };
}
