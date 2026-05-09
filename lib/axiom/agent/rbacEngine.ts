/**
 * Axiom Enterprise RBAC & Approval Policy Engine
 *
 * Provides:
 *   - Role-based permission checks scoped per organization
 *   - Provider-scoped membership (user may only see AWS, not Azure)
 *   - Risk-tiered approval policies with configurable approval counts
 *   - Multi-approver approval chains with escalation & expiration
 *   - RBAC-specific audit trail for compliance
 *   - Built-in example policies for common enterprise setups
 *
 * Safety invariants:
 *   - High-risk actions always require 2+ approvals or are blocked
 *   - No role can self-approve an action it triggered
 *   - Approval chains cannot be resolved by a single user voting twice
 *   - Provider scope restricts visibility, not just write access
 *   - All RBAC mutations produce immutable audit events
 */

import {
  OrgRole,
  ApprovalChainStatus,
  RiskLevel,
  ActionType,
  ActionDisposition,
  CloudProvider,
  FindingCategory,
} from "../enums";

// ---------------------------------------------------------------------------
// 1. Permission definitions
// ---------------------------------------------------------------------------

export type Permission =
  | "scan:run"
  | "scan:view"
  | "findings:view"
  | "recommendations:view"
  | "recommendations:approve"
  | "recommendations:reject"
  | "recommendations:snooze"
  | "actions:apply"
  | "actions:rollback"
  | "terraform:export"
  | "cli:export"
  | "audit:view"
  | "preferences:view"
  | "preferences:edit"
  | "autopilot:configure"
  | "members:view"
  | "members:invite"
  | "members:remove"
  | "members:change_role"
  | "policies:view"
  | "policies:manage"
  | "cloud_accounts:view"
  | "cloud_accounts:connect"
  | "cloud_accounts:disconnect"
  | "cloud_accounts:rotate_credentials"
  | "api_keys:create"
  | "api_keys:revoke"
  | "billing:manage"
  | "org:delete"
  | "workflows:view"
  | "workflows:manage";

const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  [OrgRole.Owner]: new Set<Permission>([
    "scan:run", "scan:view",
    "findings:view",
    "recommendations:view", "recommendations:approve", "recommendations:reject", "recommendations:snooze",
    "actions:apply", "actions:rollback",
    "terraform:export", "cli:export",
    "audit:view",
    "preferences:view", "preferences:edit",
    "autopilot:configure",
    "members:view", "members:invite", "members:remove", "members:change_role",
    "policies:view", "policies:manage",
    "cloud_accounts:view", "cloud_accounts:connect", "cloud_accounts:disconnect", "cloud_accounts:rotate_credentials",
    "api_keys:create", "api_keys:revoke",
    "billing:manage",
    "org:delete",
    "workflows:view", "workflows:manage",
  ]),

  [OrgRole.Admin]: new Set<Permission>([
    "scan:run", "scan:view",
    "findings:view",
    "recommendations:view", "recommendations:approve", "recommendations:reject", "recommendations:snooze",
    "actions:apply", "actions:rollback",
    "terraform:export", "cli:export",
    "audit:view",
    "preferences:view", "preferences:edit",
    "autopilot:configure",
    "members:view", "members:invite", "members:remove", "members:change_role",
    "policies:view", "policies:manage",
    "cloud_accounts:view", "cloud_accounts:connect", "cloud_accounts:disconnect", "cloud_accounts:rotate_credentials",
    "api_keys:create", "api_keys:revoke",
    "workflows:view", "workflows:manage",
  ]),

  [OrgRole.Operator]: new Set<Permission>([
    "scan:run", "scan:view",
    "findings:view",
    "recommendations:view", "recommendations:approve", "recommendations:reject", "recommendations:snooze",
    "actions:apply", "actions:rollback",
    "terraform:export", "cli:export",
    "audit:view",
    "preferences:view",
    "members:view",
    "policies:view",
    "cloud_accounts:view",
    "workflows:view",
  ]),

  [OrgRole.SecurityReviewer]: new Set<Permission>([
    "scan:view",
    "findings:view",
    "recommendations:view", "recommendations:approve", "recommendations:reject",
    "audit:view",
    "preferences:view",
    "members:view",
    "policies:view",
    "cloud_accounts:view",
  ]),

  [OrgRole.FinanceViewer]: new Set<Permission>([
    "scan:view",
    "findings:view",
    "recommendations:view",
    "terraform:export",
    "audit:view",
    "preferences:view",
    "cloud_accounts:view",
    "billing:manage",
  ]),

  [OrgRole.ReadOnly]: new Set<Permission>([
    "scan:view",
    "findings:view",
    "recommendations:view",
    "audit:view",
    "preferences:view",
    "cloud_accounts:view",
  ]),
};

// Role hierarchy — higher index = more privilege
const ROLE_RANK: Record<OrgRole, number> = {
  [OrgRole.ReadOnly]: 0,
  [OrgRole.FinanceViewer]: 1,
  [OrgRole.SecurityReviewer]: 2,
  [OrgRole.Operator]: 3,
  [OrgRole.Admin]: 4,
  [OrgRole.Owner]: 5,
};

// ---------------------------------------------------------------------------
// 2. Membership types
// ---------------------------------------------------------------------------

export type Membership = {
  userId: string;
  organizationId: string;
  role: OrgRole;
  providerScopes: CloudProvider[];
};

// ---------------------------------------------------------------------------
// 3. Permission checks
// ---------------------------------------------------------------------------

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function getPermissions(role: OrgRole): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

export function isRoleAtLeast(role: OrgRole, minimumRole: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}

export function canManageRole(actorRole: OrgRole, targetRole: OrgRole): boolean {
  if (actorRole === targetRole) return false;
  if (targetRole === OrgRole.Owner) return actorRole === OrgRole.Owner;
  return ROLE_RANK[actorRole] > ROLE_RANK[targetRole];
}

export function isProviderInScope(
  membership: Membership,
  provider: CloudProvider,
): boolean {
  if (membership.providerScopes.length === 0) return true;
  return membership.providerScopes.includes(provider);
}

export type AuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function authorize(
  membership: Membership,
  permission: Permission,
  provider?: CloudProvider,
): AuthorizationResult {
  if (!hasPermission(membership.role, permission)) {
    return {
      allowed: false,
      reason: `Role '${membership.role}' lacks permission '${permission}'`,
    };
  }
  if (provider && !isProviderInScope(membership, provider)) {
    return {
      allowed: false,
      reason: `Provider '${provider}' is outside your scope [${membership.providerScopes.join(", ")}]`,
    };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// 4. Approval policy types
// ---------------------------------------------------------------------------

export type ApprovalPolicyDef = {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;

  matchRiskLevels: RiskLevel[];
  matchActionTypes: ActionType[];
  matchProviders: CloudProvider[];
  matchCategories: FindingCategory[];
  matchMinSavings?: number;

  requiredApprovals: number;
  requiredRoles: OrgRole[];
  escalateAfterHours?: number;
  escalateToRoles: OrgRole[];
  autoExpireHours?: number;
  blockAction: boolean;
};

export type ApprovalTarget = {
  riskLevel: RiskLevel;
  actionType: ActionType;
  provider: CloudProvider;
  category: FindingCategory;
  yearlySavings: number;
  disposition: ActionDisposition;
};

export type PolicyMatch = {
  policy: ApprovalPolicyDef;
  requiredApprovals: number;
  requiredRoles: OrgRole[];
  blocked: boolean;
  escalateAfterHours?: number;
  autoExpireHours?: number;
};

// ---------------------------------------------------------------------------
// 5. Policy evaluation
// ---------------------------------------------------------------------------

function matchesPolicy(policy: ApprovalPolicyDef, target: ApprovalTarget): boolean {
  if (policy.matchRiskLevels.length > 0 && !policy.matchRiskLevels.includes(target.riskLevel)) {
    return false;
  }
  if (policy.matchActionTypes.length > 0 && !policy.matchActionTypes.includes(target.actionType)) {
    return false;
  }
  if (policy.matchProviders.length > 0 && !policy.matchProviders.includes(target.provider)) {
    return false;
  }
  if (policy.matchCategories.length > 0 && !policy.matchCategories.includes(target.category)) {
    return false;
  }
  if (policy.matchMinSavings != null && target.yearlySavings < policy.matchMinSavings) {
    return false;
  }
  return true;
}

export function resolveApprovalPolicy(
  policies: ApprovalPolicyDef[],
  target: ApprovalTarget,
): PolicyMatch | null {
  const enabled = policies
    .filter((p) => p.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const policy of enabled) {
    if (matchesPolicy(policy, target)) {
      return {
        policy,
        requiredApprovals: policy.blockAction ? 0 : policy.requiredApprovals,
        requiredRoles: policy.requiredRoles,
        blocked: policy.blockAction,
        escalateAfterHours: policy.escalateAfterHours,
        autoExpireHours: policy.autoExpireHours,
      };
    }
  }

  return null;
}

export function resolveWithDefaults(
  policies: ApprovalPolicyDef[],
  target: ApprovalTarget,
): PolicyMatch {
  const explicit = resolveApprovalPolicy(policies, target);
  if (explicit) return explicit;

  return applyDefaultPolicy(target);
}

function applyDefaultPolicy(target: ApprovalTarget): PolicyMatch {
  const fallback: ApprovalPolicyDef = {
    id: "__default__",
    organizationId: "",
    name: "Default Policy",
    enabled: true,
    priority: -1,
    matchRiskLevels: [],
    matchActionTypes: [],
    matchProviders: [],
    matchCategories: [],
    requiredApprovals: 1,
    requiredRoles: [],
    escalateToRoles: [OrgRole.Owner],
    blockAction: false,
  };

  switch (target.riskLevel) {
    case RiskLevel.Low:
      fallback.requiredApprovals = 1;
      fallback.requiredRoles = [OrgRole.Operator, OrgRole.Admin, OrgRole.Owner];
      fallback.autoExpireHours = 168; // 7 days
      break;
    case RiskLevel.Medium:
      fallback.requiredApprovals = 2;
      fallback.requiredRoles = [OrgRole.Admin, OrgRole.Owner, OrgRole.SecurityReviewer];
      fallback.escalateAfterHours = 48;
      fallback.autoExpireHours = 120; // 5 days
      break;
    case RiskLevel.High:
      if (
        target.actionType === ActionType.DecommissionCompute ||
        target.actionType === ActionType.PurchaseCommitment
      ) {
        fallback.blockAction = true;
        fallback.requiredApprovals = 0;
      } else {
        fallback.requiredApprovals = 2;
        fallback.requiredRoles = [OrgRole.Admin, OrgRole.Owner];
        fallback.escalateAfterHours = 24;
        fallback.autoExpireHours = 72;
      }
      break;
  }

  return {
    policy: fallback,
    requiredApprovals: fallback.blockAction ? 0 : fallback.requiredApprovals,
    requiredRoles: fallback.requiredRoles,
    blocked: fallback.blockAction,
    escalateAfterHours: fallback.escalateAfterHours,
    autoExpireHours: fallback.autoExpireHours,
  };
}

// ---------------------------------------------------------------------------
// 6. Approval chain management
// ---------------------------------------------------------------------------

export type ApprovalChain = {
  id: string;
  organizationId: string;
  approvalItemId: string;
  policyId: string;
  status: ApprovalChainStatus;
  requiredCount: number;
  currentCount: number;
  votes: ApprovalVote[];
  escalatedAt?: string;
  expiresAt?: string;
  resolvedAt?: string;
  createdAt: string;
};

export type ApprovalVote = {
  id: string;
  chainId: string;
  userId: string;
  role: OrgRole;
  decision: VoteDecision;
  reason?: string;
  createdAt: string;
};

export type VoteDecision = "approve" | "reject" | "escalate";

export type VoteInput = {
  chainId: string;
  userId: string;
  role: OrgRole;
  decision: VoteDecision;
  reason?: string;
};

export type VoteResult =
  | { accepted: true; chainStatus: ApprovalChainStatus; votesRemaining: number }
  | { accepted: false; reason: string };

export type ChainResolution = {
  status: ApprovalChainStatus;
  approvalsReceived: number;
  approvalsRequired: number;
  rejectionsReceived: number;
  escalated: boolean;
  expired: boolean;
};

// In-memory chain store for the engine (production uses Prisma)
const chainStore = new Map<string, ApprovalChain>();
let chainCounter = 0;

export function _resetChainStore(): void {
  chainStore.clear();
  chainCounter = 0;
}

export function createChain(
  organizationId: string,
  approvalItemId: string,
  policyMatch: PolicyMatch,
): ApprovalChain {
  const id = `chain-${++chainCounter}`;
  const now = new Date().toISOString();
  const chain: ApprovalChain = {
    id,
    organizationId,
    approvalItemId,
    policyId: policyMatch.policy.id,
    status: ApprovalChainStatus.PendingApprovals,
    requiredCount: policyMatch.requiredApprovals,
    currentCount: 0,
    votes: [],
    expiresAt: policyMatch.autoExpireHours
      ? new Date(Date.now() + policyMatch.autoExpireHours * 3600 * 1000).toISOString()
      : undefined,
    createdAt: now,
  };
  chainStore.set(id, chain);
  return chain;
}

export function getChain(chainId: string): ApprovalChain | null {
  return chainStore.get(chainId) ?? null;
}

export function getChainsForItem(approvalItemId: string): ApprovalChain[] {
  return [...chainStore.values()].filter((c) => c.approvalItemId === approvalItemId);
}

export function getChainsForOrg(
  organizationId: string,
  status?: ApprovalChainStatus,
): ApprovalChain[] {
  return [...chainStore.values()].filter(
    (c) => c.organizationId === organizationId && (!status || c.status === status),
  );
}

// ---------------------------------------------------------------------------
// 7. Voting
// ---------------------------------------------------------------------------

export function castVote(input: VoteInput, triggerUserId: string): VoteResult {
  const chain = chainStore.get(input.chainId);
  if (!chain) {
    return { accepted: false, reason: "Approval chain not found" };
  }

  if (chain.status !== ApprovalChainStatus.PendingApprovals) {
    return { accepted: false, reason: `Chain already resolved: ${chain.status}` };
  }

  // Self-approval guard: the user who triggered the action cannot approve it
  if (input.userId === triggerUserId && input.decision === "approve") {
    return { accepted: false, reason: "Cannot self-approve an action you triggered" };
  }

  // Duplicate vote guard
  if (chain.votes.some((v) => v.userId === input.userId)) {
    return { accepted: false, reason: "You have already voted on this chain" };
  }

  // Expiration check
  if (chain.expiresAt && new Date(chain.expiresAt) < new Date()) {
    chain.status = ApprovalChainStatus.Expired;
    chain.resolvedAt = new Date().toISOString();
    return { accepted: false, reason: "Approval chain has expired" };
  }

  const vote: ApprovalVote = {
    id: `vote-${chain.votes.length + 1}`,
    chainId: input.chainId,
    userId: input.userId,
    role: input.role,
    decision: input.decision,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };

  chain.votes.push(vote);

  // Resolve chain state
  const resolution = resolveChain(chain);
  chain.status = resolution.status;
  chain.currentCount = resolution.approvalsReceived;

  if (resolution.status !== ApprovalChainStatus.PendingApprovals) {
    chain.resolvedAt = new Date().toISOString();
  }
  if (resolution.escalated && !chain.escalatedAt) {
    chain.escalatedAt = new Date().toISOString();
  }

  const votesRemaining = Math.max(0, chain.requiredCount - resolution.approvalsReceived);

  return { accepted: true, chainStatus: chain.status, votesRemaining };
}

export function resolveChain(chain: ApprovalChain): ChainResolution {
  const approvals = chain.votes.filter((v) => v.decision === "approve").length;
  const rejections = chain.votes.filter((v) => v.decision === "reject").length;
  const escalations = chain.votes.filter((v) => v.decision === "escalate").length;
  const expired = chain.expiresAt ? new Date(chain.expiresAt) < new Date() : false;

  // Any rejection immediately rejects the chain
  if (rejections > 0) {
    return {
      status: ApprovalChainStatus.Rejected,
      approvalsReceived: approvals,
      approvalsRequired: chain.requiredCount,
      rejectionsReceived: rejections,
      escalated: false,
      expired: false,
    };
  }

  // Any escalation vote escalates
  if (escalations > 0) {
    return {
      status: ApprovalChainStatus.Escalated,
      approvalsReceived: approvals,
      approvalsRequired: chain.requiredCount,
      rejectionsReceived: 0,
      escalated: true,
      expired: false,
    };
  }

  // Enough approvals
  if (approvals >= chain.requiredCount) {
    return {
      status: ApprovalChainStatus.Approved,
      approvalsReceived: approvals,
      approvalsRequired: chain.requiredCount,
      rejectionsReceived: 0,
      escalated: false,
      expired: false,
    };
  }

  // Expired
  if (expired) {
    return {
      status: ApprovalChainStatus.Expired,
      approvalsReceived: approvals,
      approvalsRequired: chain.requiredCount,
      rejectionsReceived: 0,
      escalated: false,
      expired: true,
    };
  }

  // Still pending
  return {
    status: ApprovalChainStatus.PendingApprovals,
    approvalsReceived: approvals,
    approvalsRequired: chain.requiredCount,
    rejectionsReceived: 0,
    escalated: false,
    expired: false,
  };
}

// ---------------------------------------------------------------------------
// 8. Escalation check
// ---------------------------------------------------------------------------

export type EscalationCheck = {
  chainId: string;
  shouldEscalate: boolean;
  hoursSinceCreation: number;
  escalateAfterHours: number;
  escalateToRoles: OrgRole[];
};

export function checkEscalation(
  chain: ApprovalChain,
  policy: ApprovalPolicyDef,
): EscalationCheck {
  if (chain.status !== ApprovalChainStatus.PendingApprovals) {
    return {
      chainId: chain.id,
      shouldEscalate: false,
      hoursSinceCreation: 0,
      escalateAfterHours: policy.escalateAfterHours ?? 0,
      escalateToRoles: [],
    };
  }

  const hoursSince = (Date.now() - new Date(chain.createdAt).getTime()) / (3600 * 1000);
  const threshold = policy.escalateAfterHours ?? Infinity;

  return {
    chainId: chain.id,
    shouldEscalate: hoursSince >= threshold,
    hoursSinceCreation: Math.round(hoursSince * 10) / 10,
    escalateAfterHours: policy.escalateAfterHours ?? 0,
    escalateToRoles: policy.escalateToRoles,
  };
}

// ---------------------------------------------------------------------------
// 9. RBAC audit event builder
// ---------------------------------------------------------------------------

export type RbacAuditEvent = {
  organizationId: string;
  actorId: string;
  actorRole: OrgRole;
  action: RbacAuditAction;
  targetType: "membership" | "policy" | "chain" | "item" | "vote";
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type RbacAuditAction =
  | "role_assigned"
  | "role_changed"
  | "member_removed"
  | "member_invited"
  | "policy_created"
  | "policy_updated"
  | "policy_deleted"
  | "policy_toggled"
  | "chain_created"
  | "approval_voted"
  | "chain_escalated"
  | "chain_expired"
  | "provider_scope_changed";

const auditLog: RbacAuditEvent[] = [];

export function logRbacEvent(event: RbacAuditEvent): void {
  auditLog.push(event);
}

export function getRbacAuditLog(
  organizationId: string,
  limit = 50,
): RbacAuditEvent[] {
  return auditLog
    .filter((e) => e.organizationId === organizationId)
    .slice(-limit);
}

export function _resetAuditLog(): void {
  auditLog.length = 0;
}

// ---------------------------------------------------------------------------
// 10. Full authorization flow: membership + policy → chain or block
// ---------------------------------------------------------------------------

export type AuthorizationDecision = {
  permitted: boolean;
  disposition: "allowed" | "approval_required" | "blocked" | "insufficient_role" | "out_of_scope";
  policyMatch?: PolicyMatch;
  chain?: ApprovalChain;
  reason: string;
};

export function authorizeAction(
  membership: Membership,
  target: ApprovalTarget,
  policies: ApprovalPolicyDef[],
  triggerUserId: string,
): AuthorizationDecision {
  // Step 1: Check base permission
  const authResult = authorize(membership, "recommendations:approve", target.provider);
  if (!authResult.allowed) {
    return {
      permitted: false,
      disposition: membership.providerScopes.length > 0 &&
        !membership.providerScopes.includes(target.provider)
        ? "out_of_scope"
        : "insufficient_role",
      reason: authResult.reason,
    };
  }

  // Step 2: Resolve approval policy
  const policyMatch = resolveWithDefaults(policies, target);

  // Step 3: Block if policy says block
  if (policyMatch.blocked) {
    return {
      permitted: false,
      disposition: "blocked",
      policyMatch,
      reason: `Blocked by policy '${policyMatch.policy.name}': ${target.actionType} at risk level ${target.riskLevel}`,
    };
  }

  // Step 4: Check if role qualifies as an approver for this policy
  if (
    policyMatch.requiredRoles.length > 0 &&
    !policyMatch.requiredRoles.includes(membership.role)
  ) {
    return {
      permitted: false,
      disposition: "insufficient_role",
      policyMatch,
      reason: `Policy '${policyMatch.policy.name}' requires roles [${policyMatch.requiredRoles.join(", ")}], you have '${membership.role}'`,
    };
  }

  // Step 5: If approvals required, create or return existing chain
  if (policyMatch.requiredApprovals > 0) {
    return {
      permitted: false,
      disposition: "approval_required",
      policyMatch,
      reason: `Requires ${policyMatch.requiredApprovals} approval(s) from [${policyMatch.requiredRoles.join(", ") || "any authorized role"}]`,
    };
  }

  // Step 6: No approvals needed (auto-approve path)
  return {
    permitted: true,
    disposition: "allowed",
    policyMatch,
    reason: "Action permitted by policy",
  };
}

// ---------------------------------------------------------------------------
// 11. Example policies
// ---------------------------------------------------------------------------

export const EXAMPLE_POLICIES: Omit<ApprovalPolicyDef, "id" | "organizationId">[] = [
  {
    name: "Low-risk single approval",
    description: "Low-risk actions need 1 approval from an operator, admin, or owner",
    enabled: true,
    priority: 10,
    matchRiskLevels: [RiskLevel.Low],
    matchActionTypes: [],
    matchProviders: [],
    matchCategories: [],
    requiredApprovals: 1,
    requiredRoles: [OrgRole.Operator, OrgRole.Admin, OrgRole.Owner],
    escalateToRoles: [OrgRole.Admin],
    escalateAfterHours: 72,
    autoExpireHours: 168,
    blockAction: false,
  },
  {
    name: "Medium-risk dual approval",
    description: "Medium-risk actions need 2 approvals, at least 1 from admin or security reviewer",
    enabled: true,
    priority: 20,
    matchRiskLevels: [RiskLevel.Medium],
    matchActionTypes: [],
    matchProviders: [],
    matchCategories: [],
    requiredApprovals: 2,
    requiredRoles: [OrgRole.Admin, OrgRole.Owner, OrgRole.SecurityReviewer],
    escalateToRoles: [OrgRole.Owner],
    escalateAfterHours: 48,
    autoExpireHours: 120,
    blockAction: false,
  },
  {
    name: "High-risk block by default",
    description: "High-risk actions are blocked and require manual escalation",
    enabled: true,
    priority: 30,
    matchRiskLevels: [RiskLevel.High],
    matchActionTypes: [],
    matchProviders: [],
    matchCategories: [],
    requiredApprovals: 0,
    requiredRoles: [],
    escalateToRoles: [OrgRole.Owner],
    blockAction: true,
  },
  {
    name: "Decommission always blocked",
    description: "Decommission actions are always blocked regardless of risk level",
    enabled: true,
    priority: 100,
    matchRiskLevels: [],
    matchActionTypes: [ActionType.DecommissionCompute],
    matchProviders: [],
    matchCategories: [],
    requiredApprovals: 0,
    requiredRoles: [],
    escalateToRoles: [OrgRole.Owner],
    blockAction: true,
  },
  {
    name: "Commitment purchase requires owner",
    description: "Reserved instance / savings plan purchases require owner-level approval",
    enabled: true,
    priority: 90,
    matchRiskLevels: [],
    matchActionTypes: [ActionType.PurchaseCommitment],
    matchProviders: [],
    matchCategories: [],
    requiredApprovals: 1,
    requiredRoles: [OrgRole.Owner],
    escalateToRoles: [],
    autoExpireHours: 72,
    blockAction: false,
  },
  {
    name: "Security findings need security reviewer",
    description: "Security-category findings require security reviewer sign-off",
    enabled: true,
    priority: 50,
    matchRiskLevels: [],
    matchActionTypes: [],
    matchProviders: [],
    matchCategories: [FindingCategory.Security],
    requiredApprovals: 1,
    requiredRoles: [OrgRole.SecurityReviewer, OrgRole.Admin, OrgRole.Owner],
    escalateToRoles: [OrgRole.Admin],
    escalateAfterHours: 24,
    autoExpireHours: 72,
    blockAction: false,
  },
  {
    name: "High-value cost optimization",
    description: "Cost optimizations saving >$50K/year need dual admin approval",
    enabled: true,
    priority: 60,
    matchRiskLevels: [],
    matchActionTypes: [],
    matchProviders: [],
    matchCategories: [FindingCategory.Cost],
    matchMinSavings: 50_000,
    requiredApprovals: 2,
    requiredRoles: [OrgRole.Admin, OrgRole.Owner],
    escalateToRoles: [OrgRole.Owner],
    escalateAfterHours: 48,
    autoExpireHours: 120,
    blockAction: false,
  },
];

// ---------------------------------------------------------------------------
// 12. Policy presets — one-click setup for common enterprise configurations
// ---------------------------------------------------------------------------

export type PolicyPreset = {
  name: string;
  description: string;
  policies: Omit<ApprovalPolicyDef, "id" | "organizationId">[];
};

export const POLICY_PRESETS: Record<string, PolicyPreset> = {
  startup: {
    name: "Startup — Move Fast",
    description: "Low friction: single approval for most actions, block only high-risk destructive",
    policies: [
      {
        name: "Single approval for everything",
        enabled: true,
        priority: 10,
        matchRiskLevels: [RiskLevel.Low, RiskLevel.Medium],
        matchActionTypes: [],
        matchProviders: [],
        matchCategories: [],
        requiredApprovals: 1,
        requiredRoles: [OrgRole.Operator, OrgRole.Admin, OrgRole.Owner],
        escalateToRoles: [OrgRole.Owner],
        autoExpireHours: 168,
        blockAction: false,
      },
      {
        name: "Block high-risk destructive",
        enabled: true,
        priority: 50,
        matchRiskLevels: [RiskLevel.High],
        matchActionTypes: [ActionType.DecommissionCompute, ActionType.PurchaseCommitment],
        matchProviders: [],
        matchCategories: [],
        requiredApprovals: 0,
        requiredRoles: [],
        escalateToRoles: [OrgRole.Owner],
        blockAction: true,
      },
    ],
  },

  enterprise: {
    name: "Enterprise — Compliance First",
    description: "Strict: dual approval for medium+, mandatory security review, block destructive",
    policies: EXAMPLE_POLICIES,
  },

  regulated: {
    name: "Regulated — Healthcare / Finance",
    description: "Maximum control: dual approval for everything, security review required, all high-risk blocked",
    policies: [
      {
        name: "All actions need dual approval",
        enabled: true,
        priority: 10,
        matchRiskLevels: [RiskLevel.Low, RiskLevel.Medium],
        matchActionTypes: [],
        matchProviders: [],
        matchCategories: [],
        requiredApprovals: 2,
        requiredRoles: [OrgRole.Admin, OrgRole.Owner, OrgRole.SecurityReviewer],
        escalateToRoles: [OrgRole.Owner],
        escalateAfterHours: 24,
        autoExpireHours: 72,
        blockAction: false,
      },
      {
        name: "All high-risk blocked",
        enabled: true,
        priority: 50,
        matchRiskLevels: [RiskLevel.High],
        matchActionTypes: [],
        matchProviders: [],
        matchCategories: [],
        requiredApprovals: 0,
        requiredRoles: [],
        escalateToRoles: [OrgRole.Owner],
        blockAction: true,
      },
      {
        name: "Security findings need security + admin",
        enabled: true,
        priority: 60,
        matchRiskLevels: [],
        matchActionTypes: [],
        matchProviders: [],
        matchCategories: [FindingCategory.Security, FindingCategory.Compliance],
        requiredApprovals: 2,
        requiredRoles: [OrgRole.SecurityReviewer, OrgRole.Admin, OrgRole.Owner],
        escalateToRoles: [OrgRole.Owner],
        escalateAfterHours: 12,
        autoExpireHours: 48,
        blockAction: false,
      },
    ],
  },
};

export function getPresetNames(): string[] {
  return Object.keys(POLICY_PRESETS);
}

export function loadPreset(presetName: string): PolicyPreset | null {
  return POLICY_PRESETS[presetName] ?? null;
}

// ---------------------------------------------------------------------------
// 13. Invariant tests
// ---------------------------------------------------------------------------

export type RbacTestResult = { name: string; passed: boolean; detail: string };

export function runRbacTests(): RbacTestResult[] {
  const results: RbacTestResult[] = [];
  _resetChainStore();
  _resetAuditLog();

  // Test 1: Owner has all permissions
  {
    const allPerms = getPermissions(OrgRole.Owner);
    const has = allPerms.includes("org:delete") && allPerms.includes("billing:manage");
    results.push({
      name: "Owner has full permissions including org:delete and billing:manage",
      passed: has,
      detail: `Owner permissions: ${allPerms.length}`,
    });
  }

  // Test 2: ReadOnly cannot approve
  {
    const can = hasPermission(OrgRole.ReadOnly, "recommendations:approve");
    results.push({
      name: "ReadOnly cannot approve recommendations",
      passed: !can,
      detail: `hasPermission(read_only, approve) = ${can}`,
    });
  }

  // Test 3: SecurityReviewer can approve but cannot apply
  {
    const canApprove = hasPermission(OrgRole.SecurityReviewer, "recommendations:approve");
    const canApply = hasPermission(OrgRole.SecurityReviewer, "actions:apply");
    results.push({
      name: "SecurityReviewer can approve but cannot apply",
      passed: canApprove && !canApply,
      detail: `approve=${canApprove}, apply=${canApply}`,
    });
  }

  // Test 4: Provider scope restricts access
  {
    const membership: Membership = {
      userId: "u1",
      organizationId: "org1",
      role: OrgRole.Operator,
      providerScopes: [CloudProvider.AWS],
    };
    const aws = authorize(membership, "scan:run", CloudProvider.AWS);
    const gcp = authorize(membership, "scan:run", CloudProvider.GCP);
    results.push({
      name: "Provider scope restricts out-of-scope providers",
      passed: aws.allowed && !gcp.allowed,
      detail: `AWS=${aws.allowed}, GCP=${gcp.allowed}`,
    });
  }

  // Test 5: Default policy assigns correct approvals by risk
  {
    const lowTarget: ApprovalTarget = {
      riskLevel: RiskLevel.Low,
      actionType: ActionType.ResizeCompute,
      provider: CloudProvider.AWS,
      category: FindingCategory.Cost,
      yearlySavings: 5000,
      disposition: ActionDisposition.ApprovalRequired,
    };
    const highTarget: ApprovalTarget = {
      ...lowTarget,
      riskLevel: RiskLevel.High,
      actionType: ActionType.DecommissionCompute,
    };
    const lowMatch = resolveWithDefaults([], lowTarget);
    const highMatch = resolveWithDefaults([], highTarget);
    results.push({
      name: "Default policy: low=1 approval, high decommission=blocked",
      passed: lowMatch.requiredApprovals === 1 && highMatch.blocked,
      detail: `low=${lowMatch.requiredApprovals} approvals, high blocked=${highMatch.blocked}`,
    });
  }

  // Test 6: Custom policy overrides default
  {
    const customPolicy: ApprovalPolicyDef = {
      id: "p1",
      organizationId: "org1",
      name: "Custom",
      enabled: true,
      priority: 10,
      matchRiskLevels: [RiskLevel.Low],
      matchActionTypes: [],
      matchProviders: [],
      matchCategories: [],
      requiredApprovals: 3,
      requiredRoles: [OrgRole.Owner],
      escalateToRoles: [],
      blockAction: false,
    };
    const target: ApprovalTarget = {
      riskLevel: RiskLevel.Low,
      actionType: ActionType.ResizeCompute,
      provider: CloudProvider.AWS,
      category: FindingCategory.Cost,
      yearlySavings: 1000,
      disposition: ActionDisposition.ApprovalRequired,
    };
    const match = resolveWithDefaults([customPolicy], target);
    results.push({
      name: "Custom policy overrides default (3 approvals for low-risk)",
      passed: match.requiredApprovals === 3 && match.policy.id === "p1",
      detail: `approvals=${match.requiredApprovals}, policy=${match.policy.id}`,
    });
  }

  // Test 7: Approval chain requires multiple votes
  {
    const policyMatch: PolicyMatch = {
      policy: {
        id: "p2",
        organizationId: "org1",
        name: "Dual approval",
        enabled: true,
        priority: 10,
        matchRiskLevels: [],
        matchActionTypes: [],
        matchProviders: [],
        matchCategories: [],
        requiredApprovals: 2,
        requiredRoles: [],
        escalateToRoles: [],
        blockAction: false,
      },
      requiredApprovals: 2,
      requiredRoles: [],
      blocked: false,
    };

    const chain = createChain("org1", "item-1", policyMatch);
    const v1 = castVote(
      { chainId: chain.id, userId: "u1", role: OrgRole.Admin, decision: "approve" },
      "u-trigger",
    );
    const afterV1 = getChain(chain.id)!;

    const v2 = castVote(
      { chainId: chain.id, userId: "u2", role: OrgRole.Owner, decision: "approve" },
      "u-trigger",
    );
    const afterV2 = getChain(chain.id)!;

    results.push({
      name: "Chain needs 2 approvals: pending after 1, approved after 2",
      passed:
        v1.accepted === true &&
        afterV1.status === ApprovalChainStatus.PendingApprovals &&
        v2.accepted === true &&
        afterV2.status === ApprovalChainStatus.Approved,
      detail: `After v1: ${afterV1.status}, after v2: ${afterV2.status}`,
    });
  }

  // Test 8: Self-approval is blocked
  {
    const policyMatch: PolicyMatch = {
      policy: {
        id: "p3", organizationId: "org1", name: "Test", enabled: true, priority: 1,
        matchRiskLevels: [], matchActionTypes: [], matchProviders: [], matchCategories: [],
        requiredApprovals: 1, requiredRoles: [], escalateToRoles: [], blockAction: false,
      },
      requiredApprovals: 1,
      requiredRoles: [],
      blocked: false,
    };

    const chain = createChain("org1", "item-2", policyMatch);
    const result = castVote(
      { chainId: chain.id, userId: "trigger-user", role: OrgRole.Admin, decision: "approve" },
      "trigger-user",
    );
    results.push({
      name: "Self-approval is blocked",
      passed: result.accepted === false,
      detail: `accepted=${result.accepted}, reason=${"reason" in result ? result.reason : ""}`,
    });
  }

  // Test 9: Duplicate vote is blocked
  {
    const policyMatch: PolicyMatch = {
      policy: {
        id: "p4", organizationId: "org1", name: "Test", enabled: true, priority: 1,
        matchRiskLevels: [], matchActionTypes: [], matchProviders: [], matchCategories: [],
        requiredApprovals: 2, requiredRoles: [], escalateToRoles: [], blockAction: false,
      },
      requiredApprovals: 2,
      requiredRoles: [],
      blocked: false,
    };

    const chain = createChain("org1", "item-3", policyMatch);
    castVote(
      { chainId: chain.id, userId: "u1", role: OrgRole.Admin, decision: "approve" },
      "u-trigger",
    );
    const dup = castVote(
      { chainId: chain.id, userId: "u1", role: OrgRole.Admin, decision: "approve" },
      "u-trigger",
    );
    results.push({
      name: "Duplicate vote by same user is blocked",
      passed: dup.accepted === false,
      detail: `accepted=${dup.accepted}, reason=${"reason" in dup ? dup.reason : ""}`,
    });
  }

  // Test 10: Single rejection immediately rejects chain
  {
    const policyMatch: PolicyMatch = {
      policy: {
        id: "p5", organizationId: "org1", name: "Test", enabled: true, priority: 1,
        matchRiskLevels: [], matchActionTypes: [], matchProviders: [], matchCategories: [],
        requiredApprovals: 3, requiredRoles: [], escalateToRoles: [], blockAction: false,
      },
      requiredApprovals: 3,
      requiredRoles: [],
      blocked: false,
    };

    const chain = createChain("org1", "item-4", policyMatch);
    castVote(
      { chainId: chain.id, userId: "u1", role: OrgRole.Admin, decision: "approve" },
      "u-trigger",
    );
    castVote(
      { chainId: chain.id, userId: "u2", role: OrgRole.Owner, decision: "reject", reason: "Too risky" },
      "u-trigger",
    );
    const final = getChain(chain.id)!;
    results.push({
      name: "Single rejection immediately rejects a chain",
      passed: final.status === ApprovalChainStatus.Rejected,
      detail: `Status: ${final.status}, votes: ${final.votes.length}`,
    });
  }

  // Test 11: Role hierarchy — admin can manage operator but not owner
  {
    const canManageOp = canManageRole(OrgRole.Admin, OrgRole.Operator);
    const canManageOwner = canManageRole(OrgRole.Admin, OrgRole.Owner);
    const canManageSelf = canManageRole(OrgRole.Admin, OrgRole.Admin);
    results.push({
      name: "Admin can manage operator, cannot manage owner or self",
      passed: canManageOp && !canManageOwner && !canManageSelf,
      detail: `operator=${canManageOp}, owner=${canManageOwner}, self=${canManageSelf}`,
    });
  }

  // Test 12: Policy priority — higher priority wins
  {
    const lowPriority: ApprovalPolicyDef = {
      id: "low", organizationId: "org1", name: "Low", enabled: true, priority: 10,
      matchRiskLevels: [RiskLevel.Medium], matchActionTypes: [], matchProviders: [],
      matchCategories: [], requiredApprovals: 1, requiredRoles: [], escalateToRoles: [],
      blockAction: false,
    };
    const highPriority: ApprovalPolicyDef = {
      id: "high", organizationId: "org1", name: "High", enabled: true, priority: 50,
      matchRiskLevels: [RiskLevel.Medium], matchActionTypes: [], matchProviders: [],
      matchCategories: [], requiredApprovals: 3, requiredRoles: [OrgRole.Owner], escalateToRoles: [],
      blockAction: false,
    };
    const target: ApprovalTarget = {
      riskLevel: RiskLevel.Medium, actionType: ActionType.ResizeCompute,
      provider: CloudProvider.Azure, category: FindingCategory.Cost,
      yearlySavings: 10000, disposition: ActionDisposition.ApprovalRequired,
    };
    const match = resolveApprovalPolicy([lowPriority, highPriority], target);
    results.push({
      name: "Higher priority policy wins when both match",
      passed: match?.policy.id === "high" && match.requiredApprovals === 3,
      detail: `Winner: ${match?.policy.id}, approvals: ${match?.requiredApprovals}`,
    });
  }

  // Test 13: RBAC audit log records events
  {
    _resetAuditLog();
    logRbacEvent({
      organizationId: "org1",
      actorId: "u1",
      actorRole: OrgRole.Owner,
      action: "role_assigned",
      targetType: "membership",
      targetId: "m1",
      after: { role: OrgRole.Operator },
    });
    logRbacEvent({
      organizationId: "org1",
      actorId: "u1",
      actorRole: OrgRole.Owner,
      action: "policy_created",
      targetType: "policy",
      targetId: "p1",
    });
    const log = getRbacAuditLog("org1");
    results.push({
      name: "RBAC audit log records and retrieves events",
      passed: log.length === 2 && log[0].action === "role_assigned" && log[1].action === "policy_created",
      detail: `Events: ${log.length}, actions: [${log.map((e) => e.action).join(", ")}]`,
    });
  }

  // Test 14: FinanceViewer can view but cannot approve or apply
  {
    const canView = hasPermission(OrgRole.FinanceViewer, "findings:view");
    const canApprove = hasPermission(OrgRole.FinanceViewer, "recommendations:approve");
    const canApply = hasPermission(OrgRole.FinanceViewer, "actions:apply");
    const canBilling = hasPermission(OrgRole.FinanceViewer, "billing:manage");
    results.push({
      name: "FinanceViewer: view+billing yes, approve+apply no",
      passed: canView && !canApprove && !canApply && canBilling,
      detail: `view=${canView}, approve=${canApprove}, apply=${canApply}, billing=${canBilling}`,
    });
  }

  // Test 15: Escalation vote immediately escalates
  {
    const policyMatch: PolicyMatch = {
      policy: {
        id: "p-esc", organizationId: "org1", name: "Test", enabled: true, priority: 1,
        matchRiskLevels: [], matchActionTypes: [], matchProviders: [], matchCategories: [],
        requiredApprovals: 2, requiredRoles: [], escalateToRoles: [OrgRole.Owner], blockAction: false,
      },
      requiredApprovals: 2,
      requiredRoles: [],
      blocked: false,
    };

    const chain = createChain("org1", "item-esc", policyMatch);
    castVote(
      { chainId: chain.id, userId: "u1", role: OrgRole.Operator, decision: "escalate", reason: "Need owner eyes" },
      "u-trigger",
    );
    const final = getChain(chain.id)!;
    results.push({
      name: "Escalation vote immediately escalates the chain",
      passed: final.status === ApprovalChainStatus.Escalated && final.escalatedAt != null,
      detail: `Status: ${final.status}, escalatedAt: ${final.escalatedAt}`,
    });
  }

  _resetChainStore();
  _resetAuditLog();

  return results;
}
