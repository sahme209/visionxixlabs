/**
 * Autonomy levels — typed safety ladder for what Axiom is allowed to do
 * in a tenant. Defaults to Level 2 (Plan). Higher levels require explicit
 * tenant policy + admin approval — Axiom can never silently self-promote.
 */

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface AutonomyLevelSpec {
  level: AutonomyLevel;
  name: string;
  description: string;
  /** Capabilities active at this level. */
  capabilities: string[];
  /** Capabilities explicitly disabled at this level. */
  disabled: string[];
  /** Default — true if this level is the platform's safe default. */
  isDefault: boolean;
  /** Requires explicit tenant policy + admin approval to activate. */
  requiresExplicitOptIn: boolean;
}

export const AUTONOMY_LEVELS: AutonomyLevelSpec[] = [
  {
    level: 0,
    name: "Observe Only",
    description: "Scan, report, and explain. No execution plans generated.",
    capabilities: ["cloud_scan", "report_generation", "memory_capture"],
    disabled: ["recommendation_generation", "execution_plan_generation", "execution", "auto_apply"],
    isDefault: false,
    requiresExplicitOptIn: false,
  },
  {
    level: 1,
    name: "Recommend",
    description: "Generate findings + recommendations + reasoning traces. No execution plans unless user requests.",
    capabilities: ["cloud_scan", "recommendations", "reasoning_traces", "memory_capture"],
    disabled: ["execution_plan_generation", "execution", "auto_apply"],
    isDefault: false,
    requiresExplicitOptIn: false,
  },
  {
    level: 2,
    name: "Plan",
    description: "Generate execution plan candidates with Terraform/CLI previews + rollback planning. Approval required.",
    capabilities: ["cloud_scan", "recommendations", "execution_plans", "terraform_preview", "rollback_plans", "approval_routing"],
    disabled: ["execution", "auto_apply"],
    isDefault: true,
    requiresExplicitOptIn: false,
  },
  {
    level: 3,
    name: "Prepare",
    description: "Generate exports, prepare desktop handoffs, queue approval. No apply without approval.",
    capabilities: ["cloud_scan", "recommendations", "execution_plans", "terraform_export", "cli_export", "desktop_handoff", "approval_routing"],
    disabled: ["execution", "auto_apply"],
    isDefault: false,
    requiresExplicitOptIn: true,
  },
  {
    level: 4,
    name: "Assisted Execute",
    description: "Apply human-approved execution plans. Verification required. Rollback always prepared.",
    capabilities: ["cloud_scan", "recommendations", "execution_plans", "terraform_export", "approval_routing", "execution_with_approval", "verification", "rollback_orchestration"],
    disabled: ["auto_apply"],
    isDefault: false,
    requiresExplicitOptIn: true,
  },
  {
    level: 5,
    name: "Autonomous Execute",
    description: "Auto-apply for explicitly allowed low-risk action classes only. Disabled by default. Tenant policy + full audit required. High-risk classes always remain manual.",
    capabilities: ["cloud_scan", "recommendations", "execution_plans", "terraform_export", "approval_routing", "execution_with_approval", "verification", "rollback_orchestration", "auto_apply_low_risk_only"],
    disabled: [],
    isDefault: false,
    requiresExplicitOptIn: true,
  },
];

// ---------------------------------------------------------------------------
// Tenant autonomy state
// ---------------------------------------------------------------------------

export interface TenantAutonomy {
  organizationId: string;
  level: AutonomyLevel;
  /** Action classes explicitly opted-into for auto-apply when level >= 5. */
  autoApplyClasses: string[];
  /** Action classes that can never be auto-applied regardless of level. */
  blockedAutoApplyClasses: string[];
  /** Audit trail of every autonomy change. */
  changeLog: { fromLevel: AutonomyLevel; toLevel: AutonomyLevel; at: string; changedBy: string; reason: string }[];
  updatedAt: string;
}

const DEFAULT_AUTONOMY: Omit<TenantAutonomy, "organizationId" | "updatedAt"> = {
  level: 2,
  autoApplyClasses: [],
  blockedAutoApplyClasses: ["iam_modification", "network_modification", "database_modification", "secret_rotation", "release_rollback"],
  changeLog: [],
};

export function defaultAutonomyFor(organizationId: string): TenantAutonomy {
  return { ...DEFAULT_AUTONOMY, organizationId, updatedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Validation — Axiom can never silently increase autonomy
// ---------------------------------------------------------------------------

export interface AutonomyChangeRequest {
  organizationId: string;
  fromLevel: AutonomyLevel;
  toLevel: AutonomyLevel;
  requestedBy: string;
  reason: string;
}

export type AutonomyChangeResult =
  | { allowed: true; newAutonomy: TenantAutonomy }
  | { allowed: false; blockReason: string; requiredApproval?: ApprovalRequirementSummary };

export interface ApprovalRequirementSummary {
  role: string;
  count: number;
}

/**
 * Evaluate an autonomy change request. Increases require explicit admin role.
 * Decreases are always allowed (safer direction).
 */
export function evaluateAutonomyChange(current: TenantAutonomy, request: AutonomyChangeRequest, actorRole: string): AutonomyChangeResult {
  if (request.organizationId !== current.organizationId) {
    return { allowed: false, blockReason: "Autonomy change requested for a different tenant." };
  }
  if (request.fromLevel !== current.level) {
    return { allowed: false, blockReason: `Stale autonomy change — current level is ${current.level}, request claims ${request.fromLevel}.` };
  }
  // Decreases — always allowed
  if (request.toLevel <= request.fromLevel) {
    return {
      allowed: true,
      newAutonomy: {
        ...current,
        level: request.toLevel,
        changeLog: [{ fromLevel: request.fromLevel, toLevel: request.toLevel, at: new Date().toISOString(), changedBy: request.requestedBy, reason: request.reason }, ...current.changeLog].slice(0, 100),
        updatedAt: new Date().toISOString(),
      },
    };
  }
  // Increases — require admin role
  if (actorRole !== "admin" && actorRole !== "owner") {
    return { allowed: false, blockReason: "Autonomy increases require an organization admin or owner.", requiredApproval: { role: "admin", count: 1 } };
  }
  // Level 5 requires admin + a documented reason >= 30 chars
  if (request.toLevel === 5 && request.reason.length < 30) {
    return { allowed: false, blockReason: "Level 5 (Autonomous Execute) requires a documented reason of at least 30 characters." };
  }
  return {
    allowed: true,
    newAutonomy: {
      ...current,
      level: request.toLevel,
      changeLog: [{ fromLevel: request.fromLevel, toLevel: request.toLevel, at: new Date().toISOString(), changedBy: request.requestedBy, reason: request.reason }, ...current.changeLog].slice(0, 100),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function specFor(level: AutonomyLevel): AutonomyLevelSpec {
  return AUTONOMY_LEVELS[level];
}
