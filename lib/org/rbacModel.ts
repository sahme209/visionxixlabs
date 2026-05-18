/**
 * Workspace + Team + RBAC — typed contract.
 *
 * Closed unions of 6 roles × 13 permissions. No role can enable
 * mutation or bypass approval — the union itself excludes
 * mutation/apply permissions.
 *
 * Until full persistence ships, the workspace state is derived from
 * the authenticated NextAuth context; the role catalog is canonical
 * and exported here for consumers to consult.
 */

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "cloud_engineer"
  | "security_reviewer"
  | "release_manager"
  | "viewer";

export type WorkspacePermission =
  | "view_sources"
  | "validate_sources"
  | "run_readonly_scan"
  | "view_findings"
  | "create_remediation_plan"
  | "create_simulation"
  | "request_approval"
  | "approve_plan"
  | "export_evidence"
  | "manage_workspace"
  | "manage_members"
  | "view_audit"
  | "manage_desktop_sessions";

export type RoleEnforcement = "preview" | "partial" | "enforced";

export interface RoleDefinition {
  role: WorkspaceRole;
  /** Human label. */
  label: string;
  /** What this role is for. */
  description: string;
  /** Closed list of permissions this role holds. */
  permissions: WorkspacePermission[];
  /** Operator-readable rationale. */
  rationale: string;
}

export interface WorkspaceMember {
  /** Stable id. */
  id: string;
  email: string;
  /** Honest display name when unavailable. */
  displayName: string;
  role: WorkspaceRole;
  /** When the member was added (canonical generatedAt fallback). */
  addedAt: string;
  /** Was the member the actor of the current session? */
  isCurrentSession: boolean;
}

export interface WorkspaceState {
  generatedAt: string;
  workspaceId: string;
  workspaceLabel: string;
  /** Acting member of the current session. */
  currentMember: WorkspaceMember | null;
  /** Member roster (today: minimum = current session only). */
  members: WorkspaceMember[];
  /** Canonical role catalog (always present). */
  roleCatalog: RoleDefinition[];
  /** Per-permission enforcement state. */
  enforcement: Record<WorkspacePermission, RoleEnforcement>;
  /** Honest summary stats. */
  summary: {
    memberCount: number;
    rolesDefined: number;
    permissionsDefined: number;
    enforcedPermissions: number;
    previewPermissions: number;
  };
  /** Hard literal — RBAC never grants mutation. */
  safetyContract: "rbac_never_enables_mutation";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Canonical role catalog
// ---------------------------------------------------------------------------

export const ROLE_CATALOG: RoleDefinition[] = [
  {
    role: "owner",
    label: "Owner",
    description: "Workspace owner — full operator visibility, can manage members + roles. Cannot bypass approvals.",
    permissions: [
      "view_sources", "validate_sources", "run_readonly_scan",
      "view_findings", "create_remediation_plan", "create_simulation",
      "request_approval", "approve_plan", "export_evidence",
      "manage_workspace", "manage_members", "view_audit",
      "manage_desktop_sessions",
    ],
    rationale: "The Owner is the operator-of-last-resort. Holds every permission the system grants. Cannot bypass approvals.",
  },
  {
    role: "admin",
    label: "Admin",
    description: "Workspace administrator. Manages members + integrations + policies. No bypass of approvals.",
    permissions: [
      "view_sources", "validate_sources", "run_readonly_scan",
      "view_findings", "create_remediation_plan", "create_simulation",
      "request_approval", "approve_plan", "export_evidence",
      "manage_workspace", "manage_members", "view_audit",
      "manage_desktop_sessions",
    ],
    rationale: "Operational equivalent of Owner; typically delegated to platform-team leads.",
  },
  {
    role: "cloud_engineer",
    label: "Cloud engineer",
    description: "Day-to-day operator. Runs read-only scans, builds remediation, requests approval. Cannot self-approve.",
    permissions: [
      "view_sources", "validate_sources", "run_readonly_scan",
      "view_findings", "create_remediation_plan", "create_simulation",
      "request_approval", "view_audit", "manage_desktop_sessions",
    ],
    rationale: "Standard engineering role. Cannot approve their own plans — separation of duties enforced.",
  },
  {
    role: "security_reviewer",
    label: "Security reviewer",
    description: "Reviews findings, approves remediation, exports evidence. Does not run scans.",
    permissions: [
      "view_sources", "view_findings",
      "approve_plan", "export_evidence", "view_audit",
    ],
    rationale: "Approval authority + evidence export. Audit-readable. Cannot manipulate sources.",
  },
  {
    role: "release_manager",
    label: "Release manager",
    description: "Owns the release approval queue. Approves release-class changes.",
    permissions: [
      "view_sources", "view_findings",
      "approve_plan", "view_audit",
    ],
    rationale: "Mirrors typical release manager scope: approve, observe, audit. Does not configure sources.",
  },
  {
    role: "viewer",
    label: "Viewer",
    description: "Read-only access to dashboards. No actions.",
    permissions: [
      "view_sources", "view_findings", "view_audit",
    ],
    rationale: "Stakeholder visibility without any operator authority.",
  },
];

/** Pure lookup: does a role hold a permission? */
export function roleHasPermission(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  const def = ROLE_CATALOG.find((r) => r.role === role);
  return def ? def.permissions.includes(permission) : false;
}

// ---------------------------------------------------------------------------
// Visual helpers
// ---------------------------------------------------------------------------

export const ROLE_TONE: Record<WorkspaceRole, "rose" | "amber" | "cyan" | "violet" | "emerald" | "zinc"> = {
  owner:             "rose",
  admin:             "amber",
  cloud_engineer:    "cyan",
  security_reviewer: "violet",
  release_manager:   "emerald",
  viewer:            "zinc",
};

export const PERMISSION_LABEL: Record<WorkspacePermission, string> = {
  view_sources:             "View sources",
  validate_sources:         "Validate sources",
  run_readonly_scan:        "Run read-only scan",
  view_findings:            "View findings",
  create_remediation_plan:  "Create remediation plan",
  create_simulation:        "Create simulation",
  request_approval:         "Request approval",
  approve_plan:             "Approve plan",
  export_evidence:          "Export evidence",
  manage_workspace:         "Manage workspace",
  manage_members:           "Manage members",
  view_audit:               "View audit",
  manage_desktop_sessions:  "Manage desktop sessions",
};
