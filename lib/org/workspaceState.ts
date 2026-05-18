/**
 * Workspace State builder.
 *
 * Composes the canonical WorkspaceState from the authenticated
 * context. Until persistent member roster ships, the state surfaces
 * the current session as the single member (honest "one-member preview")
 * — never fabricates additional members.
 */

import "server-only";

import type { OrganizationId, UserId } from "@/lib/domain/ids";
import {
  ROLE_CATALOG,
  type WorkspacePermission,
  type WorkspaceRole,
  type RoleEnforcement,
  type WorkspaceState,
  type WorkspaceMember,
} from "./rbacModel";

export interface BuildWorkspaceStateInput {
  tenantId: OrganizationId;
  actorUserId?: UserId;
  /** Optional acting member's email (from session). */
  actorEmail?: string;
  /** Optional acting member's display name. */
  actorDisplayName?: string;
}

export function buildWorkspaceState(input: BuildWorkspaceStateInput): WorkspaceState {
  const generatedAt = new Date().toISOString();
  const actorEmail = input.actorEmail ?? "operator@workspace.local";
  const actorDisplayName = input.actorDisplayName ?? "Operator";

  // Until persistence ships, the current session is the only member.
  // Default role is owner for the session user — the workspace's first
  // member. When member persistence wires up, role becomes durable.
  const currentMember: WorkspaceMember = {
    id: String(input.actorUserId ?? "session-actor"),
    email: actorEmail,
    displayName: actorDisplayName,
    role: "owner",
    addedAt: generatedAt,
    isCurrentSession: true,
  };

  // Enforcement state: which permissions are actually enforced today
  // vs documented but advisory. Honest — most permissions are "preview"
  // until full RBAC enforcement ships.
  const enforcement: Record<WorkspacePermission, RoleEnforcement> = {
    // Always enforced — tenant scoping in route handlers
    view_sources:             "enforced",
    view_findings:            "enforced",
    view_audit:               "enforced",
    // Partial — invoking the route requires auth but role isn't checked
    validate_sources:         "partial",
    run_readonly_scan:        "partial",
    create_remediation_plan:  "partial",
    create_simulation:        "partial",
    request_approval:         "partial",
    export_evidence:          "partial",
    manage_desktop_sessions:  "partial",
    // Preview — role definition exists, full check pending Prisma persistence
    approve_plan:             "preview",
    manage_workspace:         "preview",
    manage_members:           "preview",
  };

  const enforcedPermissions = Object.values(enforcement).filter((e) => e === "enforced").length;
  const previewPermissions  = Object.values(enforcement).filter((e) => e === "preview").length;

  return {
    generatedAt,
    workspaceId: String(input.tenantId),
    workspaceLabel: `Workspace ${String(input.tenantId).slice(0, 12)}`,
    currentMember,
    members: [currentMember],
    roleCatalog: ROLE_CATALOG,
    enforcement,
    summary: {
      memberCount: 1,
      rolesDefined: ROLE_CATALOG.length,
      permissionsDefined: Object.keys(enforcement).length,
      enforcedPermissions,
      previewPermissions,
    },
    safetyContract: "rbac_never_enables_mutation",
    limitations: [
      "Member persistence not yet wired — current session is the single member shown.",
      "Per-permission enforcement is partial until Prisma-backed member roster ships.",
      "No role in this catalog enables mutation or bypasses approval — the union itself excludes mutation/apply permissions.",
    ],
    safeNextAction: { label: "Open Settings", href: "/dashboard/settings" },
  };
}

/** Pure helper: does the current actor hold a permission? */
export function actorHasPermission(state: WorkspaceState, permission: WorkspacePermission): boolean {
  const role = state.currentMember?.role;
  if (!role) return false;
  const def = ROLE_CATALOG.find((r) => r.role === role);
  return def ? def.permissions.includes(permission) : false;
}

/** Convert a role to a label-friendly string. */
export function roleLabel(role: WorkspaceRole): string {
  return ROLE_CATALOG.find((r) => r.role === role)?.label ?? role;
}
