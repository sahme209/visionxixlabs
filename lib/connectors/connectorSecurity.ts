/**
 * Connector security model — typed enterprise trust profile per connector.
 *
 * Lists permission scopes, token storage requirements, revocation procedures,
 * rotation guidance, and audit obligations. UI surfaces (Integrations Center,
 * setup wizards, security docs) read from this single source.
 */

import type { ConnectorRecord } from "./connectorRegistry";

export type TokenStorageRequirement =
  | "encrypted_at_rest"          // Server-side encrypted DB column
  | "os_keychain"                // Desktop runtime — OS native keychain
  | "no_storage"                 // Webhook URL only; no auth token retained
  | "federated_identity";        // Workload identity / federated trust — no secret to store

export interface ConnectorSecurityProfile {
  connectorId: string;
  authType: string;
  tokenStorage: TokenStorageRequirement;
  permissionScopes: string[];
  readPermissions: string[];
  writePermissions: string[];
  /** How a tenant revokes the connector cleanly. */
  revocationProcedure: string[];
  leastPrivilegeGuidance: string;
  tenantIsolationGuarantees: string[];
  auditRequirements: string[];
  rotationGuidance: string;
  /** Risk notes the user should know before connecting. */
  riskNotes: string[];
}

const PROFILES: Record<string, ConnectorSecurityProfile> = {
  aws: {
    connectorId: "aws",
    authType: "IAM Role + External ID",
    tokenStorage: "federated_identity",
    permissionScopes: ["sts:AssumeRole", "ec2:Describe*", "s3:GetBucket*", "rds:Describe*", "iam:Get*/List*/Simulate*", "cloudwatch:Get*/List*", "ce:Get*"],
    readPermissions: ["Read-only Describe/Get/List across listed services"],
    writePermissions: ["None on scan role", "Per-action-class execution role (opt-in)"],
    revocationProcedure: [
      "Delete the IAM role in AWS Console → IAM → Roles",
      "Or remove the trust policy condition (External ID) to break confused-deputy",
      "Axiom loses all access on the next sts:AssumeRole attempt",
    ],
    leastPrivilegeGuidance: "Use the published policy verbatim — every action is mapped to a specific Axiom capability.",
    tenantIsolationGuarantees: [
      "Each connection has a unique External ID",
      "Cross-tenant role assumption is impossible — External ID and Axiom AWS account ID must both match",
    ],
    auditRequirements: ["Every sts:AssumeRole emits a CloudTrail event in the tenant's account"],
    rotationGuidance: "External ID rotation = disconnect + re-onboard. Role can be replaced via stack update.",
    riskNotes: ["Worst case if compromised: someone reads infrastructure metadata for authorized regions. No mutation possible."],
  },
  azure: {
    connectorId: "azure",
    authType: "Service Principal + role assignment (federated identity preferred)",
    tokenStorage: "federated_identity",
    permissionScopes: ["Reader (built-in)", "Custom Cost Management + Activity Log read role"],
    readPermissions: ["Resource metadata at subscription or resource-group scope"],
    writePermissions: ["Planned Q2 2026 — per-action-class custom role"],
    revocationProcedure: [
      "Remove the role assignment for the Axiom Service Principal",
      "Or disable the Service Principal entirely in Azure AD",
    ],
    leastPrivilegeGuidance: "Scope role assignment as narrowly as needed (subscription, resource group, or resource).",
    tenantIsolationGuarantees: ["Each tenant uses an independent Service Principal", "No shared credentials"],
    auditRequirements: ["Every API call is logged in Azure Activity Log"],
    rotationGuidance: "Client secret rotation handled via Service Principal credential refresh; federated identity has no secret to rotate.",
    riskNotes: ["Reader role grants metadata read at the chosen scope only"],
  },
  gcp: {
    connectorId: "gcp",
    authType: "Service Account + IAM binding (workload identity federation preferred)",
    tokenStorage: "federated_identity",
    permissionScopes: ["roles/viewer", "roles/iam.securityReviewer", "Custom Billing read", "Custom Audit Log read"],
    readPermissions: ["Project/folder-scoped metadata read"],
    writePermissions: ["Planned Q3 2026 — per-action-class custom role"],
    revocationProcedure: [
      "Remove the IAM binding from the Service Account",
      "Or disable the Service Account",
    ],
    leastPrivilegeGuidance: "Bind at project or folder scope, never organization scope unless explicitly required.",
    tenantIsolationGuarantees: ["Per-tenant Service Account", "Workload identity federation eliminates JSON key sharing"],
    auditRequirements: ["Every API call is logged in Cloud Audit Logs"],
    rotationGuidance: "Workload identity federation = no key to rotate. JSON keys rotated automatically every 30 days when used.",
    riskNotes: ["roles/viewer grants read across many resources — scope binding accordingly"],
  },
  github: {
    connectorId: "github",
    authType: "GitHub App installation (org-level)",
    tokenStorage: "encrypted_at_rest",
    permissionScopes: ["actions:read", "contents:read (metadata)", "deployments:read", "metadata:read", "pull_requests:read"],
    readPermissions: ["Workflow runs, branch protection, deployments, PR reviews, release/tag events"],
    writePermissions: ["Planned — approval comments, Change Request linkage (opt-in per organization)"],
    revocationProcedure: [
      "Uninstall the GitHub App from your organization's installation page",
      "Or remove specific repository selections from the installation",
    ],
    leastPrivilegeGuidance: "Install at the organization level with read-scoped permissions; per-repository scoping is honored.",
    tenantIsolationGuarantees: ["One installation per tenant", "Installation IDs and tokens never cross tenants"],
    auditRequirements: ["GitHub Audit Log captures App installation + every API call"],
    rotationGuidance: "GitHub Apps auto-rotate installation tokens every hour — no manual rotation needed.",
    riskNotes: ["No source-code cloning", "Org admin must approve the installation"],
  },
  terraform: {
    connectorId: "terraform",
    authType: "Terraform Cloud team token (read scope) or local plan upload",
    tokenStorage: "encrypted_at_rest",
    permissionScopes: ["Read scope on workspaces"],
    readPermissions: ["Plan JSON metadata, workspace + module list, state reference"],
    writePermissions: ["Annotate plans with risk classification (when configured)"],
    revocationProcedure: ["Revoke the team token in Terraform Cloud"],
    leastPrivilegeGuidance: "Scope team token to specific workspaces, not the entire organization.",
    tenantIsolationGuarantees: ["Per-tenant team token", "Plans never shared across tenants"],
    auditRequirements: ["Each plan ingestion emits an audit event"],
    rotationGuidance: "Rotate tokens quarterly; system warns 14 days before expiration.",
    riskNotes: ["State contents are never transmitted — only references"],
  },
  servicenow: {
    connectorId: "servicenow",
    authType: "OAuth 2.0 with read scope on change_request module",
    tokenStorage: "encrypted_at_rest",
    permissionScopes: ["change_request:read", "change_request:write (opt-in)"],
    readPermissions: ["Change Request status, approvers, audit linkage"],
    writePermissions: ["Auto-create CRs with risk justification (opt-in)"],
    revocationProcedure: ["Revoke the OAuth grant in ServiceNow"],
    leastPrivilegeGuidance: "Use a service account with module-scoped permissions, not a personal admin account.",
    tenantIsolationGuarantees: ["Per-tenant OAuth installation"],
    auditRequirements: ["ServiceNow audit + Axiom audit both record CR linkage"],
    rotationGuidance: "OAuth refresh handled automatically",
    riskNotes: ["Write scope is opt-in per integration"],
  },
  slack: {
    connectorId: "slack",
    authType: "Incoming webhook with signed payload",
    tokenStorage: "encrypted_at_rest",
    permissionScopes: ["incoming-webhook"],
    readPermissions: ["None — outbound only"],
    writePermissions: ["Approval prompts, scan completions, deploy blockers, rollback alerts, weekly summaries"],
    revocationProcedure: ["Revoke the Slack webhook URL"],
    leastPrivilegeGuidance: "Bind webhook to a specific channel; use a dedicated #axiom channel for high-volume tenants.",
    tenantIsolationGuarantees: ["One webhook per tenant", "Signed payloads prevent spoofing"],
    auditRequirements: ["Every notification emits an audit event"],
    rotationGuidance: "Rotate webhook URL via Slack admin if compromised",
    riskNotes: ["Outbound-only — no Slack data read by Axiom"],
  },
  desktop: {
    connectorId: "desktop",
    authType: "Local Tauri runtime — code-signed binary + Axiom session token in OS keychain",
    tokenStorage: "os_keychain",
    permissionScopes: ["OS keychain (Axiom session token only)", "Local CLI invocation (terraform / aws / az / gcloud / kubectl / git)"],
    readPermissions: ["Local CLI output", "Local AWS profile via shell-out (never stored)"],
    writePermissions: ["Local Terraform apply (with approval)", "OS-level notifications", "Local audit log file"],
    revocationProcedure: [
      "Sign out from the desktop app — OS keychain entry removed",
      "Uninstall the desktop app",
    ],
    leastPrivilegeGuidance: "Workstation mode disables all outbound network — only direct AWS API traffic from your machine.",
    tenantIsolationGuarantees: ["Local runtime is per-user", "Session token in OS keychain — not in app files"],
    auditRequirements: ["Local audit log + optional sync to cloud audit fabric"],
    rotationGuidance: "Session token auto-rotates on sign-in",
    riskNotes: ["Worst case if local machine compromised: attacker has the same AWS CLI access the user has"],
  },
};

/**
 * Look up the security profile for a connector. Throws if no profile exists —
 * forces every new connector to have an explicit security profile.
 */
export function securityFor(connectorId: string): ConnectorSecurityProfile {
  const p = PROFILES[connectorId];
  if (!p) throw new Error(`No security profile defined for connector "${connectorId}".`);
  return p;
}

/**
 * Return security profiles for a list of connectors. Connectors without
 * a profile are silently skipped (useful for the integrations center
 * which may include not-yet-implemented connectors).
 */
export function securityProfilesFor(connectors: Pick<ConnectorRecord, "id">[]): ConnectorSecurityProfile[] {
  return connectors.map((c) => PROFILES[c.id]).filter((p): p is ConnectorSecurityProfile => p !== undefined);
}

export { PROFILES };
