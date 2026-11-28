/**
 * "Deploy when the window opens" (pure). The desktop app holds a refused deployment and sends it again
 * at the next opening, through the same route, so every gate is checked again then. Nothing runs
 * unattended on a server: if the app is closed, nothing is sent.
 */
import { evaluateChangeWindow, parseChangeWindowRule } from "./environmentChangeWindow";

/** Next opening of the environment's window after a window or freeze refusal; null when there is none to wait for. */
export function nextOpeningAfterRefusal(error: string, storedRule: unknown, now: Date): string | null {
  if (error !== "outside_change_window" && error !== "deployment_freeze_active") return null;
  const rule = parseChangeWindowRule(storedRule);
  if (rule.kind === "unreadable") return null;
  const decision = evaluateChangeWindow(rule, now);
  return !decision.open ? decision.nextOpen?.startUtc ?? null : null;
}

/** Sent a few seconds after the opening so the server's clock agrees the window is open. */
export const SCHEDULE_GRACE_MS = 5_000;
export function isScheduledDeployDue(atIso: string, now: Date): boolean {
  const at = Date.parse(atIso);
  return Number.isFinite(at) && now.getTime() >= at + SCHEDULE_GRACE_MS;
}
