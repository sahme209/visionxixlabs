/**
 * Founder autopilot (pure). Each run reads live signals and keeps the company map current without a
 * person: steps that V19 records show running are marked live, and steps whose signal needs attention
 * get a dated note. It only changes steps whose automation mode is autonomous. For steps that need the
 * founder's approval it proposes the change instead of making it. When the autopilot is paused it
 * plans nothing. Every applied run is saved as a new version, so it can be reviewed and undone.
 */
import type { Blueprint, SignalKey } from "./blueprint";

export type AutopilotAction =
  | { kind: "mark_live"; stepId: string; text: string }
  | { kind: "note_attention"; stepId: string; text: string };
export interface AutopilotPlan { next: Blueprint; actions: AutopilotAction[]; proposals: AutopilotAction[] }

const ATTENTION: ReadonlySet<SignalKey> = new Set(["deployments_failed_7d", "incidents_open", "freezes_active", "agent_requests_pending", "webhook_failures_7d"]);
const LABEL: Record<SignalKey, string> = {
  feedback_30d: "feedback in 30 days", leads_30d: "leads in 30 days", deployments_7d: "deployments in 7 days", deployments_failed_7d: "failed deployments in 7 days",
  incidents_open: "open incidents", freezes_active: "frozen environments", ai_cost_30d_cents: "AI cost in 30 days (cents)", agent_requests_pending: "agent requests waiting",
  webhook_failures_7d: "webhook deliveries given up in 7 days", workspaces_total: "workspaces", workspaces_new_30d: "new workspaces in 30 days",
};
export const AUTOPILOT_MAX_ACTIONS = 20;
export const AUTOPILOT_ACTOR = "autopilot@v19";

export function planAutopilot(b: Blueprint, signals: Partial<Record<SignalKey, number | null>>, now: Date): AutopilotPlan {
  const next: Blueprint = structuredClone(b);
  const actions: AutopilotAction[] = []; const proposals: AutopilotAction[] = [];
  if (b.autopilot.paused) return { next, actions, proposals };
  const day = now.toISOString().slice(0, 10);
  for (const s of next.steps) {
    if (s.status === "archived" || !s.signal) continue;
    const v = signals[s.signal];
    if (typeof v !== "number" || v <= 0) continue;
    let action: AutopilotAction | null = null;
    if (!ATTENTION.has(s.signal) && (s.status === "draft" || s.status === "in_progress")) {
      action = { kind: "mark_live", stepId: s.id, text: `Marked "${s.title}" live: V19 recorded ${v.toLocaleString("en-US")} ${LABEL[s.signal]}.` };
    } else if (ATTENTION.has(s.signal)) {
      const line = `Autopilot ${day}: ${v.toLocaleString("en-US")} ${LABEL[s.signal]}.`;
      if (!s.notes.includes(`Autopilot ${day}: ${v.toLocaleString("en-US")} ${LABEL[s.signal]}`)) action = { kind: "note_attention", stepId: s.id, text: `Noted on "${s.title}": ${v.toLocaleString("en-US")} ${LABEL[s.signal]}.` };
      if (action && s.automation.mode === "autonomous" && actions.length < AUTOPILOT_MAX_ACTIONS) s.notes = `${s.notes ? `${s.notes.trimEnd()}\n` : ""}${line}`.slice(-4000);
    }
    if (!action) continue;
    if (s.automation.mode === "autonomous") {
      if (actions.length >= AUTOPILOT_MAX_ACTIONS) break;
      if (action.kind === "mark_live") s.status = "live";
      actions.push(action);
    } else if (s.automation.mode === "approval") proposals.push(action);
  }
  return { next, actions, proposals };
}

/** One-line summary for the saved version. */
export function autopilotSummary(actions: readonly AutopilotAction[]): string {
  const live = actions.filter((a) => a.kind === "mark_live").length, notes = actions.length - live;
  return `Autopilot: ${[live ? `marked ${live} step${live === 1 ? "" : "s"} live` : "", notes ? `noted ${notes} signal${notes === 1 ? "" : "s"} needing attention` : ""].filter(Boolean).join(", ")}.`.slice(0, 200);
}
