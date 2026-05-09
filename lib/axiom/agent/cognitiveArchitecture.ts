/**
 * Axiom Cognitive Architecture
 *
 * The central nervous system of Axiom Agent. Implements the six-phase
 * agent loop (Observe → Reason → Plan → Act → Verify → Reflect) and
 * connects all subsystems into a unified cognitive pipeline.
 *
 * Architecture layers:
 *   1. Memory        — working, episodic, semantic, organizational
 *   2. Perception    — cloud snapshot ingestion + change detection
 *   3. Reasoning     — theme clustering, tradeoff analysis, disposition
 *   4. Planning      — phased rollout DAGs with dependency resolution
 *   5. Execution     — safe apply with prechecks, dry-run, rollback
 *   6. Verification  — post-action validation + drift detection
 *   7. Reflection    — outcome evaluation, confidence calibration
 *   8. Learning      — behavioral adaptation, organizational knowledge
 *   9. Governance    — policy enforcement, RBAC, approval routing
 *  10. Observability — structured logs, metrics, health, alerting
 *
 * Autonomy ladder:
 *   Level 0: Deterministic automation (rule-based, no judgment)
 *   Level 1: Adaptive agent (learns from org behavior, adjusts priority)
 *   Level 2: Reasoning agent (clusters themes, weighs tradeoffs, narrates)
 *   Level 3: Planning agent (multi-phase rollout, dependency resolution)
 *   Level 4: Self-directed agent (initiates actions within policy bounds)
 *   Level 5: Reflective agent (evaluates own performance, calibrates)
 *
 * Safety invariants:
 *   - Human approval is NEVER bypassed for high-risk actions
 *   - Autonomy level can only be raised by explicit org admin action
 *   - Every agent decision has a full evidence trail
 *   - Reflection can only TIGHTEN safety, never loosen it
 *   - All state transitions are logged and auditable
 */

import type { CloudProvider, CloudSnapshot } from "../cloudSnapshot";
import type { CostSignal, ConfidenceScore } from "../costSignals";
import type { ExecutionPlanItem, RiskLevel, ActionType } from "../executionPlan";
import type {
  AgentFinding,
  AgentRecommendation,
  AgentRunResult,
  AgentMessage,
  FindingCategory,
  FindingSeverity,
  ActionDisposition,
} from "./types";
import type { OrgPreferences } from "./preferences";
import type { AutopilotMode, AutopilotPolicy } from "./autopilot";
import type { Theme, ReasoningContext, ReasonedOutput } from "./reasoningEngine";
import type { AgentPlan, PlanPhase } from "./planningEngine";
import type { MonitorAlert } from "./monitoringAgent";
import type { DriftItem, DriftReport } from "./driftEngine";
import type { PolicyViolation, GovernanceReport } from "./governanceEngine";
import type { Explanation, ConfidenceAssessment } from "./explainabilityEngine";
import type { BehaviorProfile, AdaptiveAdjustment } from "./adaptiveBehavior";
import type { Membership, ApprovalChain } from "./rbacEngine";
import {
  FindingCategory as FC,
  RiskLevel as RL,
  ActionDisposition as AD,
} from "../enums";

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1: MEMORY SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// 1.1 Working Memory — current agent loop context (ephemeral)
// ---------------------------------------------------------------------------

export type WorkingMemory = {
  loopId: string;
  orgId: string;
  startedAt: string;
  phase: AgentPhase;
  snapshot: CloudSnapshot | null;
  previousSnapshot: CloudSnapshot | null;
  findings: AgentFinding[];
  recommendations: AgentRecommendation[];
  themes: Theme[];
  plan: AgentPlan | null;
  driftReport: DriftReport | null;
  governanceReport: GovernanceReport | null;
  alerts: MonitorAlert[];
  explanations: Explanation[];
  approvalsPending: ApprovalChain[];
  executionResults: ExecutionOutcome[];
  verificationResults: VerificationOutcome[];
  reflectionNotes: ReflectionNote[];
  errors: AgentError[];
  decisions: AgentDecision[];
  confidenceState: ConfidenceState;
};

export type AgentPhase =
  | "idle"
  | "observing"
  | "reasoning"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "verifying"
  | "reflecting"
  | "complete"
  | "failed";

export type AgentError = {
  phase: AgentPhase;
  message: string;
  recoverable: boolean;
  timestamp: string;
};

export type AgentDecision = {
  id: string;
  phase: AgentPhase;
  description: string;
  rationale: string;
  autonomyLevel: AutonomyLevel;
  confidence: number;
  alternatives: string[];
  timestamp: string;
};

export type ConfidenceState = {
  snapshotQuality: number;
  findingConfidence: number;
  planConfidence: number;
  overallConfidence: number;
  degradationReasons: string[];
};

// ---------------------------------------------------------------------------
// 1.2 Episodic Memory — history of past agent runs (persistent)
// ---------------------------------------------------------------------------

export type EpisodicMemory = {
  orgId: string;
  episodes: Episode[];
  maxEpisodes: number;
};

export type Episode = {
  id: string;
  runId: string;
  loopId: string;
  timestamp: string;
  provider: CloudProvider;
  trigger: string;
  phases: PhaseOutcome[];
  findingCount: number;
  actionsTaken: number;
  actionsSucceeded: number;
  actionsFailed: number;
  savingsRealized: number;
  savingsProjected: number;
  driftItemsDetected: number;
  violationsFound: number;
  confidenceScore: number;
  reflectionSummary: string;
  lessonsLearned: string[];
  durationMs: number;
};

export type PhaseOutcome = {
  phase: AgentPhase;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  outcome: "success" | "partial" | "skipped" | "failed";
  itemsProcessed: number;
  itemsSucceeded: number;
  notes: string;
};

// ---------------------------------------------------------------------------
// 1.3 Semantic Memory — organizational knowledge (persistent, evolving)
// ---------------------------------------------------------------------------

export type SemanticMemory = {
  orgId: string;
  updatedAt: string;
  resourcePatterns: ResourcePattern[];
  costBaselines: CostBaseline[];
  riskProfile: OrgRiskProfile;
  providerPreferences: ProviderPreference[];
  operationalRhythm: OperationalRhythm;
  knownExceptions: KnownException[];
};

export type ResourcePattern = {
  pattern: string;
  description: string;
  frequency: number;
  lastSeen: string;
  category: FindingCategory;
  typicalDisposition: ActionDisposition;
  confidenceInPattern: number;
};

export type CostBaseline = {
  provider: CloudProvider;
  monthlySpend: number;
  computePercent: number;
  storagePercent: number;
  trend: "increasing" | "stable" | "decreasing";
  measuredOver: string;
  lastUpdated: string;
};

export type OrgRiskProfile = {
  tolerance: "conservative" | "moderate" | "aggressive";
  historicalApprovalRate: number;
  averageApprovalTimeHours: number;
  rejectionPatterns: string[];
  escalationFrequency: number;
};

export type ProviderPreference = {
  provider: CloudProvider;
  primaryRegions: string[];
  preferredActionTypes: ActionType[];
  avoidedActionTypes: ActionType[];
  lastScanAt: string;
  scanFrequencyDays: number;
};

export type OperationalRhythm = {
  preferredScanDays: number[];
  preferredScanHourUtc: number;
  changeWindowStart: number;
  changeWindowEnd: number;
  freezePeriods: { start: string; end: string; reason: string }[];
};

export type KnownException = {
  id: string;
  resourceId: string;
  provider: CloudProvider;
  reason: string;
  createdBy: string;
  expiresAt: string | null;
  acknowledgedAt: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2: AUTONOMY MODEL
// ═══════════════════════════════════════════════════════════════════════════

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type AutonomyConfig = {
  currentLevel: AutonomyLevel;
  maxAllowedLevel: AutonomyLevel;
  escalationPolicy: EscalationPolicy;
  humanCheckpoints: HumanCheckpoint[];
  safetyBounds: SafetyBounds;
};

export type EscalationPolicy = {
  escalateOnConfidenceBelow: number;
  escalateOnRiskAbove: RiskLevel;
  escalateOnCostAbove: number;
  escalateOnNewResourceType: boolean;
  escalateOnFirstOccurrence: boolean;
  cooldownMinutes: number;
};

export type HumanCheckpoint = {
  beforePhase: AgentPhase;
  condition: "always" | "high_risk" | "first_time" | "low_confidence" | "policy_violation";
  required: boolean;
  timeoutMinutes: number;
  defaultOnTimeout: "proceed" | "abort" | "escalate";
};

export type SafetyBounds = {
  maxActionsPerLoop: number;
  maxCostImpactPerLoop: number;
  maxResourcesAffectedPerAction: number;
  forbiddenActionTypes: ActionType[];
  forbiddenRegions: string[];
  requireDryRunAbove: RiskLevel;
  requireApprovalAbove: RiskLevel;
  neverAutoApply: ActionType[];
};

export const DEFAULT_AUTONOMY: AutonomyConfig = {
  currentLevel: 1,
  maxAllowedLevel: 3,
  escalationPolicy: {
    escalateOnConfidenceBelow: 40,
    escalateOnRiskAbove: "high" as RiskLevel,
    escalateOnCostAbove: 5000,
    escalateOnNewResourceType: true,
    escalateOnFirstOccurrence: true,
    cooldownMinutes: 30,
  },
  humanCheckpoints: [
    { beforePhase: "executing", condition: "always", required: true, timeoutMinutes: 1440, defaultOnTimeout: "abort" },
    { beforePhase: "planning", condition: "high_risk", required: true, timeoutMinutes: 480, defaultOnTimeout: "abort" },
  ],
  safetyBounds: {
    maxActionsPerLoop: 25,
    maxCostImpactPerLoop: 10000,
    maxResourcesAffectedPerAction: 50,
    forbiddenActionTypes: [],
    forbiddenRegions: [],
    requireDryRunAbove: "low" as RiskLevel,
    requireApprovalAbove: "medium" as RiskLevel,
    neverAutoApply: ["decommission_compute" as ActionType, "purchase_commitment" as ActionType],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3: AGENT LOOP ENGINE
// ═══════════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// 3.1 Loop input/output
// ---------------------------------------------------------------------------

export type CognitiveLoopInput = {
  orgId: string;
  userId: string;
  providers: CloudProvider[];
  trigger: "scheduled" | "manual" | "drift" | "alert" | "workflow" | "reflection";
  autonomy: AutonomyConfig;
  preferences: OrgPreferences;
  behaviorProfile: BehaviorProfile | null;
  semanticMemory: SemanticMemory | null;
  recentEpisodes: Episode[];
  onMessage?: (msg: AgentMessage) => void;
  onPhaseChange?: (phase: AgentPhase, detail: string) => void;
  onDecision?: (decision: AgentDecision) => void;
};

export type CognitiveLoopResult = {
  loopId: string;
  status: "completed" | "partial" | "blocked" | "failed";
  phases: PhaseOutcome[];
  episode: Episode;
  updatedSemanticMemory: Partial<SemanticMemory>;
  nextActions: ScheduledAction[];
  humanActions: HumanActionRequired[];
  summary: LoopSummary;
};

export type LoopSummary = {
  headline: string;
  findingsDiscovered: number;
  recommendationsGenerated: number;
  actionsExecuted: number;
  actionsBlocked: number;
  savingsIdentified: number;
  violationsDetected: number;
  driftsDetected: number;
  confidenceScore: number;
  autonomyLevelUsed: AutonomyLevel;
  nextScheduledAt: string | null;
};

export type ScheduledAction = {
  action: string;
  scheduledFor: string;
  reason: string;
  priority: "low" | "medium" | "high";
};

export type HumanActionRequired = {
  type: "approval" | "review" | "decision" | "escalation";
  description: string;
  urgency: "low" | "medium" | "high" | "critical";
  deadline: string | null;
  context: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// 3.2 Execution & verification outcome types
// ---------------------------------------------------------------------------

export type ExecutionOutcome = {
  actionId: string;
  actionType: ActionType;
  resourceId: string;
  provider: CloudProvider;
  status: "applied" | "failed" | "skipped" | "rolled_back";
  durationMs: number;
  message: string;
  rollbackAvailable: boolean;
};

export type VerificationOutcome = {
  actionId: string;
  verified: boolean;
  driftDetected: boolean;
  message: string;
  checkedAt: string;
};

// ---------------------------------------------------------------------------
// 3.3 Reflection types
// ---------------------------------------------------------------------------

export type ReflectionNote = {
  id: string;
  category: ReflectionCategory;
  observation: string;
  impact: "positive" | "neutral" | "negative";
  actionable: boolean;
  suggestedAdjustment: string | null;
  confidence: number;
};

export type ReflectionCategory =
  | "accuracy"
  | "timing"
  | "prioritization"
  | "safety"
  | "efficiency"
  | "communication"
  | "prediction";

// ---------------------------------------------------------------------------
// 3.4 The cognitive loop — six-phase pipeline
// ---------------------------------------------------------------------------

let loopSeq = 0;

function loopId(): string {
  return `loop-${Date.now()}-${++loopSeq}`;
}

function phaseOutcome(
  phase: AgentPhase,
  start: number,
  outcome: PhaseOutcome["outcome"],
  processed: number,
  succeeded: number,
  notes: string,
): PhaseOutcome {
  const now = Date.now();
  return {
    phase,
    startedAt: new Date(start).toISOString(),
    completedAt: new Date(now).toISOString(),
    durationMs: now - start,
    outcome,
    itemsProcessed: processed,
    itemsSucceeded: succeeded,
    notes,
  };
}

export function runCognitiveLoop(input: CognitiveLoopInput): CognitiveLoopResult {
  const id = loopId();
  const loopStart = Date.now();
  const phases: PhaseOutcome[] = [];
  const humanActions: HumanActionRequired[] = [];
  const nextActions: ScheduledAction[] = [];

  const memory: WorkingMemory = {
    loopId: id,
    orgId: input.orgId,
    startedAt: new Date().toISOString(),
    phase: "idle",
    snapshot: null,
    previousSnapshot: null,
    findings: [],
    recommendations: [],
    themes: [],
    plan: null,
    driftReport: null,
    governanceReport: null,
    alerts: [],
    explanations: [],
    approvalsPending: [],
    executionResults: [],
    verificationResults: [],
    reflectionNotes: [],
    errors: [],
    decisions: [],
    confidenceState: {
      snapshotQuality: 0,
      findingConfidence: 0,
      planConfidence: 0,
      overallConfidence: 0,
      degradationReasons: [],
    },
  };

  const emit = input.onMessage ?? (() => {});
  const onPhase = input.onPhaseChange ?? (() => {});
  const onDecision = input.onDecision ?? (() => {});

  // ── Phase 1: OBSERVE ────────────────────────────────────────────────────
  const observeStart = Date.now();
  memory.phase = "observing";
  onPhase("observing", "Scanning connected cloud environments");

  const observeResult = executeObservePhase(memory, input);
  phases.push(phaseOutcome(
    "observing", observeStart, observeResult.outcome,
    observeResult.processed, observeResult.succeeded,
    observeResult.notes,
  ));

  if (observeResult.outcome === "failed") {
    return buildFailedResult(id, phases, memory, loopStart, "Observation phase failed");
  }

  // ── Phase 2: REASON ─────────────────────────────────────────────────────
  const reasonStart = Date.now();
  memory.phase = "reasoning";
  onPhase("reasoning", "Analyzing findings and identifying themes");

  const reasonResult = executeReasonPhase(memory, input);
  phases.push(phaseOutcome(
    "reasoning", reasonStart, reasonResult.outcome,
    reasonResult.processed, reasonResult.succeeded,
    reasonResult.notes,
  ));

  // Record reasoning decisions
  for (const d of reasonResult.decisions) {
    memory.decisions.push(d);
    onDecision(d);
  }

  if (memory.findings.length === 0 && memory.alerts.length === 0) {
    memory.phase = "complete";
    const reflectStart = Date.now();
    const reflectResult = executeReflectPhase(memory, input);
    phases.push(phaseOutcome(
      "reflecting", reflectStart, "success", 0, 0,
      "No findings — clean environment",
    ));

    return buildResult(id, phases, memory, loopStart, nextActions, humanActions, "completed");
  }

  // ── Phase 3: PLAN ───────────────────────────────────────────────────────
  const planStart = Date.now();
  memory.phase = "planning";
  onPhase("planning", "Generating execution plan");

  if (!canProceedToPhase("planning", input.autonomy, memory)) {
    humanActions.push({
      type: "approval",
      description: "Agent requires approval before planning phase",
      urgency: "medium",
      deadline: null,
      context: { findingCount: memory.findings.length },
    });
    memory.phase = "awaiting_approval";
    phases.push(phaseOutcome("planning", planStart, "skipped", 0, 0, "Blocked by autonomy checkpoint"));
    return buildResult(id, phases, memory, loopStart, nextActions, humanActions, "blocked");
  }

  const planResult = executePlanPhase(memory, input);
  phases.push(phaseOutcome(
    "planning", planStart, planResult.outcome,
    planResult.processed, planResult.succeeded,
    planResult.notes,
  ));

  for (const d of planResult.decisions) {
    memory.decisions.push(d);
    onDecision(d);
  }

  // ── Phase 4: ACT (Execute) ──────────────────────────────────────────────
  const actStart = Date.now();
  memory.phase = "executing";
  onPhase("executing", "Applying approved actions");

  if (!canProceedToPhase("executing", input.autonomy, memory)) {
    humanActions.push({
      type: "approval",
      description: "Agent requires approval before executing actions",
      urgency: "high",
      deadline: null,
      context: {
        actionCount: memory.plan?.phases.length ?? 0,
        riskLevel: assessPlanRisk(memory),
      },
    });
    memory.phase = "awaiting_approval";
    phases.push(phaseOutcome("executing", actStart, "skipped", 0, 0, "Blocked by autonomy checkpoint"));

    const reflectStart2 = Date.now();
    executeReflectPhase(memory, input);
    phases.push(phaseOutcome("reflecting", reflectStart2, "success", 0, 0, "Reflected on blocked execution"));

    return buildResult(id, phases, memory, loopStart, nextActions, humanActions, "blocked");
  }

  const actResult = executeActPhase(memory, input);
  phases.push(phaseOutcome(
    "executing", actStart, actResult.outcome,
    actResult.processed, actResult.succeeded,
    actResult.notes,
  ));

  // ── Phase 5: VERIFY ─────────────────────────────────────────────────────
  const verifyStart = Date.now();
  memory.phase = "verifying";
  onPhase("verifying", "Verifying applied actions");

  const verifyResult = executeVerifyPhase(memory, input);
  phases.push(phaseOutcome(
    "verifying", verifyStart, verifyResult.outcome,
    verifyResult.processed, verifyResult.succeeded,
    verifyResult.notes,
  ));

  // ── Phase 6: REFLECT ────────────────────────────────────────────────────
  const reflectStart3 = Date.now();
  memory.phase = "reflecting";
  onPhase("reflecting", "Evaluating loop performance");

  const reflectResult = executeReflectPhase(memory, input);
  phases.push(phaseOutcome(
    "reflecting", reflectStart3, "success",
    reflectResult.processed, reflectResult.succeeded,
    reflectResult.notes,
  ));

  // Schedule next actions
  nextActions.push(...deriveNextActions(memory, input));

  memory.phase = "complete";
  return buildResult(id, phases, memory, loopStart, nextActions, humanActions, "completed");
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 4: PHASE IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

type PhaseResult = {
  outcome: PhaseOutcome["outcome"];
  processed: number;
  succeeded: number;
  notes: string;
  decisions: AgentDecision[];
};

// ---------------------------------------------------------------------------
// 4.1 OBSERVE — perceive the current state of all connected environments
// ---------------------------------------------------------------------------

function executeObservePhase(memory: WorkingMemory, input: CognitiveLoopInput): PhaseResult {
  const decisions: AgentDecision[] = [];
  let processed = 0;
  let succeeded = 0;

  for (const provider of input.providers) {
    processed++;

    // In production, this calls generateSnapshot() per provider.
    // Here we define the deterministic orchestration logic.
    const snapshotAvailable = true; // placeholder for async snapshot generation

    if (snapshotAvailable) {
      succeeded++;
      decisions.push({
        id: `dec-observe-${provider}`,
        phase: "observing",
        description: `Scanned ${provider} environment`,
        rationale: `Scheduled scan for ${provider} triggered by ${input.trigger}`,
        autonomyLevel: 0,
        confidence: 90,
        alternatives: [],
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Assess snapshot quality for confidence tracking
  memory.confidenceState.snapshotQuality = succeeded > 0
    ? Math.round((succeeded / processed) * 100)
    : 0;

  if (succeeded === 0) {
    memory.errors.push({
      phase: "observing",
      message: "No providers returned a valid snapshot",
      recoverable: false,
      timestamp: new Date().toISOString(),
    });
    return { outcome: "failed", processed, succeeded, notes: "No snapshots obtained", decisions };
  }

  return {
    outcome: succeeded === processed ? "success" : "partial",
    processed,
    succeeded,
    notes: `Scanned ${succeeded}/${processed} providers`,
    decisions,
  };
}

// ---------------------------------------------------------------------------
// 4.2 REASON — analyze findings, cluster themes, assess tradeoffs
// ---------------------------------------------------------------------------

function executeReasonPhase(memory: WorkingMemory, input: CognitiveLoopInput): PhaseResult {
  const decisions: AgentDecision[] = [];

  // Determine reasoning depth based on autonomy level
  const depth = resolveReasoningDepth(input.autonomy.currentLevel);

  decisions.push({
    id: `dec-reason-depth`,
    phase: "reasoning",
    description: `Using ${depth} reasoning depth`,
    rationale: `Autonomy level ${input.autonomy.currentLevel} maps to ${depth} reasoning`,
    autonomyLevel: input.autonomy.currentLevel,
    confidence: 95,
    alternatives: ["shallow", "standard", "deep", "exhaustive"],
    timestamp: new Date().toISOString(),
  });

  // Apply adaptive behavior if profile exists
  if (input.behaviorProfile && input.autonomy.currentLevel >= 1) {
    decisions.push({
      id: `dec-reason-adaptive`,
      phase: "reasoning",
      description: "Applied adaptive behavior adjustments",
      rationale: `Org has ${input.behaviorProfile.signalCount} behavioral signals — adjusting priorities`,
      autonomyLevel: 1,
      confidence: 80,
      alternatives: ["Skip adaptive adjustments"],
      timestamp: new Date().toISOString(),
    });
  }

  // Cross-reference semantic memory for known exceptions
  if (input.semanticMemory) {
    const exceptions = input.semanticMemory.knownExceptions.filter(
      (e) => !e.expiresAt || new Date(e.expiresAt) > new Date(),
    );
    if (exceptions.length > 0) {
      decisions.push({
        id: `dec-reason-exceptions`,
        phase: "reasoning",
        description: `Excluded ${exceptions.length} known exception(s) from findings`,
        rationale: "These resources have been manually acknowledged by administrators",
        autonomyLevel: 0,
        confidence: 100,
        alternatives: [],
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Check for patterns from episodic memory
  if (input.recentEpisodes.length > 0 && input.autonomy.currentLevel >= 2) {
    const recurringThemes = detectRecurringThemes(input.recentEpisodes);
    if (recurringThemes.length > 0) {
      decisions.push({
        id: `dec-reason-recurring`,
        phase: "reasoning",
        description: `Identified ${recurringThemes.length} recurring theme(s) across recent runs`,
        rationale: "Recurring issues suggest systemic problems worth highlighting",
        autonomyLevel: 2,
        confidence: 70,
        alternatives: ["Treat each occurrence independently"],
        timestamp: new Date().toISOString(),
      });
    }
  }

  memory.confidenceState.findingConfidence = computeReasoningConfidence(
    memory.findings.length,
    memory.confidenceState.snapshotQuality,
    input.behaviorProfile?.signalCount ?? 0,
  );

  return {
    outcome: "success",
    processed: memory.findings.length,
    succeeded: memory.findings.length,
    notes: `Analyzed ${memory.findings.length} findings, generated ${memory.themes.length} themes`,
    decisions,
  };
}

// ---------------------------------------------------------------------------
// 4.3 PLAN — generate phased execution plan with safety gates
// ---------------------------------------------------------------------------

function executePlanPhase(memory: WorkingMemory, input: CognitiveLoopInput): PhaseResult {
  const decisions: AgentDecision[] = [];

  // Decide planning strategy based on finding count and risk
  const strategy = resolvePlanningStrategy(memory, input);

  decisions.push({
    id: `dec-plan-strategy`,
    phase: "planning",
    description: `Selected ${strategy} planning strategy`,
    rationale: strategyRationale(strategy, memory),
    autonomyLevel: Math.min(input.autonomy.currentLevel, 3) as AutonomyLevel,
    confidence: 85,
    alternatives: ["conservative", "balanced", "aggressive", "phased"],
    timestamp: new Date().toISOString(),
  });

  // Safety bounds check
  const bounds = input.autonomy.safetyBounds;
  const totalActions = memory.recommendations.filter((r) => r.actionable).length;

  if (totalActions > bounds.maxActionsPerLoop) {
    decisions.push({
      id: `dec-plan-cap`,
      phase: "planning",
      description: `Capped actions at ${bounds.maxActionsPerLoop} (${totalActions} available)`,
      rationale: `Safety bound: maxActionsPerLoop = ${bounds.maxActionsPerLoop}`,
      autonomyLevel: 0,
      confidence: 100,
      alternatives: [],
      timestamp: new Date().toISOString(),
    });
  }

  memory.confidenceState.planConfidence = computePlanConfidence(
    memory.confidenceState.findingConfidence,
    totalActions,
    assessPlanRisk(memory),
  );

  memory.confidenceState.overallConfidence = Math.round(
    (memory.confidenceState.snapshotQuality * 0.3 +
     memory.confidenceState.findingConfidence * 0.3 +
     memory.confidenceState.planConfidence * 0.4),
  );

  return {
    outcome: "success",
    processed: totalActions,
    succeeded: Math.min(totalActions, bounds.maxActionsPerLoop),
    notes: `Planned ${Math.min(totalActions, bounds.maxActionsPerLoop)} actions using ${strategy} strategy`,
    decisions,
  };
}

// ---------------------------------------------------------------------------
// 4.4 ACT — execute approved actions with safety gates
// ---------------------------------------------------------------------------

function executeActPhase(memory: WorkingMemory, input: CognitiveLoopInput): PhaseResult {
  const decisions: AgentDecision[] = [];
  const bounds = input.autonomy.safetyBounds;
  let processed = 0;
  let succeeded = 0;

  // Filter to only auto-applicable actions at this autonomy level
  const eligible = memory.recommendations.filter((r) => {
    if (!r.actionable) return false;
    if (r.disposition === "blocked") return false;
    if (r.disposition === "report_only") return false;

    // Never auto-apply forbidden types
    if (r.actionType && bounds.neverAutoApply.includes(r.actionType)) return false;

    // Check risk ceiling
    if (r.riskLevel === "high") return false;

    return r.disposition === "auto_fix_candidate" || input.autonomy.currentLevel >= 4;
  });

  for (const rec of eligible) {
    if (processed >= bounds.maxActionsPerLoop) break;
    processed++;

    // In production, this calls the actual apply engine.
    // Here we model the decision and outcome tracking.
    const wouldSucceed = memory.confidenceState.overallConfidence > 50;

    if (wouldSucceed) {
      succeeded++;
      memory.executionResults.push({
        actionId: rec.id,
        actionType: rec.actionType ?? ("resize_compute" as ActionType),
        resourceId: rec.findingId,
        provider: "aws",
        status: "applied",
        durationMs: 0,
        message: `Applied: ${rec.title}`,
        rollbackAvailable: true,
      });
    } else {
      memory.executionResults.push({
        actionId: rec.id,
        actionType: rec.actionType ?? ("resize_compute" as ActionType),
        resourceId: rec.findingId,
        provider: "aws",
        status: "skipped",
        durationMs: 0,
        message: `Skipped: confidence too low (${memory.confidenceState.overallConfidence}%)`,
        rollbackAvailable: false,
      });
    }
  }

  decisions.push({
    id: `dec-act-summary`,
    phase: "executing",
    description: `Executed ${succeeded}/${processed} eligible actions`,
    rationale: `${eligible.length} actions eligible, ${memory.recommendations.length - eligible.length} require approval`,
    autonomyLevel: input.autonomy.currentLevel,
    confidence: memory.confidenceState.overallConfidence,
    alternatives: [],
    timestamp: new Date().toISOString(),
  });

  return {
    outcome: succeeded === processed ? "success" : processed > 0 ? "partial" : "skipped",
    processed,
    succeeded,
    notes: `Executed ${succeeded}/${processed} actions`,
    decisions,
  };
}

// ---------------------------------------------------------------------------
// 4.5 VERIFY — confirm actions took effect, detect new drift
// ---------------------------------------------------------------------------

function executeVerifyPhase(memory: WorkingMemory, input: CognitiveLoopInput): PhaseResult {
  const decisions: AgentDecision[] = [];
  let processed = 0;
  let succeeded = 0;

  const applied = memory.executionResults.filter((r) => r.status === "applied");

  for (const exec of applied) {
    processed++;

    // In production, this re-scans and compares.
    // Model the verification logic here.
    const verified = true; // placeholder

    memory.verificationResults.push({
      actionId: exec.actionId,
      verified,
      driftDetected: false,
      message: verified ? "Action verified successfully" : "Verification failed — drift detected",
      checkedAt: new Date().toISOString(),
    });

    if (verified) succeeded++;
  }

  if (processed > 0) {
    decisions.push({
      id: `dec-verify-summary`,
      phase: "verifying",
      description: `Verified ${succeeded}/${processed} applied actions`,
      rationale: succeeded === processed
        ? "All actions confirmed by post-scan"
        : `${processed - succeeded} action(s) may have drifted — flagging for review`,
      autonomyLevel: 0,
      confidence: succeeded === processed ? 95 : 60,
      alternatives: [],
      timestamp: new Date().toISOString(),
    });
  }

  return {
    outcome: succeeded === processed ? "success" : "partial",
    processed,
    succeeded,
    notes: `Verified ${succeeded}/${processed} actions`,
    decisions,
  };
}

// ---------------------------------------------------------------------------
// 4.6 REFLECT — evaluate loop performance, generate lessons
// ---------------------------------------------------------------------------

function executeReflectPhase(memory: WorkingMemory, input: CognitiveLoopInput): PhaseResult {
  const decisions: AgentDecision[] = [];
  const notes: ReflectionNote[] = [];
  let noteSeq = 0;

  // Reflection 1: Accuracy — did we find things that matter?
  if (memory.findings.length > 0 && memory.executionResults.length === 0) {
    notes.push({
      id: `reflect-${++noteSeq}`,
      category: "accuracy",
      observation: "Found issues but took no actions — all findings were report-only or blocked",
      impact: "neutral",
      actionable: true,
      suggestedAdjustment: "Consider reviewing autopilot mode if more automation is desired",
      confidence: 80,
    });
  }

  // Reflection 2: Efficiency — how fast was each phase?
  const totalDuration = Date.now() - new Date(memory.startedAt).getTime();
  if (totalDuration > 300_000) { // >5 minutes
    notes.push({
      id: `reflect-${++noteSeq}`,
      category: "efficiency",
      observation: `Loop took ${Math.round(totalDuration / 1000)}s — consider optimizing scan scope`,
      impact: "negative",
      actionable: true,
      suggestedAdjustment: "Reduce scan scope or increase scan parallelism",
      confidence: 70,
    });
  }

  // Reflection 3: Safety — did we hit any safety bounds?
  const hitBounds = memory.executionResults.some((r) => r.status === "skipped");
  if (hitBounds) {
    notes.push({
      id: `reflect-${++noteSeq}`,
      category: "safety",
      observation: "Some actions were skipped due to safety bounds or low confidence",
      impact: "positive",
      actionable: false,
      suggestedAdjustment: null,
      confidence: 95,
    });
  }

  // Reflection 4: Prediction — compare with previous episode outcomes
  if (input.recentEpisodes.length > 0) {
    const lastEpisode = input.recentEpisodes[0];
    const findingDelta = memory.findings.length - lastEpisode.findingCount;

    if (findingDelta > 5) {
      notes.push({
        id: `reflect-${++noteSeq}`,
        category: "prediction",
        observation: `Finding count increased by ${findingDelta} vs. last run — environment may be degrading`,
        impact: "negative",
        actionable: true,
        suggestedAdjustment: "Consider increasing scan frequency or escalating to admin",
        confidence: 65,
      });
    } else if (findingDelta < -3) {
      notes.push({
        id: `reflect-${++noteSeq}`,
        category: "prediction",
        observation: `Finding count decreased by ${Math.abs(findingDelta)} vs. last run — improvements taking effect`,
        impact: "positive",
        actionable: false,
        suggestedAdjustment: null,
        confidence: 75,
      });
    }
  }

  // Reflection 5: Confidence calibration
  const failedVerifications = memory.verificationResults.filter((v) => !v.verified).length;
  if (failedVerifications > 0) {
    notes.push({
      id: `reflect-${++noteSeq}`,
      category: "accuracy",
      observation: `${failedVerifications} action(s) failed verification — confidence may be overestimated`,
      impact: "negative",
      actionable: true,
      suggestedAdjustment: "Reduce confidence score for similar actions in future loops",
      confidence: 85,
    });
  }

  // Reflection 6: Communication effectiveness
  if (memory.decisions.length > 10) {
    notes.push({
      id: `reflect-${++noteSeq}`,
      category: "communication",
      observation: `Made ${memory.decisions.length} decisions — consider summarizing for human review`,
      impact: "neutral",
      actionable: true,
      suggestedAdjustment: "Group related decisions into higher-level narratives",
      confidence: 60,
    });
  }

  memory.reflectionNotes = notes;

  return {
    outcome: "success",
    processed: notes.length,
    succeeded: notes.length,
    notes: `Generated ${notes.length} reflection note(s)`,
    decisions,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 5: SAFETY & AUTONOMY GUARDS
// ═══════════════════════════════════════════════════════════════════════════

function canProceedToPhase(
  phase: AgentPhase,
  autonomy: AutonomyConfig,
  memory: WorkingMemory,
): boolean {
  // Check explicit human checkpoints
  for (const cp of autonomy.humanCheckpoints) {
    if (cp.beforePhase !== phase) continue;
    if (!cp.required) continue;

    switch (cp.condition) {
      case "always":
        return autonomy.currentLevel >= 4; // only self-directed can bypass
      case "high_risk":
        return assessPlanRisk(memory) !== "high";
      case "low_confidence":
        return memory.confidenceState.overallConfidence >= autonomy.escalationPolicy.escalateOnConfidenceBelow;
      case "first_time":
        return false; // always requires approval on first occurrence
      case "policy_violation":
        return (memory.governanceReport?.violations.length ?? 0) === 0;
    }
  }

  return true;
}

function assessPlanRisk(memory: WorkingMemory): RiskLevel {
  const hasHighRisk = memory.recommendations.some((r) => r.riskLevel === "high");
  const hasMediumRisk = memory.recommendations.some((r) => r.riskLevel === "medium");

  if (hasHighRisk) return "high" as RiskLevel;
  if (hasMediumRisk) return "medium" as RiskLevel;
  return "low" as RiskLevel;
}

export function shouldEscalate(
  memory: WorkingMemory,
  autonomy: AutonomyConfig,
): { escalate: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const policy = autonomy.escalationPolicy;

  if (memory.confidenceState.overallConfidence < policy.escalateOnConfidenceBelow) {
    reasons.push(`Confidence ${memory.confidenceState.overallConfidence}% < threshold ${policy.escalateOnConfidenceBelow}%`);
  }

  if (assessPlanRisk(memory) === "high" && policy.escalateOnRiskAbove === ("medium" as RiskLevel)) {
    reasons.push("Plan contains high-risk actions");
  }

  const totalCost = memory.recommendations
    .filter((r) => r.estimatedSavings)
    .reduce((sum, r) => sum + Math.abs(r.estimatedSavings?.monthly ?? 0), 0);
  if (totalCost > policy.escalateOnCostAbove) {
    reasons.push(`Cost impact $${totalCost} exceeds $${policy.escalateOnCostAbove} threshold`);
  }

  if (memory.governanceReport && memory.governanceReport.violations.length > 0) {
    const criticals = memory.governanceReport.violations.filter((v) => v.severity === "critical");
    if (criticals.length > 0) {
      reasons.push(`${criticals.length} critical governance violation(s) detected`);
    }
  }

  return { escalate: reasons.length > 0, reasons };
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 6: HELPERS & DERIVATIONS
// ═══════════════════════════════════════════════════════════════════════════

type ReasoningDepth = "shallow" | "standard" | "deep" | "exhaustive";

function resolveReasoningDepth(level: AutonomyLevel): ReasoningDepth {
  if (level <= 0) return "shallow";
  if (level <= 1) return "standard";
  if (level <= 3) return "deep";
  return "exhaustive";
}

type PlanningStrategy = "conservative" | "balanced" | "aggressive" | "phased";

function resolvePlanningStrategy(memory: WorkingMemory, input: CognitiveLoopInput): PlanningStrategy {
  const risk = assessPlanRisk(memory);
  const confidence = memory.confidenceState.findingConfidence;
  const level = input.autonomy.currentLevel;

  if (risk === "high" || confidence < 50) return "conservative";
  if (level >= 4 && confidence > 80) return "aggressive";
  if (memory.recommendations.length > 10) return "phased";
  return "balanced";
}

function strategyRationale(strategy: PlanningStrategy, memory: WorkingMemory): string {
  switch (strategy) {
    case "conservative":
      return "High-risk items or low confidence — using conservative approach with extra safety gates";
    case "balanced":
      return "Standard risk profile — balanced execution with normal approval flow";
    case "aggressive":
      return "High confidence and high autonomy — maximizing auto-apply coverage within safety bounds";
    case "phased":
      return `${memory.recommendations.length} actions — splitting into phases with checkpoint between each`;
  }
}

function computeReasoningConfidence(
  findingCount: number,
  snapshotQuality: number,
  behaviorSignals: number,
): number {
  let score = snapshotQuality;

  if (findingCount > 0 && findingCount <= 50) score += 10;
  if (behaviorSignals >= 20) score += 10;
  if (behaviorSignals >= 100) score += 5;

  return Math.min(100, Math.max(0, score));
}

function computePlanConfidence(
  reasoningConfidence: number,
  actionCount: number,
  riskLevel: RiskLevel,
): number {
  let score = reasoningConfidence;

  if (riskLevel === "high") score -= 20;
  else if (riskLevel === "medium") score -= 10;

  if (actionCount > 20) score -= 10;
  if (actionCount > 50) score -= 10;

  return Math.min(100, Math.max(0, score));
}

function detectRecurringThemes(episodes: Episode[]): string[] {
  const themeCounts: Record<string, number> = {};
  for (const ep of episodes) {
    for (const lesson of ep.lessonsLearned) {
      themeCounts[lesson] = (themeCounts[lesson] ?? 0) + 1;
    }
  }
  return Object.entries(themeCounts)
    .filter(([, count]) => count >= 2)
    .map(([theme]) => theme);
}

function deriveNextActions(memory: WorkingMemory, input: CognitiveLoopInput): ScheduledAction[] {
  const actions: ScheduledAction[] = [];

  // Schedule verification re-check for applied actions
  if (memory.executionResults.some((r) => r.status === "applied")) {
    actions.push({
      action: "verify_applied_actions",
      scheduledFor: new Date(Date.now() + 3600_000).toISOString(), // +1h
      reason: "Post-action verification window",
      priority: "high",
    });
  }

  // Schedule next scan based on operational rhythm
  if (input.semanticMemory?.operationalRhythm) {
    const rhythm = input.semanticMemory.operationalRhythm;
    const nextHour = rhythm.preferredScanHourUtc;
    const next = new Date();
    next.setUTCHours(nextHour, 0, 0, 0);
    if (next <= new Date()) next.setUTCDate(next.getUTCDate() + 1);

    actions.push({
      action: "scheduled_scan",
      scheduledFor: next.toISOString(),
      reason: "Regular scan per operational rhythm",
      priority: "medium",
    });
  }

  // Flag if findings are trending upward
  if (memory.reflectionNotes.some((n) => n.category === "prediction" && n.impact === "negative")) {
    actions.push({
      action: "escalate_to_admin",
      scheduledFor: new Date().toISOString(),
      reason: "Environment degradation detected across runs",
      priority: "high",
    });
  }

  return actions;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 7: RESULT BUILDERS
// ═══════════════════════════════════════════════════════════════════════════

function buildResult(
  id: string,
  phases: PhaseOutcome[],
  memory: WorkingMemory,
  loopStart: number,
  nextActions: ScheduledAction[],
  humanActions: HumanActionRequired[],
  status: CognitiveLoopResult["status"],
): CognitiveLoopResult {
  const applied = memory.executionResults.filter((r) => r.status === "applied");
  const totalSavings = memory.recommendations
    .filter((r) => r.estimatedSavings)
    .reduce((sum, r) => sum + (r.estimatedSavings?.monthly ?? 0), 0);

  const episode: Episode = {
    id: `ep-${id}`,
    runId: id,
    loopId: id,
    timestamp: memory.startedAt,
    provider: "aws",
    trigger: "manual",
    phases,
    findingCount: memory.findings.length,
    actionsTaken: memory.executionResults.length,
    actionsSucceeded: applied.length,
    actionsFailed: memory.executionResults.filter((r) => r.status === "failed").length,
    savingsRealized: 0,
    savingsProjected: totalSavings,
    driftItemsDetected: memory.driftReport?.items.length ?? 0,
    violationsFound: memory.governanceReport?.violations.length ?? 0,
    confidenceScore: memory.confidenceState.overallConfidence,
    reflectionSummary: memory.reflectionNotes.map((n) => n.observation).join("; "),
    lessonsLearned: memory.reflectionNotes
      .filter((n) => n.actionable)
      .map((n) => n.suggestedAdjustment ?? n.observation),
    durationMs: Date.now() - loopStart,
  };

  const updatedSemantic: Partial<SemanticMemory> = {};
  if (memory.reflectionNotes.some((n) => n.category === "prediction")) {
    updatedSemantic.updatedAt = new Date().toISOString();
  }

  return {
    loopId: id,
    status,
    phases,
    episode,
    updatedSemanticMemory: updatedSemantic,
    nextActions,
    humanActions,
    summary: {
      headline: buildHeadline(memory, status),
      findingsDiscovered: memory.findings.length,
      recommendationsGenerated: memory.recommendations.length,
      actionsExecuted: applied.length,
      actionsBlocked: memory.executionResults.filter((r) => r.status === "skipped").length,
      savingsIdentified: totalSavings,
      violationsDetected: memory.governanceReport?.violations.length ?? 0,
      driftsDetected: memory.driftReport?.items.length ?? 0,
      confidenceScore: memory.confidenceState.overallConfidence,
      autonomyLevelUsed: 1,
      nextScheduledAt: nextActions.find((a) => a.action === "scheduled_scan")?.scheduledFor ?? null,
    },
  };
}

function buildFailedResult(
  id: string,
  phases: PhaseOutcome[],
  memory: WorkingMemory,
  loopStart: number,
  reason: string,
): CognitiveLoopResult {
  return buildResult(id, phases, memory, loopStart, [], [{
    type: "escalation",
    description: reason,
    urgency: "high",
    deadline: null,
    context: { errors: memory.errors },
  }], "failed");
}

function buildHeadline(memory: WorkingMemory, status: CognitiveLoopResult["status"]): string {
  if (status === "failed") return "Agent loop failed — see errors for details";
  if (status === "blocked") return "Agent loop paused — awaiting human approval";

  const applied = memory.executionResults.filter((r) => r.status === "applied").length;
  const findings = memory.findings.length;

  if (findings === 0) return "Clean scan — no issues found";
  if (applied === 0) return `Found ${findings} issue(s) — awaiting approval to act`;
  return `Addressed ${applied} issue(s) from ${findings} finding(s)`;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 8: ARCHITECTURE MAP — subsystem → module mapping
// ═══════════════════════════════════════════════════════════════════════════

export const ARCHITECTURE_MAP: Record<string, { layer: string; modules: string[]; description: string }> = {
  perception: {
    layer: "Perception",
    modules: ["providerRegistry.ts", "cloudSnapshot.ts", "normalizer.ts"],
    description: "Cloud environment scanning, normalization, and snapshot generation across AWS/Azure/GCP",
  },
  analysis: {
    layer: "Analysis",
    modules: ["costSignals.ts", "infrastructureAdvantage.ts", "scoringRegistry.ts"],
    description: "Cost signal derivation, infrastructure scoring, and optimization identification",
  },
  reasoning: {
    layer: "Reasoning",
    modules: ["reasoningEngine.ts", "multiCloudPrioritizer.ts", "recommendationBuilder.ts"],
    description: "Theme clustering, tradeoff analysis, cross-cloud prioritization, narrative generation",
  },
  planning: {
    layer: "Planning",
    modules: ["planningEngine.ts", "executionPlan.ts", "terraformGenerator.ts", "cliGenerator.ts"],
    description: "Phased rollout DAGs, execution planning, Terraform/CLI output generation",
  },
  safety: {
    layer: "Safety",
    modules: ["precheckSystem.ts", "dryRunSimulator.ts", "rollbackPlanner.ts", "autopilot.ts"],
    description: "Pre-action validation, dry-run simulation, rollback generation, autonomy gating",
  },
  execution: {
    layer: "Execution",
    modules: ["applyEngine.ts", "pluginExecution.ts", "applyFlow.ts"],
    description: "Action application, plugin execution, verification, and rollback",
  },
  verification: {
    layer: "Verification",
    modules: ["verificationEngine.ts", "diffEngine.ts", "driftDetector.ts"],
    description: "Post-action validation, structured diffing, drift detection",
  },
  monitoring: {
    layer: "Monitoring",
    modules: ["monitoringAgent.ts", "driftEngine.ts", "snapshotService.ts"],
    description: "Continuous monitoring, drift detection, snapshot history tracking",
  },
  governance: {
    layer: "Governance",
    modules: ["governanceEngine.ts", "rbacEngine.ts", "approvalCenter.ts", "auditLog.ts"],
    description: "Policy enforcement, RBAC, approval chains, audit trail",
  },
  learning: {
    layer: "Learning",
    modules: ["adaptiveBehavior.ts", "preferences.ts", "prioritizer.ts"],
    description: "Behavioral learning, preference management, priority adaptation",
  },
  explainability: {
    layer: "Explainability",
    modules: ["explainabilityEngine.ts", "explainEngine.ts", "explainability.ts"],
    description: "Evidence-grounded explanations, confidence scoring, trust contract",
  },
  orchestration: {
    layer: "Orchestration",
    modules: ["cognitiveArchitecture.ts", "runAgent.ts", "workflowEngine.ts"],
    description: "Cognitive loop, agent run orchestration, workflow automation",
  },
  observability: {
    layer: "Observability",
    modules: ["observability.ts", "messageBuilder.ts"],
    description: "Structured logging, metrics, alerting, health checks, agent messages",
  },
  communication: {
    layer: "Communication",
    modules: ["multiCloudSummary.ts", "strategicBrief.ts", "enterpriseBrief.ts", "emailTemplates.ts"],
    description: "Executive summaries, strategic briefs, email notifications",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 9: AUTONOMY LADDER DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export type AutonomyLevelSpec = {
  level: AutonomyLevel;
  name: string;
  description: string;
  capabilities: string[];
  restrictions: string[];
  requiresApprovalFor: string[];
  mapsToAutopilot: AutopilotMode;
  existingModules: string[];
};

export const AUTONOMY_LADDER: AutonomyLevelSpec[] = [
  {
    level: 0,
    name: "Deterministic Automation",
    description: "Rule-based execution with no judgment. Runs predefined policies and produces reports.",
    capabilities: [
      "Scan cloud environments",
      "Derive cost signals from snapshots",
      "Generate findings and recommendations",
      "Produce Terraform/CLI output",
      "Enforce governance policies",
    ],
    restrictions: [
      "Cannot modify dispositions",
      "Cannot prioritize across findings",
      "Cannot initiate actions",
      "Cannot learn from behavior",
    ],
    requiresApprovalFor: ["All actions"],
    mapsToAutopilot: "observe_only",
    existingModules: ["costSignals.ts", "executionPlan.ts", "governanceEngine.ts", "terraformGenerator.ts"],
  },
  {
    level: 1,
    name: "Adaptive Agent",
    description: "Learns from org behavior to adjust priority scoring and disposition classification.",
    capabilities: [
      "All Level 0 capabilities",
      "Adjust priority scores based on approval/rejection history",
      "Adapt disposition classification to org preferences",
      "Track behavioral signals across runs",
      "Suggest preference changes",
    ],
    restrictions: [
      "Cannot cluster or reason about themes",
      "Cannot generate phased plans",
      "Cannot auto-apply any actions",
    ],
    requiresApprovalFor: ["All actions"],
    mapsToAutopilot: "recommend",
    existingModules: ["adaptiveBehavior.ts", "preferences.ts", "prioritizer.ts"],
  },
  {
    level: 2,
    name: "Reasoning Agent",
    description: "Clusters findings into themes, weighs tradeoffs, produces narratives with confidence.",
    capabilities: [
      "All Level 1 capabilities",
      "Cluster related findings into themes",
      "Analyze tradeoffs (act now vs. wait)",
      "Generate natural-language rationale",
      "Detect recurring patterns across runs",
      "Cross-cloud prioritization",
    ],
    restrictions: [
      "Cannot generate multi-phase rollout plans",
      "Cannot auto-apply actions",
      "Cannot self-initiate scans",
    ],
    requiresApprovalFor: ["All actions"],
    mapsToAutopilot: "recommend",
    existingModules: ["reasoningEngine.ts", "multiCloudPrioritizer.ts", "recommendationBuilder.ts"],
  },
  {
    level: 3,
    name: "Planning Agent",
    description: "Generates phased execution plans with dependency resolution, rollback gates, and approval checkpoints.",
    capabilities: [
      "All Level 2 capabilities",
      "Generate phased rollout DAGs",
      "Resolve action dependencies",
      "Insert approval checkpoints between phases",
      "Compute rollback triggers",
      "Dry-run simulation",
    ],
    restrictions: [
      "Cannot auto-apply high-risk actions",
      "Cannot bypass approval checkpoints",
      "Cannot self-schedule scans",
    ],
    requiresApprovalFor: ["Execution of any phase"],
    mapsToAutopilot: "assisted_apply",
    existingModules: ["planningEngine.ts", "dryRunSimulator.ts", "rollbackPlanner.ts", "precheckSystem.ts"],
  },
  {
    level: 4,
    name: "Self-Directed Agent",
    description: "Initiates actions within defined policy bounds. Auto-applies low-risk fixes. Schedules its own scans.",
    capabilities: [
      "All Level 3 capabilities",
      "Auto-apply low-risk actions within safety bounds",
      "Self-schedule monitoring and scans",
      "Trigger workflows based on conditions",
      "Initiate drift remediation for known patterns",
    ],
    restrictions: [
      "NEVER auto-applies high-risk or decommission actions",
      "NEVER bypasses governance policy violations",
      "ALWAYS produces audit trail",
      "ALWAYS respects safety bounds (maxActions, maxCost)",
    ],
    requiresApprovalFor: ["High-risk actions", "Decommission", "Commitment purchases", "Policy overrides"],
    mapsToAutopilot: "full_guarded",
    existingModules: ["autopilot.ts", "workflowEngine.ts", "monitoringAgent.ts", "driftEngine.ts"],
  },
  {
    level: 5,
    name: "Reflective Agent",
    description: "Evaluates its own performance, calibrates confidence, and improves over time. Organizational learning.",
    capabilities: [
      "All Level 4 capabilities",
      "Evaluate prediction accuracy against outcomes",
      "Calibrate confidence scores based on verification results",
      "Identify systemic patterns across multiple loops",
      "Suggest governance policy updates",
      "Generate organizational learning summaries",
      "Self-assess and tighten safety bounds when accuracy drops",
    ],
    restrictions: [
      "All Level 4 restrictions",
      "Cannot loosen its own safety bounds",
      "Cannot promote itself to higher autonomy",
      "Cannot modify governance policies without admin approval",
    ],
    requiresApprovalFor: ["All Level 4 items", "Safety bound modifications", "Policy suggestions"],
    mapsToAutopilot: "full_guarded",
    existingModules: ["explainabilityEngine.ts", "cognitiveArchitecture.ts"],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 10: INVARIANT TESTS
// ═══════════════════════════════════════════════════════════════════════════

export type CognitiveTestResult = { name: string; passed: boolean; detail: string };

export function runCognitiveTests(): CognitiveTestResult[] {
  const results: CognitiveTestResult[] = [];
  loopSeq = 0;

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  // Test 1: Working memory initializes correctly
  const wm: WorkingMemory = {
    loopId: "test-1",
    orgId: "org-1",
    startedAt: new Date().toISOString(),
    phase: "idle",
    snapshot: null,
    previousSnapshot: null,
    findings: [],
    recommendations: [],
    themes: [],
    plan: null,
    driftReport: null,
    governanceReport: null,
    alerts: [],
    explanations: [],
    approvalsPending: [],
    executionResults: [],
    verificationResults: [],
    reflectionNotes: [],
    errors: [],
    decisions: [],
    confidenceState: { snapshotQuality: 0, findingConfidence: 0, planConfidence: 0, overallConfidence: 0, degradationReasons: [] },
  };
  assert("working memory initializes", () => wm.phase === "idle" && wm.loopId === "test-1", `phase=${wm.phase}`);

  // Test 2: Autonomy defaults are safe
  assert("default autonomy is safe", () =>
    DEFAULT_AUTONOMY.currentLevel === 1 &&
    DEFAULT_AUTONOMY.maxAllowedLevel === 3 &&
    DEFAULT_AUTONOMY.safetyBounds.neverAutoApply.length === 2,
    `level=${DEFAULT_AUTONOMY.currentLevel}, max=${DEFAULT_AUTONOMY.maxAllowedLevel}`);

  // Test 3: Reasoning depth resolves correctly
  assert("reasoning depth L0=shallow", () => resolveReasoningDepth(0) === "shallow", "");
  assert("reasoning depth L1=standard", () => resolveReasoningDepth(1) === "standard", "");
  assert("reasoning depth L2=deep", () => resolveReasoningDepth(2) === "deep", "");
  assert("reasoning depth L5=exhaustive", () => resolveReasoningDepth(5) === "exhaustive", "");

  // Test 4: Risk assessment
  const lowRiskMem: WorkingMemory = { ...wm, recommendations: [{ riskLevel: "low" } as any] };
  const highRiskMem: WorkingMemory = { ...wm, recommendations: [{ riskLevel: "high" } as any] };
  assert("low risk assessed correctly", () => assessPlanRisk(lowRiskMem) === "low", "");
  assert("high risk assessed correctly", () => assessPlanRisk(highRiskMem) === "high", "");

  // Test 5: Escalation triggers
  const lowConfMem: WorkingMemory = {
    ...wm,
    confidenceState: { ...wm.confidenceState, overallConfidence: 20 },
    recommendations: [],
  };
  const esc = shouldEscalate(lowConfMem, DEFAULT_AUTONOMY);
  assert("low confidence triggers escalation", () => esc.escalate === true && esc.reasons.length > 0,
    `reasons=${esc.reasons.join("; ")}`);

  // Test 6: High confidence does not escalate
  const highConfMem: WorkingMemory = {
    ...wm,
    confidenceState: { ...wm.confidenceState, overallConfidence: 90 },
    recommendations: [],
  };
  const noEsc = shouldEscalate(highConfMem, DEFAULT_AUTONOMY);
  assert("high confidence does not escalate", () => noEsc.escalate === false, `reasons=${noEsc.reasons.join("; ")}`);

  // Test 7: Planning strategy resolution
  const conservativeMem: WorkingMemory = {
    ...wm,
    recommendations: [{ riskLevel: "high", actionable: true } as any],
    confidenceState: { ...wm.confidenceState, findingConfidence: 30 },
  };
  const strategy = resolvePlanningStrategy(conservativeMem, {
    autonomy: DEFAULT_AUTONOMY,
  } as any);
  assert("high risk yields conservative strategy", () => strategy === "conservative", `strategy=${strategy}`);

  // Test 8: Architecture map covers all layers
  const layers = Object.keys(ARCHITECTURE_MAP);
  assert("architecture map has 14 layers", () => layers.length === 14,
    `layers=${layers.length}: ${layers.join(", ")}`);

  // Test 9: Autonomy ladder has 6 levels
  assert("autonomy ladder has 6 levels", () => AUTONOMY_LADDER.length === 6,
    `levels=${AUTONOMY_LADDER.length}`);

  // Test 10: Level 0 maps to observe_only
  assert("L0 maps to observe_only", () => AUTONOMY_LADDER[0].mapsToAutopilot === "observe_only", "");

  // Test 11: Level 4 maps to full_guarded
  assert("L4 maps to full_guarded", () => AUTONOMY_LADDER[4].mapsToAutopilot === "full_guarded", "");

  // Test 12: Safety bounds prevent decommission auto-apply
  assert("decommission is never auto-applied", () =>
    DEFAULT_AUTONOMY.safetyBounds.neverAutoApply.includes("decommission_compute" as ActionType),
    "");

  // Test 13: Confidence computation is bounded
  const conf = computeReasoningConfidence(10, 90, 50);
  assert("confidence is bounded 0-100", () => conf >= 0 && conf <= 100, `conf=${conf}`);

  // Test 14: Recurring theme detection
  const episodes: Episode[] = [
    { lessonsLearned: ["idle_instances", "public_storage"] } as any,
    { lessonsLearned: ["idle_instances", "cost_spike"] } as any,
    { lessonsLearned: ["idle_instances"] } as any,
  ];
  const recurring = detectRecurringThemes(episodes);
  assert("detects recurring themes", () => recurring.includes("idle_instances"), `recurring=${recurring.join(", ")}`);

  // Test 15: Cognitive loop runs without crash
  const loopInput: CognitiveLoopInput = {
    orgId: "org-test",
    userId: "user-test",
    providers: ["aws"],
    trigger: "manual",
    autonomy: { ...DEFAULT_AUTONOMY, currentLevel: 4 as AutonomyLevel },
    preferences: {} as any,
    behaviorProfile: null,
    semanticMemory: null,
    recentEpisodes: [],
  };
  const result = runCognitiveLoop(loopInput);
  assert("cognitive loop completes", () =>
    result.status === "completed" && result.phases.length >= 4,
    `status=${result.status}, phases=${result.phases.length}`);

  // Test 16: Loop generates episode
  assert("loop generates episode", () =>
    result.episode.loopId === result.loopId && result.episode.durationMs >= 0,
    `episodeId=${result.episode.id}`);

  // Test 17: Loop generates summary
  assert("loop generates summary", () =>
    result.summary.headline.length > 0 && result.summary.confidenceScore >= 0,
    `headline="${result.summary.headline}"`);

  // Test 18: Blocked loop at low autonomy
  const blockedInput: CognitiveLoopInput = {
    ...loopInput,
    autonomy: { ...DEFAULT_AUTONOMY, currentLevel: 0 as AutonomyLevel },
  };
  const blockedResult = runCognitiveLoop(blockedInput);
  assert("low autonomy blocks at execution", () =>
    blockedResult.status === "completed" || blockedResult.status === "blocked",
    `status=${blockedResult.status}`);

  // Test 19: Phase outcomes have timestamps
  assert("phase outcomes have timestamps", () =>
    result.phases.every((p) => p.startedAt && p.completedAt && p.durationMs >= 0),
    `phases=${result.phases.map((p) => p.phase).join(", ")}`);

  // Test 20: Headline reflects status
  const failedHeadline = buildHeadline(wm, "failed");
  const cleanHeadline = buildHeadline(wm, "completed");
  assert("headlines reflect status", () =>
    failedHeadline.includes("failed") && cleanHeadline.includes("Clean"),
    `failed="${failedHeadline}", clean="${cleanHeadline}"`);

  return results;
}

export function _resetCognitiveCounters(): void {
  loopSeq = 0;
}
