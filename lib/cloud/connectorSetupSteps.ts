/**
 * Connector setup step lookup.
 *
 * Turns raw env-var names like AZURE_TENANT_ID into a typed
 * ConnectorSetupStep with a friendly label, a one-sentence purpose,
 * and a help link. Used by the dashboard provider drilldowns so a
 * client sees "Azure Directory (tenant) ID" + "Found under Microsoft
 * Entra ID → Overview" instead of a bare uppercase string.
 *
 * Pure / no I/O. Adding a new provider connector means appending here.
 */

export interface ConnectorSetupStep {
  /** The exact env var the back-end expects. */
  envVar: string;
  /** Operator-readable label. */
  label: string;
  /** One-sentence description of where to find it. */
  description: string;
  /** Closed-union grouping for rendering. */
  group: "identity" | "credential" | "scope" | "endpoint" | "other";
  /** Optional deep link to a Stripe-Dashboard-style help page. */
  helpHref?: string;
  /** True if this value is a secret (renders as masked input). */
  isSecret: boolean;
}

const CATALOG: ReadonlyArray<ConnectorSetupStep> = [
  // ── Azure ────────────────────────────────────────────────────
  {
    envVar: "AZURE_TENANT_ID",
    label: "Azure directory (tenant) ID",
    description: "Microsoft Entra ID → Overview → Directory (tenant) ID. UUID format.",
    group: "identity",
    helpHref: "/docs/azure-setup#tenant-id",
    isSecret: false,
  },
  {
    envVar: "AZURE_CLIENT_ID",
    label: "App registration (client) ID",
    description: "The App registration you created for Axiom. Microsoft Entra ID → App registrations → your app → Overview.",
    group: "identity",
    helpHref: "/docs/azure-setup#client-id",
    isSecret: false,
  },
  {
    envVar: "AZURE_CLIENT_SECRET",
    label: "Client secret",
    description: "App registration → Certificates & secrets → New client secret. Copy the Value (not the ID) — it's only shown once.",
    group: "credential",
    helpHref: "/docs/azure-setup#client-secret",
    isSecret: true,
  },
  {
    envVar: "AZURE_SUBSCRIPTION_ID",
    label: "Subscription ID",
    description: "The Azure subscription you want Axiom to read. Subscriptions blade → your subscription → Overview.",
    group: "scope",
    helpHref: "/docs/azure-setup#subscription",
    isSecret: false,
  },

  // ── GCP ──────────────────────────────────────────────────────
  {
    envVar: "GCP_PROJECT_ID",
    label: "GCP project ID",
    description: "The Google Cloud project you want Axiom to read.",
    group: "scope",
    helpHref: "/docs/gcp-setup#project-id",
    isSecret: false,
  },
  {
    envVar: "GCP_SERVICE_ACCOUNT_JSON",
    label: "Service account key (JSON)",
    description: "Paste the JSON key for a service account with read-only viewer role on the project.",
    group: "credential",
    helpHref: "/docs/gcp-setup#service-account",
    isSecret: true,
  },
  {
    envVar: "GCP_CLIENT_EMAIL",
    label: "Service account email",
    description: "Optional alternative — paste the service-account email instead of the JSON key.",
    group: "credential",
    helpHref: "/docs/gcp-setup#service-account",
    isSecret: false,
  },
  {
    envVar: "GCP_PRIVATE_KEY",
    label: "Service account private key",
    description: "Paired with GCP_CLIENT_EMAIL when not using JSON. PEM-formatted.",
    group: "credential",
    helpHref: "/docs/gcp-setup#service-account",
    isSecret: true,
  },

  // ── AWS ──────────────────────────────────────────────────────
  {
    envVar: "AWS_ACCOUNT_ID",
    label: "AWS account ID",
    description: "12-digit number. AWS console → top-right → Account.",
    group: "identity",
    isSecret: false,
  },
  {
    envVar: "AWS_ROLE_ARN",
    label: "Cross-account IAM role ARN",
    description: "The role Axiom will assume. Trust policy must include Axiom's principal.",
    group: "credential",
    helpHref: "/docs/aws-setup#role-arn",
    isSecret: false,
  },
  {
    envVar: "AWS_REGION",
    label: "Primary AWS region",
    description: "e.g. us-east-1. Used as the starting region for inventory.",
    group: "scope",
    isSecret: false,
  },
];

const UNKNOWN_STEP = (envVar: string): ConnectorSetupStep => ({
  envVar,
  label: envVar,
  description: "Required by the connector — see provider docs for details.",
  group: "other",
  isSecret: false,
});

/**
 * Resolve a raw env-var name (possibly with "  *or*  " separators
 * coming from the legacy missingRequirements format) into a list of
 * typed setup steps for the UI to render.
 */
export function resolveSetupSteps(rawRequirements: readonly string[]): readonly ConnectorSetupStep[] {
  const out: ConnectorSetupStep[] = [];
  for (const raw of rawRequirements) {
    // The legacy state-builder sometimes joins alternatives with " *or* ".
    // Split + flatten so each alternative is its own card.
    const parts = raw.split(/\s+\*?or\*?\s+/i).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      // Strip stray punctuation.
      const cleaned = part.replace(/[`"']/g, "").trim();
      const found = CATALOG.find((c) => c.envVar === cleaned);
      out.push(found ?? UNKNOWN_STEP(cleaned));
    }
  }
  return out;
}

export const GROUP_LABEL: Record<ConnectorSetupStep["group"], string> = {
  identity:   "Identity",
  credential: "Credentials",
  scope:      "Scope",
  endpoint:   "Endpoints",
  other:      "Other",
};
