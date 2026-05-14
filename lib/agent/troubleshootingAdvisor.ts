/**
 * Troubleshooting advisor — pattern-matching diagnoser for common errors.
 *
 * Takes an error code or error message and returns a typed diagnosis with
 * likely cause, evidence, step-by-step fix, doc link, and safe next action.
 * Self-serve first; contact CTA only as fallback.
 */

export interface DiagnosisStep {
  number: number;
  description: string;
  command?: string;
}

export interface Diagnosis {
  /** Stable identifier for analytics. */
  id: string;
  /** Specific error code or pattern that matched. */
  matched: string;
  /** Likely cause in plain English. */
  likelyCause: string;
  /** Confidence in the diagnosis in [0, 1]. */
  confidence: number;
  /** Structured evidence (signal name → value pairs). */
  evidence: { name: string; value: string }[];
  /** Step-by-step self-serve fix. */
  fix: DiagnosisStep[];
  /** Docs deep-link with anchor. */
  docsHref: string;
  /** Safe next action — what to do right now. */
  safeNextAction: { label: string; href: string };
  /** Escalation fallback — only surfaced if user explicitly requests it. */
  escalation?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Known issues
// ---------------------------------------------------------------------------

interface IssuePattern {
  id: string;
  patterns: RegExp[];
  diagnose: (matched: string) => Diagnosis;
}

const ISSUES: IssuePattern[] = [
  {
    id: "aws.access_denied_assume_role",
    patterns: [/AccessDenied.*AssumeRole/i, /not authorized to perform.*AssumeRole/i],
    diagnose: (matched) => ({
      id: "aws.access_denied_assume_role",
      matched,
      likelyCause: "The trust policy on your IAM role doesn't allow Axiom's AWS account ID to assume it.",
      confidence: 0.92,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Open AWS Console → IAM → Roles → [your axiom role] → Trust relationships" },
        { number: 2, description: "Confirm the Principal.AWS value matches the Axiom account ID shown in the onboarding screen" },
        { number: 3, description: "Save trust policy and click 'Test connection' in Axiom" },
      ],
      docsHref: "/docs/aws-setup#option-2",
      safeNextAction: { label: "Open AWS setup guide", href: "/docs/aws-setup" },
    }),
  },
  {
    id: "aws.invalid_external_id",
    patterns: [/InvalidExternalId/i, /external\s*id.*(?:mismatch|does\s+not\s+match)/i],
    diagnose: (matched) => ({
      id: "aws.invalid_external_id",
      matched,
      likelyCause: "The External ID in the trust policy condition doesn't match what Axiom sends.",
      confidence: 0.95,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Open the onboarding wizard at /operator/onboarding and copy the External ID value exactly" },
        { number: 2, description: "Open the trust policy in AWS Console and replace the existing condition with the copied value" },
        { number: 3, description: "Save the role and click 'Test connection' in Axiom" },
      ],
      docsHref: "/docs/aws-setup#option-2",
      safeNextAction: { label: "Re-copy External ID from onboarding", href: "/operator/onboarding" },
    }),
  },
  {
    id: "aws.malformed_policy",
    patterns: [/MalformedPolicyDocumentException/i, /Policy.*not\s+a\s+valid\s+JSON/i],
    diagnose: (matched) => ({
      id: "aws.malformed_policy",
      matched,
      likelyCause: "JSON syntax error in the trust or permission policy.",
      confidence: 0.95,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Open the policy in AWS Console JSON tab" },
        { number: 2, description: "Check for trailing commas, missing quotes, and copy-paste line breaks" },
        { number: 3, description: "Use the AWS Console built-in validator before saving" },
      ],
      docsHref: "/docs/troubleshooting#aws-connection",
      safeNextAction: { label: "Re-copy policy from onboarding", href: "/operator/onboarding" },
    }),
  },
  {
    id: "scan.zero_results",
    patterns: [/scan.*0\s+resources/i, /no\s+resources\s+found/i, /empty\s+(?:snapshot|scan)/i],
    diagnose: (matched) => ({
      id: "scan.zero_results",
      matched,
      likelyCause: "Role has no permission to Describe resources in the selected regions, or the regions truly have no resources.",
      confidence: 0.85,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Run aws sts get-caller-identity --profile axiom-role in CloudShell to confirm assumption works", command: "aws sts get-caller-identity" },
        { number: 2, description: "Confirm the permission policy includes Describe* / List* / Get* for the services you expect" },
        { number: 3, description: "Try a region where you know resources exist (e.g., us-east-1)" },
      ],
      docsHref: "/docs/troubleshooting#scanning",
      safeNextAction: { label: "Review AWS setup", href: "/docs/aws-setup" },
    }),
  },
  {
    id: "scan.failed_generic",
    patterns: [/scan\s+failed/i],
    diagnose: (matched) => ({
      id: "scan.failed_generic",
      matched,
      likelyCause: "Scan worker errored before completion — see the audit log for the specific failure.",
      confidence: 0.65,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Open the Command Center activity feed for the exact provider error" },
        { number: 2, description: "If the error code is one of: AccessDenied, InvalidExternalId, MalformedPolicy — see the dedicated troubleshooting entry" },
        { number: 3, description: "Otherwise re-run the scan; transient AWS API errors usually clear" },
      ],
      docsHref: "/docs/troubleshooting#scanning",
      safeNextAction: { label: "Open Command Center", href: "/dashboard/command-center" },
    }),
  },
  {
    id: "github.app_not_authorized",
    patterns: [/github.*(?:401|403|not\s+authorized)/i, /app\s+installation\s+not\s+found/i],
    diagnose: (matched) => ({
      id: "github.app_not_authorized",
      matched,
      likelyCause: "GitHub App installation removed, or org-level OAuth restriction is blocking discovery.",
      confidence: 0.85,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Open GitHub → Settings → Applications → Authorized GitHub Apps" },
        { number: 2, description: "Confirm Axiom's app is installed and has access to the expected repositories" },
        { number: 3, description: "If org-policy restricts third-party apps, your org admin must approve" },
      ],
      docsHref: "/docs/releaseops/connectors#github",
      safeNextAction: { label: "Open GitHub App settings", href: "https://github.com/settings/installations" },
    }),
  },
  {
    id: "terraform.export_unavailable",
    patterns: [/terraform\s+export\s+(?:unavailable|disabled|not\s+supported)/i],
    diagnose: (matched) => ({
      id: "terraform.export_unavailable",
      matched,
      likelyCause: "Plan generator did not produce Terraform — likely because the action class is destructive without explicit risk acknowledgement.",
      confidence: 0.8,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Review the recommendation type — destructive actions are blocked by default" },
        { number: 2, description: "If the recommendation is intended, acknowledge the risk in the approval form" },
        { number: 3, description: "Generate the CLI export as an alternative review path" },
      ],
      docsHref: "/docs/terraform-export#safety",
      safeNextAction: { label: "Read Terraform export guide", href: "/docs/terraform-export" },
    }),
  },
  {
    id: "approval.blocked",
    patterns: [/approval\s+(?:blocked|denied|required)/i, /policy\s+blocked/i, /governance\s+gate/i],
    diagnose: (matched) => ({
      id: "approval.blocked",
      matched,
      likelyCause: "A governance policy rule blocked this action. See the policy decision in the Approval Center.",
      confidence: 0.9,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Open the Approval Center to see which rule fired" },
        { number: 2, description: "If a multi-party approver is required, route to the second approver" },
        { number: 3, description: "If the policy is too restrictive, an org admin can adjust the default policy pack" },
      ],
      docsHref: "/docs/approval-workflow",
      safeNextAction: { label: "Open Approval Center", href: "/dashboard/approvals" },
    }),
  },
  {
    id: "desktop.handoff_unavailable",
    patterns: [/desktop\s+handoff\s+(?:unavailable|disabled|not\s+available)/i, /no\s+desktop\s+runtime/i],
    diagnose: (matched) => ({
      id: "desktop.handoff_unavailable",
      matched,
      likelyCause: "The desktop app is not installed (or platform is not yet shipping).",
      confidence: 0.85,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Install the desktop app from /download (macOS preview today)" },
        { number: 2, description: "Or fall back to Terraform export and apply through your existing pipeline" },
      ],
      docsHref: "/docs/desktop-install",
      safeNextAction: { label: "Open /download", href: "/download" },
    }),
  },
  {
    id: "audit.export_failed",
    patterns: [/audit\s+export\s+failed/i],
    diagnose: (matched) => ({
      id: "audit.export_failed",
      matched,
      likelyCause: "Audit export job failed — likely due to a transient storage / format error.",
      confidence: 0.6,
      evidence: [{ name: "error", value: matched.slice(0, 200) }],
      fix: [
        { number: 1, description: "Re-run the export with a narrower time window" },
        { number: 2, description: "If repeated, try a different format (CSV vs JSON vs NDJSON)" },
        { number: 3, description: "Check the dashboard activity feed for the specific failure" },
      ],
      docsHref: "/docs/audit-logs",
      safeNextAction: { label: "Open audit logs", href: "/dashboard/memory" },
    }),
  },
];

// ---------------------------------------------------------------------------
// Diagnoser
// ---------------------------------------------------------------------------

/**
 * Match an error code/message to a known diagnosis. Returns the first
 * matching pattern; if no pattern matches, returns a generic fallback.
 */
export function diagnose(errorText: string): Diagnosis {
  for (const issue of ISSUES) {
    for (const pattern of issue.patterns) {
      if (pattern.test(errorText)) {
        return issue.diagnose(errorText);
      }
    }
  }
  // Generic fallback
  return {
    id: "generic.unknown_error",
    matched: errorText,
    likelyCause: "No specific diagnosis available for this error pattern.",
    confidence: 0.3,
    evidence: [{ name: "error", value: errorText.slice(0, 200) }],
    fix: [
      { number: 1, description: "Open the troubleshooting guide for the relevant area" },
      { number: 2, description: "Check the audit log for the exact failure context" },
      { number: 3, description: "If unresolved, contact support with the error text and the run ID" },
    ],
    docsHref: "/docs/troubleshooting",
    safeNextAction: { label: "Open troubleshooting guide", href: "/docs/troubleshooting" },
    escalation: { label: "Contact support", href: "/contact?topic=technical-support" },
  };
}

/**
 * Diagnose a list of error events — returns up to N distinct diagnoses,
 * de-duplicated by issue ID.
 */
export function diagnoseBatch(errorTexts: string[], limit = 5): Diagnosis[] {
  const seen = new Set<string>();
  const out: Diagnosis[] = [];
  for (const text of errorTexts) {
    const d = diagnose(text);
    if (!seen.has(d.id)) {
      seen.add(d.id);
      out.push(d);
      if (out.length >= limit) break;
    }
  }
  return out;
}
