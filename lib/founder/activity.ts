/**
 * Founder live activity (pure, client-safe). Events come from V19's own records across all
 * workspaces. Each event names the signal it moves, so the blueprint can light up the steps that
 * watch that signal. Events carry no customer content: no emails, messages, repository names or
 * targets, only what happened, when, and how it went.
 */
import type { SignalKey } from "./blueprint";
import type { StatusTone } from "@/lib/cockpit/statusTone";

export const ACTIVITY_KINDS = [
  "workspace_created", "lead_received", "feedback_received",
  "deployment_started", "deployment_succeeded", "deployment_failed",
  "incident_opened", "incident_resolved", "freeze_started", "freeze_ended",
  "agent_request", "agent_request_decided", "webhook_given_up",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityEvent {
  /** Stable across polls: kind plus the source record id. */
  id: string;
  kind: ActivityKind;
  at: string;
  signal: SignalKey;
  title: string;
  detail: string;
  tone: StatusTone;
}

export const ACTIVITY_SIGNAL: Record<ActivityKind, SignalKey> = {
  workspace_created: "workspaces_new_30d",
  lead_received: "leads_30d",
  feedback_received: "feedback_30d",
  deployment_started: "deployments_7d",
  deployment_succeeded: "deployments_7d",
  deployment_failed: "deployments_failed_7d",
  incident_opened: "incidents_open",
  incident_resolved: "incidents_open",
  freeze_started: "freezes_active",
  freeze_ended: "freezes_active",
  agent_request: "agent_requests_pending",
  agent_request_decided: "agent_requests_pending",
  webhook_given_up: "webhook_failures_7d",
};

/** Newest first, de-duplicated by id, capped. */
export function mergeActivity(existing: readonly ActivityEvent[], incoming: readonly ActivityEvent[], cap = 200): ActivityEvent[] {
  const byId = new Map<string, ActivityEvent>();
  for (const e of [...incoming, ...existing]) if (!byId.has(e.id)) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, cap);
}

/** Per signal: how many events in the window and the newest event time. Drives pulses and edge flow. */
export function activityBySignal(events: readonly ActivityEvent[], now: number, windowMs: number): Map<SignalKey, { count: number; latest: number }> {
  const out = new Map<SignalKey, { count: number; latest: number }>();
  for (const e of events) {
    const t = Date.parse(e.at);
    if (!Number.isFinite(t) || now - t > windowMs || t > now + 60_000) continue;
    const cur = out.get(e.signal) ?? { count: 0, latest: 0 };
    out.set(e.signal, { count: cur.count + 1, latest: Math.max(cur.latest, t) });
  }
  return out;
}

/** "just now", "4 min ago", "3 h ago", "2 d ago". */
export function timeAgo(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (!Number.isFinite(s)) return "";
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

/** How a step's freshest activity should look: pulsing (last 10 minutes), active (last 24 hours) or quiet. */
export function liveness(latest: number | undefined, now: number): "pulse" | "active" | "quiet" {
  if (!latest) return "quiet";
  const age = now - latest;
  return age <= 10 * 60_000 ? "pulse" : age <= 24 * 3_600_000 ? "active" : "quiet";
}
