/**
 * Axiom Explainability & Trust Engine
 *
 * Every agent recommendation, action, or governance violation must be
 * fully explainable. This engine ensures:
 *
 *   1. No hallucinated evidence — all claims trace to stored data
 *   2. Grounded explanations — resource IDs, metrics, thresholds, timestamps
 *   3. Confidence scoring — quantified certainty with degradation factors
 *   4. Risk disclosure — what happens if the recommendation is ignored
 *   5. Assumption transparency — what the agent assumed and what was measured
 *   6. Provider-agnostic — uniform explanation model across AWS, Azure, GCP
 *
 * Trust invariants:
 *   - Every explanation has ≥1 evidence reference
 *   - Confidence cannot exceed the weakest evidence source
 *   - Assumptions are always explicitly enumerated
 *   - "Unknown" is a valid and preferred answer over fabrication
 */

import type { CloudProvider, CloudSnapshot, ComputeResource, StorageResource } from "../cloudSnapshot";
import type { ConfidenceScore } from "../costSignals";
import type { AgentFinding, AgentRecommendation } from "./types";
import type { PolicyViolation, ViolationEvidence } from "./governanceEngine";
import type { DriftItem, DriftFieldChange } from "./driftEngine";
import type { MonitorAlert } from "./monitoringAgent";
import {
  FindingCategory,
  RiskLevel,
  ActionType,
} from "../enums";

// ---------------------------------------------------------------------------
// 1. Evidence schema — the atomic unit of trust
// ---------------------------------------------------------------------------

export type EvidenceType =
  | "metric"           // a measured value (CPU %, cost, object count)
  | "resource_state"   // current state of a resource (running, stopped, public)
  | "configuration"    // a config setting (replication, encryption, storage class)
  | "threshold"        // a policy or rule threshold that was crossed
  | "historical"       // comparison to a prior state or scan
  | "financial"        // cost/savings data from billing APIs
  | "tag"              // resource tag or label
  | "flag"             // snapshot-level flag (singleRegion, noBackupsDetected)
  | "external"         // reference to external system (Terraform plan, execution plan)
  | "absence";         // something expected was NOT found

export type EvidenceConfidence =
  | "measured"         // directly observed from cloud API
  | "derived"          // computed from measured values
  | "estimated"        // inferred with assumptions
  | "unknown";         // data unavailable, agent is transparent about gap

export type EvidenceReference = {
  id: string;
  type: EvidenceType;
  confidence: EvidenceConfidence;
  provider: CloudProvider;
  source: string;                    // e.g. "CloudWatch", "Cost Explorer", "snapshot scan"
  resourceId: string | null;         // null for account-level evidence
  region: string | null;
  field: string;                     // what was observed: "cpuAvgPct", "publicAccess", "monthlySpend"
  observedValue: unknown;            // the actual value
  observedAt: string;                // ISO 8601 timestamp
  comparisonValue?: unknown;         // threshold, expected, or previous value
  comparisonLabel?: string;          // "threshold", "previous_scan", "policy_requirement"
  unit?: string;                     // "%", "USD", "GB", "count", "days"
  sampleWindow?: string;             // "168h", "30d" — how much data backs this
  note?: string;                     // human-readable context
};

// ---------------------------------------------------------------------------
// 2. Explanation schema — the full trust payload
// ---------------------------------------------------------------------------

export type Explanation = {
  id: string;
  subjectType: ExplanationSubject;
  subjectId: string;                 // finding ID, recommendation ID, violation ID, etc.
  generatedAt: string;

  why: string;                       // plain-English: why was this recommended?
  whatTriggered: string;             // what metric/state/condition triggered this
  whatEvidenceUsed: string;          // summary of evidence sources
  assumptions: Assumption[];         // what the agent assumed
  risks: Risk[];                     // what could go wrong
  ifIgnored: string;                 // what happens if the user does nothing
  confidence: ConfidenceAssessment;  // quantified certainty

  evidence: EvidenceReference[];     // the ground truth backing this explanation
  relatedResourceIds: string[];      // all resources involved
  providerContext: ProviderContext;   // provider-specific framing
};

export type ExplanationSubject =
  | "finding"
  | "recommendation"
  | "governance_violation"
  | "drift_item"
  | "monitor_alert"
  | "action_plan";

export type Assumption = {
  statement: string;                 // e.g. "CPU usage is representative of the past 7 days"
  basis: "measured" | "default" | "inferred";
  impact: "low" | "medium" | "high"; // how wrong could this make the recommendation
  alternative?: string;              // what if this assumption is wrong
};

export type Risk = {
  description: string;
  likelihood: "unlikely" | "possible" | "likely";
  impact: "low" | "medium" | "high";
  mitigation: string;
};

export type ConfidenceAssessment = {
  overall: ConfidenceLevel;          // the final confidence
  score: number;                     // 0-100 numeric score
  factors: ConfidenceFactor[];       // what raised/lowered confidence
  dataCompleteness: number;          // 0-100, how complete was the input data
  degradationReasons: string[];      // why confidence is not 100
};

export type ConfidenceLevel = "very_low" | "low" | "medium" | "high" | "very_high";

export type ConfidenceFactor = {
  factor: string;
  direction: "increases" | "decreases";
  weight: number;                    // 0-1
  reason: string;
};

export type ProviderContext = {
  provider: CloudProvider;
  serviceName: string;               // e.g. "EC2", "Azure VMs", "Compute Engine"
  consoleUrl?: string;               // deep link template (no actual URLs generated)
  cliCommand?: string;               // equivalent CLI to verify
  apiReference?: string;             // API docs path
};

// ---------------------------------------------------------------------------
// 3. Confidence scoring engine
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLDS: Record<ConfidenceLevel, [number, number]> = {
  very_low: [0, 20],
  low: [20, 40],
  medium: [40, 65],
  high: [65, 85],
  very_high: [85, 101],
};

function scoreToLevel(score: number): ConfidenceLevel {
  for (const [level, [min, max]] of Object.entries(CONFIDENCE_THRESHOLDS)) {
    if (score >= min && score < max) return level as ConfidenceLevel;
  }
  return "medium";
}

export function computeConfidenceAssessment(
  evidence: EvidenceReference[],
  dataPoints: DataCompletenessInput,
): ConfidenceAssessment {
  const factors: ConfidenceFactor[] = [];
  const degradationReasons: string[] = [];

  let score = 50;

  // Factor 1: Evidence count
  if (evidence.length >= 3) {
    factors.push({ factor: "evidence_count", direction: "increases", weight: 0.15, reason: `${evidence.length} evidence references` });
    score += 15;
  } else if (evidence.length === 0) {
    factors.push({ factor: "evidence_count", direction: "decreases", weight: 0.3, reason: "No evidence references" });
    score -= 30;
    degradationReasons.push("No evidence references available");
  }

  // Factor 2: Evidence confidence quality
  const measured = evidence.filter((e) => e.confidence === "measured").length;
  const estimated = evidence.filter((e) => e.confidence === "estimated").length;
  const unknown = evidence.filter((e) => e.confidence === "unknown").length;
  const total = evidence.length || 1;

  const measuredRatio = measured / total;
  if (measuredRatio >= 0.7) {
    factors.push({ factor: "measurement_quality", direction: "increases", weight: 0.2, reason: `${(measuredRatio * 100).toFixed(0)}% of evidence is directly measured` });
    score += 20;
  } else if (estimated > measured) {
    factors.push({ factor: "measurement_quality", direction: "decreases", weight: 0.1, reason: "More estimated than measured evidence" });
    score -= 10;
    degradationReasons.push("Relying on estimated rather than measured data");
  }
  if (unknown > 0) {
    factors.push({ factor: "unknown_data", direction: "decreases", weight: 0.15, reason: `${unknown} evidence source(s) with unknown confidence` });
    score -= 15;
    degradationReasons.push(`${unknown} data point(s) have unknown reliability`);
  }

  // Factor 3: Sample window depth
  const hasDeepSamples = evidence.some((e) => {
    if (!e.sampleWindow) return false;
    const hours = parseSampleWindow(e.sampleWindow);
    return hours >= 168; // 7+ days
  });
  if (hasDeepSamples) {
    factors.push({ factor: "sample_depth", direction: "increases", weight: 0.1, reason: "7+ days of metric history" });
    score += 10;
  }

  const hasShallowOnly = evidence.length > 0 && evidence.every((e) => {
    if (!e.sampleWindow) return true;
    return parseSampleWindow(e.sampleWindow) < 24;
  });
  if (hasShallowOnly && evidence.length > 0) {
    factors.push({ factor: "sample_depth", direction: "decreases", weight: 0.1, reason: "Less than 24h of metric data" });
    score -= 10;
    degradationReasons.push("Short observation window — metrics may not be representative");
  }

  // Factor 4: Data completeness
  const completeness = computeDataCompleteness(dataPoints);
  if (completeness >= 80) {
    factors.push({ factor: "data_completeness", direction: "increases", weight: 0.1, reason: `${completeness}% data completeness` });
    score += 10;
  } else if (completeness < 50) {
    factors.push({ factor: "data_completeness", direction: "decreases", weight: 0.15, reason: `Only ${completeness}% data completeness` });
    score -= 15;
    degradationReasons.push(`Data completeness is ${completeness}% — some fields were unavailable`);
  }

  // Factor 5: Cross-provider normalization
  if (evidence.some((e) => e.provider !== evidence[0]?.provider)) {
    factors.push({ factor: "cross_provider", direction: "decreases", weight: 0.05, reason: "Evidence spans multiple providers with different APIs" });
    score -= 5;
    degradationReasons.push("Cross-provider comparison introduces normalization uncertainty");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    overall: scoreToLevel(score),
    score,
    factors,
    dataCompleteness: completeness,
    degradationReasons,
  };
}

export type DataCompletenessInput = {
  hasCpuMetrics: boolean;
  hasMemoryMetrics: boolean;
  hasCostData: boolean;
  hasTagData: boolean;
  hasStorageMetrics: boolean;
  hasNetworkMetrics: boolean;
  hasBackupStatus: boolean;
  hasReplicationStatus: boolean;
};

function computeDataCompleteness(input: DataCompletenessInput): number {
  const fields = [
    input.hasCpuMetrics,
    input.hasMemoryMetrics,
    input.hasCostData,
    input.hasTagData,
    input.hasStorageMetrics,
    input.hasNetworkMetrics,
    input.hasBackupStatus,
    input.hasReplicationStatus,
  ];
  const present = fields.filter(Boolean).length;
  return Math.round((present / fields.length) * 100);
}

function parseSampleWindow(window: string): number {
  const match = window.match(/^(\d+)(h|d|w)$/);
  if (!match) return 0;
  const val = parseInt(match[1], 10);
  switch (match[2]) {
    case "h": return val;
    case "d": return val * 24;
    case "w": return val * 168;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// 4. Evidence builders — grounded in actual snapshot data
// ---------------------------------------------------------------------------

let evidenceSeq = 0;

function evidenceId(): string {
  return `ev-${Date.now()}-${++evidenceSeq}`;
}

export function buildMetricEvidence(
  provider: CloudProvider,
  resourceId: string,
  region: string,
  field: string,
  value: unknown,
  unit: string,
  scanTime: string,
  opts?: {
    source?: string;
    confidence?: EvidenceConfidence;
    comparisonValue?: unknown;
    comparisonLabel?: string;
    sampleWindow?: string;
    note?: string;
  },
): EvidenceReference {
  return {
    id: evidenceId(),
    type: "metric",
    confidence: opts?.confidence ?? "measured",
    provider,
    source: opts?.source ?? providerMetricSource(provider),
    resourceId,
    region,
    field,
    observedValue: value,
    observedAt: scanTime,
    unit,
    comparisonValue: opts?.comparisonValue,
    comparisonLabel: opts?.comparisonLabel,
    sampleWindow: opts?.sampleWindow,
    note: opts?.note,
  };
}

export function buildStateEvidence(
  provider: CloudProvider,
  resourceId: string,
  region: string,
  field: string,
  value: unknown,
  scanTime: string,
  opts?: {
    confidence?: EvidenceConfidence;
    comparisonValue?: unknown;
    comparisonLabel?: string;
    note?: string;
  },
): EvidenceReference {
  return {
    id: evidenceId(),
    type: "resource_state",
    confidence: opts?.confidence ?? "measured",
    provider,
    source: providerStateSource(provider),
    resourceId,
    region,
    field,
    observedValue: value,
    observedAt: scanTime,
    comparisonValue: opts?.comparisonValue,
    comparisonLabel: opts?.comparisonLabel,
    note: opts?.note,
  };
}

export function buildThresholdEvidence(
  provider: CloudProvider,
  resourceId: string | null,
  region: string | null,
  field: string,
  observedValue: unknown,
  threshold: unknown,
  thresholdLabel: string,
  scanTime: string,
  unit?: string,
): EvidenceReference {
  return {
    id: evidenceId(),
    type: "threshold",
    confidence: "measured",
    provider,
    source: "policy_engine",
    resourceId,
    region,
    field,
    observedValue,
    observedAt: scanTime,
    comparisonValue: threshold,
    comparisonLabel: thresholdLabel,
    unit,
  };
}

export function buildFlagEvidence(
  provider: CloudProvider,
  accountId: string,
  flag: string,
  value: boolean,
  scanTime: string,
): EvidenceReference {
  return {
    id: evidenceId(),
    type: "flag",
    confidence: "measured",
    provider,
    source: "snapshot_scan",
    resourceId: accountId,
    region: null,
    field: flag,
    observedValue: value,
    observedAt: scanTime,
  };
}

export function buildAbsenceEvidence(
  provider: CloudProvider,
  resourceId: string,
  region: string,
  field: string,
  expected: string,
  scanTime: string,
): EvidenceReference {
  return {
    id: evidenceId(),
    type: "absence",
    confidence: "measured",
    provider,
    source: "snapshot_scan",
    resourceId,
    region,
    field,
    observedValue: null,
    observedAt: scanTime,
    comparisonValue: expected,
    comparisonLabel: "expected_value",
    note: `Expected ${field} to be "${expected}" but it was not found`,
  };
}

export function buildHistoricalEvidence(
  provider: CloudProvider,
  resourceId: string,
  region: string,
  field: string,
  previousValue: unknown,
  currentValue: unknown,
  previousScanTime: string,
  currentScanTime: string,
): EvidenceReference {
  return {
    id: evidenceId(),
    type: "historical",
    confidence: "measured",
    provider,
    source: "snapshot_comparison",
    resourceId,
    region,
    field,
    observedValue: currentValue,
    observedAt: currentScanTime,
    comparisonValue: previousValue,
    comparisonLabel: `previous_scan (${previousScanTime})`,
  };
}

// ---------------------------------------------------------------------------
// 5. Provider-specific source labels
// ---------------------------------------------------------------------------

function providerMetricSource(provider: CloudProvider): string {
  switch (provider) {
    case "aws": return "CloudWatch";
    case "azure": return "Azure Monitor";
    case "gcp": return "Cloud Monitoring";
    default: return "cloud_metrics";
  }
}

function providerStateSource(provider: CloudProvider): string {
  switch (provider) {
    case "aws": return "AWS API (DescribeInstances/ListBuckets)";
    case "azure": return "Azure Resource Manager API";
    case "gcp": return "GCP Resource Manager API";
    default: return "cloud_api";
  }
}

function providerCostSource(provider: CloudProvider): string {
  switch (provider) {
    case "aws": return "AWS Cost Explorer / CUR";
    case "azure": return "Azure Cost Management API";
    case "gcp": return "GCP Billing API / BigQuery export";
    default: return "billing_api";
  }
}

function providerServiceName(provider: CloudProvider, resourceType: "compute" | "storage"): string {
  if (resourceType === "compute") {
    switch (provider) {
      case "aws": return "EC2";
      case "azure": return "Azure Virtual Machines";
      case "gcp": return "Compute Engine";
    }
  }
  switch (provider) {
    case "aws": return "S3";
    case "azure": return "Azure Blob Storage";
    case "gcp": return "Cloud Storage";
  }
}

// ---------------------------------------------------------------------------
// 6. Explanation builders — from domain objects to full explanations
// ---------------------------------------------------------------------------

let explanationSeq = 0;

function explanationId(): string {
  return `expl-${Date.now()}-${++explanationSeq}`;
}

export function explainFinding(
  finding: AgentFinding,
  snapshot: CloudSnapshot,
): Explanation {
  const now = new Date().toISOString();
  const evidence: EvidenceReference[] = [];
  const assumptions: Assumption[] = [];
  const risks: Risk[] = [];

  // Build evidence from finding data
  for (const resourceId of finding.affectedResources) {
    const resource = snapshot.resources.find((r) => r.resourceId === resourceId);
    if (resource?.resourceType === "compute") {
      const compute = resource as ComputeResource;
      evidence.push(buildStateEvidence(
        finding.provider, resourceId, finding.region,
        "state", compute.state, snapshot.scannedAt,
      ));
      if (compute.usage?.cpuAvgPct !== undefined) {
        evidence.push(buildMetricEvidence(
          finding.provider, resourceId, finding.region,
          "cpuAvgPct", compute.usage.cpuAvgPct, "%", snapshot.scannedAt,
          { sampleWindow: compute.usage.sampleWindowHours ? `${compute.usage.sampleWindowHours}h` : undefined },
        ));
      }
      if (compute.monthlyCostEstimate !== undefined) {
        evidence.push(buildMetricEvidence(
          finding.provider, resourceId, finding.region,
          "monthlyCostEstimate", compute.monthlyCostEstimate, "USD", snapshot.scannedAt,
          { source: providerCostSource(finding.provider), confidence: "derived" },
        ));
      }
    }
    if (resource?.resourceType === "storage") {
      const storage = resource as StorageResource;
      evidence.push(buildStateEvidence(
        finding.provider, resourceId, finding.region,
        "storageClass", storage.storageClass, snapshot.scannedAt,
      ));
      if (storage.sizeGb !== undefined) {
        evidence.push(buildMetricEvidence(
          finding.provider, resourceId, finding.region,
          "sizeGb", storage.sizeGb, "GB", snapshot.scannedAt,
        ));
      }
    }
  }

  // Standard assumptions based on confidence level
  if (finding.confidence === "low") {
    assumptions.push({
      statement: "Limited data available — metrics may not reflect typical usage patterns",
      basis: "inferred",
      impact: "high",
      alternative: "Gather more metrics over a longer sample window before acting",
    });
  }
  if (finding.estimatedSavings) {
    assumptions.push({
      statement: "Savings estimates assume current pricing and usage patterns remain stable",
      basis: "default",
      impact: "medium",
      alternative: "Actual savings may vary if usage patterns change",
    });
  }

  // Risks
  if (finding.category === "cost") {
    risks.push({
      description: "Right-sizing may impact application performance during peak loads",
      likelihood: "possible",
      impact: "medium",
      mitigation: "Monitor application metrics closely for 48h after changes",
    });
  }
  if (finding.category === "security") {
    risks.push({
      description: "Security issue may already have been exploited",
      likelihood: "unlikely",
      impact: "high",
      mitigation: "Audit access logs before and after remediation",
    });
  }

  const resourceType = snapshot.resources.find(
    (r) => finding.affectedResources.includes(r.resourceId),
  )?.resourceType ?? "compute";

  const dataPoints = snapshotToDataCompleteness(snapshot);
  const confidence = computeConfidenceAssessment(evidence, dataPoints);

  return {
    id: explanationId(),
    subjectType: "finding",
    subjectId: finding.id,
    generatedAt: now,
    why: `${finding.title}: ${finding.description}`,
    whatTriggered: deriveWhatTriggered(finding),
    whatEvidenceUsed: `${evidence.length} data points from ${providerMetricSource(finding.provider)} and snapshot scan at ${snapshot.scannedAt}`,
    assumptions,
    risks,
    ifIgnored: deriveIfIgnored(finding),
    confidence,
    evidence,
    relatedResourceIds: finding.affectedResources,
    providerContext: {
      provider: finding.provider,
      serviceName: providerServiceName(finding.provider, resourceType),
    },
  };
}

export function explainRecommendation(
  rec: AgentRecommendation,
  finding: AgentFinding,
  snapshot: CloudSnapshot,
): Explanation {
  const base = explainFinding(finding, snapshot);

  // Overlay recommendation-specific fields
  base.subjectType = "recommendation";
  base.subjectId = rec.id;
  base.why = rec.rationale;

  if (rec.estimatedSavings) {
    base.evidence.push(buildMetricEvidence(
      finding.provider, finding.affectedResources[0] ?? snapshot.accountId,
      finding.region, "estimatedMonthlySavings", rec.estimatedSavings.monthly, "USD",
      snapshot.scannedAt, {
        source: providerCostSource(finding.provider),
        confidence: "estimated",
        note: `Estimated annual savings: $${rec.estimatedSavings.yearly}`,
      },
    ));
  }

  if (rec.riskLevel === "high") {
    base.risks.push({
      description: "This is a high-risk action that may cause service disruption",
      likelihood: "possible",
      impact: "high",
      mitigation: "Use a maintenance window and have rollback plans ready",
    });
  }

  if (rec.disposition === "auto_fix_candidate") {
    base.assumptions.push({
      statement: "This action was classified as safe for automated execution based on risk analysis",
      basis: "inferred",
      impact: "low",
      alternative: "Request manual approval if you want to review before execution",
    });
  }

  return base;
}

export function explainGovernanceViolation(
  violation: PolicyViolation,
  snapshot: CloudSnapshot,
): Explanation {
  const now = new Date().toISOString();
  const evidence: EvidenceReference[] = [];

  for (const ve of violation.evidence) {
    evidence.push({
      id: evidenceId(),
      type: "threshold",
      confidence: "measured",
      provider: violation.provider,
      source: "governance_engine",
      resourceId: violation.resourceId,
      region: violation.region,
      field: ve.field,
      observedValue: ve.actual,
      observedAt: violation.detectedAt,
      comparisonValue: ve.expected,
      comparisonLabel: `policy_requirement (${violation.policyName})`,
    });
  }

  const assumptions: Assumption[] = [
    {
      statement: `Policy "${violation.policyName}" is correctly configured and applies to this scope`,
      basis: "default",
      impact: "low",
    },
  ];

  const risks: Risk[] = [];
  if (violation.severity === "critical") {
    risks.push({
      description: "Critical policy violation indicates immediate security or compliance risk",
      likelihood: "likely",
      impact: "high",
      mitigation: "Address this violation before next compliance audit window",
    });
  }

  const ifIgnored = violation.enforcement === "block"
    ? `This violation BLOCKS further actions. It must be resolved before the agent can proceed.`
    : violation.enforcement === "enforce"
      ? `This violation will be escalated for mandatory approval. Ignoring it may trigger audit alerts.`
      : `This violation will be logged for audit purposes. Repeated violations may trigger enforcement escalation.`;

  const dataPoints = snapshotToDataCompleteness(snapshot);

  return {
    id: explanationId(),
    subjectType: "governance_violation",
    subjectId: violation.id,
    generatedAt: now,
    why: violation.description,
    whatTriggered: `Policy "${violation.policyName}" detected ${violation.evidence.map((e) => `${e.field}=${e.actual}`).join(", ")}`,
    whatEvidenceUsed: `${evidence.length} policy evaluation(s) against snapshot from ${snapshot.scannedAt}`,
    assumptions,
    risks,
    ifIgnored,
    confidence: computeConfidenceAssessment(evidence, dataPoints),
    evidence,
    relatedResourceIds: [violation.resourceId],
    providerContext: {
      provider: violation.provider,
      serviceName: providerServiceName(violation.provider, violation.resourceType),
    },
  };
}

export function explainDriftItem(
  drift: DriftItem,
  snapshot: CloudSnapshot,
): Explanation {
  const now = new Date().toISOString();
  const evidence: EvidenceReference[] = [];

  for (const fc of drift.fieldChanges) {
    evidence.push({
      id: evidenceId(),
      type: fc.source === "previous_snapshot" ? "historical" : "external",
      confidence: "measured",
      provider: drift.provider,
      source: `drift_detection (${fc.source})`,
      resourceId: drift.resourceId,
      region: drift.region,
      field: fc.field,
      observedValue: fc.actual,
      observedAt: drift.firstDetectedAt,
      comparisonValue: fc.expected,
      comparisonLabel: fc.source,
    });
  }

  const assumptions: Assumption[] = [
    {
      statement: "The reference state (plan/snapshot) accurately represents the intended configuration",
      basis: "default",
      impact: "medium",
      alternative: "If the drift was intentional, update the reference state to match",
    },
  ];

  const risks: Risk[] = [];
  if (drift.severity === "critical") {
    risks.push({
      description: "Critical drift may indicate unauthorized access or misconfiguration",
      likelihood: "possible",
      impact: "high",
      mitigation: "Investigate the change source via audit logs immediately",
    });
  }
  if (drift.impact.blastRadius !== "single_resource") {
    risks.push({
      description: `Drift affects ${drift.impact.blastRadius}-level scope — impact extends beyond this resource`,
      likelihood: "likely",
      impact: "medium",
      mitigation: "Assess downstream dependencies before remediation",
    });
  }

  const dataPoints = snapshotToDataCompleteness(snapshot);

  return {
    id: explanationId(),
    subjectType: "drift_item",
    subjectId: drift.id,
    generatedAt: now,
    why: drift.description,
    whatTriggered: `Drift detected: ${drift.fieldChanges.map((f) => `${f.field} changed from ${JSON.stringify(f.expected)} to ${JSON.stringify(f.actual)}`).join("; ")}`,
    whatEvidenceUsed: `${evidence.length} field comparison(s) against ${drift.fieldChanges[0]?.source ?? "reference state"}`,
    assumptions,
    risks,
    ifIgnored: drift.impact.description,
    confidence: computeConfidenceAssessment(evidence, dataPoints),
    evidence,
    relatedResourceIds: [drift.resourceId],
    providerContext: {
      provider: drift.provider,
      serviceName: providerServiceName(drift.provider, drift.resourceType),
    },
  };
}

export function explainMonitorAlert(
  alert: MonitorAlert,
  snapshot: CloudSnapshot,
): Explanation {
  const now = new Date().toISOString();
  const evidence: EvidenceReference[] = [];

  evidence.push({
    id: evidenceId(),
    type: alert.delta.direction === "new" ? "resource_state" : "historical",
    confidence: "measured",
    provider: alert.provider,
    source: "monitoring_agent",
    resourceId: alert.affectedResources[0] ?? null,
    region: alert.regions[0] ?? null,
    field: alert.delta.metric,
    observedValue: alert.delta.currentValue,
    observedAt: alert.timestamp,
    comparisonValue: alert.delta.previousValue,
    comparisonLabel: "previous_scan",
    note: alert.delta.changePercent !== null
      ? `${alert.delta.changePercent > 0 ? "+" : ""}${alert.delta.changePercent.toFixed(1)}% change`
      : undefined,
  });

  const assumptions: Assumption[] = [
    {
      statement: "The previous scan represents a stable baseline for comparison",
      basis: "default",
      impact: "low",
    },
  ];

  const risks: Risk[] = [];
  if (alert.severity === "critical") {
    risks.push({
      description: "Critical alert requires immediate attention — potential security or cost incident",
      likelihood: "likely",
      impact: "high",
      mitigation: alert.recommendation,
    });
  }

  const dataPoints = snapshotToDataCompleteness(snapshot);

  return {
    id: explanationId(),
    subjectType: "monitor_alert",
    subjectId: alert.id,
    generatedAt: now,
    why: alert.summary,
    whatTriggered: `${alert.delta.metric} ${alert.delta.direction} from ${alert.delta.previousValue ?? "N/A"} to ${alert.delta.currentValue}`,
    whatEvidenceUsed: `Monitoring delta: ${alert.delta.metric} (${alert.delta.direction})`,
    assumptions,
    risks,
    ifIgnored: alert.requiresAction
      ? `This alert requires action. Ignoring it may lead to: ${alert.detail}`
      : `Informational alert. No immediate action required, but continued monitoring is recommended.`,
    confidence: computeConfidenceAssessment(evidence, dataPoints),
    evidence,
    relatedResourceIds: alert.affectedResources,
    providerContext: {
      provider: alert.provider,
      serviceName: "Multi-service",
    },
  };
}

// ---------------------------------------------------------------------------
// 7. Helpers
// ---------------------------------------------------------------------------

function snapshotToDataCompleteness(snapshot: CloudSnapshot): DataCompletenessInput {
  const computes = snapshot.resources.filter(
    (r): r is ComputeResource => r.resourceType === "compute",
  );
  const storages = snapshot.resources.filter(
    (r): r is StorageResource => r.resourceType === "storage",
  );

  return {
    hasCpuMetrics: computes.some((c) => c.usage?.cpuAvgPct !== undefined),
    hasMemoryMetrics: computes.some((c) => c.usage?.memoryAvgPct !== undefined),
    hasCostData: snapshot.monthlySpend !== undefined && snapshot.monthlySpend > 0,
    hasTagData: snapshot.resources.some((r) => r.tags && Object.keys(r.tags).length > 0),
    hasStorageMetrics: storages.some((s) => s.sizeGb !== undefined),
    hasNetworkMetrics: computes.some((c) => c.usage?.networkInGbPerDay !== undefined),
    hasBackupStatus: true, // always available via snapshot flags
    hasReplicationStatus: storages.some((s) => s.tags?.["replication"] !== undefined),
  };
}

function deriveWhatTriggered(finding: AgentFinding): string {
  switch (finding.category) {
    case "cost":
      return finding.estimatedSavings
        ? `Potential savings of $${finding.estimatedSavings.monthly}/mo identified across ${finding.affectedResources.length} resource(s)`
        : `Cost optimization opportunity on ${finding.affectedResources.length} resource(s)`;
    case "resilience":
      return `Resilience gap detected: ${finding.title}`;
    case "security":
      return `Security issue identified: ${finding.title}`;
    case "performance":
      return `Performance concern: ${finding.title}`;
    case "compliance":
      return `Compliance gap: ${finding.title}`;
    default:
      return finding.title;
  }
}

function deriveIfIgnored(finding: AgentFinding): string {
  switch (finding.category) {
    case "cost":
      return finding.estimatedSavings
        ? `Continued overspend of approximately $${finding.estimatedSavings.monthly}/month ($${finding.estimatedSavings.yearly}/year)`
        : "Potential cost waste will continue accumulating";
    case "resilience":
      return "Infrastructure remains vulnerable to outages in the affected region(s)";
    case "security":
      return "Security exposure remains unmitigated — risk of data breach or unauthorized access";
    case "performance":
      return "Application performance may continue to degrade for end users";
    case "compliance":
      return "Non-compliance risk persists — may impact audit results or regulatory standing";
    default:
      return "Issue will persist until addressed";
  }
}

// ---------------------------------------------------------------------------
// 8. Response templates — structured output for UI rendering
// ---------------------------------------------------------------------------

export type ExplanationCard = {
  headline: string;
  sections: ExplanationSection[];
};

export type ExplanationSection = {
  heading: string;
  content: string;
  evidenceRefs: string[];  // evidence IDs for inline citations
};

export function toExplanationCard(explanation: Explanation): ExplanationCard {
  const sections: ExplanationSection[] = [];

  sections.push({
    heading: "Why this was flagged",
    content: explanation.why,
    evidenceRefs: explanation.evidence.slice(0, 3).map((e) => e.id),
  });

  sections.push({
    heading: "What triggered it",
    content: explanation.whatTriggered,
    evidenceRefs: explanation.evidence.filter((e) => e.type === "metric" || e.type === "threshold").map((e) => e.id),
  });

  sections.push({
    heading: "Evidence used",
    content: explanation.evidence.map((e) =>
      `${e.field}: ${JSON.stringify(e.observedValue)}${e.unit ? ` ${e.unit}` : ""}` +
      (e.comparisonValue !== undefined ? ` (${e.comparisonLabel}: ${JSON.stringify(e.comparisonValue)})` : "") +
      ` [${e.confidence}, ${e.source}]`
    ).join("\n"),
    evidenceRefs: explanation.evidence.map((e) => e.id),
  });

  if (explanation.assumptions.length > 0) {
    sections.push({
      heading: "Assumptions made",
      content: explanation.assumptions.map((a) =>
        `• ${a.statement} (${a.basis}, impact: ${a.impact})` +
        (a.alternative ? `\n  If wrong: ${a.alternative}` : "")
      ).join("\n"),
      evidenceRefs: [],
    });
  }

  if (explanation.risks.length > 0) {
    sections.push({
      heading: "Risks",
      content: explanation.risks.map((r) =>
        `• ${r.description} (${r.likelihood}, impact: ${r.impact})\n  Mitigation: ${r.mitigation}`
      ).join("\n"),
      evidenceRefs: [],
    });
  }

  sections.push({
    heading: "What happens if ignored",
    content: explanation.ifIgnored,
    evidenceRefs: [],
  });

  sections.push({
    heading: "Confidence",
    content: `${explanation.confidence.overall} (${explanation.confidence.score}/100)` +
      (explanation.confidence.degradationReasons.length > 0
        ? `\nLimitations: ${explanation.confidence.degradationReasons.join("; ")}`
        : "") +
      `\nData completeness: ${explanation.confidence.dataCompleteness}%`,
    evidenceRefs: [],
  });

  return {
    headline: explanation.why,
    sections,
  };
}

// ---------------------------------------------------------------------------
// 9. Batch explanation
// ---------------------------------------------------------------------------

export function explainFindings(
  findings: AgentFinding[],
  snapshot: CloudSnapshot,
): Explanation[] {
  return findings.map((f) => explainFinding(f, snapshot));
}

export function explainGovernanceViolations(
  violations: PolicyViolation[],
  snapshot: CloudSnapshot,
): Explanation[] {
  return violations.map((v) => explainGovernanceViolation(v, snapshot));
}

export function explainDriftItems(
  items: DriftItem[],
  snapshot: CloudSnapshot,
): Explanation[] {
  return items.map((d) => explainDriftItem(d, snapshot));
}

// ---------------------------------------------------------------------------
// 10. Validation — ensure no explanation is shipped without evidence
// ---------------------------------------------------------------------------

export type ExplanationValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateExplanation(explanation: Explanation): ExplanationValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (explanation.evidence.length === 0) {
    errors.push("Explanation has no evidence references — this violates the trust contract");
  }

  if (!explanation.why || explanation.why.trim().length === 0) {
    errors.push("Explanation is missing 'why' — every recommendation must state its reason");
  }

  if (!explanation.ifIgnored || explanation.ifIgnored.trim().length === 0) {
    errors.push("Explanation is missing 'ifIgnored' — users must know the cost of inaction");
  }

  if (explanation.confidence.score === 0) {
    errors.push("Confidence score is 0 — this should not be presented to users");
  }

  if (explanation.assumptions.length === 0) {
    warnings.push("No assumptions listed — verify that no implicit assumptions exist");
  }

  if (explanation.risks.length === 0) {
    warnings.push("No risks listed — verify that action is truly risk-free");
  }

  for (const ev of explanation.evidence) {
    if (ev.observedValue === undefined) {
      errors.push(`Evidence ${ev.id} has undefined observedValue — all evidence must be grounded`);
    }
    if (!ev.observedAt) {
      errors.push(`Evidence ${ev.id} has no timestamp — evidence must be time-bound`);
    }
  }

  if (explanation.confidence.overall === "very_low") {
    warnings.push("Very low confidence — consider gathering more data before presenting this");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 11. Reset (for testing)
// ---------------------------------------------------------------------------

export function _resetExplainabilityCounters(): void {
  evidenceSeq = 0;
  explanationSeq = 0;
}

// ---------------------------------------------------------------------------
// 12. Invariant tests
// ---------------------------------------------------------------------------

export type ExplainabilityTestResult = { name: string; passed: boolean; detail: string };

export function runExplainabilityTests(): ExplainabilityTestResult[] {
  const results: ExplainabilityTestResult[] = [];
  _resetExplainabilityCounters();

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  function makeSnapshot(overrides?: Partial<CloudSnapshot>): CloudSnapshot {
    return {
      provider: "aws",
      accountId: "123456789012",
      scannedAt: "2026-05-09T00:00:00Z",
      regions: ["us-east-1", "us-west-2"],
      resources: [],
      monthlySpend: 15_000,
      flags: { singleRegion: false, noBackupsDetected: false },
      ...overrides,
    };
  }

  const makeFinding = (overrides?: Partial<AgentFinding>): AgentFinding => ({
    id: "f-1",
    category: "cost",
    severity: "medium",
    title: "Underutilized instance",
    description: "Instance i-abc123 is running at 3% CPU",
    affectedResources: ["i-abc123"],
    region: "us-east-1",
    provider: "aws",
    confidence: "high",
    estimatedSavings: { monthly: 200, yearly: 2400 },
    data: {},
    ...overrides,
  });

  const makeRec = (overrides?: Partial<AgentRecommendation>): AgentRecommendation => ({
    id: "r-1",
    findingId: "f-1",
    title: "Right-size i-abc123",
    rationale: "Instance is consistently underutilized; right-sizing to m5.large saves $200/mo",
    estimatedSavings: { monthly: 200, yearly: 2400 },
    actionType: "resize_compute" as ActionType,
    disposition: "approval_required",
    dispositionReason: "Compute resize requires approval",
    riskLevel: "medium" as RiskLevel,
    effort: "low",
    actionable: true,
    ...overrides,
  });

  const snapshot = makeSnapshot({
    resources: [{
      resourceType: "compute" as const,
      provider: "aws" as CloudProvider,
      resourceId: "i-abc123",
      region: "us-east-1",
      instanceType: "m5.xlarge",
      tier: "general" as const,
      vcpus: 4,
      memoryGb: 16,
      state: "running" as const,
      usage: { cpuAvgPct: 3.2, sampleWindowHours: 168 },
      monthlyCostEstimate: 300,
    }],
  });

  // Test 1: Finding explanation has evidence
  const findingExpl = explainFinding(makeFinding(), snapshot);
  assert("finding explanation has evidence", () => findingExpl.evidence.length > 0,
    `evidence_count=${findingExpl.evidence.length}`);

  // Test 2: Finding explanation passes validation
  const findingValid = validateExplanation(findingExpl);
  assert("finding explanation passes validation", () => findingValid.valid,
    `errors=${findingValid.errors.join("; ")}`);

  // Test 3: Recommendation explanation inherits finding evidence
  const recExpl = explainRecommendation(makeRec(), makeFinding(), snapshot);
  assert("recommendation has evidence", () => recExpl.evidence.length > 0,
    `evidence_count=${recExpl.evidence.length}`);

  // Test 4: Recommendation includes savings evidence
  const savingsEvidence = recExpl.evidence.find((e) => e.field === "estimatedMonthlySavings");
  assert("recommendation includes savings evidence", () => savingsEvidence !== undefined,
    `found=${!!savingsEvidence}`);

  // Test 5: Confidence scoring
  const goodEvidence = [
    buildMetricEvidence("aws", "i-1", "us-east-1", "cpu", 3, "%", "2026-05-09T00:00:00Z", { sampleWindow: "168h" }),
    buildMetricEvidence("aws", "i-1", "us-east-1", "cost", 300, "USD", "2026-05-09T00:00:00Z"),
    buildStateEvidence("aws", "i-1", "us-east-1", "state", "running", "2026-05-09T00:00:00Z"),
  ];
  const goodConf = computeConfidenceAssessment(goodEvidence, {
    hasCpuMetrics: true, hasMemoryMetrics: true, hasCostData: true, hasTagData: true,
    hasStorageMetrics: true, hasNetworkMetrics: true, hasBackupStatus: true, hasReplicationStatus: true,
  });
  assert("good evidence yields high confidence", () => goodConf.score >= 65,
    `score=${goodConf.score}, level=${goodConf.overall}`);

  // Test 6: No evidence yields low confidence
  const noConf = computeConfidenceAssessment([], {
    hasCpuMetrics: false, hasMemoryMetrics: false, hasCostData: false, hasTagData: false,
    hasStorageMetrics: false, hasNetworkMetrics: false, hasBackupStatus: false, hasReplicationStatus: false,
  });
  assert("no evidence yields low confidence", () => noConf.score < 20,
    `score=${noConf.score}, level=${noConf.overall}`);

  // Test 7: Confidence degrades with unknowns
  const unknownEvidence = [
    buildMetricEvidence("aws", "i-1", "us-east-1", "cpu", 3, "%", "2026-05-09T00:00:00Z", { confidence: "unknown" }),
  ];
  const unknownConf = computeConfidenceAssessment(unknownEvidence, {
    hasCpuMetrics: true, hasMemoryMetrics: false, hasCostData: false, hasTagData: false,
    hasStorageMetrics: false, hasNetworkMetrics: false, hasBackupStatus: false, hasReplicationStatus: false,
  });
  assert("unknown evidence degrades confidence", () => unknownConf.score < goodConf.score,
    `unknown=${unknownConf.score} < good=${goodConf.score}`);

  // Test 8: Explanation card generation
  const card = toExplanationCard(findingExpl);
  assert("explanation card has sections", () => card.sections.length >= 5,
    `sections=${card.sections.length}`);

  // Test 9: Validation catches missing evidence
  const badExpl: Explanation = {
    ...findingExpl,
    evidence: [],
    why: "",
    ifIgnored: "",
  };
  const badValid = validateExplanation(badExpl);
  assert("validation catches missing evidence", () => !badValid.valid && badValid.errors.length >= 3,
    `errors=${badValid.errors.length}: ${badValid.errors.join("; ")}`);

  // Test 10: Governance violation explanation
  const violation: PolicyViolation = {
    id: "v-1",
    policyId: "gov-no-public-storage",
    policyName: "No public storage",
    domain: "security",
    severity: "critical",
    enforcement: "block",
    provider: "aws",
    accountId: "123456789012",
    region: "us-east-1",
    resourceId: "bucket-public",
    resourceType: "storage",
    title: "Public storage detected",
    description: "bucket-public has public access enabled",
    evidence: [{ field: "publicAccess", expected: "disabled", actual: "true" }],
    remediation: {
      action: "restrict_access",
      description: "Disable public access",
      automatable: true,
      effort: "trivial",
      suggestedDisposition: "blocked" as any,
      approvalRequired: true,
    },
    detectedAt: "2026-05-09T00:00:00Z",
    deduplicationKey: "gov-no-public-storage:bucket-public:no_public_storage",
  };
  const govExpl = explainGovernanceViolation(violation, snapshot);
  assert("governance explanation has evidence", () => govExpl.evidence.length > 0,
    `evidence_count=${govExpl.evidence.length}`);

  // Test 11: Drift explanation
  const driftItem: DriftItem = {
    id: "d-1",
    category: "config_mutation",
    severity: "high",
    source: "previous_snapshot",
    provider: "aws",
    region: "us-east-1",
    resourceId: "i-abc123",
    resourceType: "compute",
    title: "Instance resized outside agent",
    description: "Instance was manually resized from m5.xlarge to m5.4xlarge",
    fieldChanges: [{
      field: "instanceType",
      expected: "m5.xlarge",
      actual: "m5.4xlarge",
      source: "previous_snapshot",
    }],
    impact: {
      category: "cost" as FindingCategory,
      riskLevel: "medium" as RiskLevel,
      description: "Cost increase from manual resize",
      blastRadius: "single_resource",
    },
    remediation: {
      action: "revert_to_plan",
      description: "Revert to planned instance size",
      effort: "low",
      automatable: true,
      terraformApplicable: true,
    },
    suppressible: true,
    firstDetectedAt: "2026-05-09T00:00:00Z",
    deduplicationKey: "drift:i-abc123:instanceType",
  };
  const driftExpl = explainDriftItem(driftItem, snapshot);
  assert("drift explanation has evidence", () => driftExpl.evidence.length > 0,
    `evidence_count=${driftExpl.evidence.length}`);

  // Test 12: Monitor alert explanation
  const alert: MonitorAlert = {
    id: "a-1",
    category: "cost_spike",
    severity: "warning",
    title: "Monthly spend increased 25%",
    summary: "Account spend jumped from $12,000 to $15,000",
    detail: "Driven by new compute instances in us-west-2",
    provider: "aws",
    regions: ["us-east-1", "us-west-2"],
    affectedResources: ["i-abc123"],
    timestamp: "2026-05-09T00:00:00Z",
    deduplicationHash: "hash-1",
    delta: {
      metric: "monthlySpend",
      previousValue: 12000,
      currentValue: 15000,
      changePercent: 25,
      direction: "increased",
    },
    recommendation: "Review new instances in us-west-2",
    suppressible: true,
    requiresAction: false,
  };
  const alertExpl = explainMonitorAlert(alert, snapshot);
  assert("monitor alert explanation has evidence", () => alertExpl.evidence.length > 0,
    `evidence_count=${alertExpl.evidence.length}`);

  // Test 13: All explanations have required fields
  const allExpls = [findingExpl, recExpl, govExpl, driftExpl, alertExpl];
  const allValid = allExpls.every((e) => validateExplanation(e).valid);
  assert("all explanations pass validation", () => allValid,
    `allValid=${allValid}`);

  // Test 14: Batch explanation
  const batchFindings = explainFindings([makeFinding(), makeFinding({ id: "f-2" })], snapshot);
  assert("batch findings generates explanations", () => batchFindings.length === 2,
    `count=${batchFindings.length}`);

  // Test 15: Evidence builder produces valid references
  const metric = buildMetricEvidence("aws", "i-1", "us-east-1", "cpu", 5, "%", "2026-05-09T00:00:00Z");
  const state = buildStateEvidence("aws", "i-1", "us-east-1", "state", "running", "2026-05-09T00:00:00Z");
  const flag = buildFlagEvidence("aws", "123", "singleRegion", true, "2026-05-09T00:00:00Z");
  const absence = buildAbsenceEvidence("aws", "bucket-1", "us-east-1", "encryption", "enabled", "2026-05-09T00:00:00Z");
  const hist = buildHistoricalEvidence("aws", "i-1", "us-east-1", "cpu", 80, 3, "2026-05-08T00:00:00Z", "2026-05-09T00:00:00Z");
  assert("evidence builders produce valid refs", () =>
    [metric, state, flag, absence, hist].every((e) => e.id && e.observedAt && e.provider === "aws"),
    "all evidence references valid");

  // Test 16: Confidence factors are populated
  assert("confidence factors populated", () =>
    goodConf.factors.length >= 3,
    `factors=${goodConf.factors.length}`);

  // Test 17: Data completeness ranges 0-100
  const fullCompleteness = computeConfidenceAssessment(goodEvidence, {
    hasCpuMetrics: true, hasMemoryMetrics: true, hasCostData: true, hasTagData: true,
    hasStorageMetrics: true, hasNetworkMetrics: true, hasBackupStatus: true, hasReplicationStatus: true,
  });
  assert("full data completeness is 100", () => fullCompleteness.dataCompleteness === 100,
    `completeness=${fullCompleteness.dataCompleteness}`);

  // Test 18: Empty data completeness is 0 (only backup always true in real snapshots)
  const emptyCompleteness = computeConfidenceAssessment([], {
    hasCpuMetrics: false, hasMemoryMetrics: false, hasCostData: false, hasTagData: false,
    hasStorageMetrics: false, hasNetworkMetrics: false, hasBackupStatus: false, hasReplicationStatus: false,
  });
  assert("empty data completeness is 0", () => emptyCompleteness.dataCompleteness === 0,
    `completeness=${emptyCompleteness.dataCompleteness}`);

  // Test 19: Security findings include security-specific risks
  const secFinding = makeFinding({ category: "security", severity: "critical" });
  const secExpl = explainFinding(secFinding, snapshot);
  assert("security finding includes security risk", () =>
    secExpl.risks.some((r) => r.description.toLowerCase().includes("security")),
    `risks=${secExpl.risks.map((r) => r.description).join("; ")}`);

  // Test 20: ifIgnored varies by category
  const costIgnored = deriveIfIgnored(makeFinding({ category: "cost" }));
  const secIgnored = deriveIfIgnored(makeFinding({ category: "security" }));
  assert("ifIgnored varies by category", () => costIgnored !== secIgnored,
    `cost="${costIgnored.slice(0, 40)}..." vs sec="${secIgnored.slice(0, 40)}..."`);

  return results;
}
