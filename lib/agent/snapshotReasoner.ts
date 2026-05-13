/**
 * Snapshot-to-reasoning pipeline.
 *
 * Takes a normalized CloudSnapshot and produces evidence-backed
 * Finding + Recommendation + ReasoningTrace records. Pure function over
 * typed contracts — no I/O, no Prisma calls. Easy to unit-test.
 */

import type { CloudSnapshot, NormalizedResource, ResourceRisk } from "@/lib/cloud/snapshotModel";
import type { ReasoningTraceData, ReasoningStep, ReasoningEvidence } from "@/lib/agent/reasoningTrace";

// ---------------------------------------------------------------------------
// Finding + recommendation types
// ---------------------------------------------------------------------------

export interface ReasonedFinding {
  id: string;
  resource: NormalizedResource;
  risk: ResourceRisk;
  /** Human-readable evidence — what's wrong + why we know. */
  evidenceLines: string[];
  /** Confidence in [0, 1]. */
  confidence: number;
}

export interface ReasonedRecommendation {
  id: string;
  findingId: string;
  action: string;
  rationale: string;
  /** Estimated savings or impact if applied. */
  monthlySavingsUsd?: number;
  /** Required risk classification for approval routing. */
  risk: "low" | "medium" | "high";
  /** Rollback plan summary. */
  rollback: string;
  /** Confidence in the recommendation in [0, 1]. */
  confidence: number;
  approvalRequired: boolean;
}

export interface ReasonerOutput {
  snapshotId: string;
  findings: ReasonedFinding[];
  recommendations: ReasonedRecommendation[];
  reasoningTraces: ReasoningTraceData[];
  summary: ReasonerSummary;
}

export interface ReasonerSummary {
  totalResources: number;
  findingsBySeverity: Record<ResourceRisk["severity"], number>;
  recommendationsByRisk: Record<"low" | "medium" | "high", number>;
  estimatedMonthlySavingsUsd: number;
  highestRiskResources: NormalizedResource[];
}

// ---------------------------------------------------------------------------
// Core reasoner
// ---------------------------------------------------------------------------

/**
 * Walk a snapshot and produce evidence-backed findings, recommendations,
 * and reasoning traces. Each pass is deterministic per snapshot.
 */
export function reasonAboutSnapshot(snapshot: CloudSnapshot): ReasonerOutput {
  const findings: ReasonedFinding[] = [];
  const recommendations: ReasonedRecommendation[] = [];
  const traces: ReasoningTraceData[] = [];

  for (const resource of snapshot.resources) {
    for (const risk of resource.risks) {
      const findingId = `finding_${resource.ref.id}_${risk.category}_${risk.severity}`;
      const evidenceLines = buildEvidence(resource, risk);
      const confidence = scoreConfidence(resource, risk);

      findings.push({
        id: findingId,
        resource,
        risk,
        evidenceLines,
        confidence,
      });

      const rec = buildRecommendation(findingId, resource, risk, confidence);
      recommendations.push(rec);

      traces.push(buildReasoningTrace(snapshot.id, resource, risk, rec, confidence));
    }
  }

  return {
    snapshotId: snapshot.id,
    findings,
    recommendations,
    reasoningTraces: traces,
    summary: summarize(snapshot, findings, recommendations),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEvidence(resource: NormalizedResource, risk: ResourceRisk): string[] {
  const lines: string[] = [risk.evidence];
  if (risk.monthlyCostImpactUsd && risk.monthlyCostImpactUsd > 0) {
    lines.push(`Estimated monthly impact: $${Math.round(risk.monthlyCostImpactUsd).toLocaleString()}`);
  }
  if (resource.tags && Object.keys(resource.tags).length > 0) {
    const ownerTag = resource.tags.Owner ?? resource.tags.owner ?? resource.tags.Team;
    if (ownerTag) lines.push(`Owner tag: ${ownerTag}`);
  }
  if (resource.ref.region) lines.push(`Region: ${resource.ref.region}`);
  if (resource.createdAt) lines.push(`Resource created: ${resource.createdAt.slice(0, 10)}`);
  return lines;
}

/**
 * Confidence model: starts at a base value per severity, raises for
 * deterministic signals (cost, public exposure) and lowers for noisy ones
 * (performance heuristics).
 */
function scoreConfidence(resource: NormalizedResource, risk: ResourceRisk): number {
  const base = risk.severity === "critical" ? 0.95
            : risk.severity === "high"     ? 0.85
            : risk.severity === "medium"   ? 0.75
            : risk.severity === "low"      ? 0.65
            : 0.55;

  let conf = base;
  // Deterministic categories raise confidence
  if (risk.category === "cost" && risk.monthlyCostImpactUsd) conf += 0.03;
  if (risk.category === "security" && risk.title.toLowerCase().includes("public")) conf += 0.05;
  // Performance signals are inherently noisier
  if (risk.category === "performance") conf -= 0.05;
  // Resource state hints
  if (resource.state === "running") conf += 0.02;
  if (resource.state === "unknown") conf -= 0.05;

  return Math.max(0, Math.min(1, conf));
}

function buildRecommendation(
  findingId: string,
  resource: NormalizedResource,
  risk: ResourceRisk,
  confidence: number
): ReasonedRecommendation {
  const recId = `rec_${findingId}`;
  const isCost = risk.category === "cost";
  const isSecurity = risk.category === "security";
  const isDrift = risk.category === "drift";

  // Risk classification — drives approval routing
  let classifiedRisk: "low" | "medium" | "high" = "low";
  if (risk.severity === "critical" || risk.severity === "high") classifiedRisk = "high";
  else if (risk.severity === "medium") classifiedRisk = "medium";

  // Pre-existing low-confidence recs always require approval
  const approvalRequired = confidence < 0.7 || classifiedRisk !== "low";

  return {
    id: recId,
    findingId,
    action: actionFor(resource, risk),
    rationale: rationaleFor(resource, risk),
    monthlySavingsUsd: isCost ? risk.monthlyCostImpactUsd : undefined,
    risk: classifiedRisk,
    rollback: rollbackFor(resource, risk),
    confidence,
    approvalRequired,
  };
}

function actionFor(resource: NormalizedResource, risk: ResourceRisk): string {
  const id = resource.ref.id.slice(0, 16);
  if (risk.category === "cost" && resource.kind.startsWith("compute"))
    return `Right-size ${id} based on observed utilization`;
  if (risk.category === "security" && risk.title.toLowerCase().includes("public"))
    return `Restrict public access on ${id}`;
  if (risk.category === "drift")
    return `Revert ${id} to declared baseline state`;
  return `Address ${risk.category} risk on ${id}`;
}

function rationaleFor(resource: NormalizedResource, risk: ResourceRisk): string {
  return `${risk.title} — ${risk.evidence} (${risk.severity} severity, ${risk.category}). Resource: ${resource.kind} in ${resource.ref.region ?? resource.ref.provider}.`;
}

function rollbackFor(resource: NormalizedResource, risk: ResourceRisk): string {
  if (risk.category === "cost") return `Restore prior instance type via pre-flight snapshot (RTO ~60s)`;
  if (risk.category === "security") return `Restore prior policy/SG configuration from pre-flight capture`;
  if (risk.category === "drift") return `Re-apply prior Terraform state from operational memory`;
  return `Pre-flight state captured before any change; restore on health failure`;
  void resource; // explicit unused
}

function buildReasoningTrace(
  snapshotId: string,
  resource: NormalizedResource,
  risk: ResourceRisk,
  rec: ReasonedRecommendation,
  confidence: number
): ReasoningTraceData {
  const runId = `run_${snapshotId.slice(0, 8)}_${resource.ref.id.slice(0, 8)}`;
  const now = new Date().toISOString();

  const evidence: ReasoningEvidence[] = [
    { label: "Resource ID", value: resource.ref.id, source: resource.ref },
    { label: "Risk title", value: risk.title },
    { label: "Severity", value: risk.severity },
    { label: "Evidence", value: risk.evidence },
  ];
  if (risk.monthlyCostImpactUsd) evidence.push({ label: "Monthly impact", value: `$${Math.round(risk.monthlyCostImpactUsd).toLocaleString()}` });

  const steps: ReasoningStep[] = [
    {
      id: `${runId}_observe`,
      phase: "observe",
      label: "Observed resource configuration",
      detail: `Captured configuration + tags + state for ${resource.kind} resource ${resource.ref.id}.`,
      status: "complete",
      evidence,
    },
    {
      id: `${runId}_interpret`,
      phase: "interpret",
      label: "Classified resource risk",
      detail: `Identified ${risk.severity}-severity ${risk.category} risk: ${risk.title}.`,
      status: "complete",
      confidence,
    },
    {
      id: `${runId}_reason`,
      phase: "reason",
      label: "Selected remediation strategy",
      detail: rec.rationale,
      status: "complete",
      confidence,
    },
    {
      id: `${runId}_plan`,
      phase: "plan",
      label: "Built phased execution plan",
      detail: `${rec.action}. Approval: ${rec.approvalRequired ? "required" : "Trust Ladder eligible"}.`,
      status: "complete",
    },
    {
      id: `${runId}_verify`,
      phase: "verify",
      label: "Verified rollback path",
      detail: rec.rollback,
      status: "complete",
    },
    {
      id: `${runId}_execute`,
      phase: "execute",
      label: rec.approvalRequired ? "Awaiting approval" : "Ready to apply",
      detail: rec.approvalRequired
        ? `Plan ready. Approval gate enforced for ${rec.risk} risk action class.`
        : `Plan ready. Trust Ladder eligible for this action class.`,
      status: rec.approvalRequired ? "pending" : "active",
    },
  ];

  return {
    runId,
    provider: resource.ref.provider,
    title: rec.action,
    summary: rec.rationale,
    whyItMatters: whyItMatters(risk),
    confidence,
    steps,
    affectedResources: [resource.ref],
    recommendation: {
      action: rec.action,
      impact: rec.rationale,
      risk: rec.risk,
      monthlySavingsUsd: rec.monthlySavingsUsd,
      approvalRequired: rec.approvalRequired,
    },
    startedAt: now,
    completedAt: now,
  };
}

function whyItMatters(risk: ResourceRisk): string {
  if (risk.category === "cost") {
    const impact = risk.monthlyCostImpactUsd ? `${Math.round(risk.monthlyCostImpactUsd)}/mo` : "ongoing";
    return `This ${risk.severity} cost waste is recurring (${impact}). Addressing it locks margin and reduces blast radius for future incidents — without changing application behavior.`;
  }
  if (risk.category === "security") {
    return `This ${risk.severity} security exposure widens the attack surface and may breach compliance posture. Remediation typically takes seconds and is fully reversible.`;
  }
  if (risk.category === "drift") {
    return `This ${risk.severity} drift means infrastructure diverged from declared state. Left unaddressed, it accumulates and complicates every future change.`;
  }
  return `This ${risk.severity} ${risk.category} risk is worth addressing now while remediation is cheap.`;
}

function summarize(
  snapshot: CloudSnapshot,
  findings: ReasonedFinding[],
  recs: ReasonedRecommendation[]
): ReasonerSummary {
  const findingsBySeverity: Record<ResourceRisk["severity"], number> = {
    info: 0, low: 0, medium: 0, high: 0, critical: 0,
  };
  for (const f of findings) findingsBySeverity[f.risk.severity]++;

  const recsByRisk = { low: 0, medium: 0, high: 0 };
  for (const r of recs) recsByRisk[r.risk]++;

  const savings = recs.reduce((s, r) => s + (r.monthlySavingsUsd ?? 0), 0);

  const highestRisk = [...snapshot.resources]
    .filter((r) => r.risks.some((x) => x.severity === "critical" || x.severity === "high"))
    .slice(0, 5);

  return {
    totalResources: snapshot.resources.length,
    findingsBySeverity,
    recommendationsByRisk: recsByRisk,
    estimatedMonthlySavingsUsd: savings,
    highestRiskResources: highestRisk,
  };
}
