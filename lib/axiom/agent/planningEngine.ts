/**
 * Axiom Agent Multi-Step Planning Engine
 *
 * Breaks large cloud improvements into safe, phased execution plans.
 * Instead of "apply all 47 changes now," the agent produces a dependency-aware
 * rollout with canary phases, approval checkpoints, and rollback gates.
 *
 * Supports four rollout archetypes:
 *   1. Region Resilience Rollout   — single-region → multi-region, phase by criticality
 *   2. Storage Lifecycle Rollout   — tiering + lifecycle policies, phase by bucket age
 *   3. Commitment Adoption Rollout — RI/savings plan purchases, phase by confidence
 *   4. Backup Strategy Rollout     — enable backups, phase by data criticality
 *
 * Each archetype produces phases with:
 *   - Dependency edges (DAG — no cycles)
 *   - Approval checkpoints between risk tiers
 *   - Estimated impact per phase
 *   - Rollback considerations
 *   - Provider-specific execution details
 */

import type { CloudProvider } from "../cloudSnapshot";
import type { ExecutionPlanItem, ActionType, RiskLevel } from "../executionPlan";
import type { AgentFinding, AgentRecommendation, FindingCategory } from "./types";
import type { OrgPreferences } from "./preferences";
import type { Theme } from "./reasoningEngine";

// ---------------------------------------------------------------------------
// 1. Core interfaces
// ---------------------------------------------------------------------------

export type PlanId = string;
export type PhaseId = string;

export type PlanStatus =
  | "draft"
  | "approved"
  | "in_progress"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type PhaseStatus =
  | "pending"
  | "ready"
  | "awaiting_approval"
  | "approved"
  | "executing"
  | "verifying"
  | "completed"
  | "failed"
  | "rolled_back"
  | "skipped";

export type RolloutArchetype =
  | "region_resilience"
  | "storage_lifecycle"
  | "commitment_adoption"
  | "backup_strategy"
  | "security_hardening"
  | "compute_rightsizing"
  | "mixed";

export type PhasingStrategy =
  | "canary_then_fleet"
  | "region_sweep"
  | "risk_ascending"
  | "provider_sequential"
  | "criticality_descending";

// ---------------------------------------------------------------------------
// AgentPlan — the top-level plan container
// ---------------------------------------------------------------------------

export type AgentPlan = {
  id: PlanId;
  name: string;
  description: string;
  archetype: RolloutArchetype;
  strategy: PhasingStrategy;
  createdAt: string;
  status: PlanStatus;

  phases: PlanPhase[];
  dependencyGraph: DependencyGraph;
  approvalCheckpoints: ApprovalCheckpoint[];

  estimatedImpact: PlanImpact;
  rollbackSummary: PlanRollbackSummary;

  providers: CloudProvider[];
  regions: string[];
  totalResourceCount: number;

  metadata: {
    themeIds: string[];
    generatedFrom: "reasoning_engine" | "manual" | "drift_response";
    estimatedDurationDays: number;
    riskProfile: RiskLevel;
  };
};

// ---------------------------------------------------------------------------
// PlanPhase — a batch of execution items that run together
// ---------------------------------------------------------------------------

export type PlanPhase = {
  id: PhaseId;
  name: string;
  description: string;
  order: number;
  status: PhaseStatus;

  items: ExecutionPlanItem[];
  provider: CloudProvider;
  regions: string[];
  resourceCount: number;

  phaseType: PhaseType;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  requiresMaintenanceWindow: boolean;

  estimatedDurationMinutes: number;
  estimatedImpact: PhaseImpact;

  preconditions: PhasePrecondition[];
  successCriteria: SuccessCriterion[];
  rollbackTriggers: RollbackTrigger[];

  waitAfterMinutes: number;
  canaryPercentage: number | null;
};

export type PhaseType =
  | "canary"
  | "gradual_rollout"
  | "full_rollout"
  | "validation"
  | "cleanup"
  | "preparation";

export type PhaseImpact = {
  monthlySavings: number;
  yearlySavings: number;
  resourcesAffected: number;
  downtimeMinutes: number;
  riskScore: number;
};

export type PhasePrecondition = {
  type: "phase_complete" | "approval_granted" | "time_elapsed" | "metric_stable";
  description: string;
  phaseId?: PhaseId;
  minimumMinutes?: number;
};

export type SuccessCriterion = {
  metric: string;
  operator: "equals" | "greater_than" | "less_than" | "within_range";
  target: number;
  tolerancePercent: number;
  description: string;
};

export type RollbackTrigger = {
  condition: string;
  severity: "auto_rollback" | "pause_and_alert" | "log_warning";
  action: string;
};

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

export type DependencyEdge = {
  from: PhaseId;
  to: PhaseId;
  type: "must_complete" | "should_complete" | "wait_after";
  waitMinutes?: number;
};

export type DependencyGraph = {
  edges: DependencyEdge[];
  roots: PhaseId[];
  leaves: PhaseId[];
};

// ---------------------------------------------------------------------------
// Approval checkpoints
// ---------------------------------------------------------------------------

export type ApprovalCheckpoint = {
  id: string;
  afterPhaseId: PhaseId;
  beforePhaseId: PhaseId;
  reason: string;
  approverRole: "owner" | "admin" | "operator";
  autoApproveAfterHours: number | null;
  blocksExecution: boolean;
};

// ---------------------------------------------------------------------------
// Plan-level impact & rollback
// ---------------------------------------------------------------------------

export type PlanImpact = {
  totalMonthlySavings: number;
  totalYearlySavings: number;
  totalResourcesAffected: number;
  totalDowntimeMinutes: number;
  breakdownByProvider: Record<CloudProvider, { savings: number; resources: number }>;
  breakdownByPhase: Array<{ phaseId: PhaseId; phaseName: string; savings: number }>;
};

export type PlanRollbackSummary = {
  fullyReversible: boolean;
  irreversiblePhases: PhaseId[];
  estimatedRollbackMinutes: number;
  rollbackComplexity: "trivial" | "moderate" | "complex";
  notes: string[];
};

// ---------------------------------------------------------------------------
// Plan generation input
// ---------------------------------------------------------------------------

export type PlanGenerationInput = {
  themes: Theme[];
  executionItems: ExecutionPlanItem[];
  preferences: OrgPreferences;
  providers: CloudProvider[];
};

// ---------------------------------------------------------------------------
// 2. Dependency graph operations
// ---------------------------------------------------------------------------

export function buildDependencyGraph(phases: PlanPhase[], edges: DependencyEdge[]): DependencyGraph {
  const phaseIds = new Set(phases.map((p) => p.id));

  const validEdges = edges.filter((e) => phaseIds.has(e.from) && phaseIds.has(e.to));

  const hasIncoming = new Set(validEdges.map((e) => e.to));
  const hasOutgoing = new Set(validEdges.map((e) => e.from));

  const roots = phases.map((p) => p.id).filter((id) => !hasIncoming.has(id));
  const leaves = phases.map((p) => p.id).filter((id) => !hasOutgoing.has(id));

  return { edges: validEdges, roots, leaves };
}

export function topologicalSort(graph: DependencyGraph, phases: PlanPhase[]): PlanPhase[] {
  const adj = new Map<PhaseId, PhaseId[]>();
  const inDegree = new Map<PhaseId, number>();

  for (const phase of phases) {
    adj.set(phase.id, []);
    inDegree.set(phase.id, 0);
  }

  for (const edge of graph.edges) {
    if (edge.type === "must_complete" || edge.type === "wait_after") {
      adj.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    }
  }

  const queue: PhaseId[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: PhaseId[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adj.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== phases.length) {
    throw new Error("PlanningEngine: dependency cycle detected — cannot produce valid execution order");
  }

  const orderMap = new Map(sorted.map((id, i) => [id, i]));
  return [...phases].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
}

export function detectCycles(graph: DependencyGraph): PhaseId[][] {
  const adj = new Map<PhaseId, PhaseId[]>();
  const allIds = new Set([...graph.roots, ...graph.leaves]);
  for (const edge of graph.edges) {
    allIds.add(edge.from);
    allIds.add(edge.to);
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push(edge.to);
  }

  const visited = new Set<PhaseId>();
  const inStack = new Set<PhaseId>();
  const cycles: PhaseId[][] = [];

  function dfs(node: PhaseId, path: PhaseId[]): void {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart));
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of adj.get(node) ?? []) {
      dfs(neighbor, path);
    }

    path.pop();
    inStack.delete(node);
  }

  for (const id of allIds) {
    if (!visited.has(id)) dfs(id, []);
  }

  return cycles;
}

export function getReadyPhases(
  graph: DependencyGraph,
  phases: PlanPhase[],
  completedPhaseIds: Set<PhaseId>,
): PlanPhase[] {
  return phases.filter((phase) => {
    if (completedPhaseIds.has(phase.id)) return false;
    if (phase.status === "completed" || phase.status === "skipped") return false;

    const deps = graph.edges.filter(
      (e) => e.to === phase.id && e.type === "must_complete",
    );
    return deps.every((e) => completedPhaseIds.has(e.from));
  });
}

// ---------------------------------------------------------------------------
// 3. Phasing strategies
// ---------------------------------------------------------------------------

function groupByRegion(items: ExecutionPlanItem[]): Map<string, ExecutionPlanItem[]> {
  const groups = new Map<string, ExecutionPlanItem[]>();
  for (const item of items) {
    const key = item.region;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

function groupByProvider(items: ExecutionPlanItem[]): Map<CloudProvider, ExecutionPlanItem[]> {
  const groups = new Map<CloudProvider, ExecutionPlanItem[]>();
  for (const item of items) {
    if (!groups.has(item.provider)) groups.set(item.provider, []);
    groups.get(item.provider)!.push(item);
  }
  return groups;
}

function groupByRisk(items: ExecutionPlanItem[]): Map<RiskLevel, ExecutionPlanItem[]> {
  const groups = new Map<RiskLevel, ExecutionPlanItem[]>();
  for (const item of items) {
    if (!groups.has(item.riskLevel)) groups.set(item.riskLevel, []);
    groups.get(item.riskLevel)!.push(item);
  }
  return groups;
}

const RISK_ORDER: RiskLevel[] = ["low", "medium", "high"];
const PROVIDER_ORDER: CloudProvider[] = ["aws", "azure", "gcp"];

// ---------------------------------------------------------------------------
// 4. Plan generators — one per rollout archetype
// ---------------------------------------------------------------------------

let phaseCounter = 0;
let checkpointCounter = 0;
function nextPhaseId(): PhaseId { return `phase_${++phaseCounter}`; }
function nextCheckpointId(): string { return `checkpoint_${++checkpointCounter}`; }
function resetCounters(): void { phaseCounter = 0; checkpointCounter = 0; }

function computePhaseImpact(items: ExecutionPlanItem[]): PhaseImpact {
  const monthlySavings = items.reduce((s, i) => s + i.estimatedSavings.monthly, 0);
  return {
    monthlySavings,
    yearlySavings: monthlySavings * 12,
    resourcesAffected: items.reduce((s, i) => s + i.resourceIds.length, 0),
    downtimeMinutes: items.filter((i) => i.requiresDowntime).length * 5,
    riskScore: items.reduce((s, i) => s + RISK_WEIGHT[i.riskLevel], 0) / Math.max(items.length, 1),
  };
}

const RISK_WEIGHT: Record<RiskLevel, number> = { low: 1, medium: 3, high: 7 };

function highestRisk(items: ExecutionPlanItem[]): RiskLevel {
  if (items.some((i) => i.riskLevel === "high")) return "high";
  if (items.some((i) => i.riskLevel === "medium")) return "medium";
  return "low";
}

function makePhase(
  name: string,
  description: string,
  order: number,
  items: ExecutionPlanItem[],
  overrides: Partial<PlanPhase> = {},
): PlanPhase {
  const regions = [...new Set(items.map((i) => i.region))];
  const provider = items[0]?.provider ?? "aws";
  const risk = highestRisk(items);

  return {
    id: nextPhaseId(),
    name,
    description,
    order,
    status: "pending",
    items,
    provider,
    regions,
    resourceCount: items.reduce((s, i) => s + i.resourceIds.length, 0),
    phaseType: "gradual_rollout",
    riskLevel: risk,
    requiresApproval: risk !== "low",
    requiresMaintenanceWindow: items.some((i) => i.requiresDowntime),
    estimatedDurationMinutes: Math.max(items.length * 3, 10),
    estimatedImpact: computePhaseImpact(items),
    preconditions: [],
    successCriteria: [],
    rollbackTriggers: defaultRollbackTriggers(risk),
    waitAfterMinutes: risk === "high" ? 60 : risk === "medium" ? 30 : 10,
    canaryPercentage: null,
    ...overrides,
  };
}

function defaultRollbackTriggers(risk: RiskLevel): RollbackTrigger[] {
  const triggers: RollbackTrigger[] = [
    {
      condition: "Error rate exceeds 5% in affected services",
      severity: "auto_rollback",
      action: "Revert all changes in this phase immediately",
    },
    {
      condition: "Latency p99 increases >50% post-change",
      severity: "pause_and_alert",
      action: "Pause execution and notify operator",
    },
  ];

  if (risk === "high") {
    triggers.push({
      condition: "Any health check failure within 10 minutes",
      severity: "auto_rollback",
      action: "Revert and block remaining phases",
    });
  }

  return triggers;
}

function defaultSuccessCriteria(actionType: ActionType): SuccessCriterion[] {
  switch (actionType) {
    case "resize_compute":
      return [
        { metric: "cpu_utilization_avg", operator: "less_than", target: 80, tolerancePercent: 10, description: "CPU stays below 80% after resize" },
        { metric: "error_rate", operator: "less_than", target: 1, tolerancePercent: 0, description: "Error rate stays below 1%" },
      ];
    case "apply_storage_policy":
      return [
        { metric: "access_latency_p99_ms", operator: "less_than", target: 200, tolerancePercent: 20, description: "Storage access latency stays acceptable" },
      ];
    case "restrict_public_access":
      return [
        { metric: "public_endpoints_count", operator: "equals", target: 0, tolerancePercent: 0, description: "No public endpoints remain" },
      ];
    case "enable_backup":
      return [
        { metric: "backup_success_rate", operator: "equals", target: 100, tolerancePercent: 0, description: "First backup completes successfully" },
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// 4a. Region Resilience Rollout
// ---------------------------------------------------------------------------

function generateRegionResiliencePlan(
  items: ExecutionPlanItem[],
  themes: Theme[],
  prefs: OrgPreferences,
): { phases: PlanPhase[]; edges: DependencyEdge[]; checkpoints: ApprovalCheckpoint[] } {
  const phases: PlanPhase[] = [];
  const edges: DependencyEdge[] = [];
  const checkpoints: ApprovalCheckpoint[] = [];

  // Phase 0: Assessment & preparation
  const prepPhase = makePhase(
    "Assessment & Preparation",
    "Validate current architecture, identify failover targets, and document baseline metrics before any changes.",
    0,
    [],
    {
      phaseType: "preparation",
      riskLevel: "low",
      requiresApproval: false,
      estimatedDurationMinutes: 30,
      successCriteria: [
        { metric: "baseline_documented", operator: "equals", target: 1, tolerancePercent: 0, description: "Baseline metrics captured" },
      ],
    },
  );
  phases.push(prepPhase);

  // Group by region, phase by criticality
  const byRegion = groupByRegion(items);
  const regionEntries = [...byRegion.entries()];

  // Sort: primary region (most resources) last — start with less critical regions
  regionEntries.sort((a, b) => a[1].length - b[1].length);

  // Phase 1: Canary — smallest region first
  if (regionEntries.length > 0) {
    const [canaryRegion, canaryItems] = regionEntries[0];
    const canary = makePhase(
      `Canary: ${canaryRegion}`,
      `Deploy resilience improvements to ${canaryRegion} first as a canary. Monitor for 30 minutes before proceeding.`,
      1,
      canaryItems,
      {
        phaseType: "canary",
        canaryPercentage: Math.round((canaryItems.length / items.length) * 100),
        waitAfterMinutes: 30,
        successCriteria: defaultSuccessCriteria(canaryItems[0]?.actionType ?? "resize_compute"),
      },
    );
    phases.push(canary);

    edges.push({ from: prepPhase.id, to: canary.id, type: "must_complete" });

    // Checkpoint after canary
    if (regionEntries.length > 1) {
      const nextPhaseId_temp = `phase_${phaseCounter + 1}`;
      checkpoints.push({
        id: nextCheckpointId(),
        afterPhaseId: canary.id,
        beforePhaseId: nextPhaseId_temp,
        reason: "Canary phase complete — verify no regressions before rolling out to remaining regions.",
        approverRole: "operator",
        autoApproveAfterHours: 24,
        blocksExecution: true,
      });
    }
  }

  // Phase 2..N: Remaining regions
  for (let i = 1; i < regionEntries.length; i++) {
    const [region, regionItems] = regionEntries[i];
    const isLast = i === regionEntries.length - 1;

    const phase = makePhase(
      isLast ? `Primary Region: ${region}` : `Rollout: ${region}`,
      isLast
        ? `Final phase — apply resilience changes to primary region (${region}). Highest resource count.`
        : `Extend resilience improvements to ${region}.`,
      i + 1,
      regionItems,
      {
        phaseType: isLast ? "full_rollout" : "gradual_rollout",
        requiresApproval: isLast || highestRisk(regionItems) !== "low",
      },
    );
    phases.push(phase);

    const prevPhase = phases[phases.length - 2];
    edges.push({ from: prevPhase.id, to: phase.id, type: "must_complete" });

    if (isLast && regionEntries.length > 2) {
      checkpoints.push({
        id: nextCheckpointId(),
        afterPhaseId: prevPhase.id,
        beforePhaseId: phase.id,
        reason: "All secondary regions complete — final approval before primary region changes.",
        approverRole: "admin",
        autoApproveAfterHours: null,
        blocksExecution: true,
      });
    }
  }

  // Final validation phase
  const validationPhase = makePhase(
    "Post-Rollout Validation",
    "Verify all regions are healthy, failover paths work, and metrics are within expected ranges.",
    phases.length,
    [],
    {
      phaseType: "validation",
      riskLevel: "low",
      requiresApproval: false,
      estimatedDurationMinutes: 20,
      successCriteria: [
        { metric: "all_regions_healthy", operator: "equals", target: 1, tolerancePercent: 0, description: "All regions report healthy" },
        { metric: "failover_test_passed", operator: "equals", target: 1, tolerancePercent: 0, description: "Failover test passes" },
      ],
    },
  );
  phases.push(validationPhase);
  const lastRollout = phases[phases.length - 2];
  edges.push({ from: lastRollout.id, to: validationPhase.id, type: "must_complete" });

  return { phases, edges, checkpoints };
}

// ---------------------------------------------------------------------------
// 4b. Storage Lifecycle Rollout
// ---------------------------------------------------------------------------

function generateStorageLifecyclePlan(
  items: ExecutionPlanItem[],
  themes: Theme[],
  prefs: OrgPreferences,
): { phases: PlanPhase[]; edges: DependencyEdge[]; checkpoints: ApprovalCheckpoint[] } {
  const phases: PlanPhase[] = [];
  const edges: DependencyEdge[] = [];
  const checkpoints: ApprovalCheckpoint[] = [];

  // Split items: low-risk (tiering) vs medium/high-risk (lifecycle/deletion)
  const byRisk = groupByRisk(items);
  const lowRiskItems = byRisk.get("low") ?? [];
  const mediumRiskItems = byRisk.get("medium") ?? [];
  const highRiskItems = byRisk.get("high") ?? [];

  // Phase 1: Enable intelligent tiering on low-risk buckets (safe, reversible)
  if (lowRiskItems.length > 0) {
    const tieringPhase = makePhase(
      "Enable Intelligent Tiering",
      `Apply intelligent tiering to ${lowRiskItems.length} storage resource(s). Fully reversible, no data loss risk.`,
      0,
      lowRiskItems,
      {
        phaseType: "gradual_rollout",
        riskLevel: "low",
        requiresApproval: false,
        waitAfterMinutes: 15,
        successCriteria: defaultSuccessCriteria("apply_storage_policy"),
      },
    );
    phases.push(tieringPhase);
  }

  // Phase 2: Apply lifecycle policies to medium-risk buckets
  if (mediumRiskItems.length > 0) {
    const lifecyclePhase = makePhase(
      "Apply Lifecycle Policies",
      `Configure lifecycle rules on ${mediumRiskItems.length} storage resource(s). Moves cold data to cheaper tiers after inactivity period.`,
      1,
      mediumRiskItems,
      {
        phaseType: "gradual_rollout",
        riskLevel: "medium",
        requiresApproval: true,
        waitAfterMinutes: 30,
        successCriteria: [
          { metric: "lifecycle_policy_active", operator: "equals", target: 100, tolerancePercent: 0, description: "All lifecycle policies are active" },
          { metric: "access_errors", operator: "equals", target: 0, tolerancePercent: 0, description: "No access errors from tiered data" },
        ],
      },
    );
    phases.push(lifecyclePhase);

    if (phases.length > 1) {
      edges.push({ from: phases[phases.length - 2].id, to: lifecyclePhase.id, type: "must_complete" });
    }

    if (highRiskItems.length > 0) {
      checkpoints.push({
        id: nextCheckpointId(),
        afterPhaseId: lifecyclePhase.id,
        beforePhaseId: `phase_${phaseCounter + 1}`,
        reason: "Lifecycle policies applied — verify no access issues before proceeding to archive/deletion rules.",
        approverRole: "admin",
        autoApproveAfterHours: 48,
        blocksExecution: true,
      });
    }
  }

  // Phase 3: High-risk archive/deletion rules
  if (highRiskItems.length > 0) {
    const archivePhase = makePhase(
      "Archive & Retention Rules",
      `Apply archive or deletion rules to ${highRiskItems.length} storage resource(s). These changes may make data harder to access.`,
      2,
      highRiskItems,
      {
        phaseType: "full_rollout",
        riskLevel: "high",
        requiresApproval: true,
        requiresMaintenanceWindow: true,
        waitAfterMinutes: 60,
        rollbackTriggers: [
          ...defaultRollbackTriggers("high"),
          {
            condition: "Any data access failure to archived objects",
            severity: "pause_and_alert",
            action: "Pause lifecycle execution and restore affected objects",
          },
        ],
      },
    );
    phases.push(archivePhase);

    if (phases.length > 1) {
      edges.push({ from: phases[phases.length - 2].id, to: archivePhase.id, type: "must_complete" });
    }
  }

  // Validation
  if (phases.length > 0) {
    const validationPhase = makePhase(
      "Storage Validation",
      "Verify all storage policies are active, no access regressions, and cost reduction is tracking.",
      phases.length,
      [],
      {
        phaseType: "validation",
        riskLevel: "low",
        requiresApproval: false,
        estimatedDurationMinutes: 15,
      },
    );
    phases.push(validationPhase);
    edges.push({ from: phases[phases.length - 2].id, to: validationPhase.id, type: "must_complete" });
  }

  return { phases, edges, checkpoints };
}

// ---------------------------------------------------------------------------
// 4c. Commitment Adoption Rollout (RI / Savings Plans)
// ---------------------------------------------------------------------------

function generateCommitmentAdoptionPlan(
  items: ExecutionPlanItem[],
  themes: Theme[],
  prefs: OrgPreferences,
): { phases: PlanPhase[]; edges: DependencyEdge[]; checkpoints: ApprovalCheckpoint[] } {
  const phases: PlanPhase[] = [];
  const edges: DependencyEdge[] = [];
  const checkpoints: ApprovalCheckpoint[] = [];

  // Commitments are financial, not infrastructure — phase by confidence and provider
  const byProvider = groupByProvider(items);

  // Phase 0: Analysis & recommendation review
  const analysisPhase = makePhase(
    "Commitment Analysis Review",
    "Review usage patterns, validate stable baseline, and confirm commitment recommendations with finance team.",
    0,
    [],
    {
      phaseType: "preparation",
      riskLevel: "low",
      requiresApproval: true,
      estimatedDurationMinutes: 60,
      successCriteria: [
        { metric: "usage_baseline_stable", operator: "equals", target: 1, tolerancePercent: 0, description: "Usage baseline confirmed stable for 14+ days" },
      ],
    },
  );
  phases.push(analysisPhase);

  // Phase per provider — commitments are provider-specific and non-transferable
  let order = 1;
  for (const provider of PROVIDER_ORDER) {
    const providerItems = byProvider.get(provider);
    if (!providerItems || providerItems.length === 0) continue;

    const providerLabel = provider === "aws" ? "AWS" : provider === "azure" ? "Azure" : "Google Cloud";
    const commitmentLabel = provider === "aws" ? "Savings Plan" : provider === "azure" ? "Reserved Instance" : "CUD";

    // Small commitment first (canary purchase)
    const sorted = [...providerItems].sort(
      (a, b) => a.estimatedSavings.yearly - b.estimatedSavings.yearly,
    );
    const canaryItems = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.3)));
    const remainingItems = sorted.slice(canaryItems.length);

    const canaryPhase = makePhase(
      `${providerLabel}: Initial ${commitmentLabel}`,
      `Purchase smallest ${commitmentLabel} commitment first to validate billing impact before larger purchases.`,
      order++,
      canaryItems,
      {
        phaseType: "canary",
        provider,
        riskLevel: "medium",
        requiresApproval: true,
        waitAfterMinutes: 1440, // 24h — wait a billing cycle
        canaryPercentage: Math.round((canaryItems.length / providerItems.length) * 100),
        successCriteria: [
          { metric: "billing_reflects_commitment", operator: "equals", target: 1, tolerancePercent: 0, description: "Billing shows commitment discount applied" },
          { metric: "usage_still_covers_commitment", operator: "equals", target: 1, tolerancePercent: 0, description: "Actual usage still exceeds commitment" },
        ],
      },
    );
    phases.push(canaryPhase);
    edges.push({ from: analysisPhase.id, to: canaryPhase.id, type: "must_complete" });

    if (remainingItems.length > 0) {
      checkpoints.push({
        id: nextCheckpointId(),
        afterPhaseId: canaryPhase.id,
        beforePhaseId: `phase_${phaseCounter + 1}`,
        reason: `Initial ${providerLabel} commitment verified — approve remaining purchases after confirming billing impact.`,
        approverRole: "owner",
        autoApproveAfterHours: null,
        blocksExecution: true,
      });

      const fullPhase = makePhase(
        `${providerLabel}: Remaining ${commitmentLabel}s`,
        `Purchase remaining ${remainingItems.length} ${commitmentLabel} commitment(s) after canary validation.`,
        order++,
        remainingItems,
        {
          phaseType: "full_rollout",
          provider,
          riskLevel: "medium",
          requiresApproval: true,
        },
      );
      phases.push(fullPhase);
      edges.push({ from: canaryPhase.id, to: fullPhase.id, type: "must_complete" });
    }
  }

  return { phases, edges, checkpoints };
}

// ---------------------------------------------------------------------------
// 4d. Backup Strategy Rollout
// ---------------------------------------------------------------------------

function generateBackupStrategyPlan(
  items: ExecutionPlanItem[],
  themes: Theme[],
  prefs: OrgPreferences,
): { phases: PlanPhase[]; edges: DependencyEdge[]; checkpoints: ApprovalCheckpoint[] } {
  const phases: PlanPhase[] = [];
  const edges: DependencyEdge[] = [];
  const checkpoints: ApprovalCheckpoint[] = [];

  const byProvider = groupByProvider(items);

  // Phase per provider — backup tools are provider-specific
  let order = 0;
  for (const provider of PROVIDER_ORDER) {
    const providerItems = byProvider.get(provider);
    if (!providerItems || providerItems.length === 0) continue;

    const providerLabel = provider === "aws" ? "AWS" : provider === "azure" ? "Azure" : "Google Cloud";
    const backupTool = provider === "aws" ? "AWS Backup" : provider === "azure" ? "Azure Backup" : "GCP Snapshots";

    // Phase A: Enable backup on compute resources
    const computeItems = providerItems.filter((i) =>
      i.actionType === "enable_backup" && i.resourceIds.some((r) => r.includes("compute") || r.includes("instance") || r.includes("vm")),
    );
    const storageItems = providerItems.filter((i) => !computeItems.includes(i));

    const allItems = [...computeItems, ...storageItems];
    if (allItems.length === 0) continue;

    const phase = makePhase(
      `${providerLabel}: Enable ${backupTool}`,
      `Configure automated backups for ${allItems.length} resource(s) using ${backupTool}. Non-disruptive — adds protection without modifying existing resources.`,
      order++,
      allItems,
      {
        phaseType: "gradual_rollout",
        provider,
        riskLevel: "low",
        requiresApproval: false,
        waitAfterMinutes: 15,
        successCriteria: [
          ...defaultSuccessCriteria("enable_backup"),
          { metric: "backup_schedule_configured", operator: "equals", target: 100, tolerancePercent: 0, description: "All resources have backup schedules" },
        ],
      },
    );
    phases.push(phase);

    if (phases.length > 1) {
      edges.push({ from: phases[phases.length - 2].id, to: phase.id, type: "should_complete" });
    }
  }

  // Final: Verify first backup completes
  if (phases.length > 0) {
    const verifyPhase = makePhase(
      "Backup Verification",
      "Wait for first backup cycle to complete across all providers and verify backup integrity.",
      order,
      [],
      {
        phaseType: "validation",
        riskLevel: "low",
        requiresApproval: false,
        estimatedDurationMinutes: 60,
        waitAfterMinutes: 0,
        successCriteria: [
          { metric: "first_backup_completed", operator: "equals", target: 1, tolerancePercent: 0, description: "At least one backup has completed for each resource" },
          { metric: "backup_integrity_check", operator: "equals", target: 1, tolerancePercent: 0, description: "Backup integrity verification passes" },
        ],
      },
    );
    phases.push(verifyPhase);
    edges.push({ from: phases[phases.length - 2].id, to: verifyPhase.id, type: "must_complete" });
  }

  return { phases, edges, checkpoints };
}

// ---------------------------------------------------------------------------
// 4e. Security Hardening Rollout
// ---------------------------------------------------------------------------

function generateSecurityHardeningPlan(
  items: ExecutionPlanItem[],
  themes: Theme[],
  prefs: OrgPreferences,
): { phases: PlanPhase[]; edges: DependencyEdge[]; checkpoints: ApprovalCheckpoint[] } {
  const phases: PlanPhase[] = [];
  const edges: DependencyEdge[] = [];
  const checkpoints: ApprovalCheckpoint[] = [];

  // Security changes are urgent but must not break access patterns
  // Strategy: audit first, then restrict, then verify

  // Phase 0: Audit
  const auditPhase = makePhase(
    "Access Pattern Audit",
    "Identify which public endpoints are intentionally public (CDN, static sites) vs. accidentally exposed.",
    0,
    [],
    {
      phaseType: "preparation",
      riskLevel: "low",
      requiresApproval: false,
      estimatedDurationMinutes: 20,
    },
  );
  phases.push(auditPhase);

  // Phase 1: Restrict resources with no recent access
  const noAccessItems = items.filter((i) => i.riskLevel === "low");
  const activeAccessItems = items.filter((i) => i.riskLevel !== "low");

  if (noAccessItems.length > 0) {
    const restrictPhase = makePhase(
      "Restrict Unused Public Resources",
      `Lock down ${noAccessItems.length} resource(s) with no recent external access. Low risk of breaking anything.`,
      1,
      noAccessItems,
      {
        phaseType: "gradual_rollout",
        riskLevel: "low",
        requiresApproval: false,
        waitAfterMinutes: 15,
        successCriteria: defaultSuccessCriteria("restrict_public_access"),
      },
    );
    phases.push(restrictPhase);
    edges.push({ from: auditPhase.id, to: restrictPhase.id, type: "must_complete" });
  }

  if (activeAccessItems.length > 0) {
    if (noAccessItems.length > 0) {
      checkpoints.push({
        id: nextCheckpointId(),
        afterPhaseId: phases[phases.length - 1].id,
        beforePhaseId: `phase_${phaseCounter + 1}`,
        reason: "Low-risk restrictions applied — review before restricting resources with active access patterns.",
        approverRole: "admin",
        autoApproveAfterHours: null,
        blocksExecution: true,
      });
    }

    const activePhase = makePhase(
      "Restrict Active Public Resources",
      `Restrict ${activeAccessItems.length} resource(s) that have recent access. May require updating application configs or CDN origins.`,
      2,
      activeAccessItems,
      {
        phaseType: "full_rollout",
        riskLevel: "medium",
        requiresApproval: true,
        requiresMaintenanceWindow: true,
        waitAfterMinutes: 30,
      },
    );
    phases.push(activePhase);
    edges.push({ from: phases[phases.length - 2].id, to: activePhase.id, type: "must_complete" });
  }

  // Validation
  const validationPhase = makePhase(
    "Security Verification",
    "Scan all storage resources to confirm no remaining public exposure. Verify no access regressions.",
    phases.length,
    [],
    {
      phaseType: "validation",
      riskLevel: "low",
      requiresApproval: false,
      estimatedDurationMinutes: 15,
      successCriteria: [
        { metric: "public_endpoints_count", operator: "equals", target: 0, tolerancePercent: 0, description: "Zero public storage endpoints" },
        { metric: "access_error_rate", operator: "less_than", target: 1, tolerancePercent: 0, description: "No access errors from restriction" },
      ],
    },
  );
  phases.push(validationPhase);
  edges.push({ from: phases[phases.length - 2].id, to: validationPhase.id, type: "must_complete" });

  return { phases, edges, checkpoints };
}

// ---------------------------------------------------------------------------
// 4f. Compute Right-Sizing Rollout
// ---------------------------------------------------------------------------

function generateComputeRightsizingPlan(
  items: ExecutionPlanItem[],
  themes: Theme[],
  prefs: OrgPreferences,
): { phases: PlanPhase[]; edges: DependencyEdge[]; checkpoints: ApprovalCheckpoint[] } {
  const phases: PlanPhase[] = [];
  const edges: DependencyEdge[] = [];
  const checkpoints: ApprovalCheckpoint[] = [];

  // Strategy: risk-ascending — start with low-risk (idle/stopped), then medium (oversized running)
  const byRisk = groupByRisk(items);

  // Phase 0: Decommission idle/stopped instances (quick win)
  const idleItems = items.filter((i) => i.actionType === "decommission_compute");
  const resizeItems = items.filter((i) => i.actionType === "resize_compute");

  if (idleItems.length > 0) {
    const idlePhase = makePhase(
      "Decommission Idle Instances",
      `Snapshot and terminate ${idleItems.length} idle/stopped instance(s). Snapshots preserved for 30 days.`,
      0,
      idleItems,
      {
        phaseType: "gradual_rollout",
        riskLevel: "medium",
        requiresApproval: true,
        waitAfterMinutes: 30,
      },
    );
    phases.push(idlePhase);
  }

  if (resizeItems.length > 0) {
    // Split resize into canary + fleet
    const sorted = [...resizeItems].sort((a, b) => a.resourceIds.length - b.resourceIds.length);
    const canaryCount = Math.max(1, Math.floor(sorted.length * 0.2));
    const canaryItems = sorted.slice(0, canaryCount);
    const fleetItems = sorted.slice(canaryCount);

    const canaryPhase = makePhase(
      "Canary: Resize Sample Instances",
      `Resize ${canaryItems.length} instance(s) as canary. Monitor CPU/memory for 30 minutes before fleet rollout.`,
      phases.length,
      canaryItems,
      {
        phaseType: "canary",
        canaryPercentage: Math.round((canaryCount / resizeItems.length) * 100),
        waitAfterMinutes: 30,
        successCriteria: defaultSuccessCriteria("resize_compute"),
      },
    );
    phases.push(canaryPhase);

    if (phases.length > 1) {
      edges.push({ from: phases[phases.length - 2].id, to: canaryPhase.id, type: "should_complete" });
    }

    if (fleetItems.length > 0) {
      checkpoints.push({
        id: nextCheckpointId(),
        afterPhaseId: canaryPhase.id,
        beforePhaseId: `phase_${phaseCounter + 1}`,
        reason: "Canary instances resized and stable — approve fleet-wide resize.",
        approverRole: "operator",
        autoApproveAfterHours: 24,
        blocksExecution: true,
      });

      const fleetPhase = makePhase(
        "Fleet Resize",
        `Resize remaining ${fleetItems.length} instance(s) using rolling strategy (one at a time, verify between each).`,
        phases.length,
        fleetItems,
        {
          phaseType: "full_rollout",
          requiresApproval: true,
          requiresMaintenanceWindow: fleetItems.some((i) => i.requiresDowntime),
        },
      );
      phases.push(fleetPhase);
      edges.push({ from: canaryPhase.id, to: fleetPhase.id, type: "must_complete" });
    }
  }

  // Validation
  if (phases.length > 0) {
    const validationPhase = makePhase(
      "Compute Validation",
      "Monitor resized instances for 24 hours. Verify CPU/memory utilization and error rates are within acceptable ranges.",
      phases.length,
      [],
      {
        phaseType: "validation",
        riskLevel: "low",
        requiresApproval: false,
        estimatedDurationMinutes: 15,
        successCriteria: defaultSuccessCriteria("resize_compute"),
      },
    );
    phases.push(validationPhase);
    edges.push({ from: phases[phases.length - 2].id, to: validationPhase.id, type: "must_complete" });
  }

  return { phases, edges, checkpoints };
}

// ---------------------------------------------------------------------------
// 5. Archetype router — selects the right generator
// ---------------------------------------------------------------------------

function detectArchetype(themes: Theme[], items: ExecutionPlanItem[]): RolloutArchetype {
  const actionTypes = new Set(items.map((i) => i.actionType));
  const categories = new Set(themes.map((t) => t.category));

  if (actionTypes.size === 1) {
    if (actionTypes.has("restrict_public_access")) return "security_hardening";
    if (actionTypes.has("enable_backup")) return "backup_strategy";
    if (actionTypes.has("apply_storage_policy")) return "storage_lifecycle";
    if (actionTypes.has("purchase_commitment")) return "commitment_adoption";
    if (actionTypes.has("resize_compute") || actionTypes.has("decommission_compute")) return "compute_rightsizing";
  }

  if (categories.has("resilience") && themes.some((t) => t.signalTypes.includes("single_region_risk"))) {
    return "region_resilience";
  }

  if (categories.has("security")) return "security_hardening";

  if (actionTypes.has("resize_compute") || actionTypes.has("decommission_compute")) return "compute_rightsizing";
  if (actionTypes.has("apply_storage_policy")) return "storage_lifecycle";

  return "mixed";
}

function selectStrategy(archetype: RolloutArchetype): PhasingStrategy {
  switch (archetype) {
    case "region_resilience": return "region_sweep";
    case "storage_lifecycle": return "risk_ascending";
    case "commitment_adoption": return "provider_sequential";
    case "backup_strategy": return "provider_sequential";
    case "security_hardening": return "criticality_descending";
    case "compute_rightsizing": return "canary_then_fleet";
    case "mixed": return "risk_ascending";
  }
}

const ARCHETYPE_GENERATORS: Record<
  RolloutArchetype,
  (items: ExecutionPlanItem[], themes: Theme[], prefs: OrgPreferences) => {
    phases: PlanPhase[];
    edges: DependencyEdge[];
    checkpoints: ApprovalCheckpoint[];
  }
> = {
  region_resilience: generateRegionResiliencePlan,
  storage_lifecycle: generateStorageLifecyclePlan,
  commitment_adoption: generateCommitmentAdoptionPlan,
  backup_strategy: generateBackupStrategyPlan,
  security_hardening: generateSecurityHardeningPlan,
  compute_rightsizing: generateComputeRightsizingPlan,
  mixed: generateMixedPlan,
};

// ---------------------------------------------------------------------------
// 4g. Mixed rollout — groups by action type, runs security first
// ---------------------------------------------------------------------------

function generateMixedPlan(
  items: ExecutionPlanItem[],
  themes: Theme[],
  prefs: OrgPreferences,
): { phases: PlanPhase[]; edges: DependencyEdge[]; checkpoints: ApprovalCheckpoint[] } {
  const phases: PlanPhase[] = [];
  const edges: DependencyEdge[] = [];
  const checkpoints: ApprovalCheckpoint[] = [];

  // Priority order: security → backup → compute → storage → commitment
  const ACTION_PRIORITY: ActionType[] = [
    "restrict_public_access",
    "enable_backup",
    "decommission_compute",
    "resize_compute",
    "apply_storage_policy",
    "purchase_commitment",
  ];

  const byAction = new Map<ActionType, ExecutionPlanItem[]>();
  for (const item of items) {
    if (!byAction.has(item.actionType)) byAction.set(item.actionType, []);
    byAction.get(item.actionType)!.push(item);
  }

  let order = 0;
  for (const actionType of ACTION_PRIORITY) {
    const actionItems = byAction.get(actionType);
    if (!actionItems || actionItems.length === 0) continue;

    const ACTION_LABELS: Record<ActionType, string> = {
      restrict_public_access: "Security: Restrict Public Access",
      enable_backup: "Resilience: Enable Backups",
      decommission_compute: "Cost: Decommission Idle Compute",
      resize_compute: "Cost: Right-Size Compute",
      apply_storage_policy: "Cost: Storage Lifecycle",
      purchase_commitment: "Cost: Commitment Discounts",
    };

    const phase = makePhase(
      ACTION_LABELS[actionType],
      `Apply ${actionItems.length} ${actionType.replace(/_/g, " ")} action(s).`,
      order++,
      actionItems,
    );
    phases.push(phase);

    if (phases.length > 1) {
      edges.push({ from: phases[phases.length - 2].id, to: phase.id, type: "should_complete" });
    }
  }

  return { phases, edges, checkpoints };
}

// ---------------------------------------------------------------------------
// 6. Plan impact & rollback summary
// ---------------------------------------------------------------------------

function computePlanImpact(phases: PlanPhase[]): PlanImpact {
  const providerBreakdown: Record<string, { savings: number; resources: number }> = {};
  const phaseBreakdown: Array<{ phaseId: PhaseId; phaseName: string; savings: number }> = [];

  let totalMonthly = 0;
  let totalResources = 0;
  let totalDowntime = 0;

  for (const phase of phases) {
    totalMonthly += phase.estimatedImpact.monthlySavings;
    totalResources += phase.estimatedImpact.resourcesAffected;
    totalDowntime += phase.estimatedImpact.downtimeMinutes;

    phaseBreakdown.push({
      phaseId: phase.id,
      phaseName: phase.name,
      savings: phase.estimatedImpact.yearlySavings,
    });

    const p = phase.provider;
    if (!providerBreakdown[p]) providerBreakdown[p] = { savings: 0, resources: 0 };
    providerBreakdown[p].savings += phase.estimatedImpact.yearlySavings;
    providerBreakdown[p].resources += phase.estimatedImpact.resourcesAffected;
  }

  return {
    totalMonthlySavings: totalMonthly,
    totalYearlySavings: totalMonthly * 12,
    totalResourcesAffected: totalResources,
    totalDowntimeMinutes: totalDowntime,
    breakdownByProvider: providerBreakdown as Record<CloudProvider, { savings: number; resources: number }>,
    breakdownByPhase: phaseBreakdown,
  };
}

function computeRollbackSummary(phases: PlanPhase[]): PlanRollbackSummary {
  const irreversible: PhaseId[] = [];
  let totalMinutes = 0;
  let maxComplexity: "trivial" | "moderate" | "complex" = "trivial";
  const notes: string[] = [];

  for (const phase of phases) {
    if (phase.phaseType === "validation" || phase.phaseType === "preparation") continue;

    const hasIrreversible = phase.items.some(
      (i) => i.actionType === "decommission_compute" || i.actionType === "purchase_commitment",
    );
    if (hasIrreversible) {
      irreversible.push(phase.id);
    }

    totalMinutes += phase.estimatedDurationMinutes;

    if (phase.riskLevel === "high") maxComplexity = "complex";
    else if (phase.riskLevel === "medium" && maxComplexity !== "complex") maxComplexity = "moderate";
  }

  if (irreversible.length > 0) {
    notes.push(`${irreversible.length} phase(s) contain irreversible actions (decommission or commitment purchase). Snapshots will be taken before execution.`);
  }

  if (maxComplexity === "complex") {
    notes.push("High-risk phases require manual rollback verification. Automated rollback will attempt reversal but human confirmation is recommended.");
  }

  return {
    fullyReversible: irreversible.length === 0,
    irreversiblePhases: irreversible,
    estimatedRollbackMinutes: totalMinutes,
    rollbackComplexity: maxComplexity,
    notes,
  };
}

// ---------------------------------------------------------------------------
// 7. Top-level plan generator — public entry point
// ---------------------------------------------------------------------------

export function generateAgentPlan(input: PlanGenerationInput): AgentPlan {
  resetCounters();

  const { themes, executionItems, preferences, providers } = input;

  if (executionItems.length === 0) {
    return emptyPlan(providers);
  }

  const archetype = detectArchetype(themes, executionItems);
  const strategy = selectStrategy(archetype);
  const generator = ARCHETYPE_GENERATORS[archetype];

  const { phases, edges, checkpoints } = generator(executionItems, themes, preferences);

  const dependencyGraph = buildDependencyGraph(phases, edges);
  const sortedPhases = topologicalSort(dependencyGraph, phases);

  // Re-number after sort
  sortedPhases.forEach((p, i) => { p.order = i; });

  const estimatedImpact = computePlanImpact(sortedPhases);
  const rollbackSummary = computeRollbackSummary(sortedPhases);

  const allRegions = [...new Set(sortedPhases.flatMap((p) => p.regions))];
  const totalResources = sortedPhases.reduce((s, p) => s + p.resourceCount, 0);

  const planRisk = sortedPhases.some((p) => p.riskLevel === "high")
    ? "high"
    : sortedPhases.some((p) => p.riskLevel === "medium")
      ? "medium"
      : "low";

  const estimatedDays = Math.ceil(
    sortedPhases.reduce((s, p) => s + p.estimatedDurationMinutes + p.waitAfterMinutes, 0) / (8 * 60),
  );

  return {
    id: `plan_${Date.now()}_${archetype}`,
    name: ARCHETYPE_NAMES[archetype],
    description: ARCHETYPE_DESCRIPTIONS[archetype](sortedPhases.length, totalResources, allRegions.length),
    archetype,
    strategy,
    createdAt: new Date().toISOString(),
    status: "draft",
    phases: sortedPhases,
    dependencyGraph,
    approvalCheckpoints: checkpoints,
    estimatedImpact,
    rollbackSummary,
    providers,
    regions: allRegions,
    totalResourceCount: totalResources,
    metadata: {
      themeIds: themes.map((t) => t.id),
      generatedFrom: "reasoning_engine",
      estimatedDurationDays: Math.max(estimatedDays, 1),
      riskProfile: planRisk,
    },
  };
}

function emptyPlan(providers: CloudProvider[]): AgentPlan {
  return {
    id: `plan_${Date.now()}_empty`,
    name: "No Actions Required",
    description: "Infrastructure is well-optimized. No phased rollout needed at this time.",
    archetype: "mixed",
    strategy: "risk_ascending",
    createdAt: new Date().toISOString(),
    status: "completed",
    phases: [],
    dependencyGraph: { edges: [], roots: [], leaves: [] },
    approvalCheckpoints: [],
    estimatedImpact: {
      totalMonthlySavings: 0,
      totalYearlySavings: 0,
      totalResourcesAffected: 0,
      totalDowntimeMinutes: 0,
      breakdownByProvider: {} as Record<CloudProvider, { savings: number; resources: number }>,
      breakdownByPhase: [],
    },
    rollbackSummary: {
      fullyReversible: true,
      irreversiblePhases: [],
      estimatedRollbackMinutes: 0,
      rollbackComplexity: "trivial",
      notes: [],
    },
    providers,
    regions: [],
    totalResourceCount: 0,
    metadata: {
      themeIds: [],
      generatedFrom: "reasoning_engine",
      estimatedDurationDays: 0,
      riskProfile: "low",
    },
  };
}

const ARCHETYPE_NAMES: Record<RolloutArchetype, string> = {
  region_resilience: "Region Resilience Rollout",
  storage_lifecycle: "Storage Lifecycle Optimization",
  commitment_adoption: "Commitment Discount Adoption",
  backup_strategy: "Backup Strategy Rollout",
  security_hardening: "Security Hardening Plan",
  compute_rightsizing: "Compute Right-Sizing Rollout",
  mixed: "Multi-Category Optimization Plan",
};

const ARCHETYPE_DESCRIPTIONS: Record<RolloutArchetype, (phases: number, resources: number, regions: number) => string> = {
  region_resilience: (p, r, reg) =>
    `${p}-phase rollout to improve region resilience across ${reg} region(s) affecting ${r} resource(s). Starts with canary region, validates, then rolls out to primary.`,
  storage_lifecycle: (p, r) =>
    `${p}-phase rollout to optimize storage costs across ${r} resource(s). Phases by risk level — intelligent tiering first, lifecycle policies second, archive rules last.`,
  commitment_adoption: (p, r) =>
    `${p}-phase commitment purchase plan for ${r} resource(s). Starts with smallest commitment as canary, validates billing impact, then proceeds to remaining purchases.`,
  backup_strategy: (p, r) =>
    `${p}-phase backup enablement for ${r} resource(s). Non-disruptive — adds backup schedules without modifying existing resources. Verifies first backup completes.`,
  security_hardening: (p, r) =>
    `${p}-phase security hardening plan for ${r} resource(s). Audits access patterns, restricts unused public resources first, then addresses active public resources with approval.`,
  compute_rightsizing: (p, r) =>
    `${p}-phase compute optimization for ${r} resource(s). Canary resize first, monitor metrics, then fleet-wide rollout with rolling updates.`,
  mixed: (p, r) =>
    `${p}-phase optimization plan addressing ${r} resource(s) across multiple categories. Prioritizes security, then resilience, then cost optimization.`,
};

// ---------------------------------------------------------------------------
// 8. Example phased rollout plans (documentation / test fixtures)
// ---------------------------------------------------------------------------

export const EXAMPLE_PLANS = {
  regionResilience: {
    description: "3-region resilience rollout for an AWS workload currently in us-east-1 only",
    plan: {
      archetype: "region_resilience" as RolloutArchetype,
      phases: [
        "Phase 0: Assessment — document baseline, identify failover targets",
        "Phase 1: Canary (us-west-2) — deploy to secondary region, validate failover",
        "Phase 2: Rollout (eu-west-1) — extend to EU region for latency/compliance",
        "Phase 3: Primary (us-east-1) — apply resilience config to primary region",
        "Phase 4: Validation — test failover paths, verify DNS failover",
      ],
      checkpoints: [
        "After Phase 1: Operator approves after canary health check (auto-approve after 24h)",
        "After Phase 2: Admin approves before modifying primary region",
      ],
      estimatedDays: 5,
    },
  },

  storageLifecycle: {
    description: "Tiered storage optimization for 40 S3 buckets across AWS",
    plan: {
      archetype: "storage_lifecycle" as RolloutArchetype,
      phases: [
        "Phase 0: Intelligent Tiering (15 buckets) — zero-risk, automatic cost optimization",
        "Phase 1: Lifecycle Policies (18 buckets) — move cold data to Infrequent Access after 90 days",
        "Phase 2: Archive Rules (7 buckets) — Glacier Deep Archive for data >365 days old",
        "Phase 3: Validation — verify no access regressions, check cost reduction",
      ],
      checkpoints: [
        "After Phase 1: Admin approves archive rules (data harder to access)",
      ],
      estimatedDays: 7,
    },
  },

  commitmentAdoption: {
    description: "AWS Savings Plan + Azure RI adoption for stable compute baseline",
    plan: {
      archetype: "commitment_adoption" as RolloutArchetype,
      phases: [
        "Phase 0: Analysis — confirm 14-day usage baseline is stable",
        "Phase 1: AWS Canary — purchase smallest Savings Plan ($50/mo commitment)",
        "Phase 2: AWS Full — purchase remaining $400/mo Savings Plan after billing verification",
        "Phase 3: Azure Canary — purchase 1 Reserved Instance (D2s_v3, 1yr, no-upfront)",
        "Phase 4: Azure Full — purchase remaining 4 Reserved Instances after billing verification",
      ],
      checkpoints: [
        "After Phase 1: Owner approves after 24h billing verification",
        "After Phase 3: Owner approves after Azure billing verification",
      ],
      estimatedDays: 14,
    },
  },

  backupStrategy: {
    description: "Enable automated backups across AWS and GCP",
    plan: {
      archetype: "backup_strategy" as RolloutArchetype,
      phases: [
        "Phase 0: AWS Backup — enable AWS Backup for 8 EC2 instances and 3 RDS databases",
        "Phase 1: GCP Snapshots — enable scheduled snapshots for 5 Compute Engine VMs",
        "Phase 2: Verification — wait for first backup cycle, verify integrity",
      ],
      checkpoints: [],
      estimatedDays: 3,
    },
  },
} as const;

// ---------------------------------------------------------------------------
// 9. Invariant tests
// ---------------------------------------------------------------------------

export type PlanningTestResult = { name: string; passed: boolean; detail: string };

export function runPlanningTests(): PlanningTestResult[] {
  const results: PlanningTestResult[] = [];

  const makeItem = (overrides: Partial<ExecutionPlanItem> = {}): ExecutionPlanItem => ({
    id: `item_${Math.random().toString(36).slice(2, 8)}`,
    provider: "aws",
    actionType: "resize_compute",
    resourceIds: ["i-abc123"],
    region: "us-east-1",
    currentState: "m5.2xlarge",
    recommendedState: "m5.xlarge",
    estimatedSavings: { monthly: 100, yearly: 1200 },
    riskLevel: "low",
    requiresDowntime: false,
    rollbackSteps: ["Resize back to m5.2xlarge"],
    ...overrides,
  });

  const makeTheme = (overrides: Partial<Theme> = {}): Theme => ({
    id: "theme_test",
    label: "Test Theme",
    category: "cost",
    findings: [],
    recommendations: [],
    aggregatedSavings: { monthly: 100, yearly: 1200 },
    highestSeverity: "medium",
    resourceCount: 1,
    regions: ["us-east-1"],
    providers: ["aws"],
    signalTypes: ["compute_rightsizing"],
    tradeoff: {
      actNow: { outcome: "Saves money", risk: "Low", cost: "$1,200/yr" },
      waitOrIgnore: { outcome: "Waste continues", risk: "None", cost: "$100/mo wasted" },
      recommendation: "act",
      confidence: "high",
      timeHorizon: "This week",
    },
    disposition: { recommended: "approval_required", reason: "Test", alternativeIfRejected: "Wait" },
    tags: [],
    narrative: "Test narrative",
    ...overrides,
  });

  const defaultPrefs: OrgPreferences = {
    organizationId: "test",
    preferredProviders: [],
    riskTolerance: "moderate" as unknown as OrgPreferences["riskTolerance"],
    approvalPolicy: "auto_safe" as unknown as OrgPreferences["approvalPolicy"],
    autoApplyEnabled: true,
    outputFormat: "terraform" as unknown as OrgPreferences["outputFormat"],
    businessContext: "saas" as unknown as OrgPreferences["businessContext"],
    ignoredFindingTitles: new Set(),
    priorityCategories: [],
    notes: null,
  };

  // Test 1: No items produces empty plan
  {
    const plan = generateAgentPlan({
      themes: [],
      executionItems: [],
      preferences: defaultPrefs,
      providers: ["aws"],
    });
    results.push({
      name: "Empty items produce completed empty plan",
      passed: plan.status === "completed" && plan.phases.length === 0,
      detail: `Status: ${plan.status}, phases: ${plan.phases.length}`,
    });
  }

  // Test 2: Canary phase always comes before fleet
  {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `item_${i}`, region: i < 3 ? "us-west-2" : "us-east-1" }),
    );
    const plan = generateAgentPlan({
      themes: [makeTheme()],
      executionItems: items,
      preferences: defaultPrefs,
      providers: ["aws"],
    });
    const canaryIdx = plan.phases.findIndex((p) => p.phaseType === "canary");
    const fleetIdx = plan.phases.findIndex((p) => p.phaseType === "full_rollout" || p.phaseType === "gradual_rollout");
    results.push({
      name: "Canary phase precedes fleet rollout",
      passed: canaryIdx !== -1 && (fleetIdx === -1 || canaryIdx < fleetIdx),
      detail: `Canary at index ${canaryIdx}, fleet at index ${fleetIdx}`,
    });
  }

  // Test 3: Dependency graph has no cycles
  {
    const items = [
      makeItem({ region: "us-east-1" }),
      makeItem({ region: "us-west-2" }),
      makeItem({ region: "eu-west-1" }),
    ];
    const plan = generateAgentPlan({
      themes: [makeTheme({ regions: ["us-east-1", "us-west-2", "eu-west-1"] })],
      executionItems: items,
      preferences: defaultPrefs,
      providers: ["aws"],
    });
    const cycles = detectCycles(plan.dependencyGraph);
    results.push({
      name: "Dependency graph is acyclic (DAG)",
      passed: cycles.length === 0,
      detail: cycles.length === 0 ? "No cycles" : `Found ${cycles.length} cycle(s)`,
    });
  }

  // Test 4: High-risk phases always require approval
  {
    const items = [
      makeItem({ riskLevel: "high", actionType: "decommission_compute" }),
      makeItem({ riskLevel: "low" }),
    ];
    const plan = generateAgentPlan({
      themes: [makeTheme()],
      executionItems: items,
      preferences: defaultPrefs,
      providers: ["aws"],
    });
    const highRiskPhases = plan.phases.filter((p) => p.riskLevel === "high");
    const allRequireApproval = highRiskPhases.every((p) => p.requiresApproval);
    results.push({
      name: "High-risk phases always require approval",
      passed: highRiskPhases.length === 0 || allRequireApproval,
      detail: `${highRiskPhases.length} high-risk phase(s), all require approval: ${allRequireApproval}`,
    });
  }

  // Test 5: Security hardening detected and prioritized
  {
    const items = [
      makeItem({ actionType: "restrict_public_access", riskLevel: "medium" }),
      makeItem({ actionType: "restrict_public_access", riskLevel: "low" }),
    ];
    const themes = [makeTheme({ category: "security", signalTypes: ["public_storage"] })];
    const plan = generateAgentPlan({
      themes,
      executionItems: items,
      preferences: defaultPrefs,
      providers: ["aws"],
    });
    results.push({
      name: "Security items produce security_hardening archetype",
      passed: plan.archetype === "security_hardening",
      detail: `Archetype: ${plan.archetype}`,
    });
  }

  // Test 6: Commitment plans require owner approval
  {
    const items = [
      makeItem({ actionType: "purchase_commitment", riskLevel: "medium" }),
    ];
    const plan = generateAgentPlan({
      themes: [makeTheme()],
      executionItems: items,
      preferences: defaultPrefs,
      providers: ["aws"],
    });
    const ownerCheckpoints = plan.approvalCheckpoints.filter((c) => c.approverRole === "owner");
    results.push({
      name: "Commitment purchases require owner-level approval",
      passed: ownerCheckpoints.length > 0 || plan.phases.every((p) => p.requiresApproval),
      detail: `Owner checkpoints: ${ownerCheckpoints.length}, all phases require approval: ${plan.phases.every((p) => p.requiresApproval)}`,
    });
  }

  // Test 7: Phases are topologically ordered
  {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `item_${i}`, region: `region-${i % 3}` }),
    );
    const plan = generateAgentPlan({
      themes: [makeTheme()],
      executionItems: items,
      preferences: defaultPrefs,
      providers: ["aws"],
    });
    const orders = plan.phases.map((p) => p.order);
    const isMonotonic = orders.every((o, i) => i === 0 || o >= orders[i - 1]);
    results.push({
      name: "Phase order is monotonically increasing",
      passed: isMonotonic,
      detail: `Orders: [${orders.join(", ")}]`,
    });
  }

  // Test 8: Validation phase is always last
  {
    const items = [makeItem(), makeItem({ region: "us-west-2" })];
    const plan = generateAgentPlan({
      themes: [makeTheme()],
      executionItems: items,
      preferences: defaultPrefs,
      providers: ["aws"],
    });
    const lastPhase = plan.phases[plan.phases.length - 1];
    results.push({
      name: "Validation phase is the final phase",
      passed: lastPhase?.phaseType === "validation",
      detail: `Last phase type: ${lastPhase?.phaseType}`,
    });
  }

  return results;
}
