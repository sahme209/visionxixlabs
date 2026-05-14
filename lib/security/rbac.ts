/**
 * Role-based access control.
 *
 * Every sensitive action checks against this matrix. Roles roll up to
 * permissions; permissions are the unit code enforces. UI hints (showing or
 * hiding controls) are a courtesy — server-side `requirePermission()` is the
 * actual gate.
 *
 * Why a matrix rather than per-role function calls: the matrix is easy to
 * print into the Security Center UI, and changes to authority sit in one
 * file rather than scattered across handlers. A future "custom role" system
 * extends the matrix without touching call sites.
 */

import { AxiomErrors } from "@/lib/errors/axiomErrors";
import type { TenantScope } from "./tenantScope";

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type Role =
  | "owner"
  | "admin"
  | "operator"
  | "security_reviewer"
  | "finance_reviewer"
  | "developer"
  | "viewer"
  | "auditor";

export const ROLE_LABEL: Record<Role, string> = {
  owner:             "Owner",
  admin:             "Admin",
  operator:          "Operator",
  security_reviewer: "Security Reviewer",
  finance_reviewer:  "Finance Reviewer",
  developer:         "Developer",
  viewer:            "Viewer",
  auditor:           "Auditor",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner:             "Full administrative control, including billing and ownership transfer.",
  admin:             "Manage members, connectors, governance, and execution autonomy.",
  operator:          "Operate connectors, run scans, propose plans, request approvals.",
  security_reviewer: "Approve security-class actions; read audit logs.",
  finance_reviewer:  "Approve cost-class actions; read cost reports.",
  developer:         "Read-write on releases and plans; cannot change governance.",
  viewer:            "Read-only platform access.",
  auditor:           "Read-only audit log access with export rights.",
};

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export type Permission =
  // Provider / connector
  | "provider.connect"
  | "provider.read"
  | "provider.scan"
  | "provider.disconnect"
  // Findings / recommendations
  | "findings.read"
  | "recommendations.read"
  // Execution
  | "execution_plan.create"
  | "execution_plan.approve"
  | "execution_plan.export"
  | "execution_plan.execute"
  | "rollback.prepare"
  | "rollback.execute"
  // ReleaseOps
  | "releaseops.connect"
  | "releaseops.read"
  | "releaseops.govern"
  // Desktop
  | "desktop.handoff"
  | "desktop.execute_local"
  // Audit
  | "audit.read"
  | "audit.export"
  // Governance / policy
  | "governance.manage"
  | "policy.manage"
  | "members.manage"
  | "billing.manage"
  // Docs / read
  | "docs.read";

// ---------------------------------------------------------------------------
// Role × permission matrix
// ---------------------------------------------------------------------------

const MATRIX: Record<Role, Permission[]> = {
  owner: [
    "provider.connect", "provider.read", "provider.scan", "provider.disconnect",
    "findings.read", "recommendations.read",
    "execution_plan.create", "execution_plan.approve", "execution_plan.export", "execution_plan.execute",
    "rollback.prepare", "rollback.execute",
    "releaseops.connect", "releaseops.read", "releaseops.govern",
    "desktop.handoff", "desktop.execute_local",
    "audit.read", "audit.export",
    "governance.manage", "policy.manage", "members.manage", "billing.manage",
    "docs.read",
  ],
  admin: [
    "provider.connect", "provider.read", "provider.scan", "provider.disconnect",
    "findings.read", "recommendations.read",
    "execution_plan.create", "execution_plan.approve", "execution_plan.export", "execution_plan.execute",
    "rollback.prepare", "rollback.execute",
    "releaseops.connect", "releaseops.read", "releaseops.govern",
    "desktop.handoff", "desktop.execute_local",
    "audit.read", "audit.export",
    "governance.manage", "policy.manage", "members.manage",
    "docs.read",
  ],
  operator: [
    "provider.connect", "provider.read", "provider.scan",
    "findings.read", "recommendations.read",
    "execution_plan.create", "execution_plan.export",
    "rollback.prepare",
    "releaseops.read",
    "desktop.handoff",
    "audit.read",
    "docs.read",
  ],
  security_reviewer: [
    "provider.read",
    "findings.read", "recommendations.read",
    "execution_plan.approve",
    "releaseops.read",
    "audit.read", "audit.export",
    "docs.read",
  ],
  finance_reviewer: [
    "provider.read",
    "findings.read", "recommendations.read",
    "execution_plan.approve",
    "audit.read",
    "docs.read",
  ],
  developer: [
    "provider.read",
    "findings.read", "recommendations.read",
    "execution_plan.create", "execution_plan.export",
    "releaseops.read",
    "desktop.handoff",
    "docs.read",
  ],
  viewer: [
    "provider.read",
    "findings.read", "recommendations.read",
    "releaseops.read",
    "docs.read",
  ],
  auditor: [
    "provider.read",
    "findings.read", "recommendations.read",
    "audit.read", "audit.export",
    "docs.read",
  ],
};

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

export function permissionsFor(role: Role): Permission[] {
  return MATRIX[role] ?? [];
}

export function rolesWithPermission(perm: Permission): Role[] {
  return (Object.keys(MATRIX) as Role[]).filter((r) => MATRIX[r].includes(perm));
}

/** Returns true iff any of the scope's roles grants the permission. */
export function hasPermission(scope: { roles: string[] }, permission: Permission): boolean {
  for (const r of scope.roles) {
    if (isRole(r) && MATRIX[r].includes(permission)) return true;
  }
  return false;
}

/** Throws AxiomError(policy) when none of the scope's roles grants `permission`. */
export function requirePermission(scope: TenantScope, permission: Permission): void {
  if (!hasPermission(scope, permission)) {
    throw AxiomErrors.policy("rbac.permission_denied", "You don't have permission to perform this action.", {
      permission,
      roles: scope.roles.join(","),
    });
  }
}

/** All permissions in the system — for the Security Center UI. */
export function listPermissions(): Permission[] {
  const set = new Set<Permission>();
  for (const role of Object.keys(MATRIX) as Role[]) {
    for (const p of MATRIX[role]) set.add(p);
  }
  return Array.from(set);
}

function isRole(r: string): r is Role {
  return r in MATRIX;
}

/** Snapshot of the matrix for rendering / documentation. */
export interface RbacSnapshot {
  roles: { id: Role; label: string; description: string; permissions: Permission[] }[];
  permissions: Permission[];
}

export function rbacSnapshot(): RbacSnapshot {
  const roles = (Object.keys(MATRIX) as Role[]).map((id) => ({
    id,
    label: ROLE_LABEL[id],
    description: ROLE_DESCRIPTION[id],
    permissions: MATRIX[id],
  }));
  return { roles, permissions: listPermissions() };
}
