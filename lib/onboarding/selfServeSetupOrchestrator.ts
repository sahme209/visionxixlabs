/**
 * Self-Serve Setup Orchestrator.
 *
 * The default product experience is self-serve. The user should never need
 * to book a call to connect AWS, Azure, GCP, GitHub, or to enable the
 * security scanner or desktop. This orchestrator is the canonical source
 * of *what setup flow exists* for each integration — prerequisites,
 * required permissions, ordered steps, validation, common failures, and
 * the exact next action after each step.
 *
 * Onboarding UI, integrations center, command center, copilot, and docs
 * all read from this module so guidance never drifts.
 */

export type SetupTrack =
  | "aws"
  | "azure"
  | "gcp"
  | "github"
  | "security_scanner"
  | "desktop"
  | "release_ops"
  | "audit_trust";

export type SetupStepKind =
  | "navigate"          // navigate to a console / URL
  | "create_resource"   // create something (role, principal, project)
  | "copy_value"        // copy an id/secret into Axiom
  | "validate"          // press the validate button → axiom round-trip
  | "scan"              // run the first scan
  | "review";           // review output / approve

export interface SetupStep {
  id: string;
  ordinal: number;
  kind: SetupStepKind;
  title: string;
  detail: string;
  /** Action / link the user should hit. */
  action?: { label: string; href: string };
  /** Validation Axiom can run after this step. */
  validation?: { label: string; href: string };
  /** Estimated time. */
  estMinutes: number;
}

export interface SetupFailureMode {
  cause: string;
  symptom: string;
  fix: string;
  troubleshooterId?: string;
}

export interface SetupFlow {
  track: SetupTrack;
  title: string;
  status: "live" | "preview" | "expanding" | "planned";
  prerequisites: string[];
  requiredPermissions: string[];
  steps: SetupStep[];
  commonFailures: SetupFailureMode[];
  /** What the user can do next *after* this flow succeeds. */
  successNextAction: { label: string; href: string };
  /** Manual-support fallback — only used after self-serve fails repeatedly. */
  fallbackSupport: { label: string; href: string; visibleWhen: "after_self_serve_failure" };
}

// ---------------------------------------------------------------------------
// Flows
// ---------------------------------------------------------------------------

const FALLBACK = {
  label: "Open a support ticket",
  href: "/contact?topic=setup-blocked",
  visibleWhen: "after_self_serve_failure" as const,
};

const FLOWS: Record<SetupTrack, SetupFlow> = {
  aws: {
    track: "aws",
    title: "Connect AWS",
    status: "live",
    prerequisites: [
      "AWS account with admin access (or someone who can create IAM roles).",
      "Ability to set a unique External ID.",
    ],
    requiredPermissions: [
      "iam:CreateRole · iam:PutRolePolicy on the target account.",
      "Read-only access to the resource scopes you want Axiom to scan.",
    ],
    steps: [
      { id: "aws.s1", ordinal: 1, kind: "navigate",        title: "Open AWS IAM console",            detail: "Sign in to your AWS account and navigate to IAM → Roles.",       action:     { label: "Open AWS IAM",                href: "https://console.aws.amazon.com/iamv2/home#/roles" }, estMinutes: 1 },
      { id: "aws.s2", ordinal: 2, kind: "create_resource", title: "Create read-only role",            detail: "Create a role with the AWS account 'Vision XIX Axiom' as trusted entity and the External ID Axiom generates for you.", estMinutes: 3 },
      { id: "aws.s3", ordinal: 3, kind: "copy_value",      title: "Copy the Role ARN + External ID", detail: "Paste both values into the Axiom AWS connect form.",              action:     { label: "Open connect form",          href: "/operator/onboarding" }, estMinutes: 1 },
      { id: "aws.s4", ordinal: 4, kind: "validate",        title: "Validate connection",              detail: "Axiom runs STS AssumeRole + GetCallerIdentity.",                  validation: { label: "Run validation",             href: "/api/aws/validate" }, estMinutes: 1 },
      { id: "aws.s5", ordinal: 5, kind: "scan",            title: "Run first scan",                   detail: "Axiom builds your initial snapshot, findings, and recommendations.", action:    { label: "Start scan",                 href: "/dashboard/cloud/aws" }, estMinutes: 2 },
    ],
    commonFailures: [
      { cause: "External ID mismatch",       symptom: "AssumeRole returns AccessDenied with InvalidClientTokenId or wrong external id.", fix: "Copy the External ID from the Axiom connect form exactly — it is unique per workspace.", troubleshooterId: "aws.external_id_mismatch" },
      { cause: "Invalid Role ARN format",     symptom: "Validation reports 'invalid ARN'.",                                                                                fix: "Ensure ARN is `arn:aws:iam::<account-id>:role/<role-name>`.",                                troubleshooterId: "aws.role_arn_invalid" },
      { cause: "AssumeRole denied",            symptom: "STS returns AccessDenied.",                                                                                       fix: "Confirm role trust policy lists Axiom account as principal and External ID matches.",          troubleshooterId: "aws.assume_role_denied" },
      { cause: "Missing read-only permissions", symptom: "Scan starts but resource lists are empty.",                                                                       fix: "Attach AWS-managed ReadOnlyAccess policy or the curated subset documented in the setup guide.", troubleshooterId: "aws.permissions_missing" },
    ],
    successNextAction: { label: "Open AWS dashboard", href: "/dashboard/cloud/aws" },
    fallbackSupport: FALLBACK,
  },

  azure: {
    track: "azure",
    title: "Connect Azure",
    status: "preview",
    prerequisites: [
      "Azure tenant + subscription id you want Axiom to scan.",
      "Owner or User-Access-Administrator role on the subscription.",
      "Server-side env: AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID, AZURE_SCAN_MODE=live.",
    ],
    requiredPermissions: [
      "Microsoft.Authorization/roleAssignments/write on the subscription scope.",
      "Reader (built-in) role to be granted to the service principal.",
    ],
    steps: [
      { id: "azure.s1", ordinal: 1, kind: "navigate",        title: "Open Microsoft Entra ID",          detail: "Sign in to the Azure portal and open Microsoft Entra ID → App registrations.", action:     { label: "Open Entra ID",        href: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" }, estMinutes: 1 },
      { id: "azure.s2", ordinal: 2, kind: "create_resource", title: "Register Axiom application",        detail: "Register a new app for Axiom and create a client secret.", estMinutes: 3 },
      { id: "azure.s3", ordinal: 3, kind: "create_resource", title: "Assign Reader at subscription scope", detail: "Grant the new app the built-in Reader role on the target subscription.", estMinutes: 2 },
      { id: "azure.s4", ordinal: 4, kind: "copy_value",      title: "Copy tenant + subscription + client secret", detail: "Paste into the Axiom Azure connect form.", action: { label: "Open connect form", href: "/operator/onboarding" }, estMinutes: 1 },
      { id: "azure.s5", ordinal: 5, kind: "validate",        title: "Validate connection",                detail: "Axiom runs @azure/identity ClientSecretCredential against arm-subscriptions.subscriptions.get — confirms tenant + client secret + read access.", validation: { label: "Run validation", href: "/api/azure/validate" }, estMinutes: 1 },
      { id: "azure.s6", ordinal: 6, kind: "scan",            title: "Run first scan",                     detail: "Axiom returns the preview snapshot today; live ARM resource inventory ships next.",                                                                       action:     { label: "Start scan",                href: "/dashboard/multi-cloud" }, estMinutes: 2 },
    ],
    commonFailures: [
      { cause: "Tenant id invalid",       symptom: "Validation reports 'invalid tenant id'.",          fix: "Use the GUID-form tenant id (e.g. `4d0e...`), not the *.onmicrosoft.com domain.", troubleshooterId: "azure.tenant_invalid" },
      { cause: "Service principal missing role", symptom: "Validation succeeds but inventory is empty.", fix: "Assign Reader role at subscription scope (not resource-group scope).",         troubleshooterId: "azure.role_missing" },
      { cause: "Client secret expired",    symptom: "Validation reports authentication error.",        fix: "Generate a new client secret in Entra ID and paste into Axiom.",                 troubleshooterId: "azure.secret_expired" },
    ],
    successNextAction: { label: "Open Azure dashboard", href: "/dashboard/cloud/azure" },
    fallbackSupport: FALLBACK,
  },

  gcp: {
    track: "gcp",
    title: "Connect GCP",
    status: "preview",
    prerequisites: [
      "GCP project you want Axiom to scan.",
      "Project-Owner or Service-Account-Admin role.",
      "Server-side env: GCP_PROJECT_ID + either GCP_SERVICE_ACCOUNT_JSON or (GCP_CLIENT_EMAIL + GCP_PRIVATE_KEY) + GCP_SCAN_MODE=live.",
    ],
    requiredPermissions: [
      "iam.serviceAccounts.create on the project.",
      "resourcemanager.projects.setIamPolicy on the project.",
      "Service account needs roles/viewer (or roles/iam.securityReviewer for IAM checks).",
    ],
    steps: [
      { id: "gcp.s1", ordinal: 1, kind: "navigate",        title: "Open GCP IAM console",                  detail: "Open the Cloud Console → IAM & Admin → Service Accounts.", action: { label: "Open GCP IAM", href: "https://console.cloud.google.com/iam-admin/serviceaccounts" }, estMinutes: 1 },
      { id: "gcp.s2", ordinal: 2, kind: "create_resource", title: "Create Axiom service account + key",   detail: "Create a service account, attach Viewer + Security Reviewer roles, and download a JSON key.", estMinutes: 3 },
      { id: "gcp.s3", ordinal: 3, kind: "copy_value",      title: "Upload service account JSON",            detail: "Paste the JSON content into the Axiom GCP connect form (server-side env or per-tenant connection).", action: { label: "Open connect form", href: "/operator/onboarding" }, estMinutes: 1 },
      { id: "gcp.s4", ordinal: 4, kind: "validate",        title: "Validate connection",                    detail: "Axiom validates the JSON shape and runs @google-cloud/resource-manager ProjectsClient.getProject for live mode. SDK probe falls back to honest preview if the package isn't reachable.", validation: { label: "Run validation", href: "/api/gcp/validate" }, estMinutes: 1 },
      { id: "gcp.s5", ordinal: 5, kind: "scan",            title: "Run first scan",                          detail: "Axiom returns the preview snapshot; live Compute / Storage / Firewall inventory lands next.",                                                                                      action: { label: "Start scan", href: "/dashboard/multi-cloud" }, estMinutes: 2 },
    ],
    commonFailures: [
      { cause: "Service account JSON malformed", symptom: "Validation reports parse error.", fix: "Paste the full JSON file content — including the curly braces.",      troubleshooterId: "gcp.json_invalid" },
      { cause: "Permission denied",              symptom: "Live validation reports 403.",     fix: "Attach the curated role bundle from the setup guide.",                troubleshooterId: "gcp.permissions_missing" },
      { cause: "API disabled",                   symptom: "Live scan fails with 'API not enabled'.", fix: "Enable the Cloud Asset and Cloud Resource Manager APIs.",    troubleshooterId: "gcp.api_disabled" },
    ],
    successNextAction: { label: "Open GCP dashboard", href: "/dashboard/cloud/gcp" },
    fallbackSupport: FALLBACK,
  },

  github: {
    track: "github",
    title: "Connect GitHub / ReleaseOps",
    status: "expanding",
    prerequisites: ["Organisation admin on the GitHub org you want Axiom to read."],
    requiredPermissions: [
      "Install the Axiom GitHub App on the organisation (or provide a fine-grained PAT with repo:read + actions:read).",
    ],
    steps: [
      { id: "gh.s1", ordinal: 1, kind: "navigate",        title: "Open the Axiom integrations page",  detail: "Open Integrations → GitHub.",                          action: { label: "Open GitHub integration", href: "/dashboard/integrations/github" }, estMinutes: 1 },
      { id: "gh.s2", ordinal: 2, kind: "create_resource", title: "Install the Axiom GitHub App",        detail: "Select the organisation and confirm read-only repo + actions scope.", estMinutes: 2 },
      { id: "gh.s3", ordinal: 3, kind: "validate",        title: "Validate connection",                  detail: "Axiom probes /repos and /actions and confirms branch protection visibility.", validation: { label: "Run validation", href: "/api/github/validate" }, estMinutes: 1 },
      { id: "gh.s4", ordinal: 4, kind: "review",          title: "Review release readiness",             detail: "Axiom scores readiness and surfaces blockers.",                              action:     { label: "Open ReleaseOps",      href: "/dashboard/releaseops" }, estMinutes: 2 },
    ],
    commonFailures: [
      { cause: "Token missing",              symptom: "Validation reports 'no GITHUB_TOKEN configured'.", fix: "Install the GitHub App or paste a fine-grained PAT with the documented scopes.", troubleshooterId: "github.token_missing" },
      { cause: "Repo access denied",         symptom: "Repo list is empty.",                              fix: "Confirm the app is installed on the right organisation and the desired repos are selected.", troubleshooterId: "github.repo_access" },
      { cause: "Rate limited",               symptom: "Validation reports HTTP 403 rate-limit.",          fix: "Wait for rate-limit reset or move to the GitHub App for higher quotas.",            troubleshooterId: "github.rate_limit" },
    ],
    successNextAction: { label: "Open ReleaseOps", href: "/dashboard/releaseops" },
    fallbackSupport: FALLBACK,
  },

  security_scanner: {
    track: "security_scanner",
    title: "Enable security scanner",
    status: "live",
    prerequisites: ["At least one cloud provider connected (AWS/Azure/GCP) — preview mode works without."],
    requiredPermissions: [],
    steps: [
      { id: "sec.s1", ordinal: 1, kind: "navigate", title: "Open Security Scanner",  detail: "The scanner can run in preview mode immediately.", action:     { label: "Open Security Scanner", href: "/dashboard/security-scanner" }, estMinutes: 1 },
      { id: "sec.s2", ordinal: 2, kind: "scan",     title: "Run first scan",          detail: "Axiom evaluates 22 typed checks across cloud, app, supply-chain, desktop.", validation: { label: "Run scan",        href: "/api/security-scan" }, estMinutes: 1 },
      { id: "sec.s3", ordinal: 3, kind: "review",   title: "Review findings",         detail: "Each finding has narrative, recommended fix, and validation check.", action: { label: "Open findings", href: "/dashboard/security-scanner" }, estMinutes: 3 },
    ],
    commonFailures: [
      { cause: "Missing env config",     symptom: "Scanner reports preview mode despite provider connection.", fix: "Confirm provider validator runs live — see provider setup flow.", troubleshooterId: "security.env_missing" },
      { cause: "Check returns unknown",   symptom: "Check status shows 'unknown'.",                            fix: "Provide additional evidence (run live scan; configure dependency scan).", troubleshooterId: "security.evidence_missing" },
    ],
    successNextAction: { label: "Open Trust Center", href: "/dashboard/trust" },
    fallbackSupport: FALLBACK,
  },

  desktop: {
    track: "desktop",
    title: "Set up desktop workstation",
    status: "preview",
    prerequisites: ["macOS / Windows / Linux workstation."],
    requiredPermissions: [],
    steps: [
      { id: "dt.s1", ordinal: 1, kind: "navigate",   title: "Open desktop install page",    detail: "Download the appropriate installer or run from source.", action: { label: "Open downloads", href: "/desktop" }, estMinutes: 1 },
      { id: "dt.s2", ordinal: 2, kind: "validate",   title: "Pair workstation",              detail: "Sign in to Axiom from the desktop app to receive your first signed handoff.", validation: { label: "Verify handoff", href: "/api/desktop/status" }, estMinutes: 2 },
      { id: "dt.s3", ordinal: 3, kind: "review",     title: "Review handoff inbox",          detail: "Plans signed on the server can be reviewed locally with full Terraform/CLI artifacts.", action: { label: "Open desktop inbox", href: "/desktop/inbox" }, estMinutes: 2 },
    ],
    commonFailures: [
      { cause: "Binary unsigned",         symptom: "OS warns the installer is not from an identified developer.", fix: "Honest: binaries are unsigned today. Build from source until Apple Developer ID signing lands.", troubleshooterId: "desktop.binary_unsigned" },
      { cause: "Handoff expired",          symptom: "Inbox rejects the payload with 'expired'.",                    fix: "Request a fresh handoff from the server — payloads carry an explicit TTL.",         troubleshooterId: "desktop.handoff_expired" },
      { cause: "Local apply blocked",      symptom: "'Apply' button is greyed out.",                                fix: "Local apply is intentionally blocked until governance + signed binaries land.",      troubleshooterId: "desktop.apply_blocked" },
    ],
    successNextAction: { label: "Review next handoff", href: "/desktop/inbox" },
    fallbackSupport: FALLBACK,
  },

  release_ops: {
    track: "release_ops",
    title: "Enable ReleaseOps",
    status: "expanding",
    prerequisites: ["GitHub connection complete."],
    requiredPermissions: [],
    steps: [
      { id: "ro.s1", ordinal: 1, kind: "review",   title: "Open ReleaseOps dashboard", detail: "Inspect release readiness score, blockers, and recommended sequence.", action: { label: "Open ReleaseOps", href: "/dashboard/releaseops" }, estMinutes: 2 },
      { id: "ro.s2", ordinal: 2, kind: "review",   title: "Resolve top blocker",        detail: "Axiom orders blockers by severity and points at the precise next action.", estMinutes: 5 },
      { id: "ro.s3", ordinal: 3, kind: "validate", title: "Re-score readiness",         detail: "Re-run after fixing — readiness grade should improve.", validation: { label: "Re-score", href: "/dashboard/releaseops" }, estMinutes: 1 },
    ],
    commonFailures: [
      { cause: "Stale pipeline data",        symptom: "Readiness banner shows 'evidence is stale'.", fix: "Trigger a fresh GitHub sync. Readiness recomputes on the latest snapshot.", troubleshooterId: "release_ops.stale_data" },
    ],
    successNextAction: { label: "Export audit bundle", href: "/dashboard/audit" },
    fallbackSupport: FALLBACK,
  },

  audit_trust: {
    track: "audit_trust",
    title: "Configure audit & trust",
    status: "live",
    prerequisites: [],
    requiredPermissions: [],
    steps: [
      { id: "at.s1", ordinal: 1, kind: "review", title: "Open Trust Center",         detail: "Inspect compliance controls and current evidence.", action: { label: "Open Trust Center", href: "/dashboard/trust" }, estMinutes: 2 },
      { id: "at.s2", ordinal: 2, kind: "review", title: "Export evidence bundle",     detail: "Download JSON + NDJSON bundle for any audit window.", estMinutes: 1 },
    ],
    commonFailures: [
      { cause: "Audit pipeline preview",     symptom: "Trust Center shows 'preview' banner.",  fix: "Audit store moves to live after Prisma-backed SecureAuditStore lands.", troubleshooterId: "audit.preview_mode" },
    ],
    successNextAction: { label: "Validate platform", href: "/dashboard/validation" },
    fallbackSupport: FALLBACK,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getSetupFlow(track: SetupTrack): SetupFlow {
  return FLOWS[track];
}

export function listSetupFlows(): SetupFlow[] {
  return Object.values(FLOWS);
}

export function nextSetupAction(track: SetupTrack, completedStepIds: string[]): SetupStep | null {
  const flow = FLOWS[track];
  const remaining = flow.steps.filter((s) => !completedStepIds.includes(s.id));
  return remaining[0] ?? null;
}

export function listAvailableTracks(): SetupTrack[] {
  return Object.keys(FLOWS) as SetupTrack[];
}

export function setupCoverageSummary(): { live: number; preview: number; expanding: number; planned: number; total: number } {
  const tally = { live: 0, preview: 0, expanding: 0, planned: 0, total: 0 };
  for (const flow of Object.values(FLOWS)) {
    tally[flow.status] += 1;
    tally.total += 1;
  }
  return tally;
}
