/**
 * Operations event stream — Prisma → operational component types.
 *
 * Pure mapping layer. Takes raw rows from ExecutionLog / AxiomAuditEvent /
 * AxiomAgentRun / AxiomFinding / RecurringAnalysis and shapes them into
 * the typed structures consumed by ActivityFeed, MemoryTimeline,
 * ReasoningTrace, ExecutionPlanCard, and WorkflowOrchestrator.
 *
 * Live counts and aggregate stats are computed here too so callers
 * (server components, API routes) don't have to re-derive them.
 */

import type { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Output types — mirror the props consumed by the operations/ components
// ---------------------------------------------------------------------------

export type ActivityEventType =
  | "scan.completed"
  | "scan.started"
  | "scan.failed"
  | "finding.detected"
  | "finding.critical"
  | "plan.generated"
  | "plan.approved"
  | "plan.applied"
  | "drift.detected"
  | "rollback.prepared"
  | "savings.identified"
  | "agent.reasoning"
  | "approval.required"
  | "monitoring.alert"
  | "audit.event"
  // ReleaseOps event types
  | "release.assessed"
  | "release.approved"
  | "release.deployed"
  | "release.blocked"
  | "release.rolled_back"
  | "release.drift_detected"
  | "release.readiness_dropped"
  | "release.config_mismatch"
  | "release.dependency_conflict"
  | "release.verification_passed"
  | "release.approval_pending"
  | "release.servicenow_synced"
  | "release.terraform_plan";

// ReleaseOps-specific operational types
export type ReleaseSystemId = "github" | "gitlab" | "azure_devops" | "jenkins" | "argocd";

export type PipelineStatus = "running" | "queued" | "succeeded" | "failed" | "blocked" | "awaiting_approval";

export interface ReleasePipeline {
  id: string;
  service: string;
  environment: "production" | "staging" | "development" | "qa";
  system: ReleaseSystemId;
  status: PipelineStatus;
  ref: string;
  commit: string;
  author: string;
  startedAt: string;
  durationMs?: number;
  readinessScore?: number;
  blastRadius?: "contained" | "moderate" | "broad";
  awaitingApprovals?: number;
}

export interface ReleaseReadinessDimension {
  key: string;
  label: string;
  score: number;
  detail: string;
}

export interface ReleaseService {
  id: string;
  name: string;
  team: string;
  environment: "production" | "staging" | "development";
  compositeScore: number;
  trend: "up" | "down" | "flat";
  trendDelta?: string;
  dimensions: ReleaseReadinessDimension[];
  lastDeployedAt?: string;
  lastIncidentAt?: string;
  rollbackVerified: boolean;
}

export type ProviderTag = "aws" | "azure" | "gcp" | "system";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  description?: string;
  provider?: ProviderTag;
  region?: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  timestamp: string;
  metadata?: Record<string, string | number>;
}

export type MemoryEventKind =
  | "scan"
  | "recommendation.accepted"
  | "recommendation.ignored"
  | "execution.applied"
  | "execution.failed"
  | "drift.detected"
  | "rollback.executed"
  | "approval.granted"
  | "approval.denied"
  | "cost.shift"
  | "confidence.increase"
  | "confidence.decrease"
  | "baseline.snapshot";

export interface MemoryEvent {
  id: string;
  kind: MemoryEventKind;
  title: string;
  detail: string;
  timestamp: string;
  provider?: "aws" | "azure" | "gcp";
  outcome?: "positive" | "negative" | "neutral";
  delta?: { label: string; value: string; direction?: "up" | "down" };
}

export interface MemoryDayGroup {
  date: string;
  label: string;
  events: MemoryEvent[];
  summary: {
    scans: number;
    plans: number;
    savings: number;
    findings: number;
  };
}

export type WorkflowKind =
  | "recurring_scan"
  | "drift_monitor"
  | "execution_queue"
  | "post_execution_verify"
  | "cost_anomaly_watch"
  | "compliance_sweep"
  | "rollback_orchestration";

export type WorkflowStatus = "running" | "scheduled" | "paused" | "completed" | "failed";

export interface Workflow {
  id: string;
  name: string;
  kind: WorkflowKind;
  status: WorkflowStatus;
  provider?: "aws" | "azure" | "gcp";
  region?: string;
  cadence: string;            // "Every 6h" | "Daily 02:00 UTC" | "On approval"
  lastRunAt?: string;
  nextRunAt?: string;
  runsThisMonth: number;
  successRate: number;        // 0..1
  description: string;
  metrics?: { label: string; value: string }[];
}

// ---------------------------------------------------------------------------
// Prisma input types — narrow Prisma row shapes we accept
// ---------------------------------------------------------------------------

type ExecutionLogRow = {
  id: string;
  action: string;
  pluginId: string;
  status: string;
  dryRun: boolean;
  params: Prisma.JsonValue;
  error: string | null;
  executedAt: Date;
  rollbackSteps: string[];
};

type AxiomAgentRunRow = {
  id: string;
  status: string;
  trigger: string;
  summary: string | null;
  createdAt: Date;
  completedAt: Date | null;
  cloudAccount?: { provider: string | null } | null;
  findings?: AxiomFindingRow[];
  recommendations?: AxiomRecommendationRow[];
};

type AxiomFindingRow = {
  id: string;
  category: string;
  severity: string;
  title: string;
  region: string;
  provider: string;
  monthlyHigh: number;
  createdAt: Date;
};

type AxiomRecommendationRow = {
  id: string;
  title: string;
  disposition: string;
  monthlyHigh: number;
  createdAt: Date;
};

type AxiomAuditEventRow = {
  id: string;
  provider: string;
  actionType: string;
  region: string;
  status: string;
  riskLevel: string;
  monthlyHigh: number;
  createdAt: Date;
  appliedAt: Date | null;
};

type RecurringAnalysisRow = {
  id: string;
  frequency: string;
  jobType: string | null;
  lastRunAt: Date | null;
  nextRunAt: Date;
  enabled: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeProvider(raw: string | null | undefined): ProviderTag {
  if (!raw) return "system";
  const p = raw.toLowerCase();
  if (p.includes("aws")) return "aws";
  if (p.includes("azure")) return "azure";
  if (p.includes("gcp") || p.includes("google")) return "gcp";
  return "system";
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayLabel(d: Date): string {
  const now = new Date();
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  const key = dayKey(d);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffDays < 14) return "Last week";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function severityFromFinding(sev: string): ActivityEvent["severity"] {
  const s = sev.toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  if (s === "low") return "low";
  return "info";
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Map an ExecutionLog row to an ActivityEvent.
 * Best-effort — falls back to a generic audit.event if the action is unfamiliar.
 */
export function executionLogToActivityEvent(log: ExecutionLogRow): ActivityEvent {
  const action = log.action.toLowerCase();
  const isOnboarding = action.startsWith("onboarding:");

  let type: ActivityEventType = "audit.event";
  let title = log.action;
  let description = `${log.pluginId} · ${log.status}`;

  if (action.includes("scan") && log.status === "success") type = "scan.completed";
  else if (action.includes("scan") && log.status === "failed") type = "scan.failed";
  else if (action.includes("scan")) type = "scan.started";
  else if (action.includes("plan") && (log.status === "success" || log.status === "pending")) type = "plan.generated";
  else if (action.includes("apply") || action.includes("execute")) {
    type = log.status === "success" ? "plan.applied" : log.status === "failed" ? "scan.failed" : "plan.generated";
  } else if (action.includes("rollback")) type = "rollback.prepared";
  else if (action.includes("drift")) type = "drift.detected";
  else if (action.includes("approval")) type = "approval.required";
  else if (action.includes("reasoning") || action.includes("agent")) type = "agent.reasoning";

  if (isOnboarding) {
    const ev = log.action.split(":")[1] ?? log.action;
    title = `Onboarding: ${ev.replace(/_/g, " ")}`;
  }

  // Provider extraction from pluginId pattern "{provider}:{plugin}" or params.provider
  const params = (log.params as Record<string, unknown> | null) ?? {};
  const provider =
    normalizeProvider(typeof params.provider === "string" ? (params.provider as string) : null) ??
    normalizeProvider(log.pluginId.split(":")[0]);

  const region = typeof params.region === "string" ? (params.region as string) : undefined;

  // Metadata fishing
  const metadata: Record<string, string | number> = {};
  if (typeof params.findings === "number") metadata.findings = params.findings as number;
  if (typeof params.resources === "number") metadata.resources = params.resources as number;
  if (typeof params.duration === "string") metadata.duration = params.duration as string;
  if (log.dryRun) metadata.mode = "dry-run";

  return {
    id: log.id,
    type,
    title,
    description: log.error ?? description,
    provider,
    region,
    severity: log.status === "failed" ? "high" : "info",
    timestamp: log.executedAt.toISOString(),
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
}

/**
 * Map an AxiomFinding row to an ActivityEvent.
 */
export function findingToActivityEvent(f: AxiomFindingRow): ActivityEvent {
  const severity = severityFromFinding(f.severity);
  const isCritical = severity === "critical";

  return {
    id: `finding_${f.id}`,
    type: isCritical ? "finding.critical" : "finding.detected",
    title: f.title,
    description: `${f.category} · ${f.severity} severity`,
    provider: normalizeProvider(f.provider),
    region: f.region,
    severity,
    timestamp: f.createdAt.toISOString(),
    metadata: f.monthlyHigh > 0 ? { impact: `$${Math.round(f.monthlyHigh)}/mo` } : undefined,
  };
}

/**
 * Map an AxiomAgentRun row (with relations) into an ActivityEvent for the run itself.
 */
export function agentRunToActivityEvent(run: AxiomAgentRunRow): ActivityEvent {
  const provider = normalizeProvider(run.cloudAccount?.provider ?? null);
  const findings = run.findings?.length ?? 0;
  const recs = run.recommendations?.length ?? 0;

  let type: ActivityEventType = "scan.started";
  if (run.status === "completed") type = "scan.completed";
  else if (run.status === "failed") type = "scan.failed";

  return {
    id: `run_${run.id}`,
    type,
    title: run.summary ?? `${run.trigger} scan ${run.status}`,
    description: `${findings} findings · ${recs} recommendations`,
    provider,
    timestamp: (run.completedAt ?? run.createdAt).toISOString(),
    metadata: { findings, recommendations: recs },
  };
}

/**
 * Map an AxiomAuditEvent row to an ActivityEvent.
 */
export function auditEventToActivityEvent(a: AxiomAuditEventRow): ActivityEvent {
  let type: ActivityEventType = "audit.event";
  if (a.status === "applied") type = "plan.applied";
  else if (a.status === "rolled_back") type = "rollback.prepared";
  else if (a.status === "failed") type = "scan.failed";

  return {
    id: `audit_${a.id}`,
    type,
    title: `${a.actionType.replace(/_/g, " ")} · ${a.status}`,
    description: `${a.region} · ${a.riskLevel} risk`,
    provider: normalizeProvider(a.provider),
    region: a.region,
    severity: a.riskLevel === "high" ? "high" : a.riskLevel === "medium" ? "medium" : "low",
    timestamp: (a.appliedAt ?? a.createdAt).toISOString(),
    metadata: a.monthlyHigh > 0 ? { impact: `$${Math.round(a.monthlyHigh)}/mo` } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Memory event mappers
// ---------------------------------------------------------------------------

export function executionLogToMemoryEvent(log: ExecutionLogRow): MemoryEvent | null {
  const action = log.action.toLowerCase();
  let kind: MemoryEventKind = "scan";
  let outcome: MemoryEvent["outcome"] = "neutral";

  if (action.includes("apply") || action.includes("execute")) {
    kind = log.status === "success" ? "execution.applied" : "execution.failed";
    outcome = log.status === "success" ? "positive" : "negative";
  } else if (action.includes("scan")) {
    kind = "scan";
  } else if (action.includes("rollback")) {
    kind = "rollback.executed";
  } else if (action.includes("drift")) {
    kind = "drift.detected";
    outcome = "negative";
  } else if (action.includes("approval")) {
    kind = log.status === "success" ? "approval.granted" : "approval.denied";
  } else {
    return null;
  }

  const params = (log.params as Record<string, unknown> | null) ?? {};
  const provider = normalizeProvider(typeof params.provider === "string" ? (params.provider as string) : null);

  return {
    id: log.id,
    kind,
    title: log.action,
    detail: log.error ?? `${log.pluginId} · ${log.status}`,
    timestamp: log.executedAt.toISOString(),
    provider: provider === "system" ? undefined : provider,
    outcome,
  };
}

/**
 * Group a flat memory event list into day buckets with rollup summaries.
 */
export function groupMemoryEvents(events: MemoryEvent[]): MemoryDayGroup[] {
  const byDay = new Map<string, MemoryEvent[]>();

  for (const e of events) {
    const d = dayKey(new Date(e.timestamp));
    const list = byDay.get(d) ?? [];
    list.push(e);
    byDay.set(d, list);
  }

  const groups: MemoryDayGroup[] = [];

  for (const [date, dayEvents] of Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]))) {
    const summary = {
      scans: dayEvents.filter((e) => e.kind === "scan").length,
      plans: dayEvents.filter((e) => e.kind === "execution.applied").length,
      savings: dayEvents.reduce((s, e) => {
        if (e.delta?.label?.toLowerCase().includes("saving")) {
          const m = e.delta.value.match(/\d+/g);
          if (m) return s + parseInt(m.join(""), 10);
        }
        return s;
      }, 0),
      findings: dayEvents.filter((e) => e.kind === "drift.detected").length,
    };

    groups.push({
      date,
      label: dayLabel(new Date(date)),
      events: dayEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      summary,
    });
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Workflow mappers
// ---------------------------------------------------------------------------

/**
 * Map a RecurringAnalysis row into a Workflow.
 */
export function recurringAnalysisToWorkflow(r: RecurringAnalysisRow): Workflow {
  const kind: WorkflowKind = r.jobType === "iam_scan" ? "compliance_sweep" : "recurring_scan";
  return {
    id: r.id,
    name: r.jobType ? r.jobType.replace(/_/g, " ") : "Infrastructure scan",
    kind,
    status: r.enabled ? "scheduled" : "paused",
    cadence: r.frequency,
    lastRunAt: r.lastRunAt?.toISOString(),
    nextRunAt: r.nextRunAt.toISOString(),
    runsThisMonth: 0, // Caller can hydrate by counting AxiomAgentRun rows
    successRate: 1.0, // Caller can hydrate
    description: "Recurring analysis configured by user",
  };
}

// ---------------------------------------------------------------------------
// Compose helpers — merge multiple sources into a single sorted stream
// ---------------------------------------------------------------------------

export interface EventStreamInput {
  executionLogs?: ExecutionLogRow[];
  agentRuns?: AxiomAgentRunRow[];
  findings?: AxiomFindingRow[];
  auditEvents?: AxiomAuditEventRow[];
}

/**
 * Compose a single ActivityEvent[] stream from multiple Prisma sources.
 * Events are sorted descending by timestamp and de-duplicated by id.
 */
export function composeActivityStream(input: EventStreamInput): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  if (input.executionLogs) events.push(...input.executionLogs.map(executionLogToActivityEvent));
  if (input.agentRuns) events.push(...input.agentRuns.map(agentRunToActivityEvent));
  if (input.findings) events.push(...input.findings.map(findingToActivityEvent));
  if (input.auditEvents) events.push(...input.auditEvents.map(auditEventToActivityEvent));

  const seen = new Set<string>();
  return events
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/**
 * Compose a memory-timeline view from execution logs (most common source).
 */
export function composeMemoryGroups(executionLogs: ExecutionLogRow[]): MemoryDayGroup[] {
  const events: MemoryEvent[] = [];
  for (const l of executionLogs) {
    const m = executionLogToMemoryEvent(l);
    if (m) events.push(m);
  }
  return groupMemoryEvents(events);
}
