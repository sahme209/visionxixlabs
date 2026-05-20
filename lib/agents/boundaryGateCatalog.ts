/**
 * Pure boundary-gate catalog + classifier.
 *
 * The boundary gate maps every proposed change to a single boundary
 * class. The class determines which approver roles must sign off + how
 * many. Closed-union so future classes break the build.
 *
 * Pure / deterministic.
 */

export type BoundaryClass =
  | "read_only"
  | "low_blast_radius"
  | "service_scoped"
  | "account_scoped"
  | "org_scoped"
  | "data_plane";

export interface BoundaryClassDefinition {
  name: BoundaryClass;
  label: string;
  /** Minimum approver-role roster required. */
  requiredApproverRoles: readonly string[];
  /** Min approvals across those roles. */
  minApprovals: number;
  /** Strict mode: requires every required role to actually approve. */
  requiresAllRequiredRoles: boolean;
  description: string;
}

const CATALOG: readonly BoundaryClassDefinition[] = [
  {
    name: "read_only",
    label: "Read-only",
    requiredApproverRoles: ["platform_admin"],
    minApprovals: 1,
    requiresAllRequiredRoles: false,
    description: "Inspection only; no state changes. Single approver.",
  },
  {
    name: "low_blast_radius",
    label: "Low blast radius",
    requiredApproverRoles: ["platform_admin"],
    minApprovals: 1,
    requiresAllRequiredRoles: false,
    description: "Single resource change with no downstream consumers.",
  },
  {
    name: "service_scoped",
    label: "Service-scoped",
    requiredApproverRoles: ["platform_admin", "engineering_lead"],
    minApprovals: 2,
    requiresAllRequiredRoles: false,
    description: "Change affects one service. Two approvers needed.",
  },
  {
    name: "account_scoped",
    label: "Account-scoped",
    requiredApproverRoles: ["platform_admin", "security", "engineering_lead"],
    minApprovals: 2,
    requiresAllRequiredRoles: true,
    description: "Change spans multiple services in one account. Security must approve.",
  },
  {
    name: "org_scoped",
    label: "Org-scoped",
    requiredApproverRoles: ["platform_admin", "security", "compliance"],
    minApprovals: 3,
    requiresAllRequiredRoles: true,
    description: "Cross-account change. Three signatures required across platform_admin / security / compliance.",
  },
  {
    name: "data_plane",
    label: "Data plane",
    requiredApproverRoles: ["platform_admin", "security", "compliance"],
    minApprovals: 3,
    requiresAllRequiredRoles: true,
    description: "Touches customer data. Three signatures + signed Terraform required.",
  },
];

export function listBoundaryClasses(): BoundaryClassDefinition[] { return [...CATALOG]; }

export function findBoundaryClass(name: BoundaryClass): BoundaryClassDefinition | null {
  return CATALOG.find((c) => c.name === name) ?? null;
}

export interface BoundaryClassifierInput {
  blastRadius: "single_resource" | "service" | "account" | "org";
  /** True if the change writes or deletes customer data records. */
  touchesCustomerData: boolean;
  /** True if the change is observation-only. */
  readOnly: boolean;
}

export function classifyBoundary(input: BoundaryClassifierInput): BoundaryClass {
  if (input.readOnly) return "read_only";
  if (input.touchesCustomerData) return "data_plane";
  switch (input.blastRadius) {
    case "single_resource": return "low_blast_radius";
    case "service":         return "service_scoped";
    case "account":         return "account_scoped";
    case "org":             return "org_scoped";
  }
}
