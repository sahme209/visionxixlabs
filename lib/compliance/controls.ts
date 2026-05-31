/**
 * Compliance control catalog.
 *
 * Hand-curated CIS-style controls relevant to the cloud-posture
 * findings the platform produces. Each control declares a list of
 * rule-code substrings; an AxiomFinding matches the control when
 * its data.ruleCode contains any of them (case-insensitive).
 *
 * Wide on purpose: we'd rather mark a control 'partial' from a
 * single matching finding than silently miss coverage. The list is
 * a starting point — expand as scanner rule codes evolve.
 */

export type ControlStatus = "passing" | "failing" | "untested";

export interface ComplianceControl {
  id: string;
  framework: "CIS AWS" | "NIST 800-53" | "SOC 2";
  title: string;
  description: string;
  /** Substrings checked against AxiomFinding.data.ruleCode (case-insensitive). */
  ruleCodeMatchers: ReadonlyArray<string>;
}

export const COMPLIANCE_CONTROLS: ReadonlyArray<ComplianceControl> = [
  {
    id: "CIS.AWS.1.1",
    framework: "CIS AWS",
    title: "S3 buckets block public access",
    description: "All S3 buckets should have public access blocked at the account or bucket level.",
    ruleCodeMatchers: ["s3_public", "public_bucket", "bucket_acl", "block_public"],
  },
  {
    id: "CIS.AWS.1.2",
    framework: "CIS AWS",
    title: "Security groups restrict 0.0.0.0/0 ingress",
    description: "Inbound rules should not allow 0.0.0.0/0 on ports 22 or 3389 unless explicitly approved.",
    ruleCodeMatchers: ["sg_open", "open_ssh", "open_rdp", "wide_ingress", "open_security_group"],
  },
  {
    id: "CIS.AWS.1.3",
    framework: "CIS AWS",
    title: "IAM users have MFA enabled",
    description: "Every IAM user with console access should require MFA.",
    ruleCodeMatchers: ["mfa", "iam_user_mfa", "no_mfa"],
  },
  {
    id: "CIS.AWS.1.4",
    framework: "CIS AWS",
    title: "Root account has no active access keys",
    description: "Root credentials should never be used programmatically.",
    ruleCodeMatchers: ["root_access_key", "root_key"],
  },
  {
    id: "CIS.AWS.2.1",
    framework: "CIS AWS",
    title: "CloudTrail enabled and multi-region",
    description: "Audit logging must cover every region the tenant uses.",
    ruleCodeMatchers: ["cloudtrail", "audit_log"],
  },
  {
    id: "CIS.AWS.2.2",
    framework: "CIS AWS",
    title: "EBS volumes encrypted at rest",
    description: "Default EBS encryption should be enabled.",
    ruleCodeMatchers: ["ebs_unencrypted", "ebs_encryption", "unencrypted_volume"],
  },
  {
    id: "CIS.AWS.2.3",
    framework: "CIS AWS",
    title: "RDS instances encrypted at rest",
    description: "Database storage encryption is required for sensitive workloads.",
    ruleCodeMatchers: ["rds_unencrypted", "rds_encryption", "unencrypted_db"],
  },
  {
    id: "CIS.AWS.3.1",
    framework: "CIS AWS",
    title: "Idle EC2 instances flagged for shutdown",
    description: "Compute that hasn't been used in 30 days should be shut down or rightsized.",
    ruleCodeMatchers: ["idle_ec2", "underutilized_compute", "ec2_idle"],
  },
  {
    id: "SOC2.CC6.1",
    framework: "SOC 2",
    title: "Logical access controls",
    description: "Privileged actions require multi-party approval or break-glass workflow.",
    ruleCodeMatchers: ["iam_overprivileged", "wildcard_policy", "admin_access"],
  },
  {
    id: "SOC2.CC7.1",
    framework: "SOC 2",
    title: "System monitoring",
    description: "Anomaly + threshold-based alerting on critical paths.",
    ruleCodeMatchers: ["no_alarm", "missing_alarm", "cloudwatch_alarm"],
  },
  {
    id: "NIST.AC-2",
    framework: "NIST 800-53",
    title: "Account management",
    description: "Inactive credentials must be revoked or rotated.",
    ruleCodeMatchers: ["unused_key", "stale_credential", "key_age"],
  },
  {
    id: "NIST.SI-4",
    framework: "NIST 800-53",
    title: "Information system monitoring",
    description: "Detect and alert on unauthorized changes to critical resources.",
    ruleCodeMatchers: ["drift", "unauthorized_change", "config_drift"],
  },
];

/** Score a single control against a set of finding rule codes. */
export function scoreControl(
  control: ComplianceControl,
  findingRuleCodes: ReadonlyArray<string>,
): { status: ControlStatus; matchedCount: number } {
  let matched = 0;
  for (const code of findingRuleCodes) {
    const codeLower = code.toLowerCase();
    if (control.ruleCodeMatchers.some((m) => codeLower.includes(m.toLowerCase()))) {
      matched++;
    }
  }
  if (matched === 0) {
    // Untested vs passing: we can't tell without an explicit pass
    // signal, so treat zero matches as 'untested'. A future commit
    // can add positive evidence (resource scanned + no finding =
    // passing for that control).
    return { status: "untested", matchedCount: 0 };
  }
  return { status: "failing", matchedCount: matched };
}

/**
 * Inverse mapping: which controls does a single rule code violate?
 * Cheap to compute — one substring sweep across the 12-row catalog.
 * Used by the finding detail surface to show "this finding counts
 * against these controls" without recomputing the full scoreControl
 * loop on every render.
 */
export function controlsForRuleCode(ruleCode: string): ReadonlyArray<ComplianceControl> {
  const codeLower = ruleCode.toLowerCase();
  return COMPLIANCE_CONTROLS.filter((c) =>
    c.ruleCodeMatchers.some((m) => codeLower.includes(m.toLowerCase())),
  );
}
