import { prisma } from "@/lib/db";
import type { CloudProvider } from "./cloudSnapshot";
import type { ActionType, RiskLevel } from "./executionPlan";
import type { ActionDisposition } from "./agent/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExplainQuestion =
  | "why_recommended"
  | "what_evidence"
  | "what_if_ignored"
  | "what_could_go_wrong"
  | "how_to_rollback"
  | "is_this_safe";

export type EvidenceField = {
  metric: string;
  resource: string;
  observedValue: string;
  threshold: string | null;
  reason: string;
};

export type Explanation = {
  findingId: string;
  question: ExplainQuestion;
  answer: string;
  evidence: EvidenceField[];
  confidence: "high" | "medium" | "low";
  dataGaps: string[];
};

// ---------------------------------------------------------------------------
// Internal — loaded context for grounding explanations
// ---------------------------------------------------------------------------

type FindingContext = {
  finding: {
    id: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    confidence: string;
    region: string;
    provider: string;
    affectedResources: string[];
    monthlySavings: { low: number; high: number };
    yearlySavings: { low: number; high: number };
    data: Record<string, unknown> | null;
  };
  recommendation: {
    title: string;
    rationale: string;
    disposition: string;
    dispositionReason: string;
    actionType: string | null;
    riskLevel: string | null;
    effort: string;
  } | null;
  planItem: {
    currentState: string;
    recommendedState: string;
    riskLevel: string;
    disposition: string;
    rollbackPlan: RollbackData | null;
    precheckResult: PrecheckData | null;
    resourceIds: string[];
  } | null;
  resources: SnapshotResource[];
};

type RollbackData = {
  rollbackSteps?: Array<{ description: string; command?: string | null; requiresManualAction?: boolean }>;
  rollbackRisk?: string;
  rollbackRiskExplanation?: string;
  automated?: boolean;
  manualFallbackSteps?: string[];
  estimatedTotalDurationMin?: number;
};

type PrecheckData = {
  passed?: boolean;
  warnings?: string[];
  blockers?: string[];
  checksRun?: Array<{ name: string; passed: boolean; message: string }>;
};

type SnapshotResource = {
  resourceId: string;
  resourceType: string;
  region: string;
  instanceType?: string;
  state?: string;
  usage?: { cpuAvgPct?: number; memoryAvgPct?: number; networkInGbPerDay?: number; sampleWindowHours?: number };
  monthlyCostEstimate?: number;
  storageClass?: string;
  sizeGb?: number;
  lastAccessedDaysAgo?: number;
};

// ---------------------------------------------------------------------------
// QUESTION → HUMAN LABEL MAP
// ---------------------------------------------------------------------------

const QUESTION_LABELS: Record<ExplainQuestion, string> = {
  why_recommended: "Why did you recommend this?",
  what_evidence: "What evidence did you use?",
  what_if_ignored: "What happens if I ignore it?",
  what_could_go_wrong: "What could go wrong?",
  how_to_rollback: "How do I roll it back?",
  is_this_safe: "Is this safe?",
};

// ---------------------------------------------------------------------------
// explainFinding — main entry point
// ---------------------------------------------------------------------------

export async function explainFinding(
  findingId: string,
  question: ExplainQuestion,
): Promise<Explanation> {
  const ctx = await loadContext(findingId);

  const handler = HANDLERS[question];
  return handler(ctx);
}

// ---------------------------------------------------------------------------
// Load all grounding data for a finding
// ---------------------------------------------------------------------------

async function loadContext(findingId: string): Promise<FindingContext> {
  const finding = await prisma.axiomFinding.findUniqueOrThrow({
    where: { id: findingId },
    include: {
      recommendations: { take: 1 },
      run: {
        select: {
          snapshotData: true,
          executionPlan: {
            include: {
              items: {
                where: {
                  recommendation: { findingId },
                },
              },
            },
          },
        },
      },
    },
  });

  const rec = finding.recommendations[0] ?? null;
  const planItems = finding.run.executionPlan?.items ?? [];
  const planItem = planItems[0] ?? null;

  const affectedResources = finding.affectedResources as string[];
  const snapshot = finding.run.snapshotData as { resources?: SnapshotResource[] } | null;
  const allResources = (snapshot?.resources ?? []) as SnapshotResource[];
  const relevantResources = allResources.filter((r) =>
    affectedResources.includes(r.resourceId),
  );

  return {
    finding: {
      id: finding.id,
      title: finding.title,
      description: finding.description,
      category: finding.category,
      severity: finding.severity,
      confidence: finding.confidence,
      region: finding.region,
      provider: finding.provider,
      affectedResources,
      monthlySavings: { low: finding.monthlyLow, high: finding.monthlyHigh },
      yearlySavings: { low: finding.yearlyLow, high: finding.yearlyHigh },
      data: finding.data as Record<string, unknown> | null,
    },
    recommendation: rec
      ? {
          title: rec.title,
          rationale: rec.rationale,
          disposition: rec.disposition,
          dispositionReason: rec.dispositionReason,
          actionType: rec.actionType,
          riskLevel: rec.riskLevel,
          effort: rec.effort,
        }
      : null,
    planItem: planItem
      ? {
          currentState: planItem.currentState,
          recommendedState: planItem.recommendedState,
          riskLevel: planItem.riskLevel,
          disposition: planItem.disposition,
          rollbackPlan: planItem.rollbackPlan as RollbackData | null,
          precheckResult: planItem.precheckResult as PrecheckData | null,
          resourceIds: planItem.resourceIds as string[],
        }
      : null,
    resources: relevantResources,
  };
}

// ---------------------------------------------------------------------------
// Evidence extraction — pulls structured facts from snapshot + signals
// ---------------------------------------------------------------------------

function extractEvidence(ctx: FindingContext): EvidenceField[] {
  const evidence: EvidenceField[] = [];

  for (const r of ctx.resources) {
    if (r.usage?.cpuAvgPct !== undefined) {
      evidence.push({
        metric: "CPU utilization (avg)",
        resource: r.resourceId,
        observedValue: `${r.usage.cpuAvgPct.toFixed(1)}%`,
        threshold: r.usage.cpuAvgPct < 20 ? "<20% (underutilized)" : null,
        reason:
          r.usage.cpuAvgPct < 20
            ? "Average CPU usage is well below capacity, indicating the instance is oversized."
            : `CPU running at ${r.usage.cpuAvgPct.toFixed(1)}%.`,
      });
    }

    if (r.usage?.memoryAvgPct !== undefined) {
      evidence.push({
        metric: "Memory utilization (avg)",
        resource: r.resourceId,
        observedValue: `${r.usage.memoryAvgPct.toFixed(1)}%`,
        threshold: r.usage.memoryAvgPct < 20 ? "<20% (underutilized)" : null,
        reason:
          r.usage.memoryAvgPct < 20
            ? "Memory usage is consistently low, suggesting a smaller instance would suffice."
            : `Memory at ${r.usage.memoryAvgPct.toFixed(1)}%.`,
      });
    }

    if (r.monthlyCostEstimate !== undefined) {
      evidence.push({
        metric: "Monthly cost",
        resource: r.resourceId,
        observedValue: `$${r.monthlyCostEstimate.toFixed(2)}/mo`,
        threshold: null,
        reason: "Current monthly cost for this resource.",
      });
    }

    if (r.state === "stopped" || r.state === "deallocated") {
      evidence.push({
        metric: "Instance state",
        resource: r.resourceId,
        observedValue: r.state,
        threshold: "running",
        reason: `Instance is ${r.state} but may still incur charges for attached storage/IPs.`,
      });
    }

    if (r.lastAccessedDaysAgo !== undefined && r.lastAccessedDaysAgo > 30) {
      evidence.push({
        metric: "Last accessed",
        resource: r.resourceId,
        observedValue: `${r.lastAccessedDaysAgo} days ago`,
        threshold: ">30 days (infrequently accessed)",
        reason: "Storage has not been accessed recently and may qualify for a cheaper storage class.",
      });
    }

    if (r.sizeGb !== undefined && r.storageClass) {
      evidence.push({
        metric: "Storage size & class",
        resource: r.resourceId,
        observedValue: `${r.sizeGb} GB (${r.storageClass})`,
        threshold: null,
        reason: `${r.sizeGb} GB stored in ${r.storageClass} tier.`,
      });
    }

    if (r.usage?.sampleWindowHours !== undefined) {
      evidence.push({
        metric: "Observation window",
        resource: r.resourceId,
        observedValue: `${r.usage.sampleWindowHours} hours`,
        threshold: null,
        reason: `Metrics were collected over a ${r.usage.sampleWindowHours}-hour window.`,
      });
    }
  }

  // Evidence from finding.data (provider-specific signals)
  const data = ctx.finding.data;
  if (data) {
    if (typeof data.currentInstanceType === "string" && typeof data.recommendedInstanceType === "string") {
      evidence.push({
        metric: "Instance type change",
        resource: ctx.finding.affectedResources[0] ?? "unknown",
        observedValue: data.currentInstanceType,
        threshold: data.recommendedInstanceType,
        reason: `Recommending a change from ${data.currentInstanceType} to ${data.recommendedInstanceType}.`,
      });
    }
    if (typeof data.unusedDays === "number") {
      evidence.push({
        metric: "Days unused",
        resource: ctx.finding.affectedResources[0] ?? "unknown",
        observedValue: `${data.unusedDays} days`,
        threshold: ">14 days",
        reason: "Resource has not been used for an extended period.",
      });
    }
  }

  return evidence;
}

function identifyDataGaps(ctx: FindingContext): string[] {
  const gaps: string[] = [];

  if (ctx.resources.length === 0) {
    gaps.push("No resource-level snapshot data available for the affected resources.");
  }

  const hasUsage = ctx.resources.some((r) => r.usage?.cpuAvgPct !== undefined || r.usage?.memoryAvgPct !== undefined);
  if (!hasUsage && ctx.finding.category === "cost") {
    gaps.push("No CPU/memory utilization metrics were available — savings estimate is based on resource type and pricing, not observed usage.");
  }

  if (!ctx.recommendation) {
    gaps.push("No recommendation record is linked to this finding.");
  }

  if (!ctx.planItem) {
    gaps.push("No execution plan item exists — this finding may be report-only.");
  }

  if (ctx.planItem && !ctx.planItem.rollbackPlan) {
    gaps.push("No rollback plan was generated for this action.");
  }

  if (ctx.planItem && !ctx.planItem.precheckResult) {
    gaps.push("No precheck was run for this action.");
  }

  const shortWindow = ctx.resources.some(
    (r) => r.usage?.sampleWindowHours !== undefined && r.usage.sampleWindowHours < 24,
  );
  if (shortWindow) {
    gaps.push("Some metrics were observed over less than 24 hours — patterns may not reflect typical usage.");
  }

  return gaps;
}

function computeConfidence(ctx: FindingContext, evidence: EvidenceField[], gaps: string[]): "high" | "medium" | "low" {
  if (gaps.length >= 3) return "low";

  const hasUsageData = evidence.some((e) => e.metric.includes("utilization") || e.metric.includes("CPU") || e.metric.includes("Memory"));
  const hasCostData = evidence.some((e) => e.metric === "Monthly cost");
  const findingConfidence = ctx.finding.confidence;

  if (findingConfidence === "high" && hasUsageData && hasCostData && gaps.length === 0) return "high";
  if (findingConfidence === "low" || (!hasUsageData && !hasCostData)) return "low";

  return "medium";
}

// ---------------------------------------------------------------------------
// Explanation handlers — one per question type
// ---------------------------------------------------------------------------

const HANDLERS: Record<ExplainQuestion, (ctx: FindingContext) => Explanation> = {
  why_recommended: handleWhyRecommended,
  what_evidence: handleWhatEvidence,
  what_if_ignored: handleWhatIfIgnored,
  what_could_go_wrong: handleWhatCouldGoWrong,
  how_to_rollback: handleHowToRollback,
  is_this_safe: handleIsThisSafe,
};

function handleWhyRecommended(ctx: FindingContext): Explanation {
  const evidence = extractEvidence(ctx);
  const gaps = identifyDataGaps(ctx);
  const confidence = computeConfidence(ctx, evidence, gaps);

  const parts: string[] = [];

  if (ctx.recommendation?.rationale) {
    parts.push(ctx.recommendation.rationale);
  } else {
    parts.push(ctx.finding.description);
  }

  if (ctx.recommendation?.dispositionReason) {
    parts.push(ctx.recommendation.dispositionReason);
  }

  if (ctx.finding.yearlySavings.high > 0) {
    parts.push(
      `Estimated annual savings: $${ctx.finding.yearlySavings.low.toFixed(0)}–$${ctx.finding.yearlySavings.high.toFixed(0)}.`,
    );
  }

  return {
    findingId: ctx.finding.id,
    question: "why_recommended",
    answer: parts.join(" "),
    evidence,
    confidence,
    dataGaps: gaps,
  };
}

function handleWhatEvidence(ctx: FindingContext): Explanation {
  const evidence = extractEvidence(ctx);
  const gaps = identifyDataGaps(ctx);
  const confidence = computeConfidence(ctx, evidence, gaps);

  if (evidence.length === 0) {
    return {
      findingId: ctx.finding.id,
      question: "what_evidence",
      answer:
        "Limited evidence is available. This finding was generated based on resource configuration rather than observed usage metrics. " +
        ctx.finding.description,
      evidence: [],
      confidence: "low",
      dataGaps: gaps,
    };
  }

  const summaryParts = evidence.map(
    (e) => `${e.metric} for ${e.resource}: ${e.observedValue}${e.threshold ? ` (threshold: ${e.threshold})` : ""}`,
  );

  return {
    findingId: ctx.finding.id,
    question: "what_evidence",
    answer: `This recommendation is based on ${evidence.length} observed metric(s): ${summaryParts.join("; ")}.`,
    evidence,
    confidence,
    dataGaps: gaps,
  };
}

function handleWhatIfIgnored(ctx: FindingContext): Explanation {
  const evidence = extractEvidence(ctx);
  const gaps = identifyDataGaps(ctx);
  const confidence = computeConfidence(ctx, evidence, gaps);

  const parts: string[] = [];
  const f = ctx.finding;

  if (f.yearlySavings.high > 0) {
    parts.push(
      `You would continue spending an estimated $${f.monthlySavings.low.toFixed(0)}–$${f.monthlySavings.high.toFixed(0)}/month ($${f.yearlySavings.low.toFixed(0)}–$${f.yearlySavings.high.toFixed(0)}/year) more than necessary.`,
    );
  }

  if (f.category === "security") {
    parts.push("The identified security exposure will remain unaddressed and could be exploited.");
  } else if (f.category === "resilience") {
    parts.push("Your infrastructure will remain vulnerable to the identified availability risk.");
  } else if (f.category === "performance") {
    parts.push("Performance degradation may continue or worsen under load.");
  } else if (f.category === "compliance") {
    parts.push("Non-compliance with the identified standard will persist.");
  }

  if (f.severity === "high" || f.severity === "critical") {
    parts.push(`This is a ${f.severity}-severity finding — the longer it remains unaddressed, the greater the potential impact.`);
  }

  if (parts.length === 0) {
    parts.push("No immediate risk, but the identified inefficiency will continue.");
  }

  return {
    findingId: f.id,
    question: "what_if_ignored",
    answer: parts.join(" "),
    evidence,
    confidence,
    dataGaps: gaps,
  };
}

function handleWhatCouldGoWrong(ctx: FindingContext): Explanation {
  const evidence = extractEvidence(ctx);
  const gaps = identifyDataGaps(ctx);
  const confidence = computeConfidence(ctx, evidence, gaps);

  const parts: string[] = [];
  const rec = ctx.recommendation;
  const plan = ctx.planItem;

  if (plan?.precheckResult) {
    const pc = plan.precheckResult;
    if (pc.blockers && pc.blockers.length > 0) {
      parts.push(`Prechecks identified blocker(s): ${pc.blockers.join("; ")}.`);
    }
    if (pc.warnings && pc.warnings.length > 0) {
      parts.push(`Warnings: ${pc.warnings.join("; ")}.`);
    }
    if (pc.passed === true && (!pc.warnings || pc.warnings.length === 0)) {
      parts.push("All prechecks passed with no warnings.");
    }
  }

  const riskLevel = plan?.riskLevel ?? rec?.riskLevel;
  if (riskLevel === "high") {
    parts.push("This is a high-risk action. It may cause service disruption or require careful coordination.");
  } else if (riskLevel === "medium") {
    parts.push("This is a medium-risk action. Brief performance impact is possible during the change window.");
  } else if (riskLevel === "low") {
    parts.push("This is a low-risk action. Disruption is unlikely based on the action type and resource state.");
  }

  if (rec?.actionType === "decommission_compute") {
    parts.push("Decommissioning removes resources permanently. Verify no active workloads depend on these instances.");
  } else if (rec?.actionType === "resize_compute") {
    parts.push("Resizing may require a brief restart. Connections will drop during the instance type change.");
  } else if (rec?.actionType === "purchase_commitment") {
    parts.push("Commitments (Reserved Instances / Savings Plans) lock spend for 1–3 years. If usage drops, the commitment becomes waste.");
  }

  if (plan?.rollbackPlan?.rollbackRisk === "irreversible") {
    parts.push("This action is irreversible — it cannot be rolled back.");
  }

  if (parts.length === 0) {
    parts.push("No specific risks were identified by prechecks or risk analysis for this action.");
  }

  return {
    findingId: ctx.finding.id,
    question: "what_could_go_wrong",
    answer: parts.join(" "),
    evidence,
    confidence,
    dataGaps: gaps,
  };
}

function handleHowToRollback(ctx: FindingContext): Explanation {
  const evidence = extractEvidence(ctx);
  const gaps = identifyDataGaps(ctx);
  const confidence = computeConfidence(ctx, evidence, gaps);

  const plan = ctx.planItem;

  if (!plan?.rollbackPlan) {
    const disposition = plan?.disposition ?? ctx.recommendation?.disposition;
    if (disposition === "report_only") {
      return {
        findingId: ctx.finding.id,
        question: "how_to_rollback",
        answer: "This is a report-only finding — no action is taken, so no rollback is needed.",
        evidence: [],
        confidence: "high",
        dataGaps: gaps.filter((g) => !g.includes("rollback")),
      };
    }

    return {
      findingId: ctx.finding.id,
      question: "how_to_rollback",
      answer: "No rollback plan is available for this action. If applied, reverting may require manual intervention.",
      evidence: [],
      confidence: "low",
      dataGaps: gaps,
    };
  }

  const rb = plan.rollbackPlan;
  const parts: string[] = [];

  if (rb.automated) {
    parts.push("Rollback is automated and can be triggered from the Axiom dashboard.");
  } else {
    parts.push("Rollback requires manual steps.");
  }

  if (rb.rollbackRisk) {
    parts.push(`Rollback risk: ${rb.rollbackRisk}.`);
  }

  if (rb.rollbackRiskExplanation) {
    parts.push(rb.rollbackRiskExplanation);
  }

  if (rb.estimatedTotalDurationMin) {
    parts.push(`Estimated rollback time: ${rb.estimatedTotalDurationMin} minute(s).`);
  }

  if (rb.rollbackSteps && rb.rollbackSteps.length > 0) {
    const stepList = rb.rollbackSteps
      .map((s, i) => `${i + 1}. ${s.description}`)
      .join(" ");
    parts.push(`Steps: ${stepList}`);
  }

  if (rb.manualFallbackSteps && rb.manualFallbackSteps.length > 0) {
    parts.push(`Manual fallback: ${rb.manualFallbackSteps.join("; ")}.`);
  }

  return {
    findingId: ctx.finding.id,
    question: "how_to_rollback",
    answer: parts.join(" "),
    evidence,
    confidence: rb.rollbackRisk === "irreversible" ? "high" : confidence,
    dataGaps: gaps.filter((g) => !g.includes("rollback")),
  };
}

function handleIsThisSafe(ctx: FindingContext): Explanation {
  const evidence = extractEvidence(ctx);
  const gaps = identifyDataGaps(ctx);
  const confidence = computeConfidence(ctx, evidence, gaps);

  const plan = ctx.planItem;
  const rec = ctx.recommendation;
  const parts: string[] = [];

  // Precheck verdict
  if (plan?.precheckResult) {
    const pc = plan.precheckResult;
    if (pc.passed === true) {
      parts.push("All prechecks passed.");
    } else {
      parts.push("Prechecks did not pass — review blockers before proceeding.");
    }
  }

  // Risk level
  const riskLevel = plan?.riskLevel ?? rec?.riskLevel;
  if (riskLevel === "low") {
    parts.push("Risk level: low. This type of change is routine and well-understood.");
  } else if (riskLevel === "medium") {
    parts.push("Risk level: medium. The change is generally safe but may cause brief disruption.");
  } else if (riskLevel === "high") {
    parts.push("Risk level: high. Proceed with caution — consider applying during a maintenance window.");
  }

  // Rollback availability
  if (plan?.rollbackPlan) {
    const rb = plan.rollbackPlan;
    if (rb.automated) {
      parts.push("Automated rollback is available if something goes wrong.");
    } else if (rb.rollbackRisk !== "irreversible") {
      parts.push("Manual rollback steps are available.");
    } else {
      parts.push("This action is irreversible — no rollback is possible.");
    }
  }

  // Disposition context
  const disposition = plan?.disposition ?? rec?.disposition;
  if (disposition === "auto_fix_candidate") {
    parts.push("The agent classified this as safe for automated application.");
  } else if (disposition === "approval_required") {
    parts.push("The agent flagged this for human review before application.");
  } else if (disposition === "blocked") {
    parts.push("This action is currently blocked and cannot be applied.");
  }

  // Effort
  if (rec?.effort === "none" || rec?.effort === "low") {
    parts.push("The change is low-effort and quick to apply.");
  }

  if (parts.length === 0) {
    parts.push("Insufficient data to fully assess safety. Review the finding details and consider a manual evaluation.");
  }

  return {
    findingId: ctx.finding.id,
    question: "is_this_safe",
    answer: parts.join(" "),
    evidence,
    confidence,
    dataGaps: gaps,
  };
}

// ---------------------------------------------------------------------------
// Utility — list available questions for a finding
// ---------------------------------------------------------------------------

export function getAvailableQuestions(): Array<{ key: ExplainQuestion; label: string }> {
  return (Object.entries(QUESTION_LABELS) as [ExplainQuestion, string][]).map(
    ([key, label]) => ({ key, label }),
  );
}
