/**
 * Enterprise permission engine.
 *
 * `rbac.ts` answers the narrow question "does this role have this
 * permission?". Real enterprise authorisation needs more: a permission
 * check is a *composition* of role + resource scope + provider scope +
 * environment scope + action risk + tenant policy + autonomy level +
 * (for desktop actions) desktop allowance.
 *
 * `evaluatePermission()` returns a typed `PermissionDecision` that the
 * apiGuard, copilot, and audit layer all read. No sensitive action should
 * call `hasPermission()` directly — they call `evaluatePermission()` so the
 * decision carries a stable rationale.
 */

import type { Permission } from "./rbac";
import { hasPermission as roleHasPermission } from "./rbac";
import type { TenantScope } from "./tenantScope";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type EnvironmentScope = "development" | "qa" | "staging" | "production";

export type ProviderScope = "aws" | "azure" | "gcp" | "github" | "system" | "desktop";

export type ActionRisk = "low" | "medium" | "high" | "critical";

export interface PermissionRequest {
  scope: TenantScope;
  permission: Permission;
  /** What environment the action targets (drives stricter gates for production). */
  environment?: EnvironmentScope;
  /** What provider the action targets — drives provider-scoped policy. */
  provider?: ProviderScope;
  /** Risk classification — interacts with autonomy level. */
  risk?: ActionRisk;
  /** Optional resource id — surfaced in the audit record. */
  resourceRef?: string;
  /** When set, the engine ANDs role check with the resource owner check. */
  resourceOwnerUserId?: string;
}

export interface TenantPermissionSettings {
  /** Autonomy ladder level (0..5). Higher allows more without approval. */
  autonomyLevel: number;
  /** True when desktop apply is allowed by tenant policy. */
  desktopApplyAllowed: boolean;
  /** Per-environment override: actions targeting these environments require
   *  human approval regardless of role. */
  requireApprovalFor: EnvironmentScope[];
  /** Permissions explicitly blocked at the tenant level. */
  blockedPermissions: Permission[];
  /** Freeze window: production deploys paused during this interval. */
  productionFreezeWindow?: { fromIso: string; toIso: string };
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export type PermissionVerdict =
  | "allow"            // Action proceeds without approval
  | "require_approval" // Action is allowed by RBAC but needs human sign-off
  | "deny";            // Action is hard-blocked

export interface PermissionDecision {
  verdict: PermissionVerdict;
  /** Stable code for audit + UI switching. */
  code: string;
  /** User-facing reason — safe to render. */
  reason: string;
  /** The permission that was checked. */
  permission: Permission;
  /** Stable refs to the policy/rule lines that drove the decision. */
  policyRefs: string[];
  /** Whether the resulting action must be audited regardless of outcome. */
  requiresAudit: boolean;
  /** Safe action surfaced to the user when the verdict is not `allow`. */
  safeNextAction?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

const PRODUCTION_HIGH_RISK_PERMISSIONS: Permission[] = [
  "execution_plan.execute",
  "rollback.execute",
  "desktop.execute_local",
  "policy.manage",
  "governance.manage",
  "members.manage",
];

export function evaluatePermission(
  request: PermissionRequest,
  settings: TenantPermissionSettings,
): PermissionDecision {
  const refs: string[] = [];

  // 0. Tenant-level explicit block — wins above everything.
  if (settings.blockedPermissions.includes(request.permission)) {
    return {
      verdict: "deny",
      code: "permission.tenant_blocked",
      reason: "This permission is blocked at the tenant level.",
      permission: request.permission,
      policyRefs: ["tenant.blockedPermissions"],
      requiresAudit: true,
      safeNextAction: { label: "Open governance", href: "/dashboard/governance" },
    };
  }

  // 1. RBAC role check.
  if (!roleHasPermission(request.scope, request.permission)) {
    return {
      verdict: "deny",
      code: "permission.rbac_denied",
      reason: "Your role does not have this permission.",
      permission: request.permission,
      policyRefs: ["rbac.roles", `permission.${request.permission}`],
      requiresAudit: true,
      safeNextAction: { label: "Review permissions model", href: "/docs/permissions-model" },
    };
  }
  refs.push("rbac.allow");

  // 2. Resource-owner narrowing — when set, only the resource owner may act.
  if (request.resourceOwnerUserId && request.resourceOwnerUserId !== (request.scope.userId as unknown as string)) {
    return {
      verdict: "deny",
      code: "permission.not_owner",
      reason: "Only the resource owner can perform this action.",
      permission: request.permission,
      policyRefs: ["resource.owner"],
      requiresAudit: true,
    };
  }

  // 3. Freeze window — production deploys paused during the window.
  if (request.environment === "production" && settings.productionFreezeWindow) {
    const now = Date.now();
    const from = Date.parse(settings.productionFreezeWindow.fromIso);
    const to = Date.parse(settings.productionFreezeWindow.toIso);
    if (Number.isFinite(from) && Number.isFinite(to) && now >= from && now <= to) {
      return {
        verdict: "deny",
        code: "permission.freeze_window",
        reason: "Production deploys are paused inside the current freeze window.",
        permission: request.permission,
        policyRefs: ["tenant.productionFreezeWindow"],
        requiresAudit: true,
        safeNextAction: { label: "Open governance", href: "/dashboard/governance" },
      };
    }
  }

  // 4. Desktop apply requires explicit tenant allowance.
  if (request.permission === "desktop.execute_local" && !settings.desktopApplyAllowed) {
    return {
      verdict: "deny",
      code: "permission.desktop_apply_blocked",
      reason: "Tenant policy does not permit desktop apply for this plan class.",
      permission: request.permission,
      policyRefs: ["tenant.desktopApplyAllowed"],
      requiresAudit: true,
      safeNextAction: { label: "Open governance", href: "/dashboard/governance" },
    };
  }

  // 5. Approval-required gates — production + high-risk permissions + tenant override.
  const wantsApprovalByEnv = request.environment && settings.requireApprovalFor.includes(request.environment);
  const wantsApprovalByRisk =
    (request.environment === "production" && PRODUCTION_HIGH_RISK_PERMISSIONS.includes(request.permission)) ||
    request.risk === "high" ||
    request.risk === "critical";
  // Autonomy levels 0..2 always require approval for non-info actions.
  const wantsApprovalByAutonomy = settings.autonomyLevel <= 2 && (request.risk === "medium" || request.risk === "high" || request.risk === "critical");

  if (wantsApprovalByEnv || wantsApprovalByRisk || wantsApprovalByAutonomy) {
    return {
      verdict: "require_approval",
      code: "permission.requires_approval",
      reason:
        wantsApprovalByRisk
          ? "High-risk action — human approval required."
          : wantsApprovalByEnv
            ? `Tenant policy requires approval for ${request.environment} actions.`
            : "Autonomy level requires approval for this action.",
      permission: request.permission,
      policyRefs: refs.concat([
        ...(wantsApprovalByRisk ? ["risk.high_in_production"] : []),
        ...(wantsApprovalByEnv ? [`tenant.requireApprovalFor.${request.environment}`] : []),
        ...(wantsApprovalByAutonomy ? [`autonomy.level.${settings.autonomyLevel}`] : []),
      ]),
      requiresAudit: true,
      safeNextAction: { label: "Open approvals", href: "/dashboard/approvals" },
    };
  }

  // 6. Allowed.
  return {
    verdict: "allow",
    code: "permission.allow",
    reason: "Permitted.",
    permission: request.permission,
    policyRefs: refs,
    // Sensitive actions always audit — even when allowed.
    requiresAudit: PRODUCTION_HIGH_RISK_PERMISSIONS.includes(request.permission) || request.environment === "production",
  };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const VERDICT_LABEL: Record<PermissionVerdict, string> = {
  allow:            "Allowed",
  require_approval: "Requires approval",
  deny:             "Denied",
};

export function verdictSemantic(v: PermissionVerdict): "success" | "warning" | "error" {
  switch (v) {
    case "allow":            return "success";
    case "require_approval": return "warning";
    case "deny":             return "error";
  }
}
