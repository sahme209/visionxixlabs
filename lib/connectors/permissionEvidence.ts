/**
 * Per-connector permission evidence.
 *
 * For every connector Axiom integrates with, this module describes exactly
 * what permissions it requests, what it doesn't, how to revoke, and what
 * data category it accesses. Used by the Integrations Center, Trust
 * Center, onboarding flow, and the connector permission evidence bundle.
 *
 * Honest by design — no overclaim of capabilities, no understated risk.
 */

import type { ProviderId } from "@/lib/domain/provider";

export type AuthModel =
  | "iam_role_external_id"
  | "azure_service_principal"
  | "azure_managed_identity"
  | "gcp_service_account"
  | "gcp_workload_identity"
  | "github_app_installation"
  | "github_oauth"
  | "github_pat"
  | "oauth_pkce"
  | "api_key"
  | "local_keychain";

export type ConnectorRiskLevel = "low" | "medium" | "high";

export interface ConnectorPermissionEvidence {
  connectorId: string;
  label: string;
  provider: ProviderId;
  authModel: AuthModel;
  /** What this connector can read. Always explicit — never "anything we need". */
  readPermissions: string[];
  /** What this connector can write. Always explicit. */
  writePermissions: string[];
  requiredScopes: string[];
  optionalScopes?: string[];
  /** Plain-language description of what kinds of data are touched. */
  dataAccessed: string[];
  /** What we explicitly do not touch. */
  dataNotAccessed: string[];
  /** Self-serve revocation path. */
  revocationPath: { label: string; href: string; instructions: string };
  leastPrivilegeNotes: string;
  riskLevel: ConnectorRiskLevel;
  /** Honest current state of the connector in production. */
  status: "live" | "expanding" | "preview" | "planned" | "unavailable";
}

// ---------------------------------------------------------------------------
// Registry — one entry per connector. Update here only.
// ---------------------------------------------------------------------------

export const CONNECTOR_EVIDENCE: ConnectorPermissionEvidence[] = [
  {
    connectorId: "aws",
    label: "AWS",
    provider: "aws",
    authModel: "iam_role_external_id",
    readPermissions: [
      "ec2:Describe*",
      "s3:GetBucket*",
      "s3:ListBucket",
      "s3:ListAllMyBuckets",
      "rds:Describe*",
      "rds:ListTagsForResource",
      "iam:Get*",
      "iam:List*",
      "iam:Simulate*",
      "cloudwatch:Get*",
      "cloudwatch:List*",
      "cloudwatch:Describe*",
      "logs:Describe*",
      "logs:Get*",
      "sts:GetCallerIdentity",
    ],
    writePermissions: [],     // Read-only by default — writes require explicit role expansion
    requiredScopes: ["sts:AssumeRole"],
    optionalScopes: [],
    dataAccessed: [
      "Resource metadata (EC2, S3, RDS, networking) — names, regions, tags, configuration",
      "IAM policy summaries (for least-privilege analysis)",
      "Cost Explorer aggregates (when allowed)",
    ],
    dataNotAccessed: [
      "S3 object contents",
      "RDS row data",
      "CloudWatch log line bodies (only counts + metadata)",
      "Anything Axiom's role wasn't granted read on",
    ],
    revocationPath: {
      label: "Revoke AWS role trust",
      href: "/docs/aws-setup",
      instructions:
        "Remove Axiom's broker principal from the trust policy of the IAM role you created. " +
        "Axiom will refuse the next assume-role call and the connector lifecycle transitions to revoked.",
    },
    leastPrivilegeNotes:
      "Axiom recommends a read-only role with External ID. The IAM trust evaluator grades the trust " +
      "policy A-F at validation time and surfaces unsafe configurations (wildcard Principal, missing " +
      "External ID, MFA recommendations).",
    riskLevel: "low",
    status: "live",
  },
  {
    connectorId: "azure",
    label: "Microsoft Azure",
    provider: "azure",
    authModel: "azure_service_principal",
    readPermissions: [
      "Microsoft.Resources/subscriptions/read",
      "Microsoft.Compute/virtualMachines/read",
      "Microsoft.Network/*/read",
      "Microsoft.Storage/storageAccounts/read",
    ],
    writePermissions: [],
    requiredScopes: ["Reader"],
    dataAccessed: ["Resource inventory + tags + configuration for the granted subscriptions."],
    dataNotAccessed: ["Storage account blob contents", "Key Vault secrets", "Subscriptions outside the granted scope"],
    revocationPath: {
      label: "Revoke Azure service principal",
      href: "/docs/azure-setup",
      instructions:
        "Delete the App Registration's client secret or remove the Reader role assignment on the " +
        "subscription. The next discovery call will fail and the connector lifecycle transitions to failed.",
    },
    leastPrivilegeNotes: "Reader role on the subscription is sufficient. No Contributor or Owner role required.",
    riskLevel: "low",
    status: "expanding",
  },
  {
    connectorId: "gcp",
    label: "Google Cloud Platform",
    provider: "gcp",
    authModel: "gcp_service_account",
    readPermissions: [
      "resourcemanager.projects.get",
      "compute.instances.list",
      "compute.networks.list",
      "storage.buckets.list",
    ],
    writePermissions: [],
    requiredScopes: ["roles/viewer"],
    dataAccessed: ["Project + resource inventory at the project level."],
    dataNotAccessed: ["Object contents in GCS", "BigQuery row data", "Secret Manager values"],
    revocationPath: {
      label: "Revoke GCP service account",
      href: "/docs/gcp-setup",
      instructions:
        "Delete the service account key in IAM & Admin or remove the Viewer role binding. The next " +
        "discovery call refuses and the connector revokes.",
    },
    leastPrivilegeNotes:
      "Workload Identity Federation is recommended for production. Static service-account keys are " +
      "supported as a fallback but flagged in the credential vault as static.",
    riskLevel: "low",
    status: "expanding",
  },
  {
    connectorId: "github",
    label: "GitHub",
    provider: "github",
    authModel: "github_app_installation",
    readPermissions: [
      "repo: read",
      "actions: read",
      "checks: read",
      "deployments: read",
      "pull_requests: read",
      "contents: read",
      "metadata: read",
    ],
    writePermissions: [
      // Write permissions are opt-in; only requested when ReleaseOps automation is enabled.
      "issues: write (opt-in)",
      "checks: write (opt-in)",
    ],
    requiredScopes: ["repository read"],
    optionalScopes: ["repository write (ReleaseOps automation only)"],
    dataAccessed: [
      "Repository metadata, workflow runs, branch protection, deployment events, PR + check status.",
    ],
    dataNotAccessed: [
      "Personal email beyond what the OAuth scope grants",
      "Private repos you didn't install the app on",
      "Repos in other organisations",
    ],
    revocationPath: {
      label: "Uninstall the GitHub App",
      href: "https://github.com/settings/installations",
      instructions:
        "Open GitHub → Settings → Applications → Installed GitHub Apps → Axiom → Uninstall. " +
        "Axiom's token immediately becomes invalid.",
    },
    leastPrivilegeNotes:
      "Install the GitHub App on the minimum set of repos needed. The app's permissions are listed at " +
      "install time and recorded in the connector permission summary.",
    riskLevel: "medium",
    status: "preview",
  },
  {
    connectorId: "desktop",
    label: "Axiom desktop runtime",
    provider: "desktop",
    authModel: "local_keychain",
    readPermissions: [
      "Read locally-stored handoff bundles (signed by the web app)",
      "Read user-supplied cloud CLI configuration (~/.aws, ~/.config/gcloud, etc.)",
    ],
    writePermissions: [
      "Write local audit log",
      "Execute terraform plan locally (preview only)",
      "Execute terraform apply locally (approval-gated)",
    ],
    requiredScopes: ["local file access"],
    dataAccessed: ["Plans handed off by the web app", "Local CLI configuration the user explicitly points us at"],
    dataNotAccessed: ["Anything outside the bundle directory unless the user invokes a local CLI command"],
    revocationPath: {
      label: "Revoke desktop pairing",
      href: "/dashboard/security",
      instructions:
        "Open Security Center → Desktop trust → Revoke pairing. The web app will refuse to issue " +
        "further handoffs to this desktop and the desktop will refuse any local execution.",
    },
    leastPrivilegeNotes:
      "Local apply is approval-gated by default. The desktop refuses destructive operations unless " +
      "an approval grant + tenant policy allowance + rollback plan + reachable audit sink all align.",
    riskLevel: "medium",
    status: "preview",
  },
];

export function evidenceFor(connectorId: string): ConnectorPermissionEvidence | undefined {
  return CONNECTOR_EVIDENCE.find((c) => c.connectorId === connectorId);
}

// ---------------------------------------------------------------------------
// Aggregate summary — for Trust Center headline
// ---------------------------------------------------------------------------

export interface ConnectorEvidenceSummary {
  total: number;
  live: number;
  preview: number;
  expanding: number;
  planned: number;
  highRiskCount: number;
}

export function summarizeConnectorEvidence(entries: ConnectorPermissionEvidence[] = CONNECTOR_EVIDENCE): ConnectorEvidenceSummary {
  let live = 0, preview = 0, expanding = 0, planned = 0, highRiskCount = 0;
  for (const e of entries) {
    if (e.status === "live") live++;
    else if (e.status === "preview") preview++;
    else if (e.status === "expanding") expanding++;
    else if (e.status === "planned") planned++;
    if (e.riskLevel === "high") highRiskCount++;
  }
  return { total: entries.length, live, preview, expanding, planned, highRiskCount };
}
