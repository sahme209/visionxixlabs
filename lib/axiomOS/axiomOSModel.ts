/**
 * Axiom OS — canonical product state.
 *
 * This is the **one** unified shape the product reads from. It DOES NOT
 * replace any existing system. It is a typed composition of:
 *
 *   - lib/controlPlane/controlPlaneBuilder        (provider posture)
 *   - lib/operatingLoop/operatingLoopBuilder      (16-stage per-provider loops)
 *   - lib/readiness/productionReadinessRunner     (readiness report)
 *   - lib/releaseops/getReleaseOpsState           (ReleaseOps state)
 *   - lib/compliance/controlRegistry              (trust posture)
 *   - lib/compliance/evidenceCollector            (evidence coverage)
 *   - lib/audit/secureAudit                       (audit volume)
 *
 * The shape is intentionally **flat** — every section is a typed sub-record
 * the UI can render without further normalisation.
 *
 * Hard rules enforced by the shape:
 *   - Every section carries a `sourceMode` so the UI can label honestly.
 *   - Every section carries `limitations[]` so blockers are visible.
 *   - No section can claim "live" unless backed by evidence.
 */

import type { OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Common taxonomy
// ---------------------------------------------------------------------------

export type AxiomOSSourceMode = "live" | "partial_live" | "preview" | "expanding" | "blocked" | "disabled" | "unknown";

export type AxiomOSStatus =
  | "all_systems_live"
  | "partial_live"
  | "preview_mode"
  | "needs_setup"
  | "blocked"
  | "in_progress";

export interface SafeNextAction {
  label: string;
  href: string;
}

export interface SectionEnvelope<T> {
  status: "passing" | "partial" | "preview" | "blocked" | "failing" | "unknown";
  sourceMode: AxiomOSSourceMode;
  data: T;
  limitations: string[];
  safeNextAction?: SafeNextAction;
}

// ---------------------------------------------------------------------------
// Per-provider posture
// ---------------------------------------------------------------------------

export interface ProviderPosture {
  provider: "aws" | "azure" | "gcp" | "github";
  mode: AxiomOSSourceMode;
  /** Honest status — "live read-only", "preview snapshot", "blocked: missing creds". */
  headline: string;
  /** Counts the UI renders directly. */
  resourceCount?: number;
  findingCount?: number;
  remediationCount?: number;
  /** Connection / validation status. */
  connectionStatus: "connected" | "preview" | "expanding" | "blocked" | "disabled";
  /** What's missing if connection isn't live. */
  missingRequirements: string[];
  /** Last live or preview scan time. */
  lastScannedAt?: string;
  safeNextAction?: SafeNextAction;
}

// ---------------------------------------------------------------------------
// Sub-sections — one per pillar
// ---------------------------------------------------------------------------

export interface SecurityPostureSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  compoundedRiskCount: number;
  /** Distinct systems with at least one finding. */
  affectedSystems: string[];
}

export interface ReleaseOpsPostureSummary {
  readinessScore: number;
  readinessGrade: string;
  repoCount: number;
  workflowCount: number;
  failingWorkflowCount: number;
  blockerCount: number;
}

export interface RemediationPostureSummary {
  candidateCount: number;
  simulatedCount: number;
  approvalGatedCount: number;
  desktopReviewEligibleCount: number;
}

export interface ApprovalPostureSummary {
  pendingCount: number;
  highRiskCount: number;
  expiredCount: number;
}

export interface DesktopPostureSummary {
  binaryAvailable: boolean;
  signingStatus: "signed_notarized" | "signed" | "unsigned" | "preview";
  pairedSessions: number;
  /** Whether local execution is disabled per safety policy. */
  localExecutionDisabled: true;
}

export interface AuditPostureSummary {
  recentEventCount: number;
  /** Whether the Prisma-backed store is active (vs ephemeral in-memory). */
  persistent: boolean;
}

export interface EvidencePostureSummary {
  totalRecords: number;
  verifiedRecords: number;
  coverageScore: number;
}

export interface MemoryPostureSummary {
  recordCount: number;
  persistent: boolean;
}

// ---------------------------------------------------------------------------
// Operating loop summary (per provider)
// ---------------------------------------------------------------------------

export interface OperatingLoopSummary {
  provider: "aws" | "azure" | "gcp" | "github" | "security_scanner" | "desktop";
  currentStage: string;
  status: "in_progress" | "completed" | "blocked" | "failed" | "paused_for_approval" | "paused_for_user_input";
  sourceMode: AxiomOSSourceMode;
  topSafeNextAction?: SafeNextAction;
  attentionRequiredCount: number;
}

// ---------------------------------------------------------------------------
// Next-best-action surface
// ---------------------------------------------------------------------------

export interface NextBestActionLite {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  canRunNow: boolean;
  approvalRequired: boolean;
  route?: string;
}

// ---------------------------------------------------------------------------
// Top-level Axiom OS state
// ---------------------------------------------------------------------------

export interface AxiomOSState {
  /** Tenant identity. */
  tenantId: OrganizationId;
  actorUserId?: UserId;
  generatedAt: string;

  /** Composite source mode rolled up from every section. */
  sourceMode: AxiomOSSourceMode;
  /** Operator-facing rollup. */
  overallStatus: AxiomOSStatus;
  /** Production readiness score 0..1. */
  readinessScore: number;
  /** Trust score 0..1 (controls implemented × evidence coverage). */
  trustScore: number;
  /** Safety boundary statement — always true on this build. */
  safetyStatus: "approval_gated_no_destructive_execution";

  /** Per-source posture (AWS / Azure / GCP / GitHub). */
  providers: ProviderPosture[];

  /** Cross-cutting pillars. */
  securityPosture: SectionEnvelope<SecurityPostureSummary>;
  releaseOpsPosture: SectionEnvelope<ReleaseOpsPostureSummary>;
  remediationPosture: SectionEnvelope<RemediationPostureSummary>;
  approvalPosture: SectionEnvelope<ApprovalPostureSummary>;
  desktopPosture: SectionEnvelope<DesktopPostureSummary>;
  auditPosture: SectionEnvelope<AuditPostureSummary>;
  evidencePosture: SectionEnvelope<EvidencePostureSummary>;
  memoryPosture: SectionEnvelope<MemoryPostureSummary>;

  /** Per-provider operating loop summary — 5 entries (one per loop). */
  operatingLoops: OperatingLoopSummary[];

  /** Highest-priority operator actions, ordered. */
  nextBestActions: NextBestActionLite[];

  /** What Axiom can safely automate without approval. */
  safeAutonomousTasks: { id: string; title: string; route?: string }[];

  /** What requires the operator to provide input. */
  userRequiredActions: { id: string; title: string; reason: string; route?: string }[];

  /** Active critical blockers across the entire OS. */
  criticalBlockers: { area: string; reason: string; safeNextAction?: SafeNextAction }[];

  /** Honest aggregate limitations operators should know. */
  limitations: string[];

  /** Cross-system evidence refs (stable ids for traceability). */
  evidenceRefs: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function rollupSourceMode(modes: AxiomOSSourceMode[]): AxiomOSSourceMode {
  if (modes.length === 0) return "unknown";
  if (modes.includes("disabled")) return "disabled";
  if (modes.includes("blocked")) return "blocked";
  if (modes.includes("preview")) return "preview";
  if (modes.includes("partial_live")) return "partial_live";
  if (modes.includes("expanding")) return "expanding";
  if (modes.every((m) => m === "live")) return "live";
  return "preview";
}

export function overallStatusFor(score: number, modes: AxiomOSSourceMode[]): AxiomOSStatus {
  const rollup = rollupSourceMode(modes);
  if (rollup === "live" && score > 0.8) return "all_systems_live";
  if (rollup === "live" || rollup === "partial_live") return "partial_live";
  if (rollup === "blocked" || rollup === "disabled") return "blocked";
  if (rollup === "preview") return "preview_mode";
  return "needs_setup";
}
