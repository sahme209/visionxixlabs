/**
 * Audit intelligence — builds *stories* from audit records.
 *
 * `secureAudit.ts` produces individual records. This module composes them
 * into readable sequences keyed by correlation id, so the UI/copilot can
 * answer "what happened, who initiated it, why was it allowed, what was
 * changed?" without each consumer re-implementing the join logic.
 */

import type { AuditAction, AuditOutcome, AuditRecord } from "@/lib/audit/secureAudit";
import type { CorrelationId, OrganizationId } from "@/lib/domain/ids";
import type { DataSource } from "@/lib/domain/source";

// ---------------------------------------------------------------------------
// Story types
// ---------------------------------------------------------------------------

export type StoryRiskLevel = "info" | "low" | "medium" | "high" | "critical";

export interface StoryActor {
  kind: AuditRecord["actorKind"];
  label: string;
  userId?: string;
}

export interface StoryTimelineEntry {
  recordId: string;
  action: AuditAction;
  outcome: AuditOutcome;
  occurredAt: string;
  actor: StoryActor;
  /** Sub-detail rendered alongside the action label. */
  detailLine?: string;
}

export interface AuditStory {
  correlationId: CorrelationId;
  organizationId: OrganizationId;
  source: DataSource;
  /** Short, human title — derived from the dominant action. */
  title: string;
  /** Multi-sentence summary answering "what happened?". */
  summary: string;
  startedAt: string;
  endedAt: string;
  /** Distinct actors involved. */
  actors: StoryActor[];
  /** All audit records in time order. */
  timeline: StoryTimelineEntry[];
  /** Whether a policy decision was recorded. */
  policyApplied: boolean;
  /** Whether an approval was granted/denied. */
  approvalGranted?: boolean;
  approvalDenied?: boolean;
  /** Whether a rollback was prepared at any point. */
  rollbackPrepared: boolean;
  /** Whether a verification check completed. */
  verificationCompleted: boolean;
  /** Highest-risk action observed. */
  risk: StoryRiskLevel;
  /** Set when one of the timeline entries is a security event we should highlight. */
  hasSecurityEvent: boolean;
  /** Set when any timeline entry's outcome was "blocked". */
  hasBlockedAction: boolean;
}

// ---------------------------------------------------------------------------
// Story builder
// ---------------------------------------------------------------------------

const RISK_FOR_ACTION: Partial<Record<AuditAction, StoryRiskLevel>> = {
  "tenant.cross_attempt":               "critical",
  "auth.failed":                        "high",
  "policy.update":                      "high",
  "governance.update":                  "high",
  "autonomy.change":                    "high",
  "members.invite":                     "medium",
  "members.remove":                     "medium",
  "execution_plan.execute":             "high",
  "rollback.execute":                   "high",
  "desktop.handoff.issue":              "medium",
  "desktop.handoff.reject":             "high",
  "audit.export":                       "medium",
  "copilot.blocked":                    "medium",
};

function rankRisk(a: StoryRiskLevel, b: StoryRiskLevel): StoryRiskLevel {
  const order: StoryRiskLevel[] = ["info", "low", "medium", "high", "critical"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

function actorLabel(record: AuditRecord): StoryActor {
  if (record.actorKind === "user") return { kind: "user", label: record.actorUserId ?? "user", userId: record.actorUserId };
  if (record.actorKind === "external") return { kind: "external", label: "external system" };
  return { kind: "system", label: "Axiom system" };
}

function titleFor(records: AuditRecord[]): string {
  // Pick the most "significant" action — prefer execute > approve > export > submit > create > validate
  const priority: AuditAction[] = [
    "execution_plan.execute", "rollback.execute", "approval.grant", "approval.deny",
    "execution_plan.submit", "execution_plan.export", "execution_plan.create",
    "scan.success", "scan.failure", "connector.connect", "connector.disconnect",
    "policy.update", "governance.update", "autonomy.change",
    "desktop.pair", "desktop.handoff.issue", "audit.export",
    "copilot.query",
  ];
  for (const a of priority) {
    if (records.some((r) => r.action === a)) return titleForAction(a);
  }
  return titleForAction(records[0]?.action ?? "system.error");
}

function titleForAction(action: AuditAction): string {
  switch (action) {
    case "execution_plan.execute": return "Execution plan ran";
    case "execution_plan.submit":  return "Execution plan submitted";
    case "execution_plan.export":  return "Plan exported";
    case "execution_plan.create":  return "Execution plan generated";
    case "approval.grant":         return "Approval granted";
    case "approval.deny":          return "Approval denied";
    case "rollback.execute":       return "Rollback executed";
    case "rollback.prepare":       return "Rollback prepared";
    case "scan.success":           return "Cloud scan completed";
    case "scan.failure":           return "Cloud scan failed";
    case "connector.connect":      return "Connector connected";
    case "connector.disconnect":   return "Connector disconnected";
    case "policy.update":          return "Policy updated";
    case "governance.update":      return "Governance updated";
    case "autonomy.change":        return "Autonomy level changed";
    case "desktop.pair":           return "Desktop paired";
    case "desktop.handoff.issue":  return "Desktop handoff issued";
    case "audit.export":           return "Audit bundle exported";
    case "copilot.query":          return "Copilot consulted";
    case "copilot.blocked":        return "Copilot query blocked";
    case "tenant.cross_attempt":   return "Cross-tenant access blocked";
    case "auth.signin":            return "User signed in";
    case "auth.signout":           return "User signed out";
    case "auth.failed":            return "Authentication failed";
    default:                       return action.replace(/\./g, " ").replace(/_/g, " ");
  }
}

function summaryFor(records: AuditRecord[]): string {
  if (records.length === 0) return "No audit records.";
  const successCount = records.filter((r) => r.outcome === "success").length;
  const failureCount = records.filter((r) => r.outcome === "failure").length;
  const blockedCount = records.filter((r) => r.outcome === "blocked").length;
  const userCount = new Set(records.filter((r) => r.actorKind === "user").map((r) => r.actorUserId)).size;
  const parts: string[] = [];
  parts.push(`${records.length} action${records.length === 1 ? "" : "s"}`);
  parts.push(`${successCount} succeeded${failureCount > 0 ? `, ${failureCount} failed` : ""}${blockedCount > 0 ? `, ${blockedCount} blocked` : ""}`);
  if (userCount > 0) parts.push(`${userCount} user actor${userCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/**
 * Compose one audit story from a set of audit records sharing a correlation
 * id. Pure function — caller is responsible for the query.
 */
export function buildAuditStory(records: AuditRecord[]): AuditStory | null {
  if (records.length === 0) return null;
  const sorted = [...records].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const timeline: StoryTimelineEntry[] = sorted.map((r) => ({
    recordId: r.id as unknown as string,
    action: r.action,
    outcome: r.outcome,
    occurredAt: r.occurredAt,
    actor: actorLabel(r),
    detailLine: r.detail ? Object.entries(r.detail).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(" · ") : undefined,
  }));

  const actorMap = new Map<string, StoryActor>();
  for (const t of timeline) {
    const key = `${t.actor.kind}::${t.actor.userId ?? t.actor.label}`;
    if (!actorMap.has(key)) actorMap.set(key, t.actor);
  }

  let risk: StoryRiskLevel = "info";
  for (const r of sorted) {
    const a = RISK_FOR_ACTION[r.action];
    if (a) risk = rankRisk(risk, a);
    if (r.outcome === "blocked") risk = rankRisk(risk, "high");
    if (r.outcome === "failure") risk = rankRisk(risk, "medium");
  }

  return {
    correlationId: first.correlationId,
    organizationId: first.organizationId,
    source: first.source,
    title: titleFor(sorted),
    summary: summaryFor(sorted),
    startedAt: first.occurredAt,
    endedAt: last.occurredAt,
    actors: Array.from(actorMap.values()),
    timeline,
    policyApplied: sorted.some((r) => r.action === "policy.update" || r.action === "governance.update"),
    approvalGranted: sorted.some((r) => r.action === "approval.grant" && r.outcome === "success"),
    approvalDenied:  sorted.some((r) => r.action === "approval.deny"  && r.outcome === "success"),
    rollbackPrepared: sorted.some((r) => r.action === "rollback.prepare" || r.action === "rollback.execute"),
    verificationCompleted: false,
    risk,
    hasSecurityEvent: sorted.some((r) => r.action.startsWith("auth.") || r.action === "tenant.cross_attempt" || r.action === "members.invite"),
    hasBlockedAction: sorted.some((r) => r.outcome === "blocked"),
  };
}

/**
 * Group a flat list of audit records by correlation id and return one story
 * per group, sorted newest-first. The Audit Center renders this directly.
 */
export function buildStoryFeed(records: AuditRecord[]): AuditStory[] {
  const byCorrelation = new Map<string, AuditRecord[]>();
  for (const r of records) {
    const k = r.correlationId as unknown as string;
    const list = byCorrelation.get(k) ?? [];
    list.push(r);
    byCorrelation.set(k, list);
  }
  const stories: AuditStory[] = [];
  for (const list of byCorrelation.values()) {
    const story = buildAuditStory(list);
    if (story) stories.push(story);
  }
  stories.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return stories;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface StoryFilter {
  actorKind?: "user" | "system" | "external";
  action?: AuditAction;
  minRisk?: StoryRiskLevel;
  blockedOnly?: boolean;
  /** ISO timestamps — inclusive. */
  sinceIso?: string;
  untilIso?: string;
}

export function filterStories(stories: AuditStory[], filter: StoryFilter): AuditStory[] {
  const order: StoryRiskLevel[] = ["info", "low", "medium", "high", "critical"];
  const minIdx = filter.minRisk ? order.indexOf(filter.minRisk) : 0;
  return stories.filter((s) => {
    if (filter.actorKind && !s.actors.some((a) => a.kind === filter.actorKind)) return false;
    if (filter.action && !s.timeline.some((t) => t.action === filter.action)) return false;
    if (filter.minRisk && order.indexOf(s.risk) < minIdx) return false;
    if (filter.blockedOnly && !s.hasBlockedAction) return false;
    if (filter.sinceIso && s.endedAt < filter.sinceIso) return false;
    if (filter.untilIso && s.startedAt > filter.untilIso) return false;
    return true;
  });
}
