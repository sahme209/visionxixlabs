/**
 * Cost anomaly auto-explainer.
 *
 * For every billing anomaly Axiom surfaces, attempts to attribute it
 * to a concrete CloudTrail event in the same time window. The
 * correlation is intentionally simple — keyword matching between
 * the anomaly scope and CloudTrail event source/name, weighted by
 * event severity and outcome. We never claim causality we can't
 * defend; the explanation includes a confidence score and the raw
 * evidence refs so the operator can verify.
 *
 * Output: one CostAnomalyExplanation per anomaly, with optional
 * primary suspect event + ranked candidates.
 *
 * Hard rules:
 *   - Read-only inputs (billing connectors + CloudTrail extraction).
 *   - Never modifies anomaly or event state.
 *   - When no plausible event matches, we emit "no_correlation" — we
 *     never invent a cause.
 */

import "server-only";

import { buildBillingConnectors } from "./billingConnectorsBuilder";
import { extractCloudTrailEvents, type CloudTrailEventSummary } from "@/lib/cloud/aws/awsCloudTrailExtractor";
import type { BillingAnomaly, BillingAnomalyKind, BillingProvider } from "./billingConnectorsModel";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

export type CostExplanationVerdict = "primary_suspect" | "plausible" | "no_correlation";

export interface CostExplanationCandidate {
  eventId: string;
  eventName: string;
  eventTime?: string;
  eventSource?: string;
  username?: string;
  /** 0..1 — keyword overlap, severity bump, outcome weight. */
  matchScore: number;
  /** Human-readable why this event was scored. */
  reasoning: string;
}

export interface CostAnomalyExplanation {
  anomalyId: string;
  anomalyKind: BillingAnomalyKind;
  anomalyScope: string;
  anomalyHeadline: string;
  anomalyProvider: BillingProvider;
  anomalyDeltaUsd?: number;
  verdict: CostExplanationVerdict;
  /** 0..1 — only set when verdict is primary_suspect or plausible. */
  confidence: number;
  /** Single best match (when present), shown prominently. */
  primary?: CostExplanationCandidate;
  /** Ranked list (top 5) of plausible CloudTrail correlations. */
  candidates: CostExplanationCandidate[];
  /** Evidence refs the operator can verify. */
  evidenceRefs: string[];
}

export interface CostAnomalyExplainerReport {
  generatedAt: string;
  lookbackMinutes: number;
  anomaliesInspected: number;
  totalExplanations: number;
  attributedCount: number;
  unattributedCount: number;
  explanations: CostAnomalyExplanation[];
  durationMs: number;
  limitations: string[];
}

const MAX_CANDIDATES = 5;
const MIN_PLAUSIBLE_SCORE = 0.45;
const MIN_PRIMARY_SCORE = 0.7;

export async function buildCostAnomalyExplainer(input: {
  tenantId: OrganizationId;
  actorUserId?: UserId;
  lookbackMinutes?: number;
}): Promise<CostAnomalyExplainerReport> {
  const start = Date.now();
  const lookback = input.lookbackMinutes ?? 1440; // 24h default — billing anomalies are slow signals.

  const [billing, trail] = await Promise.all([
    buildBillingConnectors({ tenantId: input.tenantId, actorUserId: input.actorUserId }),
    extractCloudTrailEvents({ lookbackMinutes: lookback }),
  ]);

  const anomalies = billing.anomalies;
  const trailEvents = trail.events;
  const explanations: CostAnomalyExplanation[] = anomalies.map((a) => explainOne(a, trailEvents));

  const limitations: string[] = [];
  if (trail.mode !== "live") {
    limitations.push(`CloudTrail extraction returned mode=${trail.mode}; correlations rely on event evidence and may be incomplete.`);
  }
  for (const l of trail.limitations) limitations.push(`cloudtrail: ${l}`);
  for (const l of billing.limitations) limitations.push(`billing: ${l}`);

  return {
    generatedAt: new Date().toISOString(),
    lookbackMinutes: trail.lookbackMinutes,
    anomaliesInspected: anomalies.length,
    totalExplanations: explanations.length,
    attributedCount: explanations.filter((e) => e.verdict !== "no_correlation").length,
    unattributedCount: explanations.filter((e) => e.verdict === "no_correlation").length,
    explanations,
    durationMs: Date.now() - start,
    limitations,
  };
}

// ---------------------------------------------------------------------------
// Per-anomaly correlation
// ---------------------------------------------------------------------------

function explainOne(anomaly: BillingAnomaly, events: CloudTrailEventSummary[]): CostAnomalyExplanation {
  const evidenceRefs: string[] = [`billing:${anomaly.evidenceRef}`];
  // Score every event against the anomaly.
  const scored: CostExplanationCandidate[] = events
    .map((e) => {
      const { score, reasoning } = scorePair(anomaly, e);
      return {
        eventId: e.eventId,
        eventName: e.eventName,
        eventTime: e.eventTime,
        eventSource: e.eventSource,
        username: e.username,
        matchScore: score,
        reasoning,
      };
    })
    .filter((c) => c.matchScore >= MIN_PLAUSIBLE_SCORE)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, MAX_CANDIDATES);

  if (scored.length === 0) {
    return {
      anomalyId: anomaly.id,
      anomalyKind: anomaly.kind,
      anomalyScope: anomaly.scope,
      anomalyHeadline: anomaly.headline,
      anomalyProvider: anomaly.sourceProvider,
      anomalyDeltaUsd: anomaly.deltaUsd,
      verdict: "no_correlation",
      confidence: 0,
      candidates: [],
      evidenceRefs,
    };
  }

  const top = scored[0];
  const verdict: CostExplanationVerdict = top.matchScore >= MIN_PRIMARY_SCORE ? "primary_suspect" : "plausible";
  const confidence = Math.min(1, top.matchScore * Math.min(1, anomaly.confidence + 0.1));

  return {
    anomalyId: anomaly.id,
    anomalyKind: anomaly.kind,
    anomalyScope: anomaly.scope,
    anomalyHeadline: anomaly.headline,
    anomalyProvider: anomaly.sourceProvider,
    anomalyDeltaUsd: anomaly.deltaUsd,
    verdict,
    confidence,
    primary: top,
    candidates: scored,
    evidenceRefs: [
      ...evidenceRefs,
      ...scored.map((c) => `cloudtrail:event:${c.eventId}`),
    ],
  };
}

// ---------------------------------------------------------------------------
// Pair scoring
// ---------------------------------------------------------------------------

function scorePair(anomaly: BillingAnomaly, event: CloudTrailEventSummary): { score: number; reasoning: string } {
  // Only AWS billing anomalies can match AWS CloudTrail events. For
  // non-AWS providers, the correlation has no signal — return 0 so
  // we land in no_correlation honestly.
  if (anomaly.sourceProvider !== "aws_cost_explorer") {
    return { score: 0, reasoning: "Provider mismatch (CloudTrail only attributes AWS spend)." };
  }

  let score = 0;
  const reasons: string[] = [];

  // Service overlap — extract obvious service tokens from the anomaly
  // scope and check if the event source / name contains them.
  const scopeLower = anomaly.scope.toLowerCase();
  const eventSource = (event.eventSource ?? "").toLowerCase();
  const eventName = event.eventName.toLowerCase();

  for (const token of SERVICE_TOKENS) {
    if (scopeLower.includes(token.scopeKey)) {
      if (eventSource.includes(token.eventKey) || eventName.includes(token.eventKey)) {
        score += 0.45;
        reasons.push(`scope mentions ${token.scopeKey} → event source ${event.eventSource ?? "?"}`);
        break;
      }
    }
  }

  // Anomaly-kind ↔ event-name affinity. Some events almost always
  // produce spend changes of a particular kind.
  const affinity = KIND_EVENT_AFFINITY[anomaly.kind] ?? [];
  if (affinity.some((needle) => eventName.includes(needle))) {
    score += 0.3;
    reasons.push(`anomaly kind '${anomaly.kind}' has a known affinity to '${event.eventName}'`);
  }

  // Severity bump — high/critical events are more likely to explain
  // material cost changes.
  if (event.severity === "high" || event.severity === "critical") {
    score += 0.15;
    reasons.push(`event severity is ${event.severity}`);
  }

  // Outcome filter — failed API calls usually don't move cost.
  if (event.outcome === "failure") {
    score -= 0.25;
    reasons.push("event outcome is failure (low cost impact)");
  }

  // Root user → higher prior weight (rare + high-impact).
  if (event.rootUser) {
    score += 0.1;
    reasons.push("event acted as the root user");
  }

  // Clamp and return.
  const clamped = Math.max(0, Math.min(1, score));
  return { score: clamped, reasoning: reasons.join(" · ") || "no positive signal" };
}

// ---------------------------------------------------------------------------
// Heuristic tables
// ---------------------------------------------------------------------------

interface ServiceToken { scopeKey: string; eventKey: string }
const SERVICE_TOKENS: ServiceToken[] = [
  { scopeKey: "ec2",            eventKey: "ec2" },
  { scopeKey: "instance",       eventKey: "ec2" },
  { scopeKey: "s3",             eventKey: "s3" },
  { scopeKey: "bucket",         eventKey: "bucket" },
  { scopeKey: "rds",            eventKey: "rds" },
  { scopeKey: "lambda",         eventKey: "lambda" },
  { scopeKey: "ecs",            eventKey: "ecs" },
  { scopeKey: "eks",            eventKey: "eks" },
  { scopeKey: "kms",            eventKey: "kms" },
  { scopeKey: "cloudfront",     eventKey: "cloudfront" },
  { scopeKey: "elb",            eventKey: "elasticloadbalancing" },
  { scopeKey: "load balancer",  eventKey: "elasticloadbalancing" },
  { scopeKey: "data transfer",  eventKey: "cloudfront" },
  { scopeKey: "egress",         eventKey: "ec2" },
  { scopeKey: "nat gateway",    eventKey: "natgateway" },
  { scopeKey: "guardduty",      eventKey: "guardduty" },
  { scopeKey: "cloudwatch",     eventKey: "cloudwatch" },
];

const KIND_EVENT_AFFINITY: Partial<Record<BillingAnomalyKind, string[]>> = {
  cost_spike: ["runinstances", "createcluster", "createdbinstance", "putobject", "publish", "invokefunction"],
  unattributed_spend: ["runinstances", "createvolume", "createbucket"],
  idle_resource_costing: ["runinstances", "createvolume", "createnatgateway"],
  egress_spike: ["putobject", "createdistribution", "createnetworkinterface"],
  savings_plan_expired: ["deletesavingsplan", "createsavingsplan"],
  committed_use_underuse: ["modifyreservedinstances"],
  untagged_resource: ["runinstances", "createvolume"],
  budget_threshold_breach: ["runinstances", "createdbinstance", "publish"],
};
