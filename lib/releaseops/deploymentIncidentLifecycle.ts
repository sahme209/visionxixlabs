export const INCIDENT_STATUSES = ["open", "mitigated", "resolved", "wont_fix"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_TRANSITIONS = ["mitigate", "resolve", "reopen", "wont_fix"] as const;
export type IncidentTransition = (typeof INCIDENT_TRANSITIONS)[number];

export interface TransitionPlan {
  ok: true;
  next: IncidentStatus;
  fields: Partial<{
    mitigatedByUserId: string | null;
    mitigatedAt: Date | null;
    resolvedByUserId: string | null;
    resolvedAt: Date | null;
  }>;
}

export interface TransitionReject {
  ok: false;
  reason: "illegal_transition";
  from: IncidentStatus;
  action: IncidentTransition;
}

export function planTransition(
  current: IncidentStatus,
  action: IncidentTransition,
  ctx: { actorUserId: string; now: Date },
): TransitionPlan | TransitionReject {
  if (action === "mitigate") {
    if (current !== "open") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "mitigated", fields: { mitigatedByUserId: ctx.actorUserId, mitigatedAt: ctx.now } };
  }
  if (action === "resolve") {
    if (current !== "mitigated" && current !== "open") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "resolved", fields: { resolvedByUserId: ctx.actorUserId, resolvedAt: ctx.now } };
  }
  if (action === "wont_fix") {
    if (current === "resolved" || current === "wont_fix") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "wont_fix", fields: { resolvedByUserId: ctx.actorUserId, resolvedAt: ctx.now } };
  }
  if (action === "reopen") {
    if (current !== "mitigated") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "open", fields: { mitigatedByUserId: null, mitigatedAt: null } };
  }
  return { ok: false, reason: "illegal_transition", from: current, action };
}
