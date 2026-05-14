/**
 * Infrastructure Digital Twin Model.
 *
 * A normalised, provider-agnostic representation of the customer's
 * infrastructure that the simulator + diff engine + impact analyzer all
 * read from. The twin is built from existing snapshots, the architecture
 * graph, security scanner output, and ReleaseOps signals — it never
 * duplicates those raw structures.
 *
 * The twin's job is to make change-impact reasoning cheap + safe. It is
 * not the source of truth for billing or apply.
 */

import type { CloudProvider } from "@/lib/domain/provider";
import type { ResourceKind, ResourceState } from "@/lib/cloud/snapshotModel";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type DigitalTwinSourceMode = "live" | "preview" | "planned" | "blocked";

export type DigitalTwinRiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

export type DigitalTwinRelationshipType =
  | "contains"          // VPC contains EC2
  | "depends_on"        // app depends on database
  | "exposes"           // SG exposes EC2 to public
  | "secures"           // SG secures EC2
  | "encrypts"          // KMS encrypts S3
  | "deploys_to"        // pipeline deploys to env
  | "monitors"          // log group monitors compute
  | "governs"           // policy governs resource
  | "owned_by";         // IAM principal owns resource

// ---------------------------------------------------------------------------
// Posture sub-shapes
// ---------------------------------------------------------------------------

export interface TwinSecurityPosture {
  /** 0..100 — composite score derived from findings. */
  score: number;
  totalFindings: number;
  failing: number;
  warning: number;
  preview: number;
  topFindings: { ruleCode: string; severity: DigitalTwinRiskLevel; resourceRef: string }[];
}

export interface TwinCostPosture {
  /** Total monthly cost when known. Honest about partial coverage. */
  totalMonthlyCostUsd?: number;
  /** Resources with cost telemetry over the total. */
  coverageRatio: number;
  /** Top-cost resources sorted desc. */
  topCostResources: { resourceId: string; monthlyCostUsd: number }[];
}

export interface TwinReliabilityPosture {
  score: number;
  singleRegionResources: number;
  noBackupResources: number;
  noReplicaResources: number;
}

export interface TwinReleasePosture {
  /** Readiness grade from releaseReadiness.ts when wired in. */
  grade?: "A" | "B" | "C" | "D" | "F";
  /** Number of repo-level blockers active. */
  blockerCount: number;
}

// ---------------------------------------------------------------------------
// Resource + relationship
// ---------------------------------------------------------------------------

export interface DigitalTwinResource {
  id: string;
  provider: CloudProvider;
  type: ResourceKind | string;
  name?: string;
  region?: string;
  accountId?: string;
  /** Properties relevant to remediation reasoning. No secrets, no raw provider blobs. */
  properties: Record<string, string | number | boolean>;
  tags: Record<string, string>;
  state: ResourceState;
  riskLevel: DigitalTwinRiskLevel;
  /** Pinned security findings affecting this resource. */
  securityFindings: { ruleCode: string; severity: DigitalTwinRiskLevel; evidence?: string }[];
  /** Pinned cost findings. */
  costFindings: { code: string; monthlyCostUsd?: number; note?: string }[];
  /** Outgoing dependency ids on other twin resources. */
  dependencies: string[];
  sourceMode: DigitalTwinSourceMode;
  /** 0..1 — confidence in the data backing this resource. */
  confidence: number;
}

export interface DigitalTwinRelationship {
  fromResourceId: string;
  toResourceId: string;
  relationshipType: DigitalTwinRelationshipType;
  riskLevel: DigitalTwinRiskLevel;
  evidence?: string;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Twin wrapper
// ---------------------------------------------------------------------------

export interface DigitalTwin {
  id: string;
  tenantId?: string;
  provider: CloudProvider | "multi";
  /** Source snapshot id this twin was built from. */
  sourceSnapshotId?: string;
  /** Honest source mode for the *overall* twin. */
  sourceMode: DigitalTwinSourceMode;
  generatedAt: string;

  resources: DigitalTwinResource[];
  relationships: DigitalTwinRelationship[];

  securityPosture: TwinSecurityPosture;
  costPosture: TwinCostPosture;
  reliabilityPosture: TwinReliabilityPosture;
  releasePosture: TwinReleasePosture;

  /** Explicit limitations the operator should know about. */
  knownLimitations: string[];
  /** 0..1 — confidence in the twin as a whole. */
  confidence: number;
  /** Refs to underlying records (snapshot ids, finding ids, blocker ids). */
  evidenceRefs: { label: string; ref: string }[];
}

// ---------------------------------------------------------------------------
// Empty twin helper
// ---------------------------------------------------------------------------

export function emptyTwin(tenantId?: string): DigitalTwin {
  const now = new Date().toISOString();
  return {
    id: `twin.empty.${Date.now().toString(36)}`,
    tenantId,
    provider: "multi",
    sourceMode: "preview",
    generatedAt: now,
    resources: [],
    relationships: [],
    securityPosture:    { score: 0, totalFindings: 0, failing: 0, warning: 0, preview: 0, topFindings: [] },
    costPosture:        { coverageRatio: 0, topCostResources: [] },
    reliabilityPosture: { score: 0, singleRegionResources: 0, noBackupResources: 0, noReplicaResources: 0 },
    releasePosture:     { blockerCount: 0 },
    knownLimitations:   ["No connected provider — twin is empty."],
    confidence: 0,
    evidenceRefs: [],
  };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function findResource(twin: DigitalTwin, id: string): DigitalTwinResource | undefined {
  return twin.resources.find((r) => r.id === id);
}

export function neighborsOf(twin: DigitalTwin, resourceId: string): {
  incoming: DigitalTwinRelationship[];
  outgoing: DigitalTwinRelationship[];
} {
  return {
    incoming: twin.relationships.filter((r) => r.toResourceId === resourceId),
    outgoing: twin.relationships.filter((r) => r.fromResourceId === resourceId),
  };
}

export function highestRiskResources(twin: DigitalTwin, limit = 5): DigitalTwinResource[] {
  const rank: Record<DigitalTwinRiskLevel, number> = {
    critical: 4, high: 3, medium: 2, low: 1, unknown: 0,
  };
  return [...twin.resources].sort((a, b) => rank[b.riskLevel] - rank[a.riskLevel]).slice(0, limit);
}

export const RISK_LABEL: Record<DigitalTwinRiskLevel, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
  unknown:  "Unknown",
};
