/**
 * Self-Serve Troubleshooter.
 *
 * Diagnoses + resolves common setup / workflow failures across every
 * integration so users don't depend on a support call for normal
 * operational problems. Each diagnosis carries: likely cause, evidence
 * the user can verify locally, exact fix steps, the route to fix it, the
 * validation action that proves the fix landed, and a fallback support
 * link only as a last resort.
 *
 * The setup orchestrator references troubleshooter ids; this module
 * resolves them back to actionable diagnoses.
 */

export type TroubleshooterDomain = "aws" | "azure" | "gcp" | "github" | "desktop" | "security_scanner" | "release_ops" | "audit";

export type DiagnosisSeverity = "info" | "warning" | "blocker";

export interface DiagnosisStep {
  ordinal: number;
  detail: string;
  action?: { label: string; href: string };
}

export interface Diagnosis {
  id: string;
  domain: TroubleshooterDomain;
  title: string;
  severity: DiagnosisSeverity;
  likelyCause: string;
  /** Evidence the user can verify themselves. */
  evidence: string[];
  steps: DiagnosisStep[];
  /** Validation action to confirm the fix worked. */
  validation: { label: string; href: string };
  /** When self-serve fails, fall back to support. */
  fallback?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Diagnoses
// ---------------------------------------------------------------------------

const FALLBACK = { label: "Open a support ticket", href: "/contact?topic=setup-blocked" };

const DIAGNOSES: Diagnosis[] = [
  // ── AWS ────────────────────────────────────────────────────────────────
  {
    id: "aws.external_id_mismatch",
    domain: "aws",
    title: "AWS External ID mismatch",
    severity: "blocker",
    likelyCause: "The External ID copied into the IAM trust policy does not match the External ID Axiom generated.",
    evidence: ["STS error code: 'InvalidClientTokenId' or trust policy denial."],
    steps: [
      { ordinal: 1, detail: "Open the Axiom AWS connect form and copy the displayed External ID exactly.", action: { label: "Open connect form", href: "/operator/onboarding" } },
      { ordinal: 2, detail: "In the AWS IAM console, edit the role's trust policy and set 'sts:ExternalId' to that value." },
      { ordinal: 3, detail: "Save the trust policy." },
    ],
    validation: { label: "Re-validate AWS", href: "/api/aws/validate" },
    fallback: FALLBACK,
  },
  {
    id: "aws.role_arn_invalid",
    domain: "aws",
    title: "AWS Role ARN invalid",
    severity: "blocker",
    likelyCause: "The pasted ARN is not in the canonical `arn:aws:iam::<account-id>:role/<role-name>` form.",
    evidence: ["Validation response: 'invalid ARN'."],
    steps: [
      { ordinal: 1, detail: "Open the IAM role in the AWS console." },
      { ordinal: 2, detail: "Copy the 'Role ARN' field — it always starts with `arn:aws:iam::`." },
      { ordinal: 3, detail: "Paste the exact value into the Axiom connect form." },
    ],
    validation: { label: "Re-validate AWS", href: "/api/aws/validate" },
  },
  {
    id: "aws.assume_role_denied",
    domain: "aws",
    title: "AWS AssumeRole denied",
    severity: "blocker",
    likelyCause: "Trust policy does not list the Vision XIX Axiom AWS account as principal, or the External ID does not match.",
    evidence: ["STS error: 'AccessDenied' on sts:AssumeRole."],
    steps: [
      { ordinal: 1, detail: "Inspect the role's Trust Relationships JSON." },
      { ordinal: 2, detail: "Confirm 'Principal.AWS' lists the Axiom account id from the setup guide." },
      { ordinal: 3, detail: "Confirm 'Condition.StringEquals.sts:ExternalId' matches the workspace External ID." },
    ],
    validation: { label: "Re-validate AWS", href: "/api/aws/validate" },
    fallback: FALLBACK,
  },
  {
    id: "aws.permissions_missing",
    domain: "aws",
    title: "AWS read-only permissions missing",
    severity: "warning",
    likelyCause: "Role assumes successfully but resource inventory is empty.",
    evidence: ["Scan summary shows 0 resources across known regions."],
    steps: [
      { ordinal: 1, detail: "Attach the AWS-managed ReadOnlyAccess policy, or the curated subset documented in the setup guide.", action: { label: "Open setup guide", href: "/docs/aws-setup" } },
      { ordinal: 2, detail: "Run the scan again." },
    ],
    validation: { label: "Re-run AWS scan", href: "/api/aws/scan" },
  },
  {
    id: "aws.region_disabled",
    domain: "aws",
    title: "AWS region disabled",
    severity: "warning",
    likelyCause: "Scan failed for a specific region because it is disabled at the account level.",
    evidence: ["Scan log: 'OptInRequired' for region X."],
    steps: [{ ordinal: 1, detail: "Either enable the region in the AWS account, or remove it from the Axiom scan scope." }],
    validation: { label: "Re-run AWS scan", href: "/api/aws/scan" },
  },

  // ── Azure ──────────────────────────────────────────────────────────────
  {
    id: "azure.tenant_invalid",
    domain: "azure",
    title: "Azure tenant id invalid",
    severity: "blocker",
    likelyCause: "Tenant id field contains a domain (foo.onmicrosoft.com) instead of the GUID form.",
    evidence: ["Validation: 'invalid tenant id'."],
    steps: [{ ordinal: 1, detail: "Open Microsoft Entra ID overview and copy the 'Tenant ID' GUID." }],
    validation: { label: "Re-validate Azure", href: "/api/azure/validate" },
  },
  {
    id: "azure.role_missing",
    domain: "azure",
    title: "Azure service principal missing role",
    severity: "blocker",
    likelyCause: "App registration is created but has no role on the target subscription.",
    evidence: ["Validation succeeds but inventory is empty."],
    steps: [
      { ordinal: 1, detail: "In the target Azure subscription, open 'Access control (IAM) → Role assignments'." },
      { ordinal: 2, detail: "Add 'Reader' role and assign it to the Axiom app registration." },
    ],
    validation: { label: "Re-validate Azure", href: "/api/azure/validate" },
  },
  {
    id: "azure.secret_expired",
    domain: "azure",
    title: "Azure client secret expired",
    severity: "blocker",
    likelyCause: "The client secret created on the app registration has hit its expiry.",
    evidence: ["Validation reports 'AADSTS7000222: invalid client secret'."],
    steps: [
      { ordinal: 1, detail: "Open the Axiom app registration → 'Certificates & secrets'." },
      { ordinal: 2, detail: "Create a new client secret. Copy the value immediately." },
      { ordinal: 3, detail: "Paste it into the Axiom Azure connect form." },
    ],
    validation: { label: "Re-validate Azure", href: "/api/azure/validate" },
  },

  // ── GCP ────────────────────────────────────────────────────────────────
  {
    id: "gcp.json_invalid",
    domain: "gcp",
    title: "GCP service account JSON malformed",
    severity: "blocker",
    likelyCause: "The pasted JSON is incomplete or wraps in extra characters.",
    evidence: ["Validation: 'JSON parse failed'."],
    steps: [
      { ordinal: 1, detail: "Open the downloaded service account key file." },
      { ordinal: 2, detail: "Copy the full content — including the opening { and closing }." },
      { ordinal: 3, detail: "Paste exactly into the Axiom GCP connect form." },
    ],
    validation: { label: "Re-validate GCP", href: "/api/gcp/validate" },
  },
  {
    id: "gcp.permissions_missing",
    domain: "gcp",
    title: "GCP service account permissions denied",
    severity: "blocker",
    likelyCause: "Service account exists but lacks Viewer + Security Reviewer roles.",
    evidence: ["Live validation reports 403."],
    steps: [
      { ordinal: 1, detail: "Open Cloud Console → IAM & Admin → IAM." },
      { ordinal: 2, detail: "Attach 'Viewer' and 'Security Reviewer' roles to the Axiom service account on the target project." },
    ],
    validation: { label: "Re-validate GCP", href: "/api/gcp/validate" },
  },
  {
    id: "gcp.api_disabled",
    domain: "gcp",
    title: "GCP API disabled",
    severity: "warning",
    likelyCause: "Cloud Asset or Resource Manager APIs are disabled for the project.",
    evidence: ["Live scan fails with 'API has not been used in project'."],
    steps: [{ ordinal: 1, detail: "Enable 'Cloud Asset API' and 'Cloud Resource Manager API' on the project." }],
    validation: { label: "Re-validate GCP", href: "/api/gcp/validate" },
  },

  // ── GitHub ─────────────────────────────────────────────────────────────
  {
    id: "github.token_missing",
    domain: "github",
    title: "GitHub token missing",
    severity: "blocker",
    likelyCause: "No GitHub App install or PAT is configured for this workspace.",
    evidence: ["Validation: 'no GITHUB_TOKEN configured'."],
    steps: [
      { ordinal: 1, detail: "Install the Axiom GitHub App on your organisation.", action: { label: "Open integration", href: "/dashboard/integrations/github" } },
      { ordinal: 2, detail: "Or paste a fine-grained PAT with repo:read + actions:read." },
    ],
    validation: { label: "Re-validate GitHub", href: "/api/github/validate" },
  },
  {
    id: "github.repo_access",
    domain: "github",
    title: "GitHub repo access denied",
    severity: "warning",
    likelyCause: "App is installed but not authorised for the repos you want to scan.",
    evidence: ["Repo list is empty after a successful auth check."],
    steps: [{ ordinal: 1, detail: "Open the GitHub App install settings on your organisation and add the desired repos." }],
    validation: { label: "Re-validate GitHub", href: "/api/github/validate" },
  },
  {
    id: "github.rate_limit",
    domain: "github",
    title: "GitHub rate limited",
    severity: "warning",
    likelyCause: "Token has exceeded the unauthenticated-or-PAT rate limit.",
    evidence: ["403 with 'API rate limit exceeded'."],
    steps: [
      { ordinal: 1, detail: "Wait for the rate-limit reset window (printed in the response header)." },
      { ordinal: 2, detail: "Move to the Axiom GitHub App for higher quotas." },
    ],
    validation: { label: "Re-validate GitHub", href: "/api/github/validate" },
  },

  // ── Desktop ────────────────────────────────────────────────────────────
  {
    id: "desktop.binary_unsigned",
    domain: "desktop",
    title: "Desktop binary unsigned",
    severity: "warning",
    likelyCause: "Apple Developer ID signing + notarization are not yet enabled.",
    evidence: ["OS prompt: 'cannot verify the developer'."],
    steps: [{ ordinal: 1, detail: "Build from source until signed binaries are published.", action: { label: "Open desktop docs", href: "/desktop" } }],
    validation: { label: "Check desktop status", href: "/api/desktop/status" },
  },
  {
    id: "desktop.handoff_expired",
    domain: "desktop",
    title: "Desktop handoff expired",
    severity: "info",
    likelyCause: "Handoff payloads carry a TTL — yours has passed.",
    evidence: ["Local inbox shows 'expired'."],
    steps: [{ ordinal: 1, detail: "Request a fresh handoff from the server view of the plan." }],
    validation: { label: "Check desktop status", href: "/api/desktop/status" },
  },
  {
    id: "desktop.apply_blocked",
    domain: "desktop",
    title: "Local apply blocked",
    severity: "info",
    likelyCause: "Local apply is intentionally blocked until governance + signed binaries land.",
    evidence: ["'Apply' button is disabled."],
    steps: [{ ordinal: 1, detail: "Use the server apply path with approval-gated execution today." }],
    validation: { label: "Open execution plans", href: "/dashboard/execution" },
  },

  // ── Security scanner ──────────────────────────────────────────────────
  {
    id: "security.env_missing",
    domain: "security_scanner",
    title: "Security scanner stuck in preview",
    severity: "info",
    likelyCause: "Provider validators are running in format-only mode.",
    evidence: ["Scanner report shows preview source even when provider is connected."],
    steps: [{ ordinal: 1, detail: "Configure broker credentials and re-run the provider validator. Live signals follow." }],
    validation: { label: "Re-run security scan", href: "/api/security-scan" },
  },
  {
    id: "security.evidence_missing",
    domain: "security_scanner",
    title: "Security check returned unknown",
    severity: "info",
    likelyCause: "Underlying signal is missing — e.g. supply-chain scan was never run.",
    evidence: ["Check status: 'unknown'."],
    steps: [{ ordinal: 1, detail: "Trigger the relevant pipeline (live scan, dependency scan, secret-scan webhook)." }],
    validation: { label: "Re-run security scan", href: "/api/security-scan" },
  },

  // ── ReleaseOps ─────────────────────────────────────────────────────────
  {
    id: "release_ops.stale_data",
    domain: "release_ops",
    title: "ReleaseOps evidence stale",
    severity: "warning",
    likelyCause: "GitHub sync has not run recently.",
    evidence: ["Readiness banner: 'evidence is stale'."],
    steps: [{ ordinal: 1, detail: "Trigger a fresh GitHub sync. Readiness recomputes on the latest snapshot." }],
    validation: { label: "Open ReleaseOps", href: "/dashboard/releaseops" },
  },

  // ── Audit ──────────────────────────────────────────────────────────────
  {
    id: "audit.preview_mode",
    domain: "audit",
    title: "Audit pipeline in preview mode",
    severity: "info",
    likelyCause: "SecureAuditStore is still memory-backed.",
    evidence: ["Trust Center shows 'preview' badge on audit."],
    steps: [{ ordinal: 1, detail: "Wait for Prisma-backed audit store rollout. Schema is committed and migration is staged." }],
    validation: { label: "Open Trust Center", href: "/dashboard/trust" },
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getDiagnosis(id: string): Diagnosis | null {
  return DIAGNOSES.find((d) => d.id === id) ?? null;
}

export function diagnosesForDomain(domain: TroubleshooterDomain): Diagnosis[] {
  return DIAGNOSES.filter((d) => d.domain === domain);
}

export function listDiagnoses(): Diagnosis[] {
  return DIAGNOSES;
}

/**
 * Best-effort diagnosis from a free-text error message. Returns the most
 * likely diagnosis(es). No matches → empty list.
 */
export function diagnoseFromError(rawMessage: string): Diagnosis[] {
  const msg = rawMessage.toLowerCase();
  const hits: { d: Diagnosis; score: number }[] = [];
  for (const d of DIAGNOSES) {
    let score = 0;
    if (msg.includes(d.id.split(".")[1] ?? "")) score += 1;
    for (const e of d.evidence) {
      const tokens = e.toLowerCase().split(/\W+/).filter((t) => t.length > 4);
      for (const t of tokens) {
        if (msg.includes(t)) score += 1;
      }
    }
    if (score > 0) hits.push({ d, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 3).map((h) => h.d);
}
