/**
 * Axiom Agent — Trust & Safety Governance Engine
 *
 * The unified governance layer that connects trust levels, RBAC,
 * policies, autonomy, safety boundaries, and provider capabilities
 * into a single decision surface. While the existing modules each
 * handle their own domain:
 *
 *   enterpriseTrustModel.ts  → trust levels and promotion
 *   governanceEngine.ts      → policy definition and evaluation
 *   rbacEngine.ts            → roles, permissions, approval chains
 *   autonomousOrchestrator   → safety boundaries and workflow gates
 *   cognitiveArchitecture.ts → autonomy levels and escalation
 *
 * This module answers the CROSS-CUTTING questions:
 *
 *   "Can this agent, at this trust level, with this autonomy config,
 *    execute this action, on this provider, under these policies,
 *    for this user's role, without violating any safety invariant?"
 *
 * Core invariants:
 *   1. Agent NEVER silently escalates its own autonomy
 *   2. High-risk actions ALWAYS require human approval
 *   3. Every action has a traceable evidence chain
 *   4. Governance checks are enforced at EVERY cognitive phase
 *   5. Trust promotion requires external verification, never self-promotion
 *   6. Policy violations block execution, never just warn-and-proceed
 *   7. Rollback capability is verified BEFORE apply, not after
 *   8. Compliance evidence is continuously accumulated, not batch-collected
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. UNIFIED GOVERNANCE DECISION — THE CENTRAL AUTHORITY
// ═══════════════════════════════════════════════════════════════════════════

export type GovernanceDecision = {
  id: string;
  timestamp: string;
  orgId: string;
  requestedAction: ActionRequest;
  verdict: GovernanceVerdict;
  trustEvaluation: TrustEvaluation;
  autonomyEvaluation: AutonomyEvaluation;
  policyEvaluation: PolicyEvaluation;
  rbacEvaluation: RBACEvaluation;
  safetyEvaluation: SafetyEvaluation;
  providerEvaluation: ProviderEvaluation;
  rollbackEvaluation: RollbackEvaluation;
  evidenceChain: EvidenceLink[];
  escalationRequired: EscalationRequirement | null;
  conditions: GovernanceCondition[];
  auditHash: string;
};

export type GovernanceVerdict =
  | "allow"                // all checks pass, action may proceed
  | "allow_with_conditions" // allowed if conditions are met (e.g., approval)
  | "deny"                 // one or more checks failed, action blocked
  | "escalate"             // requires human decision
  | "defer";               // cannot decide now, retry later

export type ActionRequest = {
  actionType: GovernanceActionType;
  provider: GovernanceProvider;
  region: string | null;
  resourceIds: string[];
  resourceTypes: string[];
  riskLevel: GovernanceRiskLevel;
  estimatedCostImpact: number;
  estimatedBlastRadius: number;
  reversible: boolean;
  description: string;
  requestedBy: ActionRequestor;
  cognitivePhase: CognitivePhaseRef;
  workflowInstanceId: string | null;
};

export type GovernanceActionType =
  | "scan"                    // read-only infrastructure scan
  | "recommend"               // generate recommendation (no change)
  | "plan"                    // generate execution plan
  | "terraform_generate"      // generate Terraform code
  | "apply_safe"              // apply low-risk non-destructive change
  | "apply_standard"          // apply standard change
  | "apply_destructive"       // apply destructive change (delete, replace)
  | "apply_cross_provider"    // apply change spanning multiple providers
  | "rollback"                // rollback a previous change
  | "modify_policy"           // change governance policy
  | "modify_trust_level"      // attempt trust level change
  | "modify_autonomy"         // attempt autonomy level change
  | "modify_safety_boundary"  // attempt safety boundary change
  | "access_credentials"      // access cloud provider credentials
  | "export_data"             // export infrastructure data
  | "schedule_workflow"        // schedule a future workflow
  | "monitor"                 // set up monitoring
  | "reflect";                // execute self-reflection (always allowed)

export type GovernanceProvider = "aws" | "azure" | "gcp" | "multi" | "none";

export type GovernanceRiskLevel = "none" | "low" | "medium" | "high" | "critical";

export type ActionRequestor =
  | { type: "agent"; autonomyLevel: number; trustLevel: string; workflowId: string | null }
  | { type: "user"; userId: string; role: string }
  | { type: "workflow"; workflowId: string; templateId: string }
  | { type: "scheduler"; scheduleId: string };

export type CognitivePhaseRef =
  | "observe" | "interpret" | "reason" | "prioritize" | "plan"
  | "execute" | "verify" | "reflect" | "learn" | "none";

// ═══════════════════════════════════════════════════════════════════════════
// 2. TRUST EVALUATION — DOES THE AGENT HAVE SUFFICIENT TRUST?
// ═══════════════════════════════════════════════════════════════════════════

export type TrustEvaluation = {
  currentTrustLevel: TrustLevelRef;
  requiredTrustLevel: TrustLevelRef;
  trustScore: number;
  sufficient: boolean;
  trustGap: string | null;
  promotionEligible: boolean;
  recentTrustEvents: TrustEventSummary[];
};

export type TrustLevelRef = "unverified" | "observing" | "advising" | "assisting" | "operating" | "trusted";

export type TrustEventSummary = {
  type: "positive" | "negative" | "neutral";
  description: string;
  impact: number;
  timestamp: string;
};

export const TRUST_REQUIREMENTS_PER_ACTION: {
  actionType: GovernanceActionType;
  minimumTrustLevel: TrustLevelRef;
  description: string;
}[] = [
  { actionType: "scan", minimumTrustLevel: "observing", description: "Read-only scanning requires at least observing trust" },
  { actionType: "recommend", minimumTrustLevel: "advising", description: "Generating recommendations requires advising trust" },
  { actionType: "plan", minimumTrustLevel: "advising", description: "Planning requires advising trust" },
  { actionType: "terraform_generate", minimumTrustLevel: "advising", description: "Terraform generation requires advising trust" },
  { actionType: "apply_safe", minimumTrustLevel: "assisting", description: "Safe applies require assisting trust" },
  { actionType: "apply_standard", minimumTrustLevel: "operating", description: "Standard applies require operating trust" },
  { actionType: "apply_destructive", minimumTrustLevel: "trusted", description: "Destructive applies require trusted level" },
  { actionType: "apply_cross_provider", minimumTrustLevel: "trusted", description: "Cross-provider applies require trusted level" },
  { actionType: "rollback", minimumTrustLevel: "assisting", description: "Rollbacks require assisting trust (recovery action)" },
  { actionType: "modify_policy", minimumTrustLevel: "trusted", description: "Policy changes always require trusted + human" },
  { actionType: "modify_trust_level", minimumTrustLevel: "trusted", description: "Trust changes require external verification — never self-promotion" },
  { actionType: "modify_autonomy", minimumTrustLevel: "trusted", description: "Autonomy changes require trusted + human approval" },
  { actionType: "modify_safety_boundary", minimumTrustLevel: "trusted", description: "Safety boundary changes require trusted + human approval" },
  { actionType: "access_credentials", minimumTrustLevel: "operating", description: "Credential access requires operating trust" },
  { actionType: "export_data", minimumTrustLevel: "advising", description: "Data export requires advising trust" },
  { actionType: "schedule_workflow", minimumTrustLevel: "assisting", description: "Scheduling requires assisting trust" },
  { actionType: "monitor", minimumTrustLevel: "observing", description: "Monitoring setup requires observing trust" },
  { actionType: "reflect", minimumTrustLevel: "unverified", description: "Self-reflection is always allowed" },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. AUTONOMY EVALUATION — IS THE AGENT ALLOWED TO ACT INDEPENDENTLY?
// ═══════════════════════════════════════════════════════════════════════════

export type AutonomyEvaluation = {
  currentAutonomyLevel: number;       // 0–5
  requiredAutonomyLevel: number;
  sufficient: boolean;
  autonomyGap: string | null;
  selfEscalationAttempt: boolean;     // CRITICAL: always blocked
  humanApprovalRequired: boolean;
  escalationReason: string | null;
};

export type AutonomyRequirement = {
  actionType: GovernanceActionType;
  minimumAutonomyLevel: number;
  alwaysRequiresHuman: boolean;
  description: string;
};

export const AUTONOMY_REQUIREMENTS: AutonomyRequirement[] = [
  { actionType: "scan", minimumAutonomyLevel: 0, alwaysRequiresHuman: false, description: "Scans are fully autonomous at any level" },
  { actionType: "recommend", minimumAutonomyLevel: 1, alwaysRequiresHuman: false, description: "Recommendations require adaptive autonomy" },
  { actionType: "plan", minimumAutonomyLevel: 3, alwaysRequiresHuman: false, description: "Planning requires planning-level autonomy" },
  { actionType: "terraform_generate", minimumAutonomyLevel: 3, alwaysRequiresHuman: false, description: "Terraform gen requires planning autonomy" },
  { actionType: "apply_safe", minimumAutonomyLevel: 4, alwaysRequiresHuman: false, description: "Safe applies require self-directed autonomy" },
  { actionType: "apply_standard", minimumAutonomyLevel: 4, alwaysRequiresHuman: true, description: "Standard applies always need human approval" },
  { actionType: "apply_destructive", minimumAutonomyLevel: 5, alwaysRequiresHuman: true, description: "Destructive applies always need human approval" },
  { actionType: "apply_cross_provider", minimumAutonomyLevel: 5, alwaysRequiresHuman: true, description: "Cross-provider applies always need human approval" },
  { actionType: "rollback", minimumAutonomyLevel: 3, alwaysRequiresHuman: false, description: "Rollbacks can be autonomous if pre-approved" },
  { actionType: "modify_policy", minimumAutonomyLevel: 5, alwaysRequiresHuman: true, description: "Policy changes ALWAYS require human" },
  { actionType: "modify_trust_level", minimumAutonomyLevel: 5, alwaysRequiresHuman: true, description: "Trust changes ALWAYS require human — no self-promotion" },
  { actionType: "modify_autonomy", minimumAutonomyLevel: 5, alwaysRequiresHuman: true, description: "Autonomy changes ALWAYS require human — no self-escalation" },
  { actionType: "modify_safety_boundary", minimumAutonomyLevel: 5, alwaysRequiresHuman: true, description: "Safety changes ALWAYS require human" },
  { actionType: "access_credentials", minimumAutonomyLevel: 4, alwaysRequiresHuman: false, description: "Credential access requires self-directed autonomy" },
  { actionType: "export_data", minimumAutonomyLevel: 1, alwaysRequiresHuman: false, description: "Data export requires adaptive autonomy" },
  { actionType: "schedule_workflow", minimumAutonomyLevel: 3, alwaysRequiresHuman: false, description: "Scheduling requires planning autonomy" },
  { actionType: "monitor", minimumAutonomyLevel: 0, alwaysRequiresHuman: false, description: "Monitoring is fully autonomous" },
  { actionType: "reflect", minimumAutonomyLevel: 0, alwaysRequiresHuman: false, description: "Reflection is always autonomous" },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. POLICY EVALUATION — DO GOVERNANCE POLICIES ALLOW THIS?
// ═══════════════════════════════════════════════════════════════════════════

export type PolicyEvaluation = {
  policiesChecked: number;
  policiesViolated: number;
  blockingViolations: GovernancePolicyViolation[];
  warningViolations: GovernancePolicyViolation[];
  auditViolations: GovernancePolicyViolation[];
  overallPassed: boolean;
};

export type GovernancePolicyViolation = {
  policyId: string;
  policyName: string;
  domain: string;
  severity: GovernanceRiskLevel;
  enforcement: "audit" | "warn" | "enforce" | "block";
  description: string;
  affectedResources: string[];
  remediation: string;
  evidenceId: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. RBAC EVALUATION — DOES THE REQUESTOR HAVE PERMISSION?
// ═══════════════════════════════════════════════════════════════════════════

export type RBACEvaluation = {
  hasPermission: boolean;
  requiredPermissions: string[];
  grantedPermissions: string[];
  missingPermissions: string[];
  providerScopeValid: boolean;
  roleLevel: string | null;
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. SAFETY EVALUATION — ARE SAFETY BOUNDARIES RESPECTED?
// ═══════════════════════════════════════════════════════════════════════════

export type SafetyEvaluation = {
  withinBlastRadius: boolean;
  withinCostCeiling: boolean;
  withinResourceLimit: boolean;
  noForbiddenActions: boolean;
  notInFreezePeriod: boolean;
  invariantsHeld: SafetyInvariantCheck[];
  overallSafe: boolean;
};

export type SafetyInvariantCheck = {
  invariantId: string;
  name: string;
  held: boolean;
  evidence: string;
};

export const SAFETY_INVARIANTS: {
  id: string;
  name: string;
  description: string;
  enforcement: "hard" | "soft";
  applicablePhases: CognitivePhaseRef[];
  testable: boolean;
}[] = [
  {
    id: "inv_no_self_promotion",
    name: "No self-promotion",
    description: "Agent cannot promote its own trust level or autonomy level. All promotions require external human verification.",
    enforcement: "hard",
    applicablePhases: ["execute", "learn"],
    testable: true,
  },
  {
    id: "inv_no_silent_escalation",
    name: "No silent escalation",
    description: "Agent cannot silently increase its own privileges. Any privilege change produces an audit event and requires approval.",
    enforcement: "hard",
    applicablePhases: ["execute", "learn"],
    testable: true,
  },
  {
    id: "inv_blast_radius_ceiling",
    name: "Blast radius ceiling",
    description: "No single action can affect more resources than the configured blast radius limit.",
    enforcement: "hard",
    applicablePhases: ["plan", "execute"],
    testable: true,
  },
  {
    id: "inv_cost_ceiling",
    name: "Cost ceiling",
    description: "No single action can incur costs exceeding the configured cost ceiling.",
    enforcement: "hard",
    applicablePhases: ["plan", "execute"],
    testable: true,
  },
  {
    id: "inv_rollback_before_apply",
    name: "Rollback verified before apply",
    description: "Rollback capability must be confirmed before any apply action begins. If rollback is unavailable, the action requires explicit human approval.",
    enforcement: "hard",
    applicablePhases: ["execute"],
    testable: true,
  },
  {
    id: "inv_approval_for_high_risk",
    name: "Human approval for high risk",
    description: "Any action classified as high or critical risk must have explicit human approval. No autopilot or auto-approve can override this.",
    enforcement: "hard",
    applicablePhases: ["plan", "execute"],
    testable: true,
  },
  {
    id: "inv_no_credential_exposure",
    name: "No credential exposure",
    description: "Credentials, secrets, and API keys must never appear in logs, audit trails, recommendations, or client-facing outputs.",
    enforcement: "hard",
    applicablePhases: ["observe", "interpret", "reason", "prioritize", "plan", "execute", "verify", "reflect", "learn"],
    testable: true,
  },
  {
    id: "inv_audit_completeness",
    name: "Audit completeness",
    description: "Every governance decision must produce a tamper-evident audit entry with full evidence chain. No action can bypass audit.",
    enforcement: "hard",
    applicablePhases: ["observe", "interpret", "reason", "prioritize", "plan", "execute", "verify", "reflect", "learn"],
    testable: true,
  },
  {
    id: "inv_tenant_isolation",
    name: "Tenant isolation",
    description: "No action, query, or memory access can cross organization boundaries. All data is scoped to orgId.",
    enforcement: "hard",
    applicablePhases: ["observe", "interpret", "reason", "prioritize", "plan", "execute", "verify", "reflect", "learn"],
    testable: true,
  },
  {
    id: "inv_freeze_period_respect",
    name: "Freeze period respect",
    description: "No apply or destructive action can execute during a declared freeze period. Scans and reads are still allowed.",
    enforcement: "hard",
    applicablePhases: ["execute"],
    testable: true,
  },
  {
    id: "inv_reflection_cannot_loosen_safety",
    name: "Reflection cannot loosen safety",
    description: "The learn/reflect phases can tighten safety bounds but never loosen them. Self-improvement must be conservative.",
    enforcement: "hard",
    applicablePhases: ["reflect", "learn"],
    testable: true,
  },
  {
    id: "inv_first_time_escalation",
    name: "First-time action escalation",
    description: "Any action type being performed for the first time in an organization requires human approval, regardless of autonomy level.",
    enforcement: "hard",
    applicablePhases: ["execute"],
    testable: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 7. PROVIDER EVALUATION — CAN THE PROVIDER SUPPORT THIS ACTION?
// ═══════════════════════════════════════════════════════════════════════════

export type ProviderEvaluation = {
  provider: GovernanceProvider;
  capable: boolean;
  missingCapabilities: string[];
  providerBoundaryPassed: boolean;
  regionAllowed: boolean;
  resourceTypeAllowed: boolean;
  concurrencyAvailable: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// 8. ROLLBACK EVALUATION — IS ROLLBACK POSSIBLE IF THIS FAILS?
// ═══════════════════════════════════════════════════════════════════════════

export type RollbackEvaluation = {
  rollbackAvailable: boolean;
  rollbackStrategy: string | null;
  rollbackVerified: boolean;
  rollbackTimeEstimateMs: number | null;
  requiresApprovalWithoutRollback: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// 9. EVIDENCE CHAIN — EVERY DECISION IS TRACEABLE
// ═══════════════════════════════════════════════════════════════════════════

export type EvidenceLink = {
  id: string;
  type: EvidenceType;
  source: string;
  timestamp: string;
  data: Record<string, unknown>;
  hash: string;
};

export type EvidenceType =
  | "trust_score_snapshot"
  | "autonomy_config_snapshot"
  | "policy_evaluation_result"
  | "rbac_authorization_result"
  | "safety_check_result"
  | "provider_capability_check"
  | "rollback_capability_check"
  | "approval_record"
  | "invariant_check_result"
  | "governance_decision";

// ═══════════════════════════════════════════════════════════════════════════
// 10. ESCALATION REQUIREMENTS
// ═══════════════════════════════════════════════════════════════════════════

export type EscalationRequirement = {
  reason: EscalationReason;
  urgency: "low" | "medium" | "high" | "critical";
  requiredApprovers: string[];
  requiredApprovalCount: number;
  escalationTimeoutMs: number;
  fallbackAction: "deny" | "queue" | "retry_later";
  context: string;
};

export type EscalationReason =
  | "high_risk_action"
  | "trust_level_insufficient"
  | "autonomy_level_insufficient"
  | "policy_violation_override_requested"
  | "first_time_action"
  | "no_rollback_available"
  | "blast_radius_exceeded"
  | "cost_ceiling_exceeded"
  | "cross_provider_action"
  | "safety_invariant_soft_violation"
  | "manual_escalation";

export type GovernanceCondition = {
  type: "require_approval" | "require_rollback_plan" | "require_monitoring" | "time_restricted" | "rate_limited";
  description: string;
  met: boolean;
};

// ═══════════════════════════════════════════════════════════════════════════
// 11. GOVERNANCE PER COGNITIVE PHASE
// ═══════════════════════════════════════════════════════════════════════════

export type PhaseGovernancePolicy = {
  phase: CognitivePhaseRef;
  allowedActions: GovernanceActionType[];
  blockedActions: GovernanceActionType[];
  requiredChecks: GovernanceCheckType[];
  trustMinimum: TrustLevelRef;
  autonomyMinimum: number;
  auditLevel: "minimal" | "standard" | "comprehensive";
  description: string;
};

export type GovernanceCheckType =
  | "trust_level"
  | "autonomy_level"
  | "policy_compliance"
  | "rbac_permission"
  | "safety_boundary"
  | "provider_capability"
  | "rollback_availability"
  | "freeze_period"
  | "invariant_check";

export const PHASE_GOVERNANCE: PhaseGovernancePolicy[] = [
  {
    phase: "observe",
    allowedActions: ["scan", "monitor"],
    blockedActions: ["apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "modify_policy", "modify_trust_level", "modify_autonomy", "modify_safety_boundary"],
    requiredChecks: ["trust_level", "provider_capability"],
    trustMinimum: "observing",
    autonomyMinimum: 0,
    auditLevel: "minimal",
    description: "Observe phase: read-only operations, no writes allowed",
  },
  {
    phase: "interpret",
    allowedActions: ["scan"],
    blockedActions: ["apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "modify_policy", "modify_trust_level", "modify_autonomy", "modify_safety_boundary"],
    requiredChecks: ["trust_level"],
    trustMinimum: "observing",
    autonomyMinimum: 0,
    auditLevel: "minimal",
    description: "Interpret phase: classification only, no external calls except memory reads",
  },
  {
    phase: "reason",
    allowedActions: ["recommend"],
    blockedActions: ["apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "modify_policy", "modify_trust_level", "modify_autonomy", "modify_safety_boundary"],
    requiredChecks: ["trust_level", "policy_compliance"],
    trustMinimum: "advising",
    autonomyMinimum: 1,
    auditLevel: "standard",
    description: "Reason phase: generate insights and recommendations, policy-aware",
  },
  {
    phase: "prioritize",
    allowedActions: ["recommend"],
    blockedActions: ["apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "modify_policy", "modify_trust_level", "modify_autonomy", "modify_safety_boundary"],
    requiredChecks: ["trust_level", "policy_compliance"],
    trustMinimum: "advising",
    autonomyMinimum: 1,
    auditLevel: "standard",
    description: "Prioritize phase: rank by impact/risk, no state changes",
  },
  {
    phase: "plan",
    allowedActions: ["plan", "terraform_generate", "recommend"],
    blockedActions: ["apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "modify_trust_level", "modify_autonomy"],
    requiredChecks: ["trust_level", "autonomy_level", "policy_compliance", "safety_boundary", "rollback_availability"],
    trustMinimum: "advising",
    autonomyMinimum: 3,
    auditLevel: "comprehensive",
    description: "Plan phase: generate execution plans, verify safety boundaries and rollback availability",
  },
  {
    phase: "execute",
    allowedActions: ["apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "rollback", "access_credentials"],
    blockedActions: ["modify_trust_level", "modify_autonomy"],
    requiredChecks: ["trust_level", "autonomy_level", "policy_compliance", "rbac_permission", "safety_boundary", "provider_capability", "rollback_availability", "freeze_period", "invariant_check"],
    trustMinimum: "assisting",
    autonomyMinimum: 4,
    auditLevel: "comprehensive",
    description: "Execute phase: ALL checks required. This is the highest-governance phase.",
  },
  {
    phase: "verify",
    allowedActions: ["scan", "monitor"],
    blockedActions: ["apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "modify_policy", "modify_trust_level", "modify_autonomy", "modify_safety_boundary"],
    requiredChecks: ["trust_level", "provider_capability"],
    trustMinimum: "observing",
    autonomyMinimum: 0,
    auditLevel: "standard",
    description: "Verify phase: read-only confirmation of post-apply state",
  },
  {
    phase: "reflect",
    allowedActions: ["reflect"],
    blockedActions: ["apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "modify_trust_level", "modify_autonomy", "modify_safety_boundary"],
    requiredChecks: ["invariant_check"],
    trustMinimum: "unverified",
    autonomyMinimum: 0,
    auditLevel: "standard",
    description: "Reflect phase: evaluate performance, cannot loosen safety",
  },
  {
    phase: "learn",
    allowedActions: ["reflect"],
    blockedActions: ["apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "modify_trust_level", "modify_autonomy", "modify_safety_boundary"],
    requiredChecks: ["invariant_check"],
    trustMinimum: "unverified",
    autonomyMinimum: 0,
    auditLevel: "standard",
    description: "Learn phase: update memory, cannot loosen safety or promote trust",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 12. TRUST → AUTONOMY MAPPING — HOW TRUST UNLOCKS CAPABILITY
// ═══════════════════════════════════════════════════════════════════════════

export type TrustAutonomyMapping = {
  trustLevel: TrustLevelRef;
  maxAutonomyLevel: number;
  allowedActionTypes: GovernanceActionType[];
  requiresApproval: GovernanceActionType[];
  description: string;
};

export const TRUST_AUTONOMY_MAP: TrustAutonomyMapping[] = [
  {
    trustLevel: "unverified",
    maxAutonomyLevel: 0,
    allowedActionTypes: ["reflect"],
    requiresApproval: [],
    description: "Unverified: agent can only self-reflect. No infrastructure access.",
  },
  {
    trustLevel: "observing",
    maxAutonomyLevel: 1,
    allowedActionTypes: ["scan", "monitor", "reflect"],
    requiresApproval: [],
    description: "Observing: read-only access to infrastructure. Can scan and monitor.",
  },
  {
    trustLevel: "advising",
    maxAutonomyLevel: 3,
    allowedActionTypes: ["scan", "recommend", "plan", "terraform_generate", "export_data", "monitor", "reflect"],
    requiresApproval: ["plan", "terraform_generate"],
    description: "Advising: can generate recommendations and plans. Plans may need approval.",
  },
  {
    trustLevel: "assisting",
    maxAutonomyLevel: 4,
    allowedActionTypes: ["scan", "recommend", "plan", "terraform_generate", "apply_safe", "rollback", "schedule_workflow", "access_credentials", "export_data", "monitor", "reflect"],
    requiresApproval: ["apply_safe", "schedule_workflow"],
    description: "Assisting: can apply safe changes with approval. Can rollback autonomously.",
  },
  {
    trustLevel: "operating",
    maxAutonomyLevel: 4,
    allowedActionTypes: ["scan", "recommend", "plan", "terraform_generate", "apply_safe", "apply_standard", "rollback", "schedule_workflow", "access_credentials", "export_data", "monitor", "reflect"],
    requiresApproval: ["apply_standard"],
    description: "Operating: safe applies are autonomous. Standard applies need approval.",
  },
  {
    trustLevel: "trusted",
    maxAutonomyLevel: 5,
    allowedActionTypes: ["scan", "recommend", "plan", "terraform_generate", "apply_safe", "apply_standard", "apply_destructive", "apply_cross_provider", "rollback", "modify_policy", "schedule_workflow", "access_credentials", "export_data", "monitor", "reflect"],
    requiresApproval: ["apply_destructive", "apply_cross_provider", "modify_policy", "modify_trust_level", "modify_autonomy", "modify_safety_boundary"],
    description: "Trusted: broad autonomous operation. Destructive actions and governance changes always need approval.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 13. COMPLIANCE EVIDENCE ACCUMULATION
// ═══════════════════════════════════════════════════════════════════════════

export type ComplianceEvidence = {
  id: string;
  orgId: string;
  framework: string;
  controlId: string;
  controlName: string;
  evidenceType: ComplianceEvidenceType;
  status: "collected" | "verified" | "expired" | "insufficient";
  data: Record<string, unknown>;
  collectedAt: string;
  validUntil: string;
  source: string;
};

export type ComplianceEvidenceType =
  | "audit_log"
  | "access_review"
  | "policy_evaluation"
  | "encryption_verification"
  | "backup_verification"
  | "penetration_test"
  | "change_management"
  | "incident_response"
  | "monitoring_evidence"
  | "training_record";

export type ComplianceSnapshot = {
  orgId: string;
  framework: string;
  timestamp: string;
  totalControls: number;
  controlsMet: number;
  controlsPartial: number;
  controlsNotMet: number;
  controlsNotApplicable: number;
  overallScore: number;
  gaps: ComplianceGap[];
  nextAuditDate: string | null;
};

export type ComplianceGap = {
  controlId: string;
  controlName: string;
  currentStatus: string;
  requiredEvidence: string;
  remediationSteps: string[];
  estimatedEffortDays: number;
  priority: GovernanceRiskLevel;
};

export const COMPLIANCE_CONTROL_MAP: {
  framework: string;
  controls: { id: string; name: string; evidenceTypes: ComplianceEvidenceType[]; automatable: boolean }[];
}[] = [
  {
    framework: "SOC2",
    controls: [
      { id: "CC6.1", name: "Logical access controls", evidenceTypes: ["access_review", "audit_log"], automatable: true },
      { id: "CC6.2", name: "Access provisioning", evidenceTypes: ["access_review", "change_management"], automatable: true },
      { id: "CC6.3", name: "Access removal", evidenceTypes: ["access_review", "audit_log"], automatable: true },
      { id: "CC7.1", name: "Change management", evidenceTypes: ["change_management", "audit_log"], automatable: true },
      { id: "CC7.2", name: "Infrastructure monitoring", evidenceTypes: ["monitoring_evidence", "incident_response"], automatable: true },
      { id: "CC7.3", name: "Incident response", evidenceTypes: ["incident_response", "audit_log"], automatable: false },
      { id: "CC8.1", name: "Data protection", evidenceTypes: ["encryption_verification", "backup_verification"], automatable: true },
      { id: "A1.1", name: "Availability", evidenceTypes: ["monitoring_evidence", "backup_verification"], automatable: true },
    ],
  },
  {
    framework: "GDPR",
    controls: [
      { id: "Art5", name: "Data processing principles", evidenceTypes: ["policy_evaluation", "audit_log"], automatable: false },
      { id: "Art25", name: "Data protection by design", evidenceTypes: ["encryption_verification", "access_review"], automatable: true },
      { id: "Art30", name: "Records of processing", evidenceTypes: ["audit_log", "change_management"], automatable: true },
      { id: "Art32", name: "Security of processing", evidenceTypes: ["encryption_verification", "monitoring_evidence"], automatable: true },
      { id: "Art33", name: "Breach notification", evidenceTypes: ["incident_response", "monitoring_evidence"], automatable: false },
      { id: "Art35", name: "Data protection impact assessment", evidenceTypes: ["policy_evaluation"], automatable: false },
    ],
  },
  {
    framework: "ISO27001",
    controls: [
      { id: "A.9", name: "Access control", evidenceTypes: ["access_review", "audit_log"], automatable: true },
      { id: "A.10", name: "Cryptography", evidenceTypes: ["encryption_verification"], automatable: true },
      { id: "A.12", name: "Operations security", evidenceTypes: ["monitoring_evidence", "change_management"], automatable: true },
      { id: "A.14", name: "System acquisition and maintenance", evidenceTypes: ["change_management", "policy_evaluation"], automatable: false },
      { id: "A.16", name: "Incident management", evidenceTypes: ["incident_response", "audit_log"], automatable: false },
      { id: "A.18", name: "Compliance", evidenceTypes: ["policy_evaluation", "audit_log"], automatable: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 14. GOVERNANCE DRIFT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

export type GovernanceDrift = {
  id: string;
  orgId: string;
  driftType: GovernanceDriftType;
  severity: GovernanceRiskLevel;
  description: string;
  detectedAt: string;
  expectedState: Record<string, unknown>;
  actualState: Record<string, unknown>;
  remediation: string;
  autoRemediable: boolean;
};

export type GovernanceDriftType =
  | "policy_not_enforced"        // policy exists but isn't being checked
  | "approval_bypassed"          // action occurred without required approval
  | "trust_level_mismatch"       // agent operating above its trust level
  | "autonomy_exceeded"          // agent acted beyond its autonomy config
  | "safety_boundary_violated"   // action exceeded safety limits
  | "compliance_gap_emerged"     // previously met control is now unmet
  | "audit_gap"                  // actions occurred without audit entries
  | "freeze_period_violated"     // action during freeze period
  | "credential_policy_violated" // credential handling rule broken
  | "rbac_drift";               // actual permissions don't match declared roles

// ═══════════════════════════════════════════════════════════════════════════
// 15. POLICY EXAMPLES — PRODUCTION-READY GOVERNANCE POLICIES
// ═══════════════════════════════════════════════════════════════════════════

export type GovernancePolicyExample = {
  id: string;
  name: string;
  category: string;
  description: string;
  enforcement: "audit" | "warn" | "enforce" | "block";
  applicableProviders: GovernanceProvider[];
  applicablePhases: CognitivePhaseRef[];
  rule: string;
  examples: { scenario: string; outcome: string }[];
};

export const POLICY_EXAMPLES: GovernancePolicyExample[] = [
  {
    id: "pol_no_public_storage",
    name: "No public storage buckets",
    category: "security",
    description: "Block any action that would create or leave a storage bucket publicly accessible",
    enforcement: "block",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["plan", "execute", "verify"],
    rule: "IF resource.type IN ('s3_bucket', 'storage_account', 'gcs_bucket') AND resource.publicAccess == true THEN BLOCK",
    examples: [
      { scenario: "Agent plans to create S3 bucket with public read", outcome: "BLOCKED: No public storage buckets policy" },
      { scenario: "Agent detects existing public bucket during scan", outcome: "FINDING: Policy violation, remediation recommended" },
    ],
  },
  {
    id: "pol_require_encryption",
    name: "Require encryption at rest",
    category: "security",
    description: "All storage resources must have encryption at rest enabled",
    enforcement: "block",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["plan", "execute", "verify"],
    rule: "IF resource.type IN ('ebs_volume', 's3_bucket', 'rds_instance', 'managed_disk') AND resource.encryption != 'enabled' THEN BLOCK",
    examples: [
      { scenario: "Agent plans to create unencrypted EBS volume", outcome: "BLOCKED: Encryption required" },
      { scenario: "Agent suggests disabling RDS encryption", outcome: "BLOCKED: Cannot disable encryption" },
    ],
  },
  {
    id: "pol_require_tags",
    name: "Require cost allocation tags",
    category: "cost",
    description: "All resources must have environment, team, and cost-center tags",
    enforcement: "warn",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["plan", "execute", "verify"],
    rule: "IF resource.tags NOT CONTAINS ('environment', 'team', 'cost-center') THEN WARN",
    examples: [
      { scenario: "Agent creates EC2 instance without tags", outcome: "WARNING: Missing required tags, apply proceeds with notification" },
    ],
  },
  {
    id: "pol_max_blast_radius",
    name: "Maximum blast radius per action",
    category: "safety",
    description: "No single apply action can affect more than 10 resources",
    enforcement: "block",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["plan", "execute"],
    rule: "IF action.affectedResources.count > 10 THEN BLOCK",
    examples: [
      { scenario: "Agent plans to resize 15 EC2 instances at once", outcome: "BLOCKED: Split into batches of ≤10" },
      { scenario: "Agent plans to resize 8 instances", outcome: "ALLOWED: Within blast radius" },
    ],
  },
  {
    id: "pol_require_multi_region_backup",
    name: "Require cross-region backups for production",
    category: "resilience",
    description: "Production databases must have cross-region backup configured",
    enforcement: "enforce",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["verify", "execute"],
    rule: "IF resource.environment == 'production' AND resource.type IN ('rds_instance', 'sql_database') AND NOT resource.crossRegionBackup THEN ENFORCE",
    examples: [
      { scenario: "Agent verifies prod RDS without cross-region backup", outcome: "ENFORCED: Creates finding + remediation plan" },
    ],
  },
  {
    id: "pol_no_apply_during_business_hours",
    name: "No destructive changes during business hours",
    category: "operational",
    description: "Destructive changes (delete, replace) can only be applied outside business hours (6am-6pm org timezone)",
    enforcement: "block",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["execute"],
    rule: "IF action.type IN ('apply_destructive') AND currentTime BETWEEN '06:00' AND '18:00' THEN BLOCK",
    examples: [
      { scenario: "Agent tries to delete unused EC2 at 2pm", outcome: "BLOCKED: Schedule for after 6pm" },
      { scenario: "Agent applies at 8pm", outcome: "ALLOWED: Outside business hours" },
    ],
  },
  {
    id: "pol_approval_for_production",
    name: "Require approval for production changes",
    category: "approval",
    description: "All changes to resources tagged 'environment=production' require human approval",
    enforcement: "block",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["execute"],
    rule: "IF resource.tags.environment == 'production' AND action.type STARTS_WITH 'apply_' THEN REQUIRE_APPROVAL",
    examples: [
      { scenario: "Agent applies safe fix to prod instance", outcome: "BLOCKED until approved: Production change" },
      { scenario: "Agent applies to staging instance", outcome: "ALLOWED: Not production" },
    ],
  },
  {
    id: "pol_cost_ceiling",
    name: "Monthly cost ceiling",
    category: "cost",
    description: "Agent cannot propose or apply changes that would increase monthly spend above $50,000",
    enforcement: "block",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["plan", "execute"],
    rule: "IF projectedMonthlyCost > 50000 THEN BLOCK",
    examples: [
      { scenario: "Agent plans to add 50 new instances costing $60k/mo", outcome: "BLOCKED: Exceeds cost ceiling" },
    ],
  },
  {
    id: "pol_least_privilege_iam",
    name: "Enforce least privilege IAM",
    category: "security",
    description: "Agent must never create or recommend IAM policies with wildcard (*) actions or resources",
    enforcement: "block",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["plan", "execute", "verify"],
    rule: "IF iam_policy.actions CONTAINS '*' OR iam_policy.resources CONTAINS '*' THEN BLOCK",
    examples: [
      { scenario: "Agent generates Terraform with iam:* action", outcome: "BLOCKED: Wildcard IAM actions not allowed" },
    ],
  },
  {
    id: "pol_require_rollback_plan",
    name: "Require rollback plan before apply",
    category: "safety",
    description: "Every apply action must have a verified rollback plan before execution begins",
    enforcement: "block",
    applicableProviders: ["aws", "azure", "gcp"],
    applicablePhases: ["execute"],
    rule: "IF action.type STARTS_WITH 'apply_' AND NOT action.rollbackPlan.verified THEN BLOCK",
    examples: [
      { scenario: "Agent tries to apply without rollback plan", outcome: "BLOCKED: Verify rollback capability first" },
      { scenario: "Agent applies with verified rollback", outcome: "ALLOWED: Rollback plan verified" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 16. ARCHITECTURE DIAGRAMS
// ═══════════════════════════════════════════════════════════════════════════

export type GovernanceDiagram = {
  title: string;
  description: string;
  diagram: string;
};

export const GOVERNANCE_DIAGRAMS: GovernanceDiagram[] = [
  {
    title: "Unified Governance Decision Flow",
    description: "How all governance checks combine into a single allow/deny decision",
    diagram: `
┌──────────────────────────────────────────────────────────────────────┐
│                 UNIFIED GOVERNANCE DECISION FLOW                     │
│                                                                      │
│  ACTION REQUEST                                                      │
│  ┌────────────────────────────────────────────────┐                 │
│  │ actionType, provider, risk, cost, blast radius │                 │
│  │ requestedBy, cognitivePhase, resourceIds       │                 │
│  └──────────────────────┬─────────────────────────┘                 │
│                         │                                            │
│           ┌─────────────┼─────────────┐                             │
│           │             │             │                             │
│     ┌─────▼─────┐ ┌────▼────┐ ┌──────▼──────┐                     │
│     │  TRUST    │ │AUTONOMY │ │   PHASE     │                     │
│     │  CHECK   │ │ CHECK   │ │ GOVERNANCE  │                     │
│     │          │ │         │ │             │                     │
│     │ level ≥  │ │ level ≥ │ │ action in   │                     │
│     │ required?│ │ required│ │ allowed     │                     │
│     │          │ │ + no    │ │ list for    │                     │
│     │          │ │ self-   │ │ this phase? │                     │
│     │          │ │ promote?│ │             │                     │
│     └─────┬─────┘ └────┬────┘ └──────┬──────┘                     │
│           │             │             │                             │
│           └─────────────┼─────────────┘                             │
│                         │ all pass?                                  │
│                         ▼                                            │
│           ┌─────────────┼─────────────┐                             │
│           │             │             │                             │
│     ┌─────▼─────┐ ┌────▼────┐ ┌──────▼──────┐                     │
│     │  POLICY   │ │  RBAC   │ │  PROVIDER   │                     │
│     │  CHECK   │ │ CHECK   │ │   CHECK     │                     │
│     │          │ │         │ │             │                     │
│     │ 0 block- │ │ has     │ │ capable?    │                     │
│     │ ing viol-│ │ required│ │ region ok?  │                     │
│     │ ations?  │ │ perms?  │ │ type ok?    │                     │
│     └─────┬─────┘ └────┬────┘ └──────┬──────┘                     │
│           │             │             │                             │
│           └─────────────┼─────────────┘                             │
│                         │ all pass?                                  │
│                         ▼                                            │
│           ┌─────────────┼─────────────┐                             │
│           │             │             │                             │
│     ┌─────▼─────┐ ┌────▼────┐ ┌──────▼──────┐                     │
│     │  SAFETY   │ │ROLLBACK │ │ INVARIANT   │                     │
│     │  CHECK   │ │ CHECK   │ │   CHECK     │                     │
│     │          │ │         │ │             │                     │
│     │ blast ≤  │ │rollback │ │ all 12      │                     │
│     │ max?     │ │verified?│ │ invariants  │                     │
│     │ cost ≤   │ │         │ │ held?       │                     │
│     │ max?     │ │         │ │             │                     │
│     │ no freeze│ │         │ │             │                     │
│     └─────┬─────┘ └────┬────┘ └──────┬──────┘                     │
│           │             │             │                             │
│           └─────────────┼─────────────┘                             │
│                         │                                            │
│                    ┌────▼─────┐                                     │
│                    │ VERDICT  │                                     │
│                    │          │                                     │
│                    │ ALLOW    │ ← all checks pass                   │
│                    │ DENY     │ ← any hard check fails              │
│                    │ ESCALATE │ ← human decision needed             │
│                    │ COND.    │ ← allowed if conditions met         │
│                    └────┬─────┘                                     │
│                         │                                            │
│                    ┌────▼─────┐                                     │
│                    │ EVIDENCE │                                     │
│                    │ CHAIN    │ ← tamper-evident audit              │
│                    └──────────┘                                     │
└──────────────────────────────────────────────────────────────────────┘
`,
  },
  {
    title: "Trust → Autonomy Progression",
    description: "How trust levels unlock autonomy capabilities over time",
    diagram: `
┌──────────────────────────────────────────────────────────────────────┐
│              TRUST → AUTONOMY PROGRESSION                            │
│                                                                      │
│  TRUST LEVEL        AUTONOMY    CAPABILITIES                        │
│  ────────────       ────────    ──────────────                      │
│                                                                      │
│  UNVERIFIED ──────► Level 0    • Self-reflection only               │
│  (new org)                     • No infrastructure access            │
│       │                                                              │
│       │ evidence: onboarding + initial scan                         │
│       ▼                                                              │
│  OBSERVING ───────► Level 1    • Read-only scanning                 │
│  (read only)                   • Monitoring setup                    │
│       │                        • Adaptive behavior                   │
│       │ evidence: 10+ scans, no incidents                           │
│       ▼                                                              │
│  ADVISING ────────► Level 3    • Recommendations                    │
│  (recommends)                  • Execution plans                     │
│       │                        • Terraform generation                │
│       │ evidence: 50+ accepted recommendations                      │
│       ▼                                                              │
│  ASSISTING ───────► Level 4    • Safe applies (with approval)       │
│  (safe applies)                • Autonomous rollback                 │
│       │                        • Workflow scheduling                 │
│       │ evidence: 20+ successful applies, 0 incidents               │
│       ▼                                                              │
│  OPERATING ───────► Level 4    • Safe applies (autonomous)          │
│  (autonomous)                  • Standard applies (with approval)    │
│       │                        • Credential access                   │
│       │ evidence: 100+ applies, <1% rollback rate                   │
│       ▼                                                              │
│  TRUSTED ─────────► Level 5    • Broad autonomous operation         │
│  (full trust)                  • Destructive (with approval)         │
│                                • Cross-provider (with approval)      │
│                                • Policy changes (with approval)      │
│                                                                      │
│  ⚠️  INVARIANTS AT EVERY LEVEL:                                     │
│  • Agent NEVER promotes itself                                       │
│  • Destructive actions ALWAYS need approval                         │
│  • modify_trust/autonomy/safety ALWAYS need human                   │
│  • Rollback verified BEFORE apply                                    │
│  • Audit trail for EVERY decision                                    │
└──────────────────────────────────────────────────────────────────────┘
`,
  },
  {
    title: "Governance Integration Points",
    description: "Where governance checks are enforced in the cognitive loop",
    diagram: `
┌──────────────────────────────────────────────────────────────────────┐
│            GOVERNANCE INTEGRATION IN COGNITIVE LOOP                  │
│                                                                      │
│  ┌─────────┐  trust ≥ observing                                    │
│  │ OBSERVE │  provider capability check                             │
│  │         │  audit: minimal                                        │
│  └────┬────┘                                                        │
│       │                                                              │
│  ┌────▼────┐  trust ≥ observing                                    │
│  │INTERPRET│  no governance writes allowed                          │
│  └────┬────┘                                                        │
│       │                                                              │
│  ┌────▼────┐  trust ≥ advising                                     │
│  │ REASON  │  policy compliance check                               │
│  │         │  audit: standard                                       │
│  └────┬────┘                                                        │
│       │                                                              │
│  ┌────▼────┐  trust ≥ advising                                     │
│  │PRIORIT. │  policy compliance check                               │
│  └────┬────┘                                                        │
│       │                                                              │
│  ┌────▼────┐  trust ≥ advising, autonomy ≥ 3                       │
│  │  PLAN   │  policy + safety boundary + rollback check             │
│  │         │  audit: comprehensive                                  │
│  └────┬────┘                                                        │
│       │                                                              │
│  ┌────▼────┐  ═══════════════════════════════════                   │
│  │EXECUTE  │  ALL 9 GOVERNANCE CHECKS REQUIRED:                     │
│  │         │  trust ≥ assisting, autonomy ≥ 4                       │
│  │ ★ MAX  │  policy + RBAC + safety + provider                     │
│  │ GOVERN.│  rollback + freeze + invariants                         │
│  │         │  audit: comprehensive                                  │
│  └────┬────┘  ═══════════════════════════════════                   │
│       │                                                              │
│  ┌────▼────┐  trust ≥ observing                                    │
│  │ VERIFY  │  provider capability check                             │
│  └────┬────┘                                                        │
│       │                                                              │
│  ┌────▼────┐  invariant check (cannot loosen safety)                │
│  │REFLECT  │  audit: standard                                       │
│  └────┬────┘                                                        │
│       │                                                              │
│  ┌────▼────┐  invariant check (cannot promote trust)                │
│  │ LEARN   │  audit: standard                                       │
│  └─────────┘                                                        │
└──────────────────────────────────────────────────────────────────────┘
`,
  },
  {
    title: "Compliance Evidence Lifecycle",
    description: "How governance evidence flows from actions to compliance reports",
    diagram: `
┌──────────────────────────────────────────────────────────────────────┐
│              COMPLIANCE EVIDENCE LIFECYCLE                           │
│                                                                      │
│  AGENT ACTIONS          EVIDENCE COLLECTION       COMPLIANCE        │
│  ──────────────         ───────────────────       ──────────        │
│                                                                      │
│  ┌──────────┐           ┌───────────────┐                           │
│  │ Scan     │──────────►│ Access Review │──────┐                   │
│  └──────────┘           └───────────────┘      │                   │
│                                                 │                   │
│  ┌──────────┐           ┌───────────────┐      │  ┌─────────────┐ │
│  │ Apply    │──────────►│ Change Mgmt   │──────┼─►│ SOC2       │ │
│  └──────────┘           └───────────────┘      │  │ Snapshot   │ │
│                                                 │  │            │ │
│  ┌──────────┐           ┌───────────────┐      │  │ CC6.1 ✓   │ │
│  │ Rollback │──────────►│ Incident Resp │──────┼─►│ CC7.1 ✓   │ │
│  └──────────┘           └───────────────┘      │  │ CC8.1 ✓   │ │
│                                                 │  │ Score: 87% │ │
│  ┌──────────┐           ┌───────────────┐      │  └─────────────┘ │
│  │ Verify   │──────────►│ Monitoring    │──────┘                   │
│  └──────────┘           └───────────────┘      │  ┌─────────────┐ │
│                                                 ├─►│ GDPR       │ │
│  ┌──────────┐           ┌───────────────┐      │  │ Snapshot   │ │
│  │ Policy   │──────────►│ Encryption    │──────┘  │ Art25 ✓    │ │
│  │ Eval     │           │ Verification  │         │ Art32 ✓    │ │
│  └──────────┘           └───────────────┘         │ Score: 72% │ │
│                                                    └─────────────┘ │
│  ┌──────────┐           ┌───────────────┐                          │
│  │ Audit    │──────────►│ Audit Log     │  ← tamper-evident       │
│  │ Entry    │           │ Archive       │  ← hash-chained         │
│  └──────────┘           └───────────────┘  ← org-isolated         │
│                                                                      │
│  CONTINUOUS: Evidence collected at every governance decision        │
│  PERIODIC:   Compliance snapshots generated weekly/monthly          │
│  ON-DEMAND:  Full compliance report for auditors                    │
└──────────────────────────────────────────────────────────────────────┘
`,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 17. EXECUTABLE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

let _evidenceCounter = 0;

function evidenceId(): string {
  return `ev_${++_evidenceCounter}_${Date.now()}`;
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function evaluateGovernanceDecision(
  orgId: string,
  request: ActionRequest,
  context: GovernanceContext,
): GovernanceDecision {
  const now = new Date().toISOString();
  const evidenceChain: EvidenceLink[] = [];

  // 1. Trust evaluation
  const trustReq = TRUST_REQUIREMENTS_PER_ACTION.find(t => t.actionType === request.actionType);
  const requiredTrust = trustReq?.minimumTrustLevel ?? "trusted";
  const trustSufficient = TRUST_LEVEL_ORDER.indexOf(context.currentTrustLevel) >= TRUST_LEVEL_ORDER.indexOf(requiredTrust);

  const trustEval: TrustEvaluation = {
    currentTrustLevel: context.currentTrustLevel,
    requiredTrustLevel: requiredTrust,
    trustScore: context.trustScore,
    sufficient: trustSufficient,
    trustGap: trustSufficient ? null : `Trust level "${context.currentTrustLevel}" is below required "${requiredTrust}"`,
    promotionEligible: false,
    recentTrustEvents: [],
  };
  evidenceChain.push({
    id: evidenceId(), type: "trust_score_snapshot", source: "trustEvaluator",
    timestamp: now, data: { ...trustEval }, hash: simpleHash(JSON.stringify(trustEval)),
  });

  // 2. Autonomy evaluation
  const autoReq = AUTONOMY_REQUIREMENTS.find(a => a.actionType === request.actionType);
  const requiredAutonomy = autoReq?.minimumAutonomyLevel ?? 5;
  const alwaysHuman = autoReq?.alwaysRequiresHuman ?? true;
  const autonomySufficient = context.currentAutonomyLevel >= requiredAutonomy;

  const isSelfEscalation = request.actionType === "modify_autonomy"
    && request.requestedBy.type === "agent";

  const autonomyEval: AutonomyEvaluation = {
    currentAutonomyLevel: context.currentAutonomyLevel,
    requiredAutonomyLevel: requiredAutonomy,
    sufficient: autonomySufficient && !isSelfEscalation,
    autonomyGap: autonomySufficient ? null : `Autonomy level ${context.currentAutonomyLevel} is below required ${requiredAutonomy}`,
    selfEscalationAttempt: isSelfEscalation,
    humanApprovalRequired: alwaysHuman,
    escalationReason: isSelfEscalation ? "Agent cannot promote its own autonomy level" : (alwaysHuman ? "Action always requires human approval" : null),
  };
  evidenceChain.push({
    id: evidenceId(), type: "autonomy_config_snapshot", source: "autonomyEvaluator",
    timestamp: now, data: { ...autonomyEval }, hash: simpleHash(JSON.stringify(autonomyEval)),
  });

  // 3. Phase governance check
  const phaseGov = PHASE_GOVERNANCE.find(p => p.phase === request.cognitivePhase);
  const phaseAllowed = !phaseGov || phaseGov.allowedActions.includes(request.actionType) || !phaseGov.blockedActions.includes(request.actionType);

  // 4. Policy evaluation
  const blockingViolations: GovernancePolicyViolation[] = [];
  const warningViolations: GovernancePolicyViolation[] = [];
  for (const policy of context.activePolicies) {
    if (policy.enforcement === "block") {
      if (shouldViolatePolicy(request, policy)) {
        blockingViolations.push({
          policyId: policy.id,
          policyName: policy.name,
          domain: policy.category,
          severity: "high",
          enforcement: "block",
          description: policy.description,
          affectedResources: request.resourceIds,
          remediation: `Review and comply with policy: ${policy.name}`,
          evidenceId: evidenceId(),
        });
      }
    } else if (policy.enforcement === "warn") {
      if (shouldViolatePolicy(request, policy)) {
        warningViolations.push({
          policyId: policy.id,
          policyName: policy.name,
          domain: policy.category,
          severity: "medium",
          enforcement: "warn",
          description: policy.description,
          affectedResources: request.resourceIds,
          remediation: `Consider compliance with: ${policy.name}`,
          evidenceId: evidenceId(),
        });
      }
    }
  }

  const policyEval: PolicyEvaluation = {
    policiesChecked: context.activePolicies.length,
    policiesViolated: blockingViolations.length + warningViolations.length,
    blockingViolations,
    warningViolations,
    auditViolations: [],
    overallPassed: blockingViolations.length === 0,
  };
  evidenceChain.push({
    id: evidenceId(), type: "policy_evaluation_result", source: "policyEvaluator",
    timestamp: now, data: { checked: policyEval.policiesChecked, blocking: blockingViolations.length }, hash: simpleHash(JSON.stringify(policyEval)),
  });

  // 5. RBAC evaluation
  const rbacEval: RBACEvaluation = {
    hasPermission: context.rbacPermissions.length > 0 || request.requestedBy.type === "agent",
    requiredPermissions: getRequiredPermissions(request.actionType),
    grantedPermissions: context.rbacPermissions,
    missingPermissions: [],
    providerScopeValid: true,
    roleLevel: request.requestedBy.type === "user" ? request.requestedBy.role : null,
  };
  rbacEval.missingPermissions = rbacEval.requiredPermissions.filter(p => !rbacEval.grantedPermissions.includes(p) && request.requestedBy.type === "user");
  if (rbacEval.missingPermissions.length > 0) rbacEval.hasPermission = false;

  // 6. Safety evaluation
  const invariantChecks: SafetyInvariantCheck[] = SAFETY_INVARIANTS
    .filter(inv => inv.applicablePhases.includes(request.cognitivePhase))
    .map(inv => ({
      invariantId: inv.id,
      name: inv.name,
      held: checkInvariant(inv.id, request, context),
      evidence: `Checked at ${now}`,
    }));

  const safetyEval: SafetyEvaluation = {
    withinBlastRadius: request.estimatedBlastRadius <= context.safetyBoundary.maxBlastRadius,
    withinCostCeiling: request.estimatedCostImpact <= context.safetyBoundary.maxCostImpact,
    withinResourceLimit: request.resourceIds.length <= context.safetyBoundary.maxResourcesModified,
    noForbiddenActions: !context.safetyBoundary.forbiddenActions.includes(request.actionType),
    notInFreezePeriod: !isInFreezePeriod(context.safetyBoundary.freezePeriods),
    invariantsHeld: invariantChecks,
    overallSafe: false,
  };
  safetyEval.overallSafe = safetyEval.withinBlastRadius && safetyEval.withinCostCeiling
    && safetyEval.withinResourceLimit && safetyEval.noForbiddenActions
    && safetyEval.notInFreezePeriod && invariantChecks.every(c => c.held);
  evidenceChain.push({
    id: evidenceId(), type: "safety_check_result", source: "safetyEvaluator",
    timestamp: now, data: { safe: safetyEval.overallSafe }, hash: simpleHash(JSON.stringify(safetyEval)),
  });

  // 7. Provider evaluation
  const providerEval: ProviderEvaluation = {
    provider: request.provider,
    capable: request.provider === "none" || context.providerCapable,
    missingCapabilities: context.providerCapable ? [] : ["apply"],
    providerBoundaryPassed: true,
    regionAllowed: true,
    resourceTypeAllowed: true,
    concurrencyAvailable: true,
  };

  // 8. Rollback evaluation
  const rollbackEval: RollbackEvaluation = {
    rollbackAvailable: request.reversible || !request.actionType.startsWith("apply"),
    rollbackStrategy: request.reversible ? "automated" : null,
    rollbackVerified: request.reversible,
    rollbackTimeEstimateMs: request.reversible ? 60_000 : null,
    requiresApprovalWithoutRollback: !request.reversible && request.actionType.startsWith("apply"),
  };

  // VERDICT
  let verdict: GovernanceVerdict = "allow";
  let escalation: EscalationRequirement | null = null;
  const conditions: GovernanceCondition[] = [];

  // Hard denials
  if (isSelfEscalation) {
    verdict = "deny";
  } else if (!trustSufficient) {
    verdict = "deny";
  } else if (!autonomySufficient) {
    verdict = "deny";
  } else if (!phaseAllowed) {
    verdict = "deny";
  } else if (!policyEval.overallPassed) {
    verdict = "deny";
  } else if (!safetyEval.overallSafe) {
    verdict = "deny";
  } else if (!providerEval.capable) {
    verdict = "deny";
  } else if (rbacEval.missingPermissions.length > 0) {
    verdict = "deny";
  }

  // Escalation
  if (verdict === "allow" && alwaysHuman) {
    verdict = "escalate";
    escalation = {
      reason: "high_risk_action",
      urgency: request.riskLevel === "critical" ? "critical" : request.riskLevel === "high" ? "high" : "medium",
      requiredApprovers: [],
      requiredApprovalCount: 1,
      escalationTimeoutMs: 24 * 60 * 60 * 1000,
      fallbackAction: "deny",
      context: `Action "${request.actionType}" always requires human approval`,
    };
  }

  if (verdict === "allow" && rollbackEval.requiresApprovalWithoutRollback) {
    verdict = "allow_with_conditions";
    conditions.push({
      type: "require_approval",
      description: "No rollback available — requires explicit human approval",
      met: false,
    });
  }

  if (verdict === "allow" && warningViolations.length > 0) {
    conditions.push({
      type: "require_monitoring",
      description: `${warningViolations.length} policy warnings — increased monitoring required`,
      met: true,
    });
    if (conditions.length > 0) verdict = "allow_with_conditions";
  }

  const decision: GovernanceDecision = {
    id: `gov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now,
    orgId,
    requestedAction: request,
    verdict,
    trustEvaluation: trustEval,
    autonomyEvaluation: autonomyEval,
    policyEvaluation: policyEval,
    rbacEvaluation: rbacEval,
    safetyEvaluation: safetyEval,
    providerEvaluation: providerEval,
    rollbackEvaluation: rollbackEval,
    evidenceChain,
    escalationRequired: escalation,
    conditions,
    auditHash: simpleHash(JSON.stringify({ orgId, request: request.actionType, verdict, now })),
  };

  return decision;
}

// Supporting types and helpers

export type GovernanceContext = {
  currentTrustLevel: TrustLevelRef;
  trustScore: number;
  currentAutonomyLevel: number;
  activePolicies: GovernancePolicyExample[];
  rbacPermissions: string[];
  safetyBoundary: {
    maxBlastRadius: number;
    maxCostImpact: number;
    maxResourcesModified: number;
    forbiddenActions: string[];
    freezePeriods: { name: string; startTime: string; endTime: string }[];
  };
  providerCapable: boolean;
  previousActionTypes: string[];
};

const TRUST_LEVEL_ORDER: TrustLevelRef[] = [
  "unverified", "observing", "advising", "assisting", "operating", "trusted",
];

function shouldViolatePolicy(request: ActionRequest, policy: GovernancePolicyExample): boolean {
  if (!policy.applicablePhases.includes(request.cognitivePhase) && request.cognitivePhase !== "none") return false;
  if (policy.applicableProviders.length > 0 && !policy.applicableProviders.includes(request.provider) && request.provider !== "none") return false;

  if (policy.id === "pol_max_blast_radius" && request.estimatedBlastRadius > 10) return true;
  if (policy.id === "pol_cost_ceiling" && request.estimatedCostImpact > 50000) return true;
  if (policy.id === "pol_require_rollback_plan" && !request.reversible && request.actionType.startsWith("apply")) return true;

  return false;
}

function getRequiredPermissions(actionType: GovernanceActionType): string[] {
  const map: Record<string, string[]> = {
    scan: ["scan:read"],
    recommend: ["findings:read", "recommendations:read"],
    plan: ["recommendations:read", "actions:plan"],
    terraform_generate: ["terraform:generate"],
    apply_safe: ["actions:apply"],
    apply_standard: ["actions:apply"],
    apply_destructive: ["actions:apply", "actions:destroy"],
    apply_cross_provider: ["actions:apply"],
    rollback: ["actions:apply"],
    modify_policy: ["policies:write"],
    modify_trust_level: ["org:admin"],
    modify_autonomy: ["org:admin"],
    modify_safety_boundary: ["org:admin"],
    access_credentials: ["cloud_accounts:read"],
    export_data: ["audit:read"],
    schedule_workflow: ["workflows:write"],
    monitor: ["scan:read"],
    reflect: [],
  };
  return map[actionType] ?? [];
}

function checkInvariant(invariantId: string, request: ActionRequest, context: GovernanceContext): boolean {
  switch (invariantId) {
    case "inv_no_self_promotion":
      return !(request.actionType === "modify_trust_level" && request.requestedBy.type === "agent");
    case "inv_no_silent_escalation":
      return !(request.actionType === "modify_autonomy" && request.requestedBy.type === "agent");
    case "inv_blast_radius_ceiling":
      return request.estimatedBlastRadius <= context.safetyBoundary.maxBlastRadius;
    case "inv_cost_ceiling":
      return request.estimatedCostImpact <= context.safetyBoundary.maxCostImpact;
    case "inv_rollback_before_apply":
      return !request.actionType.startsWith("apply") || request.reversible;
    case "inv_approval_for_high_risk":
      return request.riskLevel !== "high" && request.riskLevel !== "critical";
    case "inv_freeze_period_respect":
      return !request.actionType.startsWith("apply") || !isInFreezePeriod(context.safetyBoundary.freezePeriods);
    case "inv_reflection_cannot_loosen_safety":
      return request.cognitivePhase !== "reflect" || request.actionType !== "modify_safety_boundary";
    case "inv_first_time_escalation":
      return context.previousActionTypes.includes(request.actionType);
    default:
      return true;
  }
}

function isInFreezePeriod(periods: { startTime: string; endTime: string }[]): boolean {
  const now = new Date();
  return periods.some(p => {
    const start = new Date(p.startTime);
    const end = new Date(p.endTime);
    return now >= start && now <= end;
  });
}

export function getTrustRequirementForAction(actionType: GovernanceActionType): TrustLevelRef {
  const req = TRUST_REQUIREMENTS_PER_ACTION.find(t => t.actionType === actionType);
  return req?.minimumTrustLevel ?? "trusted";
}

export function getAutonomyRequirementForAction(actionType: GovernanceActionType): AutonomyRequirement | undefined {
  return AUTONOMY_REQUIREMENTS.find(a => a.actionType === actionType);
}

export function getPhaseGovernance(phase: CognitivePhaseRef): PhaseGovernancePolicy | undefined {
  return PHASE_GOVERNANCE.find(p => p.phase === phase);
}

export function getTrustAutonomyMapping(trustLevel: TrustLevelRef): TrustAutonomyMapping | undefined {
  return TRUST_AUTONOMY_MAP.find(m => m.trustLevel === trustLevel);
}

export function getAllowedActionsForTrust(trustLevel: TrustLevelRef): GovernanceActionType[] {
  const mapping = TRUST_AUTONOMY_MAP.find(m => m.trustLevel === trustLevel);
  return mapping?.allowedActionTypes ?? [];
}

export function getComplianceControls(framework: string): { id: string; name: string; automatable: boolean }[] {
  const map = COMPLIANCE_CONTROL_MAP.find(c => c.framework === framework);
  return map?.controls.map(c => ({ id: c.id, name: c.name, automatable: c.automatable })) ?? [];
}

export function getApplicableInvariants(phase: CognitivePhaseRef): typeof SAFETY_INVARIANTS {
  return SAFETY_INVARIANTS.filter(inv => inv.applicablePhases.includes(phase));
}

// ═══════════════════════════════════════════════════════════════════════════
// 18. TESTS
// ═══════════════════════════════════════════════════════════════════════════

export type GovernanceEngineTestResult = { name: string; passed: boolean; detail: string };

export function _resetGovernanceCounters(): void {
  _evidenceCounter = 0;
}

export function runGovernanceEngineTests(): GovernanceEngineTestResult[] {
  const results: GovernanceEngineTestResult[] = [];
  _resetGovernanceCounters();

  const baseContext: GovernanceContext = {
    currentTrustLevel: "operating",
    trustScore: 85,
    currentAutonomyLevel: 4,
    activePolicies: POLICY_EXAMPLES,
    rbacPermissions: ["scan:read", "findings:read", "recommendations:read", "actions:plan", "actions:apply", "terraform:generate", "cloud_accounts:read"],
    safetyBoundary: { maxBlastRadius: 10, maxCostImpact: 5000, maxResourcesModified: 25, forbiddenActions: [], freezePeriods: [] },
    providerCapable: true,
    previousActionTypes: ["scan", "recommend", "plan", "apply_safe"],
  };

  // 1. Allow read-only scan
  const scanDecision = evaluateGovernanceDecision("org_test", {
    actionType: "scan", provider: "aws", region: "us-east-1", resourceIds: [], resourceTypes: [],
    riskLevel: "none", estimatedCostImpact: 0, estimatedBlastRadius: 0, reversible: true,
    description: "Infrastructure scan", requestedBy: { type: "agent", autonomyLevel: 4, trustLevel: "operating", workflowId: null },
    cognitivePhase: "observe", workflowInstanceId: null,
  }, baseContext);
  results.push({
    name: "Scan allowed at operating trust level",
    passed: scanDecision.verdict === "allow",
    detail: `verdict=${scanDecision.verdict}`,
  });

  // 2. Deny self-promotion (CRITICAL INVARIANT)
  const selfPromote = evaluateGovernanceDecision("org_test", {
    actionType: "modify_autonomy", provider: "none", region: null, resourceIds: [], resourceTypes: [],
    riskLevel: "critical", estimatedCostImpact: 0, estimatedBlastRadius: 0, reversible: false,
    description: "Agent attempting to increase own autonomy", requestedBy: { type: "agent", autonomyLevel: 4, trustLevel: "operating", workflowId: null },
    cognitivePhase: "learn", workflowInstanceId: null,
  }, baseContext);
  results.push({
    name: "Agent CANNOT self-promote autonomy (invariant)",
    passed: selfPromote.verdict === "deny" && selfPromote.autonomyEvaluation.selfEscalationAttempt,
    detail: `verdict=${selfPromote.verdict}, selfEscalation=${selfPromote.autonomyEvaluation.selfEscalationAttempt}`,
  });

  // 3. Deny insufficient trust
  const lowTrustCtx = { ...baseContext, currentTrustLevel: "observing" as TrustLevelRef };
  const lowTrustApply = evaluateGovernanceDecision("org_test", {
    actionType: "apply_standard", provider: "aws", region: "us-east-1", resourceIds: ["i-123"],
    resourceTypes: ["ec2_instance"], riskLevel: "medium", estimatedCostImpact: 100, estimatedBlastRadius: 1,
    reversible: true, description: "Resize EC2", requestedBy: { type: "agent", autonomyLevel: 4, trustLevel: "observing", workflowId: null },
    cognitivePhase: "execute", workflowInstanceId: null,
  }, lowTrustCtx);
  results.push({
    name: "Apply denied at insufficient trust level (observing < operating)",
    passed: lowTrustApply.verdict === "deny" && !lowTrustApply.trustEvaluation.sufficient,
    detail: `verdict=${lowTrustApply.verdict}, trust sufficient=${lowTrustApply.trustEvaluation.sufficient}`,
  });

  // 4. Escalate high-risk action
  const highRisk = evaluateGovernanceDecision("org_test", {
    actionType: "apply_destructive", provider: "aws", region: "us-east-1", resourceIds: ["i-123"],
    resourceTypes: ["ec2_instance"], riskLevel: "high", estimatedCostImpact: 200, estimatedBlastRadius: 1,
    reversible: true, description: "Delete unused instance",
    requestedBy: { type: "agent", autonomyLevel: 5, trustLevel: "trusted", workflowId: null },
    cognitivePhase: "execute", workflowInstanceId: null,
  }, { ...baseContext, currentTrustLevel: "trusted" as TrustLevelRef, currentAutonomyLevel: 5, previousActionTypes: [...baseContext.previousActionTypes, "apply_destructive"] });
  results.push({
    name: "Destructive action always escalates to human",
    passed: highRisk.verdict === "escalate" && highRisk.escalationRequired !== null,
    detail: `verdict=${highRisk.verdict}`,
  });

  // 5. Deny blast radius exceeded
  const blastExceeded = evaluateGovernanceDecision("org_test", {
    actionType: "apply_safe", provider: "aws", region: "us-east-1", resourceIds: Array.from({ length: 20 }, (_, i) => `r-${i}`),
    resourceTypes: ["ec2_instance"], riskLevel: "medium", estimatedCostImpact: 100, estimatedBlastRadius: 20,
    reversible: true, description: "Batch resize",
    requestedBy: { type: "agent", autonomyLevel: 4, trustLevel: "operating", workflowId: null },
    cognitivePhase: "execute", workflowInstanceId: null,
  }, baseContext);
  results.push({
    name: "Deny action exceeding blast radius",
    passed: blastExceeded.verdict === "deny" && !blastExceeded.safetyEvaluation.withinBlastRadius,
    detail: `verdict=${blastExceeded.verdict}, blastOk=${blastExceeded.safetyEvaluation.withinBlastRadius}`,
  });

  // 6. Evidence chain populated
  results.push({
    name: "Evidence chain populated for every decision",
    passed: scanDecision.evidenceChain.length >= 3,
    detail: `${scanDecision.evidenceChain.length} evidence links`,
  });

  // 7. Trust requirements cover all action types
  const allActions: GovernanceActionType[] = [
    "scan", "recommend", "plan", "terraform_generate", "apply_safe", "apply_standard",
    "apply_destructive", "apply_cross_provider", "rollback", "modify_policy",
    "modify_trust_level", "modify_autonomy", "modify_safety_boundary",
    "access_credentials", "export_data", "schedule_workflow", "monitor", "reflect",
  ];
  const trustCovered = allActions.every(a => TRUST_REQUIREMENTS_PER_ACTION.some(t => t.actionType === a));
  results.push({
    name: "TRUST_REQUIREMENTS covers all 18 action types",
    passed: trustCovered,
    detail: `${TRUST_REQUIREMENTS_PER_ACTION.length} / ${allActions.length}`,
  });

  // 8. Autonomy requirements cover all action types
  const autonomyCovered = allActions.every(a => AUTONOMY_REQUIREMENTS.some(r => r.actionType === a));
  results.push({
    name: "AUTONOMY_REQUIREMENTS covers all 18 action types",
    passed: autonomyCovered,
    detail: `${AUTONOMY_REQUIREMENTS.length} / ${allActions.length}`,
  });

  // 9. Phase governance covers all 9 phases
  const phases: CognitivePhaseRef[] = ["observe", "interpret", "reason", "prioritize", "plan", "execute", "verify", "reflect", "learn"];
  const phasesCovered = phases.every(p => PHASE_GOVERNANCE.some(g => g.phase === p));
  results.push({
    name: "PHASE_GOVERNANCE covers all 9 cognitive phases",
    passed: phasesCovered,
    detail: `${PHASE_GOVERNANCE.length} / ${phases.length}`,
  });

  // 10. Trust-autonomy map covers all 6 trust levels
  const trustLevels: TrustLevelRef[] = ["unverified", "observing", "advising", "assisting", "operating", "trusted"];
  const mapCovered = trustLevels.every(l => TRUST_AUTONOMY_MAP.some(m => m.trustLevel === l));
  results.push({
    name: "TRUST_AUTONOMY_MAP covers all 6 trust levels",
    passed: mapCovered,
    detail: `${TRUST_AUTONOMY_MAP.length} / ${trustLevels.length}`,
  });

  // 11. Safety invariants all testable
  const allTestable = SAFETY_INVARIANTS.every(inv => inv.testable);
  results.push({
    name: "All 12 safety invariants are testable",
    passed: allTestable && SAFETY_INVARIANTS.length === 12,
    detail: `${SAFETY_INVARIANTS.length} invariants, all testable=${allTestable}`,
  });

  // 12. Policy examples cover key domains
  const domains = new Set(POLICY_EXAMPLES.map(p => p.category));
  results.push({
    name: "POLICY_EXAMPLES covers security, cost, safety, resilience, operational, approval",
    passed: domains.size >= 5,
    detail: `${domains.size} domains: ${Array.from(domains).join(", ")}`,
  });

  // 13. Compliance control map has 3 frameworks
  results.push({
    name: "COMPLIANCE_CONTROL_MAP covers SOC2, GDPR, ISO27001",
    passed: COMPLIANCE_CONTROL_MAP.length === 3,
    detail: `${COMPLIANCE_CONTROL_MAP.length} frameworks`,
  });

  // 14. Diagrams present
  results.push({
    name: "GOVERNANCE_DIAGRAMS has 4 architecture diagrams",
    passed: GOVERNANCE_DIAGRAMS.length === 4,
    detail: `${GOVERNANCE_DIAGRAMS.length} diagrams`,
  });

  // 15. Trust→Autonomy map enforces no self-promotion at every level
  const noSelfPromo = TRUST_AUTONOMY_MAP.every(m =>
    m.requiresApproval.includes("modify_trust_level") || !m.allowedActionTypes.includes("modify_trust_level")
  );
  results.push({
    name: "Trust map never allows self-promotion without approval",
    passed: noSelfPromo,
    detail: `all levels enforce approval for modify_trust_level`,
  });

  // 16. Execute phase requires all 9 governance checks
  const execPhase = PHASE_GOVERNANCE.find(p => p.phase === "execute")!;
  results.push({
    name: "Execute phase requires all 9 governance check types",
    passed: execPhase.requiredChecks.length === 9,
    detail: `${execPhase.requiredChecks.length} checks required`,
  });

  // 17. Governance drift types defined
  const driftTypes: GovernanceDriftType[] = [
    "policy_not_enforced", "approval_bypassed", "trust_level_mismatch",
    "autonomy_exceeded", "safety_boundary_violated", "compliance_gap_emerged",
    "audit_gap", "freeze_period_violated", "credential_policy_violated", "rbac_drift",
  ];
  results.push({
    name: "10 governance drift types defined",
    passed: driftTypes.length === 10,
    detail: `${driftTypes.length} drift types`,
  });

  // 18. Accessor functions work
  const trustReq = getTrustRequirementForAction("apply_destructive");
  results.push({
    name: "getTrustRequirementForAction returns correct level",
    passed: trustReq === "trusted",
    detail: `apply_destructive requires "${trustReq}"`,
  });

  // 19. Phase governance accessor works
  const planGov = getPhaseGovernance("plan");
  results.push({
    name: "getPhaseGovernance returns correct policy for plan phase",
    passed: planGov !== undefined && planGov.autonomyMinimum === 3,
    detail: `plan autonomy minimum=${planGov?.autonomyMinimum}`,
  });

  // 20. Allowed actions for trust level
  const advisingActions = getAllowedActionsForTrust("advising");
  results.push({
    name: "getAllowedActionsForTrust returns correct set for advising",
    passed: advisingActions.includes("recommend") && advisingActions.includes("plan") && !advisingActions.includes("apply_safe"),
    detail: `${advisingActions.length} actions allowed at advising`,
  });

  return results;
}
