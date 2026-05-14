/**
 * Terraform Preview Generator.
 *
 * Produces typed *previews* of the Terraform a remediation would change.
 * Never executes Terraform. Never implies the change has been applied.
 * Output is rendered in the remediation center + desktop review.
 *
 * If a remediation cannot be safely expressed in HCL, the generator
 * returns `manualReviewRequired: true` instead of fabricating code.
 */

import type { RemediationCandidate } from "@/lib/remediation/remediationModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TerraformPreview {
  /** Stable id paired to the remediation candidate. */
  id: string;
  candidateId: string;
  fileName: string;
  provider: string;
  resourceAffected: string;
  /** HCL snippet for review. Never executed. */
  hcl: string;
  explanation: string;
  riskNotes: string[];
  rollbackNotes: string;
  requiredApproval: "single_approver" | "two_approvers" | "policy_blocked" | "none";
  unsupportedFieldsNotice?: string;
  /** When true, the generator could not produce a safe HCL snippet. */
  manualReviewRequired: boolean;
  sourceMode: "live" | "preview" | "planned" | "blocked";
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// HCL snippets per connector
// ---------------------------------------------------------------------------

interface Snippet {
  fileName: string;
  provider: string;
  hcl: string;
  resourceAffected: string;
  explanation: string;
  riskNotes: string[];
  rollback: string;
  unsupported?: string;
}

function awsS3PublicAccessSnippet(resourceId: string): Snippet {
  return {
    fileName: `aws/s3_${sanitise(resourceId)}_public_access.tf`,
    provider: "aws",
    resourceAffected: resourceId,
    hcl: `# Generated preview — Axiom does not apply this for you.
# Review, run \`terraform plan\` locally, and apply only after approval.

resource "aws_s3_bucket_public_access_block" "${sanitise(resourceId)}" {
  bucket = "${resourceId}"

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
`,
    explanation: "Blocks public access at the bucket boundary. Existing private objects are unaffected.",
    riskNotes: [
      "If any consumer depends on anonymous bucket access, that integration will break.",
      "Confirm CloudFront / static-hosting flows have signed URLs or origin access identity.",
    ],
    rollback: "Re-apply the previous resource state, or set the four flags to `false` in HCL and re-run terraform apply.",
  };
}

function awsEncryptionSnippet(resourceId: string): Snippet {
  return {
    fileName: `aws/s3_${sanitise(resourceId)}_encryption.tf`,
    provider: "aws",
    resourceAffected: resourceId,
    hcl: `resource "aws_s3_bucket_server_side_encryption_configuration" "${sanitise(resourceId)}" {
  bucket = "${resourceId}"

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
`,
    explanation: "Enables default server-side encryption on the bucket. Existing objects remain at their stored encryption setting.",
    riskNotes: [
      "Existing unencrypted objects are not retroactively encrypted — schedule a copy-in-place job to rewrite them if required.",
    ],
    rollback: "Remove the resource block and re-run terraform apply (default is unencrypted).",
  };
}

function awsSecurityGroupPublicIngressSnippet(resourceId: string): Snippet {
  return {
    fileName: `aws/sg_${sanitise(resourceId)}_tighten.tf`,
    provider: "aws",
    resourceAffected: resourceId,
    hcl: `# Replace the 0.0.0.0/0 ingress rule with a tighter CIDR.
# Axiom does not apply this automatically.

resource "aws_security_group_rule" "${sanitise(resourceId)}_ingress" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  security_group_id = "${resourceId}"

  # TODO: replace with your office / VPN / load-balancer CIDR.
  cidr_blocks = ["10.0.0.0/8"]
}
`,
    explanation: "Replaces a wide-open ingress rule with a tighter CIDR list — operator must supply the actual ranges.",
    riskNotes: [
      "If a legitimate caller is outside the supplied CIDR list, it will be denied.",
      "Confirm load-balancer / bastion / public service traffic paths before applying.",
    ],
    rollback: "Re-add the previous wide-open rule, or import the prior state from your VCS history.",
    unsupported: "CIDR list is a placeholder — Axiom cannot infer the correct customer-specific range from preview data.",
  };
}

function awsBackupRecommendationSnippet(resourceId: string): Snippet {
  return {
    fileName: `aws/backup_${sanitise(resourceId)}.tf`,
    provider: "aws",
    resourceAffected: resourceId,
    hcl: `resource "aws_backup_plan" "${sanitise(resourceId)}" {
  name = "${sanitise(resourceId)}-daily"

  rule {
    rule_name         = "daily-35d"
    target_vault_name = "default"
    schedule          = "cron(0 5 * * ? *)"
    lifecycle {
      delete_after = 35
    }
  }
}
`,
    explanation: "Adds a daily backup plan with 35-day retention to the default vault.",
    riskNotes: [
      "Backups incur storage cost — review retention with the cost owner.",
      "Confirm the default vault encryption + cross-region copy if required.",
    ],
    rollback: "Delete the aws_backup_plan resource block and re-run terraform apply.",
  };
}

function githubBranchProtectionSnippet(repoId: string, branch: string): Snippet {
  return {
    fileName: `github/branch_protection_${sanitise(repoId)}.tf`,
    provider: "github",
    resourceAffected: `${repoId}#${branch}`,
    hcl: `resource "github_branch_protection_v3" "${sanitise(repoId)}_${sanitise(branch)}" {
  repository_id = "${repoId}"
  pattern       = "${branch}"

  required_status_checks {
    strict = true
  }
  required_pull_request_reviews {
    required_approving_review_count = 2
    dismiss_stale_reviews           = true
    require_code_owner_reviews      = true
  }
  required_signatures = true
  enforce_admins      = true
}
`,
    explanation: "Adds 2-approver protection with required signatures + status checks for the named branch.",
    riskNotes: [
      "Tightens merge flow — confirm hotfix workflow is documented before rolling out.",
    ],
    rollback: "Lower required_approving_review_count or remove the resource block and re-apply.",
  };
}

function sanitise(input: string): string {
  return input.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

function selectSnippet(candidate: RemediationCandidate): Snippet | null {
  const resourceId = candidate.resourceIds[0] ?? "resource";
  const connector = candidate.connector;

  if (connector.includes("aws.network_exposure") || connector.includes("aws.public_exposure")) {
    if (connector.includes("s3")) return awsS3PublicAccessSnippet(resourceId);
    return awsSecurityGroupPublicIngressSnippet(resourceId);
  }
  if (connector.includes("aws.encryption_at_rest")) {
    return awsEncryptionSnippet(resourceId);
  }
  if (connector.startsWith("aws.")) {
    if (candidate.category === "reliability_improvement") return awsBackupRecommendationSnippet(resourceId);
    return null;
  }

  if (connector.startsWith("github.")) {
    if (connector.includes("branch_protection") || connector.includes("signed_commits_missing") || connector.includes("required_checks_missing")) {
      const branch = candidate.proposedChange.payload?.branch || "main";
      return githubBranchProtectionSnippet(resourceId, branch);
    }
    return null;
  }

  return null;
}

export function generateTerraformPreview(candidate: RemediationCandidate): TerraformPreview {
  const now = new Date().toISOString();
  const snippet = selectSnippet(candidate);
  const approval =
    candidate.approvalRequirement === "two_approvers"   ? "two_approvers"  :
    candidate.approvalRequirement === "single_approver" ? "single_approver" :
    candidate.approvalRequirement === "policy_blocked"  ? "policy_blocked"  : "none";

  if (!snippet) {
    return {
      id: `tf.${candidate.id}`,
      candidateId: candidate.id,
      fileName: `manual_review_${sanitise(candidate.id)}.tf`,
      provider: candidate.provider,
      resourceAffected: candidate.resourceIds[0] ?? "(unknown)",
      hcl: "# Manual review required — Axiom cannot generate a safe HCL snippet for this remediation today.",
      explanation: "Axiom does not yet have a deterministic HCL template for this finding category.",
      riskNotes: ["Treat this as a documentation-only remediation."],
      rollbackNotes: "N/A",
      requiredApproval: approval,
      manualReviewRequired: true,
      sourceMode: candidate.sourceMode,
      generatedAt: now,
    };
  }

  return {
    id: `tf.${candidate.id}`,
    candidateId: candidate.id,
    fileName: snippet.fileName,
    provider: snippet.provider,
    resourceAffected: snippet.resourceAffected,
    hcl: snippet.hcl,
    explanation: snippet.explanation,
    riskNotes: snippet.riskNotes,
    rollbackNotes: snippet.rollback,
    requiredApproval: approval,
    unsupportedFieldsNotice: snippet.unsupported,
    manualReviewRequired: false,
    sourceMode: candidate.sourceMode,
    generatedAt: now,
  };
}

export function generateTerraformPreviews(candidates: RemediationCandidate[]): TerraformPreview[] {
  return candidates.map(generateTerraformPreview);
}
