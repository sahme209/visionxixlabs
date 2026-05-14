/**
 * Control Plane Model.
 *
 * The single normalised state every Axiom surface reads from. Distinct
 * from `getCommandCenterState`, which focuses on dashboard widgets; the
 * control plane state is broader, covering every domain at the same
 * shape so multi-cloud / security / release / desktop / remediation /
 * simulation / approval / execution pages stop computing from raw
 * adapters and just project from this.
 *
 * No raw provider blobs. No secrets. Every field carries source mode
 * and confidence.
 */

import type { CloudProvider } from "@/lib/domain/provider";

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

export type ControlSourceMode = "live" | "preview" | "planned" | "blocked" | "empty";

export type ControlPostureStatus = "healthy" | "warning" | "degraded" | "preview" | "blocked" | "unknown";

export interface PostureEvidence { label: string; ref: string }

export interface PostureState {
  /** 0..100 — score. */
  score: number;
  status: ControlPostureStatus;
  /** Short headline rendered in cards. */
  summary: string;
  criticalItems: number;
  warnings: number;
  unknowns: number;
  sourceMode: ControlSourceMode;
  confidence: number;
  evidenceRefs: PostureEvidence[];
  nextAction?: { label: string; href?: string };
}

// ---------------------------------------------------------------------------
// Per-provider / per-connector state
// ---------------------------------------------------------------------------

export type ConnectionStatus = "connected" | "preview" | "needs_setup" | "blocked" | "unknown";
export type ScanStatus = "fresh" | "stale" | "preview" | "not_run" | "blocked";

export interface ProviderControlState {
  provider: CloudProvider;
  mode: "live" | "preview" | "disabled";
  connectionStatus: ConnectionStatus;
  validationStatus: "passing" | "partial" | "blocked" | "preview" | "unknown";
  scanStatus: ScanStatus;
  resourceCounts: Record<string, number>;
  topFindings: { ruleCode: string; risk: string; resourceRef: string }[];
  topRecommendations: { id: string; title: string }[];
  missingCapabilities: string[];
  sourceMode: ControlSourceMode;
  confidence: number;
  nextAction?: { label: string; href?: string };
}

export interface ConnectorControlState {
  connector: "github" | "audit_store" | "policy_engine" | "desktop_workstation";
  mode: "live" | "preview" | "disabled";
  connectionStatus: ConnectionStatus;
  lastSyncStatus: "fresh" | "stale" | "never";
  capabilities: string[];
  blockers: string[];
  sourceMode: ControlSourceMode;
  nextAction?: { label: string; href?: string };
}

// ---------------------------------------------------------------------------
// Inventory + posture summaries
// ---------------------------------------------------------------------------

export interface CloudInventorySummary {
  totalResources: number;
  byProvider: Record<CloudProvider, number>;
  byKind: Record<string, number>;
  sourceMode: ControlSourceMode;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Next-best action
// ---------------------------------------------------------------------------

export type ActionCategory =
  | "connect_provider"
  | "validate"
  | "scan"
  | "review_finding"
  | "remediate"
  | "simulate"
  | "request_approval"
  | "review_in_desktop"
  | "fix_config"
  | "export_audit"
  | "troubleshoot"
  | "documentation";

export interface NextBestAction {
  id: string;
  title: string;
  description: string;
  category: ActionCategory;
  priority: number;             // 0..100 — higher is more important
  riskLevel: "low" | "medium" | "high" | "critical";
  provider?: CloudProvider | "github" | "desktop" | "platform";
  connector?: ConnectorControlState["connector"];
  sourceSystem: string;
  requiredCapability?: string;
  requiredPermission?: string[];
  approvalRequired: boolean;
  desktopEligible: boolean;
  canRunNow: boolean;
  blockedReason?: string;
  route?: string;
  actionType: "navigate" | "run_safe_task" | "request_approval" | "open_desktop";
  evidenceRefs: PostureEvidence[];
}

// ---------------------------------------------------------------------------
// Top-level state
// ---------------------------------------------------------------------------

export interface ControlPlaneState {
  tenantId?: string;
  generatedAt: string;
  /** Overall source mode for the control plane. */
  sourceMode: ControlSourceMode;

  providers: ProviderControlState[];
  connectors: ConnectorControlState[];
  cloudInventory: CloudInventorySummary;

  securityPosture:    PostureState;
  costPosture:        PostureState;
  reliabilityPosture: PostureState;
  releaseOpsPosture:  PostureState;
  desktopPosture:     PostureState;
  remediationPosture: PostureState;
  simulationPosture:  PostureState;
  approvalPosture:    PostureState;
  executionPosture:   PostureState;
  auditPosture:       PostureState;
  validationPosture:  PostureState;

  memorySummary: {
    eventCount: number;
    preferredFixStyle: "terraform" | "cli" | "none";
    preferredReviewSurface: "server" | "desktop" | "none";
    approvalDelayCount: number;
  };

  autonomousTasks: {
    pending: number;
    completed: number;
    blocked: number;
  };

  nextBestActions: NextBestAction[];
  blockers: { code: string; detail: string; route?: string }[];
  risks:    { code: string; detail: string }[];
  opportunities: { code: string; detail: string }[];

  evidenceRefs: PostureEvidence[];
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const POSTURE_STATUS_LABEL: Record<ControlPostureStatus, string> = {
  healthy:  "Healthy",
  warning:  "Warning",
  degraded: "Degraded",
  preview:  "Preview",
  blocked:  "Blocked",
  unknown:  "Unknown",
};

export const SOURCE_MODE_LABEL: Record<ControlSourceMode, string> = {
  live:    "Live",
  preview: "Preview",
  planned: "Planned",
  blocked: "Blocked",
  empty:   "Empty",
};

export const ACTION_CATEGORY_LABEL: Record<ActionCategory, string> = {
  connect_provider: "Connect provider",
  validate:         "Validate",
  scan:             "Scan",
  review_finding:   "Review finding",
  remediate:        "Remediate",
  simulate:         "Simulate",
  request_approval: "Request approval",
  review_in_desktop: "Review in desktop",
  fix_config:       "Fix config",
  export_audit:     "Export audit",
  troubleshoot:     "Troubleshoot",
  documentation:    "Documentation",
};
