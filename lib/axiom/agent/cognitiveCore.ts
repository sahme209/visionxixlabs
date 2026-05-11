/**
 * Axiom Agent — Cognitive Core
 *
 * The next-generation reasoning engine for Axiom Agent. Extends the
 * existing 6-phase cognitiveArchitecture into a 9-phase pipeline with
 * explicit interpretation, prioritization, and learning phases.
 *
 * This module defines:
 *   1. The 9-phase cognitive loop architecture
 *   2. Short-term vs long-term context management
 *   3. Memory-influenced decision making
 *   4. Explainable reasoning contracts
 *   5. Safe autonomy boundaries
 *   6. Multi-subsystem coordination
 *   7. Unified multi-cloud cognitive model
 *   8. Confidence scoring and uncertainty propagation
 *   9. Failure recovery state machine
 *   10. Operational quality improvement lifecycle
 *
 * Relationship to cognitiveArchitecture.ts:
 *   cognitiveArchitecture.ts is the current runtime implementation.
 *   cognitiveCore.ts is the architectural specification for the next
 *   generation. It defines typed data structures, coordination protocols,
 *   and quality models that will evolve the runtime incrementally.
 *
 * Design philosophy:
 *   - The agent is a domain-specific operational intelligence system,
 *     not a general AI. It reasons about cloud infrastructure only.
 *   - Every decision has a typed evidence chain.
 *   - Uncertainty is propagated, not hidden.
 *   - Failure recovery is a first-class state, not an afterthought.
 *   - Learning is bounded, reversible, and auditable.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. COGNITIVE LOOP TYPES — THE 9-PHASE ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════

export type CognitivePhase =
  | "observe"        // Phase 1: Perceive the current state of cloud environments
  | "interpret"      // Phase 2: Normalize, classify, and attach meaning to observations
  | "reason"         // Phase 3: Cluster findings, weigh tradeoffs, derive insights
  | "prioritize"     // Phase 4: Rank actions by impact, risk, confidence, and org context
  | "plan"           // Phase 5: Sequence actions into phased execution DAGs
  | "execute"        // Phase 6: Apply approved changes with safety gates
  | "verify"         // Phase 7: Confirm actions achieved desired state
  | "reflect"        // Phase 8: Evaluate loop performance against predictions
  | "learn";         // Phase 9: Update memory, adapt behavior, tighten bounds

export type PhaseTransition = {
  from: CognitivePhase;
  to: CognitivePhase;
  condition: TransitionCondition;
  canSkip: boolean;
  humanGateRequired: boolean;
  rollbackTo: CognitivePhase | null;
};

export type TransitionCondition =
  | "always"                   // unconditional progression
  | "findings_exist"           // at least one finding produced
  | "plan_exists"              // execution plan generated
  | "approval_granted"         // human approved the plan
  | "execution_complete"       // all actions finished (success or failure)
  | "verification_complete"    // all post-checks finished
  | "confidence_above_threshold" // overall confidence ≥ threshold
  | "no_critical_errors";      // no unrecoverable errors in previous phase

export type PhaseDefinition = {
  phase: CognitivePhase;
  order: number;
  purpose: string;
  inputs: string[];
  outputs: string[];
  subsystemsInvoked: string[];
  decisionsMade: string[];
  confidenceContribution: string;
  failureMode: string;
  recoveryStrategy: string;
  maxDuration: string;
  autonomyMinimum: number;        // minimum autonomy level to enter this phase
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. PHASE DEFINITIONS — WHAT EACH PHASE DOES
// ═══════════════════════════════════════════════════════════════════════════

export const PHASE_DEFINITIONS: PhaseDefinition[] = [
  {
    phase: "observe",
    order: 1,
    purpose: "Perceive the current state of all connected cloud environments. Collect snapshots, metrics, events, and drift signals.",
    inputs: [
      "CloudAccount credentials",
      "Provider list (aws, azure, gcp)",
      "Scan configuration (regions, resource types)",
      "Previous snapshot (for diffing)",
    ],
    outputs: [
      "CloudSnapshot per provider",
      "QualityAssessment per snapshot",
      "SnapshotDelta (if previous exists)",
      "ProviderEvidence (API calls, errors, partial data)",
    ],
    subsystemsInvoked: [
      "providerRegistry.ts → adapter selection",
      "cloudSnapshot.ts → snapshot generation",
      "normalizer.ts → schema normalization",
      "monitoringAgent.ts → change detection",
    ],
    decisionsMade: [
      "Which providers to scan (based on account config)",
      "Which regions to include (based on preferences)",
      "Whether to use cached snapshot (if recent enough)",
      "How to handle partial API failures (continue vs abort)",
    ],
    confidenceContribution: "Snapshot quality score: 0-100 based on API success rate, metric availability, data freshness",
    failureMode: "No providers return valid data → loop cannot continue",
    recoveryStrategy: "Retry with exponential backoff. If 3 providers fail, degrade to last cached snapshot with reduced confidence.",
    maxDuration: "120 seconds per provider (360 total)",
    autonomyMinimum: 0,
  },
  {
    phase: "interpret",
    order: 2,
    purpose: "Attach meaning to raw observations. Classify resources, derive cost signals, detect anomalies, and identify findings.",
    inputs: [
      "Normalized CloudSnapshot",
      "QualityAssessment",
      "OrgPreferences (risk tolerance, business context)",
      "SemanticMemory (known exceptions, cost baselines)",
    ],
    outputs: [
      "AgentFinding[] (classified, scored, with evidence)",
      "CostSignal[] (derived from resource state)",
      "GovernanceReport (policy violations)",
      "AnomalyList (deviations from baseline)",
    ],
    subsystemsInvoked: [
      "costSignals.ts → cost signal derivation",
      "prioritizer.ts → disposition classification",
      "governanceEngine.ts → policy evaluation",
      "adaptiveBehavior.ts → behavioral adjustments",
      "explainabilityEngine.ts → evidence attachment",
    ],
    decisionsMade: [
      "Which findings to surface vs suppress (noise control)",
      "What disposition to assign (report_only, approval_required, auto_fix, blocked)",
      "Which known exceptions to exclude",
      "Whether anomalies are real or measurement artifacts",
    ],
    confidenceContribution: "Finding confidence: based on data quality, metric availability, and historical accuracy for similar findings",
    failureMode: "Classification engine produces no findings → skip to reflect phase",
    recoveryStrategy: "If partial data, classify what's available with reduced confidence. Flag gaps in evidence.",
    maxDuration: "30 seconds",
    autonomyMinimum: 0,
  },
  {
    phase: "reason",
    order: 3,
    purpose: "Move beyond individual findings to structural understanding. Cluster themes, analyze tradeoffs, detect trends, and generate narrative.",
    inputs: [
      "AgentFinding[] from interpret phase",
      "EpisodicMemory (past run outcomes)",
      "SemanticMemory (org patterns, baselines)",
      "BehaviorProfile (learned preferences)",
    ],
    outputs: [
      "Theme[] (clustered finding groups with narrative)",
      "Tradeoff[] (act now vs wait, cost vs risk)",
      "TrendAnalysis (improving vs degrading)",
      "ReasonedOutput (complete reasoning chain with evidence)",
    ],
    subsystemsInvoked: [
      "reasoningEngine.ts → theme clustering, tradeoff analysis",
      "multiCloudPrioritizer.ts → cross-cloud scoring",
      "memorySystem.ts → pattern retrieval",
      "reflectionEngine.ts → historical calibration data",
    ],
    decisionsMade: [
      "How to cluster findings into themes (category, provider, urgency)",
      "Whether to flag a trend as concerning (requires ≥3 data points)",
      "How to weight tradeoffs (org risk tolerance shapes this)",
      "What reasoning depth to use (shallow/standard/deep/exhaustive based on autonomy)",
    ],
    confidenceContribution: "Reasoning confidence: higher when multiple evidence types converge, lower when extrapolating from sparse data",
    failureMode: "Reasoning engine timeout → fallback to ungrouped finding list",
    recoveryStrategy: "Degrade gracefully: skip theme clustering, pass raw findings to prioritize phase",
    maxDuration: "15 seconds",
    autonomyMinimum: 2,
  },
  {
    phase: "prioritize",
    order: 4,
    purpose: "Rank all recommended actions by a composite score incorporating impact, risk, confidence, org context, and memory. This is where the agent's judgment is most visible.",
    inputs: [
      "ReasonedOutput from reason phase",
      "OrgPreferences (category priorities, ignored findings)",
      "BehaviorProfile (approval/rejection history)",
      "SemanticMemory (operational rhythm, freeze periods)",
      "GovernanceReport (policy enforcement levels)",
    ],
    outputs: [
      "PrioritizedRecommendation[] (ordered action list)",
      "ScoreBreakdown per recommendation (transparent scoring)",
      "FilteredOut[] (suppressed items with reasons)",
      "UrgentEscalations[] (items requiring immediate attention)",
    ],
    subsystemsInvoked: [
      "multiCloudPrioritizer.ts → cross-cloud scoring rules",
      "recommendationBuilder.ts → rich recommendation assembly",
      "preferences.ts → org preference application",
      "adaptiveBehavior.ts → behavioral score adjustments",
    ],
    decisionsMade: [
      "Final priority rank for each recommendation",
      "Whether to suppress low-confidence or previously-rejected items",
      "Whether any items require urgent escalation (critical severity + high confidence)",
      "How much to weight memory-based adjustments vs current evidence",
    ],
    confidenceContribution: "Prioritization confidence: based on signal count (more history = higher confidence), preference stability, and score spread",
    failureMode: "Scoring produces ties or all items score equally → fall back to severity-based ordering",
    recoveryStrategy: "Use deterministic severity×cost fallback ordering. Flag that adaptive scoring was unavailable.",
    maxDuration: "10 seconds",
    autonomyMinimum: 1,
  },
  {
    phase: "plan",
    order: 5,
    purpose: "Sequence approved/approvable actions into a phased execution DAG with dependency resolution, blast radius enforcement, canary gates, and rollback triggers.",
    inputs: [
      "PrioritizedRecommendation[] from prioritize phase",
      "AutonomyConfig (safety bounds, checkpoints)",
      "SemanticMemory (operational rhythm, change windows)",
      "ProviderCapabilities (what actions are actually implementable)",
    ],
    outputs: [
      "ExecutionPlan (phased DAG with dependencies)",
      "RollbackPlan per action (pre-state capture strategy)",
      "ApprovalCheckpoints (where human gates are inserted)",
      "RiskAssessment (blast radius, failure impact, rollback complexity)",
      "TerraformBlocks / CLICommands (per action)",
    ],
    subsystemsInvoked: [
      "planningEngine.ts → DAG construction, dependency resolution",
      "operationOrchestrator.ts → phased operation building",
      "toolFramework.ts → Terraform/CLI generation",
      "rollbackPlanner.ts → rollback strategy determination",
      "rbacEngine.ts → approval chain construction",
    ],
    decisionsMade: [
      "Execution order (topological sort of dependency graph)",
      "Batch size per phase (respecting blast radius limits)",
      "Where to insert canary gates (smallest scope first)",
      "Which actions need approval vs auto-apply (based on autopilot mode + risk)",
      "What rollback strategy per action (snapshot, API revert, terraform destroy)",
    ],
    confidenceContribution: "Plan confidence: lower when actions have interdependencies, higher when each step is independently rollbackable",
    failureMode: "Dependency cycle detected → reject plan, request human decomposition",
    recoveryStrategy: "Break cycles by splitting into independent sub-plans. Each sub-plan has its own approval checkpoint.",
    maxDuration: "20 seconds",
    autonomyMinimum: 3,
  },
  {
    phase: "execute",
    order: 6,
    purpose: "Apply approved changes to cloud infrastructure. Each action follows: pre-check → state capture → dry-run → execute → audit log.",
    inputs: [
      "Approved ExecutionPlan",
      "ProviderCredentials (from vault)",
      "SafetyBounds (max actions, max cost, forbidden types)",
      "RollbackPlan per action",
    ],
    outputs: [
      "ExecutionResult per action (success/failure/skipped/rolled_back)",
      "AuditEntry per action (immutable record with before/after state)",
      "RollbackRecords (state captured for potential restoration)",
      "ProviderResponses (raw API responses for debugging)",
    ],
    subsystemsInvoked: [
      "runAgent.ts → apply handler orchestration",
      "toolFramework.ts → tool invocation with retry",
      "operationOrchestrator.ts → phased execution coordination",
      "observability.ts → audit logging, metrics, correlation IDs",
      "credentials.ts → credential retrieval per action",
    ],
    decisionsMade: [
      "Whether to proceed after each action (stop-on-failure vs continue)",
      "Whether dry-run results indicate safe to proceed",
      "Whether to initiate rollback (automatic on failure)",
      "Whether to pause for canary validation between phases",
    ],
    confidenceContribution: "Execution confidence: binary (succeeded or didn't). Feeds back to update finding confidence for future loops.",
    failureMode: "Action fails → automatic rollback → operation paused → human notified",
    recoveryStrategy: "Restore pre-state from captured snapshot. If rollback fails, escalate immediately. Never retry a failed mutation without human approval.",
    maxDuration: "300 seconds per action, 1800 seconds total",
    autonomyMinimum: 3,
  },
  {
    phase: "verify",
    order: 7,
    purpose: "Confirm that executed actions achieved the desired state. Detect unintended side effects. Re-scan affected resources.",
    inputs: [
      "ExecutionResult[] from execute phase",
      "Pre-state snapshots (captured before execution)",
      "Expected state (from execution plan)",
      "VerificationCriteria (success conditions per action)",
    ],
    outputs: [
      "VerificationResult per action (verified/failed/drift_detected)",
      "SideEffectReport (unintended changes detected)",
      "DriftReport (new drift since execution)",
      "HealthCheckResult (overall system health post-execution)",
    ],
    subsystemsInvoked: [
      "verificationEngine.ts → success criteria checking",
      "driftEngine.ts → drift detection against expected state",
      "monitoringAgent.ts → post-execution health check",
      "providerRegistry.ts → targeted re-scan of affected resources",
    ],
    decisionsMade: [
      "Whether verification passed (all criteria met)",
      "Whether to trigger rollback for partially-verified actions",
      "Whether detected drift is agent-caused or external",
      "Whether to schedule follow-up verification (delayed effects)",
    ],
    confidenceContribution: "Verification confidence: 100 if all criteria pass, proportionally lower for partial verification. Critical feedback signal for calibration.",
    failureMode: "Verification fails for ≥1 action → flag for review, schedule rollback if criteria violated",
    recoveryStrategy: "Re-scan in 5 minutes (delayed convergence). If still failing, initiate rollback and escalate.",
    maxDuration: "60 seconds per action",
    autonomyMinimum: 0,
  },
  {
    phase: "reflect",
    order: 8,
    purpose: "Evaluate the entire loop's performance. Compare predictions to outcomes. Identify what went well and what went wrong. Calibrate confidence.",
    inputs: [
      "All phase outcomes from this loop",
      "Predictions made during reason/prioritize phases",
      "Actual outcomes from execute/verify phases",
      "EpisodicMemory (for trend comparison)",
    ],
    outputs: [
      "ReflectionReport (per-dimension grades)",
      "CalibrationUpdate (confidence adjustments)",
      "NoiseAnalysis (what should have been suppressed)",
      "SafetyReview (were safety bounds appropriate?)",
      "PerformanceMetrics (accuracy, efficiency, safety scores)",
    ],
    subsystemsInvoked: [
      "reflectionEngine.ts → 7-domain evaluation",
      "workflowIntelligence.ts → pattern discovery",
      "explainabilityEngine.ts → confidence assessment",
      "observability.ts → performance metrics recording",
    ],
    decisionsMade: [
      "Was the agent's confidence calibrated? (predicted success matched actual)",
      "Were any findings noise? (surfaced but never acted on across multiple loops)",
      "Were safety bounds too tight? (useful actions blocked unnecessarily)",
      "Were safety bounds too loose? (actions that should have been blocked weren't)",
      "Note: reflection can only TIGHTEN safety, never loosen it",
    ],
    confidenceContribution: "Reflection produces calibration adjustments that feed into future loops. This is how the agent's confidence scoring improves over time.",
    failureMode: "Reflection never fails — it always produces output even if sparse",
    recoveryStrategy: "If insufficient data for reflection, produce minimal report with 'insufficient data' notes",
    maxDuration: "10 seconds",
    autonomyMinimum: 5,
  },
  {
    phase: "learn",
    order: 9,
    purpose: "Persist lessons to memory. Update behavioral models. Record this loop as an episode. Derive organizational knowledge. Schedule follow-ups.",
    inputs: [
      "ReflectionReport from reflect phase",
      "CalibrationUpdate",
      "This loop's Episode record",
      "Current SemanticMemory",
      "Current BehaviorProfile",
    ],
    outputs: [
      "Updated SemanticMemory (patterns, baselines, exceptions)",
      "Updated BehaviorProfile (signal counts, rate distributions)",
      "New Episode stored in EpisodicMemory",
      "AdaptiveAdjustments (bounded changes to scoring weights)",
      "ScheduledActions (follow-up scans, verification re-checks)",
    ],
    subsystemsInvoked: [
      "memorySystem.ts → episode recording, memory updates",
      "adaptiveBehavior.ts → behavioral signal processing",
      "workflowIntelligence.ts → adaptation lifecycle",
      "cognitiveArchitecture.ts → next action scheduling",
    ],
    decisionsMade: [
      "What patterns to persist vs what's noise",
      "Whether to update cost baselines (requires ≥3 stable data points)",
      "Whether to suggest governance policy adjustments (requires admin review)",
      "What follow-up actions to schedule (verification, re-scan, escalation)",
      "Whether to flag this loop's outcomes for human review",
    ],
    confidenceContribution: "Learn phase doesn't contribute to this loop's confidence — it improves future loops.",
    failureMode: "Memory write failure → log warning, proceed without persistence. Learning is not blocking.",
    recoveryStrategy: "Queue memory updates for retry. Loop completes successfully even if learning fails.",
    maxDuration: "5 seconds",
    autonomyMinimum: 1,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. PHASE TRANSITIONS — STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════

export const PHASE_TRANSITIONS: PhaseTransition[] = [
  { from: "observe",    to: "interpret",   condition: "no_critical_errors",        canSkip: false, humanGateRequired: false, rollbackTo: null },
  { from: "interpret",  to: "reason",      condition: "findings_exist",            canSkip: true,  humanGateRequired: false, rollbackTo: null },
  { from: "reason",     to: "prioritize",  condition: "always",                    canSkip: false, humanGateRequired: false, rollbackTo: null },
  { from: "prioritize", to: "plan",        condition: "findings_exist",            canSkip: true,  humanGateRequired: false, rollbackTo: null },
  { from: "plan",       to: "execute",     condition: "approval_granted",          canSkip: true,  humanGateRequired: true,  rollbackTo: "plan" },
  { from: "execute",    to: "verify",      condition: "execution_complete",        canSkip: false, humanGateRequired: false, rollbackTo: "plan" },
  { from: "verify",     to: "reflect",     condition: "verification_complete",     canSkip: false, humanGateRequired: false, rollbackTo: null },
  { from: "reflect",    to: "learn",       condition: "always",                    canSkip: false, humanGateRequired: false, rollbackTo: null },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. CONTEXT MANAGEMENT — SHORT-TERM vs LONG-TERM
// ═══════════════════════════════════════════════════════════════════════════

export type ContextType = "short_term" | "long_term";

export type ContextLayer = {
  name: string;
  type: ContextType;
  lifetime: string;
  scope: string;
  storageLocation: string;
  maxSize: string;
  evictionPolicy: string;
  influenceOn: string[];
  description: string;
};

export const CONTEXT_LAYERS: ContextLayer[] = [
  {
    name: "Working Memory",
    type: "short_term",
    lifetime: "Single cognitive loop (minutes)",
    scope: "Current scan/execution cycle",
    storageLocation: "In-memory (TypeScript runtime)",
    maxSize: "Unbounded for single loop",
    evictionPolicy: "Discarded after loop completes. Episode summary persisted to episodic memory.",
    influenceOn: ["All phase decisions within the current loop"],
    description: "Ephemeral context for the current cognitive loop. Contains snapshot, findings, plan, execution results, and reflection notes. Destroyed after each loop.",
  },
  {
    name: "Episodic Memory",
    type: "long_term",
    lifetime: "Months to years (configurable retention)",
    scope: "Per-org history of all agent loops",
    storageLocation: "PostgreSQL (AxiomAgentRun + related tables)",
    maxSize: "100 episodes per org (oldest aged out)",
    evictionPolicy: "Aging with confidence decay. Old episodes compress into statistical summaries.",
    influenceOn: ["reason (recurring themes)", "prioritize (historical accuracy)", "reflect (trend comparison)", "learn (pattern persistence)"],
    description: "History of past agent runs. Records what was found, what was done, what succeeded, what failed, and what was learned. Used to detect trends and avoid repeating mistakes.",
  },
  {
    name: "Semantic Memory",
    type: "long_term",
    lifetime: "Persistent (updated incrementally)",
    scope: "Per-org organizational knowledge",
    storageLocation: "PostgreSQL (to be migrated from in-memory)",
    maxSize: "Bounded per field (e.g., max 50 resource patterns, max 20 known exceptions)",
    evictionPolicy: "Patterns decay in confidence over time. Low-confidence patterns eventually dropped.",
    influenceOn: ["interpret (known exceptions)", "reason (cost baselines)", "plan (operational rhythm)", "prioritize (org risk profile)"],
    description: "What the agent knows about this organization: cost baselines, risk tolerance, preferred providers, operational rhythms, known exceptions. Evolves slowly based on accumulated evidence.",
  },
  {
    name: "Procedural Memory",
    type: "long_term",
    lifetime: "Persistent (updated on successful patterns)",
    scope: "Per-org execution strategies",
    storageLocation: "PostgreSQL (to be migrated from in-memory)",
    maxSize: "Bounded per field (max 30 strategies, max 10 escalation patterns)",
    evictionPolicy: "Strategies validated by outcomes persist. Unvalidated strategies decay.",
    influenceOn: ["plan (execution strategy selection)", "execute (retry/fallback selection)", "learn (strategy recording)"],
    description: "How to do things: execution strategies that have worked before, rollback playbooks, escalation patterns. Built from successful (and failed) executions.",
  },
  {
    name: "Organizational Memory",
    type: "long_term",
    lifetime: "Persistent (evolves with org changes)",
    scope: "Per-org identity, culture, and compliance posture",
    storageLocation: "PostgreSQL (to be migrated from in-memory)",
    maxSize: "Small (org profile data, not resource-level)",
    evictionPolicy: "Refreshed when org config changes. Stale fields flagged for review.",
    influenceOn: ["prioritize (decision culture)", "reason (compliance posture)", "plan (team structure)"],
    description: "Who this organization is: team structure, compliance requirements, decision-making culture, custom policies. Changes rarely but influences every loop.",
  },
  {
    name: "Provider Context",
    type: "short_term",
    lifetime: "Current loop (refreshed per scan)",
    scope: "Per-provider API state",
    storageLocation: "In-memory (part of working memory)",
    maxSize: "Per-provider credential + config",
    evictionPolicy: "Discarded after loop. Credentials never persisted in working memory.",
    influenceOn: ["observe (which APIs to call)", "execute (which provider adapter to use)"],
    description: "Provider-specific context for the current loop: credentials, region list, API rate limit state, partial error tracking. Ephemeral and credential-sensitive.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. MEMORY-INFLUENCED DECISION MAKING
// ═══════════════════════════════════════════════════════════════════════════

export type MemoryInfluence = {
  decisionPoint: string;
  phase: CognitivePhase;
  memoryType: string;
  influence: string;
  weight: string;
  example: string;
  safeguard: string;
};

export const MEMORY_INFLUENCES: MemoryInfluence[] = [
  {
    decisionPoint: "Finding suppression",
    phase: "interpret",
    memoryType: "Semantic (known exceptions)",
    influence: "Resources in the known exceptions list are excluded from findings",
    weight: "Binary: excluded or not. Exception must be non-expired and admin-created.",
    example: "A dev instance intentionally oversized for testing is excluded from right-sizing recommendations",
    safeguard: "Exceptions expire after configured TTL. Security findings are never suppressible.",
  },
  {
    decisionPoint: "Disposition classification",
    phase: "interpret",
    memoryType: "Behavioral (approval/rejection history)",
    influence: "If an org consistently rejects a finding type, shift disposition toward report_only",
    weight: "Max ±20% adjustment. Requires ≥10 signals for the finding type.",
    example: "Org rejects 90% of dev instance resize recommendations → disposition shifts from approval_required to report_only",
    safeguard: "Adjustments are transparent, reversible, and capped. Security dispositions cannot be weakened.",
  },
  {
    decisionPoint: "Priority scoring",
    phase: "prioritize",
    memoryType: "Behavioral (category rates, provider activity)",
    influence: "Boost categories that org acts on frequently. Reduce categories that are consistently ignored.",
    weight: "±15% score adjustment based on historical action rates",
    example: "Org frequently acts on cost findings but ignores resilience → cost findings score higher in priority",
    safeguard: "All adjustments visible in ScoreBreakdown. Can be overridden by admin preferences.",
  },
  {
    decisionPoint: "Recurring theme detection",
    phase: "reason",
    memoryType: "Episodic (past run summaries)",
    influence: "If the same finding appears in ≥3 consecutive loops, flag it as a systemic issue worth escalating",
    weight: "Escalation suggestion only. Does not auto-escalate.",
    example: "Idle instance finding recurs for 4 weeks → agent notes 'This issue has persisted across 4 scans. Consider batch action.'",
    safeguard: "Recurring does not mean urgent. Agent suggests, human decides.",
  },
  {
    decisionPoint: "Execution strategy selection",
    phase: "plan",
    memoryType: "Procedural (past successful strategies)",
    influence: "If a similar operation succeeded before with a specific strategy, prefer that strategy",
    weight: "Strategy suggestion with confidence score. Human can override.",
    example: "Previous EC2 right-sizing used canary-first in us-east-1 and succeeded → suggest same approach",
    safeguard: "Past success doesn't guarantee future success. Confidence degrades with time since last validation.",
  },
  {
    decisionPoint: "Confidence calibration",
    phase: "reflect",
    memoryType: "Episodic (predicted vs actual outcomes)",
    influence: "If the agent consistently over-predicts success rate, reduce confidence scores for similar actions",
    weight: "±10% calibration adjustment per reflection cycle",
    example: "Agent predicted 95% success for S3 lifecycle changes but actual was 80% → reduce S3 lifecycle confidence by 10%",
    safeguard: "Calibration is always conservative: on uncertainty, lower confidence (not raise it).",
  },
  {
    decisionPoint: "Operational rhythm compliance",
    phase: "plan",
    memoryType: "Semantic (change windows, freeze periods)",
    influence: "Schedule executions within the org's preferred change window. Refuse to schedule during freeze periods.",
    weight: "Hard constraint: freeze periods are never violated. Change windows are preferred but not mandatory for urgent fixes.",
    example: "Org defines change window as 02:00-06:00 UTC. Agent schedules batch operations within that window.",
    safeguard: "Freeze periods cannot be overridden by the agent. Only admin can lift a freeze.",
  },
  {
    decisionPoint: "Cost baseline comparison",
    phase: "interpret",
    memoryType: "Semantic (cost baselines per provider)",
    influence: "If current costs are significantly above baseline, flag as anomaly and prioritize cost findings",
    weight: "Anomaly if >20% above rolling 30-day baseline",
    example: "Monthly AWS spend jumped from $12K baseline to $18K → agent flags cost anomaly and elevates cost findings",
    safeguard: "Baselines require ≥3 stable data points to establish. New orgs don't have baselines (no false anomalies).",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 6. EXPLAINABLE REASONING CONTRACT
// ═══════════════════════════════════════════════════════════════════════════

export type ExplainabilityRequirement = {
  decisionType: string;
  evidenceRequired: string[];
  confidenceRequired: boolean;
  assumptionsRequired: boolean;
  alternativesRequired: boolean;
  humanReadable: boolean;
  auditPersisted: boolean;
};

export const EXPLAINABILITY_CONTRACT: ExplainabilityRequirement[] = [
  {
    decisionType: "Finding classification",
    evidenceRequired: ["Resource state data", "Threshold comparison", "Provider metric source"],
    confidenceRequired: true,
    assumptionsRequired: true,
    alternativesRequired: false,
    humanReadable: true,
    auditPersisted: true,
  },
  {
    decisionType: "Priority scoring",
    evidenceRequired: ["Score breakdown by dimension", "Behavioral adjustments applied", "Preference overrides"],
    confidenceRequired: true,
    assumptionsRequired: false,
    alternativesRequired: false,
    humanReadable: true,
    auditPersisted: true,
  },
  {
    decisionType: "Execution plan ordering",
    evidenceRequired: ["Dependency graph", "Risk assessment per step", "Blast radius computation"],
    confidenceRequired: true,
    assumptionsRequired: true,
    alternativesRequired: true,
    humanReadable: true,
    auditPersisted: true,
  },
  {
    decisionType: "Auto-apply decision",
    evidenceRequired: ["Autopilot mode", "Risk level", "Safety bounds check", "Approval chain resolution"],
    confidenceRequired: true,
    assumptionsRequired: true,
    alternativesRequired: true,
    humanReadable: true,
    auditPersisted: true,
  },
  {
    decisionType: "Rollback trigger",
    evidenceRequired: ["Failure details", "Pre-state captured", "Verification criteria that failed"],
    confidenceRequired: false,
    assumptionsRequired: false,
    alternativesRequired: false,
    humanReadable: true,
    auditPersisted: true,
  },
  {
    decisionType: "Behavioral adaptation",
    evidenceRequired: ["Signal count", "Current vs proposed adjustment", "Safeguard check result"],
    confidenceRequired: true,
    assumptionsRequired: false,
    alternativesRequired: true,
    humanReadable: true,
    auditPersisted: true,
  },
  {
    decisionType: "Suppression decision",
    evidenceRequired: ["Suppression rule matched", "Historical false-positive rate", "Override option"],
    confidenceRequired: true,
    assumptionsRequired: true,
    alternativesRequired: false,
    humanReadable: true,
    auditPersisted: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 7. SAFE AUTONOMY BOUNDARIES
// ═══════════════════════════════════════════════════════════════════════════

export type AutonomyBoundary = {
  name: string;
  description: string;
  enforcement: string;
  violationResponse: string;
  canBeRelaxed: boolean;
  relaxedBy: string;               // "never" or role that can relax
};

export const AUTONOMY_BOUNDARIES: AutonomyBoundary[] = [
  {
    name: "No self-promotion",
    description: "Agent cannot increase its own autonomy level through any code path",
    enforcement: "Autopilot mode change requires admin role (RBAC-enforced). No API endpoint accepts autonomy increase from agent context.",
    violationResponse: "Immediate mode lock to observe_only. Security incident created.",
    canBeRelaxed: false,
    relaxedBy: "never",
  },
  {
    name: "Blast radius ceiling",
    description: "No single execution step affects more than 50 resources",
    enforcement: "operationOrchestrator.ts validates step scope before execution. Steps exceeding limit are split.",
    violationResponse: "Step rejected. Operation paused. Replanning required.",
    canBeRelaxed: true,
    relaxedBy: "owner (org owner role only)",
  },
  {
    name: "Cost impact ceiling",
    description: "No single loop can commit to more than $10,000 in infrastructure changes",
    enforcement: "Plan phase computes estimated cost impact. Exceeding ceiling requires explicit admin approval.",
    violationResponse: "Plan split into smaller chunks. Each chunk independently approved.",
    canBeRelaxed: true,
    relaxedBy: "admin",
  },
  {
    name: "Forbidden action types",
    description: "Certain action types (decommission_compute, purchase_commitment) never auto-apply regardless of autonomy level",
    enforcement: "Safety bounds neverAutoApply list checked before every execution.",
    violationResponse: "Action routed to approval workflow. Cannot bypass.",
    canBeRelaxed: true,
    relaxedBy: "owner (requires explicit per-action-class opt-in)",
  },
  {
    name: "Reflection cannot loosen safety",
    description: "The reflect/learn phases can only tighten safety bounds, never loosen them",
    enforcement: "Adjustment delta checked: if it would increase risk tolerance or reduce approval requirements, it's rejected.",
    violationResponse: "Adjustment rejected. Governance event logged.",
    canBeRelaxed: false,
    relaxedBy: "never",
  },
  {
    name: "Freeze period respect",
    description: "Agent will not execute changes during declared freeze periods, regardless of urgency",
    enforcement: "Plan phase checks operational rhythm freeze periods. Execution deferred to after freeze.",
    violationResponse: "Execution scheduled for after freeze ends. Urgent items escalated to human.",
    canBeRelaxed: true,
    relaxedBy: "admin (explicit freeze override per action)",
  },
  {
    name: "First-time escalation",
    description: "First occurrence of any new action type or resource type always requires human approval",
    enforcement: "Episodic memory checked for prior occurrences. No history = mandatory approval.",
    violationResponse: "Action routed to approval workflow with 'first occurrence' flag.",
    canBeRelaxed: false,
    relaxedBy: "never",
  },
  {
    name: "Credential scope limitation",
    description: "Agent can only access credentials for accounts explicitly connected by the org admin",
    enforcement: "Credential broker validates account ownership before credential retrieval.",
    violationResponse: "Credential request denied. Security event logged.",
    canBeRelaxed: false,
    relaxedBy: "never",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 8. SUBSYSTEM COORDINATION MODEL
// ═══════════════════════════════════════════════════════════════════════════

export type SubsystemCoordination = {
  coordinator: string;
  subsystem: string;
  interactionType: "invokes" | "queries" | "writes" | "subscribes" | "validates";
  phases: CognitivePhase[];
  dataFlow: string;
  errorHandling: string;
};

export const COORDINATION_MAP: SubsystemCoordination[] = [
  // Terraform generation
  { coordinator: "cognitiveCore", subsystem: "toolFramework.ts",      interactionType: "invokes", phases: ["plan"],                     dataFlow: "Recommendation → TerraformBlock + CLICommand", errorHandling: "Generation failure → skip code output, show manual instructions" },
  // Cloud APIs
  { coordinator: "cognitiveCore", subsystem: "providerRegistry.ts",   interactionType: "invokes", phases: ["observe", "execute", "verify"], dataFlow: "ProviderConfig → CloudSnapshot / ExecutionResult", errorHandling: "API failure → retry with backoff, degrade to cached data" },
  // Approval workflows
  { coordinator: "cognitiveCore", subsystem: "rbacEngine.ts",         interactionType: "queries", phases: ["plan", "execute"],           dataFlow: "ActionPlan → ApprovalChain → VoteResult", errorHandling: "Approval timeout → default action (abort or escalate per config)" },
  // Rollback systems
  { coordinator: "cognitiveCore", subsystem: "rollbackPlanner.ts",    interactionType: "invokes", phases: ["plan", "execute"],           dataFlow: "Action → RollbackPlan → RollbackExecution", errorHandling: "Rollback failure → immediate human escalation (never retry automatically)" },
  // Monitoring systems
  { coordinator: "cognitiveCore", subsystem: "monitoringAgent.ts",    interactionType: "queries", phases: ["observe", "verify"],         dataFlow: "Snapshot → SnapshotDelta → MonitorAlert", errorHandling: "Monitoring failure → proceed without monitoring data, flag reduced confidence" },
  // Reasoning engine
  { coordinator: "cognitiveCore", subsystem: "reasoningEngine.ts",    interactionType: "invokes", phases: ["reason"],                    dataFlow: "Findings → Themes + Tradeoffs + Narrative", errorHandling: "Timeout → fallback to ungrouped findings" },
  // Memory system
  { coordinator: "cognitiveCore", subsystem: "memorySystem.ts",       interactionType: "writes",  phases: ["interpret", "reason", "learn"], dataFlow: "Episode + Patterns → Memory Updates", errorHandling: "Write failure → queue for retry. Loop proceeds." },
  // Governance engine
  { coordinator: "cognitiveCore", subsystem: "governanceEngine.ts",   interactionType: "queries", phases: ["interpret", "plan"],         dataFlow: "Snapshot + Policies → GovernanceReport", errorHandling: "Evaluation failure → all actions require approval (fail-safe)" },
  // Reflection engine
  { coordinator: "cognitiveCore", subsystem: "reflectionEngine.ts",   interactionType: "invokes", phases: ["reflect"],                   dataFlow: "LoopOutcomes → ReflectionReport + CalibrationUpdate", errorHandling: "Reflection always succeeds (produces minimal report if sparse data)" },
  // Workflow intelligence
  { coordinator: "cognitiveCore", subsystem: "workflowIntelligence.ts", interactionType: "queries", phases: ["learn"],                   dataFlow: "Observations → Patterns + Adaptations", errorHandling: "Pattern discovery failure → skip adaptation, no harm" },
  // Explainability engine
  { coordinator: "cognitiveCore", subsystem: "explainabilityEngine.ts", interactionType: "invokes", phases: ["interpret", "prioritize"], dataFlow: "Finding → Explanation + ConfidenceAssessment", errorHandling: "Explanation failure → finding still surfaced but marked 'explanation unavailable'" },
  // Observability
  { coordinator: "cognitiveCore", subsystem: "observability.ts",      interactionType: "writes",  phases: ["observe", "interpret", "reason", "prioritize", "plan", "execute", "verify", "reflect", "learn"], dataFlow: "StructuredLogs + Metrics + AuditEntries at every phase", errorHandling: "Logging failure → stderr fallback. Never blocks main loop." },
  // Adaptive behavior
  { coordinator: "cognitiveCore", subsystem: "adaptiveBehavior.ts",   interactionType: "queries", phases: ["interpret", "prioritize"],  dataFlow: "BehaviorProfile → AdaptiveAdjustments", errorHandling: "Adaptation failure → use default scoring (no adjustments)" },
  // Autopilot
  { coordinator: "cognitiveCore", subsystem: "autopilot.ts",          interactionType: "queries", phases: ["plan", "execute"],           dataFlow: "AutopilotMode → PolicyDecision → Proceed/Block", errorHandling: "Mode resolution failure → default to observe_only (most restrictive)" },
];

// ═══════════════════════════════════════════════════════════════════════════
// 9. MULTI-CLOUD COGNITIVE MODEL
// ═══════════════════════════════════════════════════════════════════════════

export type MultiCloudCognition = {
  name: string;
  description: string;
  howItWorks: string;
  providerSpecificLogic: string;
  providerAgnosticLogic: string;
};

export const MULTI_CLOUD_COGNITION: MultiCloudCognition[] = [
  {
    name: "Unified observation",
    description: "Single observe phase scans all connected providers. Each provider uses its own adapter but produces the same CloudSnapshot schema.",
    howItWorks: "Provider adapters run in parallel (aws || azure || gcp). Results normalized into CloudSnapshot[]. Quality scored independently per provider.",
    providerSpecificLogic: "API calls, credential handling, metric collection, error handling for each provider's quirks",
    providerAgnosticLogic: "Snapshot quality scoring, scan orchestration, timeout management, retry policy",
  },
  {
    name: "Cross-cloud interpretation",
    description: "Findings classified using the same rules regardless of provider. Provider-specific context enriches but doesn't change classification logic.",
    howItWorks: "Finding classification is provider-agnostic (based on normalized resource state). Provider-specific hints (e.g., Azure Advisor, GCP Recommender) used as supporting signals.",
    providerSpecificLogic: "Instance family mapping, storage tier mapping, cost rate cards, provider-specific best practices",
    providerAgnosticLogic: "Classification rules, disposition logic, governance policy evaluation, anomaly detection",
  },
  {
    name: "Cross-cloud reasoning",
    description: "Reasoning engine considers findings from all providers simultaneously. Can identify cross-cloud patterns (redundancy, inconsistency, migration candidates).",
    howItWorks: "Findings from all providers pooled before theme clustering. Cross-cloud themes (e.g., same workload on two clouds) detected as a distinct theme type.",
    providerSpecificLogic: "Provider cost comparison (normalized to $/vCPU/month), provider-specific resilience patterns",
    providerAgnosticLogic: "Theme clustering, tradeoff analysis, trend detection, narrative generation",
  },
  {
    name: "Provider-specific execution",
    description: "Execution is always provider-specific (AWS API calls differ from Azure ARM calls). But the execution lifecycle (pre-check → dry-run → execute → verify) is identical.",
    howItWorks: "Plan phase generates provider-specific actions through the ProviderAdapter interface. Execute phase calls the appropriate adapter. Audit trail is provider-agnostic.",
    providerSpecificLogic: "API calls, Terraform provider blocks, CLI commands, rollback procedures, verification checks",
    providerAgnosticLogic: "Execution lifecycle, approval workflow, blast radius enforcement, rollback coordination, audit logging",
  },
  {
    name: "Unified learning",
    description: "Memory and learning are provider-agnostic. The agent learns about the organization, not about AWS or Azure specifically.",
    howItWorks: "Behavioral signals, calibration data, and organizational knowledge stored without provider tagging (except cost baselines which are naturally per-provider).",
    providerSpecificLogic: "Cost baselines per provider, provider-specific known exceptions",
    providerAgnosticLogic: "Behavioral adaptation, confidence calibration, organizational learning, reflection grading",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 10. CONFIDENCE & UNCERTAINTY MODEL
// ═══════════════════════════════════════════════════════════════════════════

export type ConfidenceDimension = {
  name: string;
  source: string;
  range: string;
  degradedBy: string[];
  improvedBy: string[];
  propagatesTo: string[];
  uncertaintyHandling: string;
};

export const CONFIDENCE_MODEL: ConfidenceDimension[] = [
  {
    name: "Snapshot Quality",
    source: "observe phase",
    range: "0-100 (API success rate × metric availability × data freshness)",
    degradedBy: ["API failures", "rate limiting", "partial region coverage", "missing CloudWatch/Monitor metrics"],
    improvedBy: ["All APIs succeed", "full region coverage", "metrics available for all resources"],
    propagatesTo: ["Finding confidence", "Overall loop confidence"],
    uncertaintyHandling: "If snapshot quality < 50, all findings marked 'low confidence' and no auto-apply permitted",
  },
  {
    name: "Finding Confidence",
    source: "interpret phase",
    range: "0-100 per finding (based on evidence strength + data quality)",
    degradedBy: ["Estimated costs (vs measured)", "Missing metrics", "Stale data (>24h old)", "First occurrence (no history)"],
    improvedBy: ["Multiple evidence types converge", "Measured costs available", "Historical pattern match", "High snapshot quality"],
    propagatesTo: ["Priority score", "Plan confidence"],
    uncertaintyHandling: "Findings with confidence < 40 are suppressed from auto-apply. Shown as 'low confidence' in UI with explanation.",
  },
  {
    name: "Reasoning Confidence",
    source: "reason phase",
    range: "0-100 (higher when multiple findings converge into clear themes)",
    degradedBy: ["Few findings (sparse data)", "Conflicting themes", "No historical comparison", "First scan for this org"],
    improvedBy: ["Clear theme clusters", "Historical trend confirmation", "Multiple provider agreement", "High finding confidence"],
    propagatesTo: ["Priority accuracy", "Plan quality"],
    uncertaintyHandling: "Low reasoning confidence → themes presented as 'preliminary' with caveat. No auto-generated narrative.",
  },
  {
    name: "Plan Confidence",
    source: "plan phase",
    range: "0-100 (based on action dependencies, risk level, and rollback availability)",
    degradedBy: ["Complex dependency chains", "High-risk actions", "No rollback available", "Multi-provider operations"],
    improvedBy: ["Independent actions", "All actions rollbackable", "Low risk", "Similar actions succeeded before (procedural memory)"],
    propagatesTo: ["Execution decision (go/no-go)", "Approval urgency"],
    uncertaintyHandling: "Plan confidence < 60 → mandatory human approval regardless of autopilot mode. Agent explains why confidence is low.",
  },
  {
    name: "Execution Confidence",
    source: "execute phase (post-hoc)",
    range: "Binary: succeeded or failed. No partial.",
    degradedBy: ["Action failure", "Rollback triggered", "Verification failure"],
    improvedBy: ["Action succeeded", "Verification passed", "No side effects detected"],
    propagatesTo: ["Future finding confidence for similar actions", "Calibration updates"],
    uncertaintyHandling: "Failed execution → immediate rollback. No retry without human approval. Confidence for similar future actions reduced.",
  },
  {
    name: "Overall Loop Confidence",
    source: "Computed: weighted average of all dimensions",
    range: "0-100 (snapshot × 0.3 + finding × 0.3 + plan × 0.4)",
    degradedBy: ["Any dimension below 50"],
    improvedBy: ["All dimensions above 75"],
    propagatesTo: ["Loop summary", "Escalation decisions", "Trust score"],
    uncertaintyHandling: "Overall < 40 → loop results marked 'low confidence' in all outputs. Agent recommends manual review.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 11. FAILURE RECOVERY STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════

export type FailureCategory =
  | "provider_api_error"     // cloud API returned error
  | "credential_error"       // credential invalid/expired
  | "timeout"                // operation exceeded time limit
  | "rate_limit"             // API rate limit hit
  | "execution_failure"      // apply action failed
  | "rollback_failure"       // rollback itself failed (critical)
  | "verification_failure"   // post-apply check failed
  | "data_integrity"         // corrupted or inconsistent data
  | "internal_error";        // bug in agent code

export type RecoveryStrategy = {
  failure: FailureCategory;
  severity: "recoverable" | "degraded" | "critical";
  immediateAction: string;
  retryPolicy: string;
  escalationTrigger: string;
  humanNotification: string;
  loopContinuation: string;
};

export const RECOVERY_STRATEGIES: RecoveryStrategy[] = [
  {
    failure: "provider_api_error",
    severity: "recoverable",
    immediateAction: "Log error with correlation ID. Mark provider as partially failed.",
    retryPolicy: "Exponential backoff: 1s, 2s, 4s, max 3 retries",
    escalationTrigger: "3 consecutive failures for same provider → escalate",
    humanNotification: "Silent unless all providers fail",
    loopContinuation: "Continue with available providers. Reduce confidence for failed provider.",
  },
  {
    failure: "credential_error",
    severity: "degraded",
    immediateAction: "Log credential validation failure (redacted). Skip provider.",
    retryPolicy: "No retry. Credentials don't fix themselves.",
    escalationTrigger: "Immediate notification to org admin",
    humanNotification: "Email/Slack: 'Cloud credentials for [provider] need to be updated'",
    loopContinuation: "Continue with other providers. Skip execute phase for this provider.",
  },
  {
    failure: "timeout",
    severity: "recoverable",
    immediateAction: "Cancel in-flight request. Record partial results if available.",
    retryPolicy: "Retry once with 2× timeout. If still fails, proceed with partial data.",
    escalationTrigger: "Timeout on ≥50% of operations → escalate as 'slow account'",
    humanNotification: "Include in loop summary: 'Scan incomplete due to timeout'",
    loopContinuation: "Continue with partial data. Flag reduced confidence.",
  },
  {
    failure: "rate_limit",
    severity: "recoverable",
    immediateAction: "Respect Retry-After header. Queue remaining requests.",
    retryPolicy: "Honor provider rate limit. Spread requests across time window.",
    escalationTrigger: "Rate limit blocks >30% of requests → suggest reducing scan scope",
    humanNotification: "Silent unless scan is significantly incomplete",
    loopContinuation: "Continue with available data. Schedule completion scan for later.",
  },
  {
    failure: "execution_failure",
    severity: "critical",
    immediateAction: "Halt execution for this action. Initiate automatic rollback.",
    retryPolicy: "Never retry failed mutations without human approval.",
    escalationTrigger: "Immediate: any execution failure is escalated",
    humanNotification: "Immediate notification with failure details, pre-state, and rollback status",
    loopContinuation: "Proceed to verify phase (check if rollback succeeded). Remaining actions paused.",
  },
  {
    failure: "rollback_failure",
    severity: "critical",
    immediateAction: "CRITICAL ALERT. Log full details. Preserve all state for forensics.",
    retryPolicy: "One careful retry with enhanced logging. If second failure, stop all agent operations for this org.",
    escalationTrigger: "Immediate escalation to org owner + on-call",
    humanNotification: "Urgent notification: 'Rollback failed. Manual intervention required. Resource [X] may be in inconsistent state.'",
    loopContinuation: "Loop terminates immediately. All future loops blocked until admin acknowledges.",
  },
  {
    failure: "verification_failure",
    severity: "degraded",
    immediateAction: "Flag action as 'unverified'. Schedule re-verification in 5 minutes.",
    retryPolicy: "Re-verify after 5 minutes (delayed convergence). If still fails after 15 minutes, initiate rollback.",
    escalationTrigger: "Verification still failing after 15 minutes → escalate",
    humanNotification: "Include in loop summary with details. Not urgent unless prolonged.",
    loopContinuation: "Continue to reflect phase. Mark action as 'verification_pending'.",
  },
  {
    failure: "data_integrity",
    severity: "critical",
    immediateAction: "Discard corrupted data. Fall back to last known good snapshot.",
    retryPolicy: "Re-scan from scratch. If corruption persists, investigate.",
    escalationTrigger: "Any data integrity issue → log for engineering review",
    humanNotification: "Silent to user unless it affects their data",
    loopContinuation: "Continue with last known good data. Reduce confidence.",
  },
  {
    failure: "internal_error",
    severity: "degraded",
    immediateAction: "Log full stack trace with correlation ID. Capture working memory state.",
    retryPolicy: "Retry current phase once. If fails again, skip phase and continue.",
    escalationTrigger: "Same error type ≥3 times in 24h → engineering alert",
    humanNotification: "Include in loop summary: 'Agent encountered internal issue. Some analysis may be incomplete.'",
    loopContinuation: "Skip failed phase. Continue with reduced output. Flag in summary.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 12. OPERATIONAL QUALITY IMPROVEMENT MODEL
// ═══════════════════════════════════════════════════════════════════════════

export type QualityDimension = {
  name: string;
  metric: string;
  measurement: string;
  target: string;
  improvementMechanism: string;
  feedbackLoop: string;
  timeToImprove: string;
};

export const QUALITY_DIMENSIONS: QualityDimension[] = [
  {
    name: "Finding Accuracy",
    metric: "Percentage of findings that lead to human action",
    measurement: "approved_findings / (approved_findings + rejected_findings)",
    target: ">80% accuracy",
    improvementMechanism: "Adaptive behavior learns from approval/rejection patterns. Reflection engine identifies noise categories. Finding thresholds adjusted.",
    feedbackLoop: "interpret → prioritize → [human decision] → learn → interpret (next loop)",
    timeToImprove: "2-4 weeks (requires ≥20 approval signals)",
  },
  {
    name: "Confidence Calibration",
    metric: "How well predicted confidence matches actual outcomes",
    measurement: "Brier score: Σ(predicted_probability - actual_outcome)² / n",
    target: "Brier score < 0.15 (well-calibrated)",
    improvementMechanism: "Reflection engine compares predicted success rate with actual. CalibrationUpdate adjusts future confidence scoring.",
    feedbackLoop: "plan (predict) → execute (actual) → reflect (compare) → learn (calibrate) → plan (improved prediction)",
    timeToImprove: "4-8 weeks (requires ≥50 execution outcomes)",
  },
  {
    name: "Noise Reduction",
    metric: "Percentage of findings suppressed by users",
    measurement: "suppressed_findings / total_findings",
    target: "<10% suppression rate",
    improvementMechanism: "Noise analysis in reflection identifies chronically suppressed categories. Adaptive behavior shifts disposition toward report_only for noisy categories.",
    feedbackLoop: "interpret → [user suppresses] → learn (noise signal) → interpret (adjusted threshold)",
    timeToImprove: "3-6 weeks (requires noise pattern detection across ≥5 loops)",
  },
  {
    name: "Execution Safety",
    metric: "Percentage of executed actions that succeed without rollback",
    measurement: "successful_actions / total_actions_attempted",
    target: ">95% success rate",
    improvementMechanism: "Procedural memory records successful strategies. Failed strategies are flagged. Confidence scoring improves to reject likely-to-fail actions.",
    feedbackLoop: "execute → verify → reflect → learn (strategy update) → plan (better strategy selection)",
    timeToImprove: "Immediate per-strategy (longer for statistical significance)",
  },
  {
    name: "Rollback Reliability",
    metric: "Percentage of triggered rollbacks that successfully restore pre-state",
    measurement: "successful_rollbacks / total_rollbacks_triggered",
    target: ">99% reliability",
    improvementMechanism: "Pre-state capture quality improvements. Rollback playbooks refined based on failure analysis. Actions without reliable rollback require elevated approval.",
    feedbackLoop: "execute (fail) → rollback → verify rollback → learn (playbook update)",
    timeToImprove: "Incremental per failure (each failure improves the playbook)",
  },
  {
    name: "Time to Insight",
    metric: "Time from scan start to recommendation delivery",
    measurement: "observe_start_timestamp - recommendation_delivery_timestamp",
    target: "<5 minutes for standard scan",
    improvementMechanism: "Parallel provider scanning. Incremental snapshot updates (diff from previous). Cache frequently-accessed data.",
    feedbackLoop: "observe → reflect (timing analysis) → learn (optimization opportunity)",
    timeToImprove: "Engineering-driven (architecture optimization, not learning)",
  },
  {
    name: "Organizational Alignment",
    metric: "How well recommendations match org priorities and risk tolerance",
    measurement: "recommendations_aligned_with_preferences / total_recommendations",
    target: ">85% alignment",
    improvementMechanism: "Organizational memory builds model of org decision culture. Preference evolution tracked over time. Recommendations pre-filtered by org context.",
    feedbackLoop: "prioritize → [human decision] → learn (preference signal) → prioritize (next loop)",
    timeToImprove: "6-12 weeks (organizational patterns are slow to establish)",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 13. LIFECYCLE DIAGRAMS
// ═══════════════════════════════════════════════════════════════════════════

export type LifecycleDiagram = {
  name: string;
  description: string;
  ascii: string;
};

export const LIFECYCLE_DIAGRAMS: LifecycleDiagram[] = [
  {
    name: "9-Phase Cognitive Loop",
    description: "The complete cognitive cycle from observation to learning",
    ascii: `
  ┌─────────────────────────────────────────────────────────────┐
  │                   COGNITIVE CORE                            │
  │                                                             │
  │   ┌─────────┐    ┌───────────┐    ┌────────┐               │
  │   │ OBSERVE │───▶│ INTERPRET │───▶│ REASON │               │
  │   │         │    │           │    │        │               │
  │   │ scan    │    │ classify  │    │ themes │               │
  │   │ collect │    │ detect    │    │ trade- │               │
  │   │ diff    │    │ evaluate  │    │ offs   │               │
  │   └─────────┘    └───────────┘    └───┬────┘               │
  │                                       │                     │
  │                                       ▼                     │
  │   ┌─────────┐    ┌───────────┐    ┌────────────┐           │
  │   │  LEARN  │    │  REFLECT  │    │ PRIORITIZE │           │
  │   │         │    │           │    │            │           │
  │   │ persist │    │ calibrate │    │ rank       │           │
  │   │ adapt   │    │ grade     │    │ score      │           │
  │   │ schedule│    │ measure   │    │ suppress   │           │
  │   └────▲────┘    └─────▲─────┘    └──────┬─────┘           │
  │        │               │                  │                 │
  │        │               │                  ▼                 │
  │   ┌────┴────┐    ┌─────┴─────┐    ┌────────────┐           │
  │   │         │    │  VERIFY   │    │    PLAN    │           │
  │   │         │    │           │    │            │           │
  │   │         │◀───│ confirm   │◀───│ sequence   │           │
  │   │         │    │ drift     │    │ DAG        │           │
  │   │         │    │ side-     │    │ rollback   │           │
  │   │         │    │ effects   │    │ approve    │           │
  │   └─────────┘    └─────▲─────┘    └──────┬─────┘           │
  │                        │                  │                 │
  │                        │     ┌────────┐   │                 │
  │                        └─────│EXECUTE │◀──┘                 │
  │                              │        │                     │
  │                              │ pre-   │ ◀── Human Gate     │
  │                              │ check  │                     │
  │                              │ dry-run│                     │
  │                              │ apply  │                     │
  │                              │ audit  │                     │
  │                              └────────┘                     │
  │                                                             │
  │   ┌─────────────────────────────────────────────────────┐   │
  │   │              MEMORY (persistent across loops)       │   │
  │   │  episodic │ semantic │ procedural │ organizational  │   │
  │   └─────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────┘`,
  },
  {
    name: "Failure Recovery Flow",
    description: "How the agent handles failures at each phase",
    ascii: `
  Any Phase Failure
       │
       ▼
  ┌────────────────┐
  │ Classify Error │
  └───────┬────────┘
          │
    ┌─────┼──────────────────┐
    │     │                  │
    ▼     ▼                  ▼
 ┌──────┐ ┌────────┐  ┌──────────┐
 │Recov-│ │Degraded│  │ Critical │
 │erable│ │        │  │          │
 └──┬───┘ └───┬────┘  └────┬─────┘
    │         │             │
    ▼         ▼             ▼
 ┌──────┐ ┌────────┐  ┌──────────┐
 │Retry │ │Skip    │  │ HALT     │
 │with  │ │phase,  │  │          │
 │back- │ │reduce  │  │ Rollback │
 │off   │ │confid- │  │ Escalate │
 │      │ │ence    │  │ Block    │
 └──┬───┘ └───┬────┘  └────┬─────┘
    │         │             │
    └────┬────┘             │
         │                  │
         ▼                  ▼
  ┌──────────────┐   ┌───────────┐
  │ Continue Loop│   │ Human     │
  │ (reduced     │   │ Required  │
  │  capability) │   │           │
  └──────────────┘   └───────────┘`,
  },
  {
    name: "Confidence Propagation",
    description: "How confidence flows and degrades through the loop",
    ascii: `
  Snapshot Quality (0-100)
       │
       │ ×0.3
       ▼
  ┌─────────────────┐
  │ Finding         │ ← metric availability
  │ Confidence      │ ← data freshness
  │ (per finding)   │ ← evidence types
  └────────┬────────┘
           │
           │ aggregate
           ▼
  ┌─────────────────┐
  │ Reasoning       │ ← theme convergence
  │ Confidence      │ ← historical match
  │                 │ ← multi-provider agree
  └────────┬────────┘
           │
           │ ×0.3
           ▼
  ┌─────────────────┐
  │ Plan            │ ← dependency complexity
  │ Confidence      │ ← rollback availability
  │                 │ ← risk level
  └────────┬────────┘
           │
           │ ×0.4
           ▼
  ┌─────────────────┐
  │ Overall Loop    │
  │ Confidence      │──── <40: "low confidence"
  │ (0-100)         │──── <60: no auto-apply
  │                 │──── >80: full capability
  └────────┬────────┘
           │
           │ after execute/verify
           ▼
  ┌─────────────────┐
  │ Calibration     │ ← predicted vs actual
  │ Update          │ ← feeds back into
  │ (±10% per loop) │   future confidence
  └─────────────────┘`,
  },
  {
    name: "Learning Flywheel",
    description: "How operational quality improves over time",
    ascii: `
         ┌──────────────────────────────────┐
         │                                  │
         ▼                                  │
  ┌──────────────┐                          │
  │ Agent scans  │                          │
  │ and produces │                          │
  │ findings     │                          │
  └──────┬───────┘                          │
         │                                  │
         ▼                                  │
  ┌──────────────┐                          │
  │ Human        │                          │
  │ approves/    │                          │
  │ rejects      │                          │
  └──────┬───────┘                          │
         │                                  │
         ▼                                  │
  ┌──────────────┐     ┌──────────────┐     │
  │ Agent        │     │ Behavioral   │     │
  │ executes     │────▶│ signal       │     │
  │ (if approved)│     │ recorded     │     │
  └──────┬───────┘     └──────┬───────┘     │
         │                    │              │
         ▼                    ▼              │
  ┌──────────────┐     ┌──────────────┐     │
  │ Agent        │     │ Adaptive     │     │
  │ reflects     │────▶│ adjustment   │     │
  │ on outcome   │     │ computed     │     │
  └──────┬───────┘     └──────┬───────┘     │
         │                    │              │
         ▼                    ▼              │
  ┌──────────────┐     ┌──────────────┐     │
  │ Calibration  │     │ Future       │     │
  │ update       │────▶│ findings     │─────┘
  │ persisted    │     │ improved     │
  └──────────────┘     └──────────────┘

  Result: Each loop makes the next loop better.
  Bounded by ±20% adjustment cap per cycle.
  Safety can only tighten, never loosen.`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 14. IMPLEMENTATION ROADMAP
// ═══════════════════════════════════════════════════════════════════════════

export type ImplementationStep = {
  id: string;
  name: string;
  phase: "phase_1" | "phase_2" | "phase_3";
  timeframe: string;
  description: string;
  currentState: string;
  targetState: string;
  dependencies: string[];
  effort: "small" | "medium" | "large";
};

export const IMPLEMENTATION_ROADMAP: ImplementationStep[] = [
  {
    id: "impl-1",
    name: "Split interpret phase from observe",
    phase: "phase_1",
    timeframe: "Week 1-2",
    description: "Extract classification, cost signal derivation, and governance evaluation into a distinct interpret phase in the cognitive loop",
    currentState: "observe and interpret are merged in executeObservePhase()",
    targetState: "executeObservePhase() only collects snapshots. New executeInterpretPhase() handles classification.",
    dependencies: [],
    effort: "medium",
  },
  {
    id: "impl-2",
    name: "Split prioritize phase from reason",
    phase: "phase_1",
    timeframe: "Week 1-2",
    description: "Extract priority scoring and recommendation building into a distinct prioritize phase",
    currentState: "Reasoning and prioritization are mixed in executeReasonPhase()",
    targetState: "executeReasonPhase() only clusters themes. New executePrioritizePhase() handles scoring.",
    dependencies: [],
    effort: "medium",
  },
  {
    id: "impl-3",
    name: "Add explicit learn phase",
    phase: "phase_1",
    timeframe: "Week 2-3",
    description: "Extract memory persistence and behavioral adaptation from reflect into a distinct learn phase",
    currentState: "Learning happens implicitly at end of executeReflectPhase()",
    targetState: "executeReflectPhase() only evaluates. New executeLearnPhase() persists and adapts.",
    dependencies: [],
    effort: "small",
  },
  {
    id: "impl-4",
    name: "Confidence propagation pipeline",
    phase: "phase_1",
    timeframe: "Week 3-4",
    description: "Implement the confidence model where each phase contributes to and degrades confidence with typed propagation",
    currentState: "ConfidenceState has 4 fields computed ad-hoc in each phase",
    targetState: "Confidence flows through phases with typed degradation rules. Low confidence blocks auto-apply.",
    dependencies: ["impl-1", "impl-2"],
    effort: "medium",
  },
  {
    id: "impl-5",
    name: "Failure recovery state machine",
    phase: "phase_1",
    timeframe: "Week 4-5",
    description: "Implement the recovery strategy lookup and execution for all 9 failure categories",
    currentState: "Error handling is per-phase with ad-hoc logic",
    targetState: "Centralized failure classification → recovery strategy resolution → execution",
    dependencies: [],
    effort: "large",
  },
  {
    id: "impl-6",
    name: "Memory persistence to PostgreSQL",
    phase: "phase_2",
    timeframe: "Week 5-7",
    description: "Migrate episodic, semantic, procedural, and organizational memory from in-memory to database",
    currentState: "Memory is in-memory only (lost on restart)",
    targetState: "All memory tiers persisted to PostgreSQL via Prisma. Write-through cache for performance.",
    dependencies: ["impl-3"],
    effort: "large",
  },
  {
    id: "impl-7",
    name: "Cross-cloud reasoning in reason phase",
    phase: "phase_2",
    timeframe: "Week 7-8",
    description: "Enable the reason phase to identify cross-cloud patterns (redundancy, migration candidates)",
    currentState: "Each provider's findings are reasoned about independently",
    targetState: "Findings from all providers pooled before theme clustering. Cross-cloud theme type added.",
    dependencies: ["impl-1"],
    effort: "medium",
  },
  {
    id: "impl-8",
    name: "Calibration feedback loop",
    phase: "phase_2",
    timeframe: "Week 8-9",
    description: "Connect reflect phase output to future confidence scoring via calibration updates",
    currentState: "Reflection notes are informational only",
    targetState: "CalibrationUpdate from reflect feeds into interpret/prioritize confidence in next loop",
    dependencies: ["impl-4", "impl-6"],
    effort: "medium",
  },
  {
    id: "impl-9",
    name: "Subsystem coordination protocol",
    phase: "phase_3",
    timeframe: "Week 9-11",
    description: "Formalize how the cognitive core invokes, queries, and writes to subsystems with typed contracts",
    currentState: "Subsystems invoked directly with ad-hoc error handling",
    targetState: "CoordinationProtocol type enforces input/output contracts. Centralized error routing.",
    dependencies: ["impl-5"],
    effort: "large",
  },
  {
    id: "impl-10",
    name: "Quality dimension tracking",
    phase: "phase_3",
    timeframe: "Week 11-12",
    description: "Implement the 7 quality dimensions with measurement, tracking, and improvement signals",
    currentState: "Quality is not systematically measured",
    targetState: "Each quality dimension tracked per loop. Trends visible in dashboard. Improvement signals fed to learn phase.",
    dependencies: ["impl-8", "impl-6"],
    effort: "medium",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 15. QUERY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function getPhaseDefinition(phase: CognitivePhase): PhaseDefinition | undefined {
  return PHASE_DEFINITIONS.find((p) => p.phase === phase);
}

export function getPhaseOrder(): CognitivePhase[] {
  return PHASE_DEFINITIONS
    .sort((a, b) => a.order - b.order)
    .map((p) => p.phase);
}

export function getTransitionsFrom(phase: CognitivePhase): PhaseTransition[] {
  return PHASE_TRANSITIONS.filter((t) => t.from === phase);
}

export function getHumanGates(): PhaseTransition[] {
  return PHASE_TRANSITIONS.filter((t) => t.humanGateRequired);
}

export function getRecoveryStrategy(failure: FailureCategory): RecoveryStrategy | undefined {
  return RECOVERY_STRATEGIES.find((r) => r.failure === failure);
}

export function getCriticalRecoveries(): RecoveryStrategy[] {
  return RECOVERY_STRATEGIES.filter((r) => r.severity === "critical");
}

export function getSubsystemsForPhase(phase: CognitivePhase): SubsystemCoordination[] {
  return COORDINATION_MAP.filter((c) => c.phases.includes(phase));
}

export function getQualityTargets(): { dimension: string; target: string; timeToImprove: string }[] {
  return QUALITY_DIMENSIONS.map((d) => ({
    dimension: d.name,
    target: d.target,
    timeToImprove: d.timeToImprove,
  }));
}

export function getImplementationByPhase(phase: ImplementationStep["phase"]): ImplementationStep[] {
  return IMPLEMENTATION_ROADMAP.filter((s) => s.phase === phase);
}

export function getImplementationProgress(): {
  total: number;
  phase1: number;
  phase2: number;
  phase3: number;
  totalEffortWeeks: number;
} {
  const small = 1, medium = 2, large = 4;
  const effortMap = { small, medium, large };
  return {
    total: IMPLEMENTATION_ROADMAP.length,
    phase1: IMPLEMENTATION_ROADMAP.filter((s) => s.phase === "phase_1").length,
    phase2: IMPLEMENTATION_ROADMAP.filter((s) => s.phase === "phase_2").length,
    phase3: IMPLEMENTATION_ROADMAP.filter((s) => s.phase === "phase_3").length,
    totalEffortWeeks: IMPLEMENTATION_ROADMAP.reduce((sum, s) => sum + effortMap[s.effort], 0),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 16. TESTS
// ═══════════════════════════════════════════════════════════════════════════

export type CognitiveCoreTestResult = { name: string; passed: boolean; detail: string };

export function runCognitiveCoreTests(): CognitiveCoreTestResult[] {
  const results: CognitiveCoreTestResult[] = [];

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  // Test 1: All 9 phases defined
  assert("9 phases defined", () => PHASE_DEFINITIONS.length === 9,
    `count=${PHASE_DEFINITIONS.length}`);

  // Test 2: Phases are in order
  const orders = PHASE_DEFINITIONS.map((p) => p.order);
  const sorted = [...orders].sort((a, b) => a - b);
  assert("phases ordered", () => JSON.stringify(orders) === JSON.stringify(sorted),
    `orders=${orders.join(",")}`);

  // Test 3: Phase order function returns all 9
  const phaseOrder = getPhaseOrder();
  assert("getPhaseOrder returns 9", () => phaseOrder.length === 9,
    `phases=${phaseOrder.join(",")}`);

  // Test 4: Transitions form a valid chain
  const transitions = PHASE_TRANSITIONS;
  assert("transitions exist", () => transitions.length >= 8,
    `count=${transitions.length}`);

  // Test 5: Execute phase requires human gate
  const executeGate = transitions.find((t) => t.to === "execute");
  assert("execute has human gate", () => !!executeGate?.humanGateRequired,
    `gate=${executeGate?.humanGateRequired}`);

  // Test 6: Context layers cover short and long term
  const shortTerm = CONTEXT_LAYERS.filter((c) => c.type === "short_term");
  const longTerm = CONTEXT_LAYERS.filter((c) => c.type === "long_term");
  assert("context layers balanced", () => shortTerm.length >= 1 && longTerm.length >= 3,
    `short=${shortTerm.length}, long=${longTerm.length}`);

  // Test 7: Memory influences defined
  assert("memory influences exist", () => MEMORY_INFLUENCES.length >= 5,
    `count=${MEMORY_INFLUENCES.length}`);

  // Test 8: All memory influences have safeguards
  const unsafeInfluences = MEMORY_INFLUENCES.filter((m) => !m.safeguard);
  assert("all influences safeguarded", () => unsafeInfluences.length === 0,
    `unsafe=${unsafeInfluences.length}`);

  // Test 9: Explainability contract complete
  assert("explainability contract exists", () => EXPLAINABILITY_CONTRACT.length >= 5,
    `count=${EXPLAINABILITY_CONTRACT.length}`);

  // Test 10: All explainability items require audit persistence
  const notPersisted = EXPLAINABILITY_CONTRACT.filter((e) => !e.auditPersisted);
  assert("all decisions audit-persisted", () => notPersisted.length === 0,
    `not persisted=${notPersisted.length}`);

  // Test 11: Autonomy boundaries include no-self-promotion
  const selfPromotion = AUTONOMY_BOUNDARIES.find((b) => b.name === "No self-promotion");
  assert("no self-promotion boundary exists", () => !!selfPromotion && !selfPromotion.canBeRelaxed,
    `relaxable=${selfPromotion?.canBeRelaxed}`);

  // Test 12: Coordination map covers all phases
  const coveredPhases = new Set(COORDINATION_MAP.flatMap((c) => c.phases));
  const allPhases: CognitivePhase[] = ["observe", "interpret", "reason", "prioritize", "plan", "execute", "verify", "reflect", "learn"];
  const missingPhases = allPhases.filter((p) => !coveredPhases.has(p));
  assert("all phases have subsystems", () => missingPhases.length === 0,
    `missing=${missingPhases.join(",") || "none"}`);

  // Test 13: Recovery strategies cover all failure categories
  const failureCategories: FailureCategory[] = [
    "provider_api_error", "credential_error", "timeout", "rate_limit",
    "execution_failure", "rollback_failure", "verification_failure",
    "data_integrity", "internal_error",
  ];
  const coveredFailures = new Set(RECOVERY_STRATEGIES.map((r) => r.failure));
  const missingFailures = failureCategories.filter((f) => !coveredFailures.has(f));
  assert("all failures have recovery", () => missingFailures.length === 0,
    `missing=${missingFailures.join(",") || "none"}`);

  // Test 14: Rollback failure is critical severity
  const rollbackRecovery = getRecoveryStrategy("rollback_failure");
  assert("rollback failure is critical", () => rollbackRecovery?.severity === "critical",
    `severity=${rollbackRecovery?.severity}`);

  // Test 15: Quality dimensions defined
  assert("quality dimensions exist", () => QUALITY_DIMENSIONS.length >= 5,
    `count=${QUALITY_DIMENSIONS.length}`);

  // Test 16: Confidence model has overall dimension
  const overallConf = CONFIDENCE_MODEL.find((c) => c.name === "Overall Loop Confidence");
  assert("overall confidence defined", () => !!overallConf,
    `found=${!!overallConf}`);

  // Test 17: Multi-cloud cognition defined
  assert("multi-cloud cognition exists", () => MULTI_CLOUD_COGNITION.length >= 4,
    `count=${MULTI_CLOUD_COGNITION.length}`);

  // Test 18: Implementation roadmap has steps
  const progress = getImplementationProgress();
  assert("implementation roadmap exists", () => progress.total >= 8,
    `total=${progress.total}, weeks=${progress.totalEffortWeeks}`);

  // Test 19: Lifecycle diagrams exist
  assert("lifecycle diagrams exist", () => LIFECYCLE_DIAGRAMS.length >= 3,
    `count=${LIFECYCLE_DIAGRAMS.length}`);

  // Test 20: Phase definitions have subsystems
  const noSubsystems = PHASE_DEFINITIONS.filter((p) => p.subsystemsInvoked.length === 0);
  assert("all phases have subsystems", () => noSubsystems.length === 0,
    `missing=${noSubsystems.map((p) => p.phase).join(",") || "none"}`);

  return results;
}
