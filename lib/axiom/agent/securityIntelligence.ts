/**
 * Axiom Agent — Security Intelligence Engine
 *
 * Deep security analysis, posture scoring, vulnerability management,
 * IAM analysis, attack surface mapping, and MITRE ATT&CK integration.
 *
 * Bridges the event stream and compliance engine with actionable
 * security operations — the "immune system" of Axiom Agent.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Security Posture Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type SecurityDomain =
  | "identity_access"
  | "network"
  | "data_protection"
  | "compute"
  | "logging_monitoring"
  | "incident_response"
  | "vulnerability_management"
  | "configuration"
  | "supply_chain"
  | "secrets_management";

export type SecurityPostureRating = "excellent" | "good" | "fair" | "poor" | "critical";

export type SecurityFindingSeverity = "critical" | "high" | "medium" | "low" | "informational";

export type SecurityFindingStatus = "open" | "acknowledged" | "in_progress" | "remediated" | "suppressed" | "false_positive" | "risk_accepted";

export interface SecurityPosture {
  accountId: string;
  provider: "aws" | "azure" | "gcp";
  assessedAt: string;
  overallScore: number;
  overallRating: SecurityPostureRating;
  domainScores: Record<SecurityDomain, DomainSecurityScore>;
  openFindings: FindingSummary;
  riskTrend: "improving" | "stable" | "degrading";
  complianceAlignment: number;
  attackSurfaceScore: number;
}

export interface DomainSecurityScore {
  domain: SecurityDomain;
  score: number;
  rating: SecurityPostureRating;
  controlsPassed: number;
  controlsFailed: number;
  controlsTotal: number;
  criticalGaps: string[];
}

export interface FindingSummary {
  total: number;
  bySeverity: Record<SecurityFindingSeverity, number>;
  byDomain: Partial<Record<SecurityDomain, number>>;
  meanTimeToRemediateHours: number;
  oldestOpenDays: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Security Controls & Checks
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecurityControl {
  id: string;
  name: string;
  domain: SecurityDomain;
  severity: SecurityFindingSeverity;
  provider: "aws" | "azure" | "gcp" | "all";
  description: string;
  checkLogic: string;
  remediationGuidance: string;
  automatable: boolean;
  cisReference?: string;
  nistReference?: string;
  mitreDefenseId?: string;
}

export const SECURITY_CONTROLS: SecurityControl[] = [
  // ── Identity & Access ──
  {
    id: "sec-iam-root-mfa",
    name: "Root Account MFA Enabled",
    domain: "identity_access",
    severity: "critical",
    provider: "aws",
    description: "Root account must have hardware MFA enabled",
    checkLogic: "iam.getAccountSummary().AccountMFAEnabled === 1",
    remediationGuidance: "Enable hardware MFA on the root account via IAM console → Security credentials",
    automatable: false,
    cisReference: "CIS AWS 1.5",
    nistReference: "IA-2(1)",
    mitreDefenseId: "M1032",
  },
  {
    id: "sec-iam-no-root-access-keys",
    name: "No Root Access Keys",
    domain: "identity_access",
    severity: "critical",
    provider: "aws",
    description: "Root account must not have active access keys",
    checkLogic: "iam.getAccountSummary().AccountAccessKeysPresent === 0",
    remediationGuidance: "Delete root access keys via IAM console → Security credentials → Access keys",
    automatable: false,
    cisReference: "CIS AWS 1.4",
    nistReference: "IA-2",
    mitreDefenseId: "M1032",
  },
  {
    id: "sec-iam-password-policy",
    name: "Strong Password Policy",
    domain: "identity_access",
    severity: "high",
    provider: "aws",
    description: "IAM password policy must require minimum 14 chars, uppercase, lowercase, number, symbol",
    checkLogic: "passwordPolicy.MinimumPasswordLength >= 14 && passwordPolicy.RequireSymbols && passwordPolicy.RequireNumbers",
    remediationGuidance: "Update IAM password policy via CLI: aws iam update-account-password-policy",
    automatable: true,
    cisReference: "CIS AWS 1.8",
    nistReference: "IA-5(1)",
  },
  {
    id: "sec-iam-unused-credentials",
    name: "No Unused Credentials (90 days)",
    domain: "identity_access",
    severity: "medium",
    provider: "aws",
    description: "IAM credentials not used in 90+ days should be disabled or removed",
    checkLogic: "credentialReport.filter(c => daysSinceLastUsed(c) > 90).length === 0",
    remediationGuidance: "Disable or delete unused IAM users and access keys older than 90 days",
    automatable: true,
    cisReference: "CIS AWS 1.12",
    nistReference: "AC-2(3)",
  },
  {
    id: "sec-iam-no-inline-policies",
    name: "No Inline IAM Policies",
    domain: "identity_access",
    severity: "medium",
    provider: "aws",
    description: "IAM users should use managed policies, not inline policies",
    checkLogic: "users.every(u => u.UserPolicyList.length === 0)",
    remediationGuidance: "Convert inline policies to managed policies for centralized management",
    automatable: true,
    cisReference: "CIS AWS 1.15",
    nistReference: "AC-6",
  },

  // ── Network ──
  {
    id: "sec-net-no-public-sg-ssh",
    name: "No Security Groups Allow SSH from 0.0.0.0/0",
    domain: "network",
    severity: "critical",
    provider: "aws",
    description: "No security group should allow inbound SSH (port 22) from any IP",
    checkLogic: "securityGroups.none(sg => sg.IpPermissions.some(p => p.FromPort <= 22 && p.ToPort >= 22 && p.IpRanges.some(r => r.CidrIp === '0.0.0.0/0')))",
    remediationGuidance: "Restrict SSH access to specific CIDR ranges or use SSM Session Manager",
    automatable: true,
    cisReference: "CIS AWS 5.2",
    nistReference: "AC-4",
    mitreDefenseId: "M1030",
  },
  {
    id: "sec-net-no-public-sg-rdp",
    name: "No Security Groups Allow RDP from 0.0.0.0/0",
    domain: "network",
    severity: "critical",
    provider: "aws",
    description: "No security group should allow inbound RDP (port 3389) from any IP",
    checkLogic: "securityGroups.none(sg => sg.IpPermissions.some(p => p.FromPort <= 3389 && p.ToPort >= 3389 && p.IpRanges.some(r => r.CidrIp === '0.0.0.0/0')))",
    remediationGuidance: "Restrict RDP to VPN CIDR ranges or use AWS Systems Manager",
    automatable: true,
    cisReference: "CIS AWS 5.3",
    nistReference: "AC-4",
    mitreDefenseId: "M1030",
  },
  {
    id: "sec-net-vpc-flow-logs",
    name: "VPC Flow Logs Enabled",
    domain: "network",
    severity: "high",
    provider: "aws",
    description: "All VPCs must have flow logs enabled for network traffic analysis",
    checkLogic: "vpcs.every(vpc => vpc.FlowLogStatus === 'ACTIVE')",
    remediationGuidance: "Enable VPC Flow Logs to CloudWatch Logs or S3 for each VPC",
    automatable: true,
    cisReference: "CIS AWS 3.9",
    nistReference: "AU-12",
    mitreDefenseId: "M1037",
  },

  // ── Data Protection ──
  {
    id: "sec-data-s3-encryption",
    name: "S3 Buckets Default Encryption",
    domain: "data_protection",
    severity: "high",
    provider: "aws",
    description: "All S3 buckets must have default encryption enabled (SSE-S3 or SSE-KMS)",
    checkLogic: "buckets.every(b => b.ServerSideEncryptionConfiguration !== undefined)",
    remediationGuidance: "Enable default encryption on each S3 bucket using SSE-S3 or SSE-KMS",
    automatable: true,
    cisReference: "CIS AWS 2.1.1",
    nistReference: "SC-28",
  },
  {
    id: "sec-data-s3-no-public",
    name: "No Public S3 Buckets",
    domain: "data_protection",
    severity: "critical",
    provider: "aws",
    description: "No S3 bucket should have public access enabled unless explicitly justified",
    checkLogic: "buckets.every(b => b.PublicAccessBlockConfiguration?.BlockPublicAcls === true)",
    remediationGuidance: "Enable S3 Block Public Access at the account level and per-bucket",
    automatable: true,
    cisReference: "CIS AWS 2.1.2",
    nistReference: "AC-3",
    mitreDefenseId: "M1041",
  },
  {
    id: "sec-data-rds-encryption",
    name: "RDS Instances Encrypted at Rest",
    domain: "data_protection",
    severity: "high",
    provider: "aws",
    description: "All RDS instances must have storage encryption enabled",
    checkLogic: "rdsInstances.every(db => db.StorageEncrypted === true)",
    remediationGuidance: "Enable encryption when creating RDS instances (cannot be changed after creation — requires migration)",
    automatable: false,
    cisReference: "CIS AWS 2.3.1",
    nistReference: "SC-28",
  },
  {
    id: "sec-data-ebs-encryption",
    name: "EBS Volumes Encrypted",
    domain: "data_protection",
    severity: "high",
    provider: "aws",
    description: "All EBS volumes must be encrypted at rest",
    checkLogic: "ebsVolumes.every(v => v.Encrypted === true)",
    remediationGuidance: "Enable default EBS encryption at the account level in EC2 settings",
    automatable: true,
    nistReference: "SC-28",
  },

  // ── Logging & Monitoring ──
  {
    id: "sec-log-cloudtrail-enabled",
    name: "CloudTrail Enabled in All Regions",
    domain: "logging_monitoring",
    severity: "critical",
    provider: "aws",
    description: "CloudTrail must be enabled in all regions with multi-region trail",
    checkLogic: "trails.some(t => t.IsMultiRegionTrail && t.IsLogging)",
    remediationGuidance: "Create a multi-region CloudTrail trail with S3 delivery and CloudWatch Logs integration",
    automatable: true,
    cisReference: "CIS AWS 3.1",
    nistReference: "AU-2",
    mitreDefenseId: "M1047",
  },
  {
    id: "sec-log-cloudtrail-encrypted",
    name: "CloudTrail Logs Encrypted",
    domain: "logging_monitoring",
    severity: "high",
    provider: "aws",
    description: "CloudTrail logs must be encrypted with KMS CMK",
    checkLogic: "trails.every(t => t.KmsKeyId !== undefined)",
    remediationGuidance: "Configure CloudTrail to use a KMS Customer Managed Key for log encryption",
    automatable: true,
    cisReference: "CIS AWS 3.7",
    nistReference: "AU-9",
  },
  {
    id: "sec-log-cloudtrail-validation",
    name: "CloudTrail Log File Validation",
    domain: "logging_monitoring",
    severity: "high",
    provider: "aws",
    description: "CloudTrail must have log file integrity validation enabled",
    checkLogic: "trails.every(t => t.LogFileValidationEnabled === true)",
    remediationGuidance: "Enable log file validation on each CloudTrail trail",
    automatable: true,
    cisReference: "CIS AWS 3.2",
    nistReference: "AU-9",
  },

  // ── Compute ──
  {
    id: "sec-compute-imdsv2",
    name: "EC2 Instances Use IMDSv2",
    domain: "compute",
    severity: "high",
    provider: "aws",
    description: "All EC2 instances must require IMDSv2 (Instance Metadata Service v2)",
    checkLogic: "instances.every(i => i.MetadataOptions.HttpTokens === 'required')",
    remediationGuidance: "Modify instance metadata options to require IMDSv2 tokens",
    automatable: true,
    nistReference: "SC-7",
    mitreDefenseId: "M1042",
  },
  {
    id: "sec-compute-no-public-amis",
    name: "No Public AMIs",
    domain: "compute",
    severity: "high",
    provider: "aws",
    description: "Custom AMIs should not be publicly shared",
    checkLogic: "images.every(i => !i.Public)",
    remediationGuidance: "Modify AMI permissions to remove public access",
    automatable: true,
    nistReference: "AC-3",
  },

  // ── Secrets Management ──
  {
    id: "sec-secrets-key-rotation",
    name: "Access Keys Rotated (90 days)",
    domain: "secrets_management",
    severity: "medium",
    provider: "aws",
    description: "IAM access keys must be rotated within 90 days",
    checkLogic: "accessKeys.every(k => daysSinceCreated(k) <= 90)",
    remediationGuidance: "Create new access keys, update applications, then deactivate old keys",
    automatable: true,
    cisReference: "CIS AWS 1.14",
    nistReference: "IA-5(1)",
  },
  {
    id: "sec-secrets-kms-rotation",
    name: "KMS Keys Auto-Rotation Enabled",
    domain: "secrets_management",
    severity: "medium",
    provider: "aws",
    description: "Customer-managed KMS keys must have automatic rotation enabled",
    checkLogic: "kmsKeys.every(k => k.KeyRotationEnabled === true)",
    remediationGuidance: "Enable automatic key rotation for each customer-managed KMS key",
    automatable: true,
    cisReference: "CIS AWS 3.8",
    nistReference: "SC-12",
  },

  // ── Azure Controls ──
  {
    id: "sec-azure-nsg-ssh",
    name: "No NSG Rules Allow SSH from Internet",
    domain: "network",
    severity: "critical",
    provider: "azure",
    description: "No Network Security Group should allow inbound SSH from the internet",
    checkLogic: "nsgs.none(nsg => nsg.securityRules.some(r => r.destinationPortRange === '22' && r.sourceAddressPrefix === '*'))",
    remediationGuidance: "Restrict SSH NSG rules to specific source IP ranges or use Azure Bastion",
    automatable: true,
    cisReference: "CIS Azure 6.1",
    nistReference: "AC-4",
  },
  {
    id: "sec-azure-storage-encryption",
    name: "Azure Storage Account Encryption",
    domain: "data_protection",
    severity: "high",
    provider: "azure",
    description: "All Azure Storage accounts must use customer-managed keys for encryption",
    checkLogic: "storageAccounts.every(sa => sa.encryption.keySource === 'Microsoft.Keyvault')",
    remediationGuidance: "Configure storage account encryption with Azure Key Vault managed keys",
    automatable: true,
    cisReference: "CIS Azure 3.2",
    nistReference: "SC-28",
  },
  {
    id: "sec-azure-ad-mfa",
    name: "Azure AD MFA for All Users",
    domain: "identity_access",
    severity: "critical",
    provider: "azure",
    description: "All Azure AD users must have MFA enabled via Conditional Access",
    checkLogic: "conditionalAccessPolicies.some(p => p.conditions.users.includeUsers === 'All' && p.grantControls.builtInControls.includes('mfa'))",
    remediationGuidance: "Create Conditional Access policy requiring MFA for all users",
    automatable: false,
    cisReference: "CIS Azure 1.1",
    nistReference: "IA-2(1)",
  },

  // ── GCP Controls ──
  {
    id: "sec-gcp-firewall-ssh",
    name: "No Firewall Rules Allow SSH from 0.0.0.0/0",
    domain: "network",
    severity: "critical",
    provider: "gcp",
    description: "No VPC firewall rule should allow inbound SSH from any source",
    checkLogic: "firewallRules.none(r => r.allowed.some(a => a.ports?.includes('22')) && r.sourceRanges?.includes('0.0.0.0/0'))",
    remediationGuidance: "Restrict firewall rules to specific source ranges or use IAP tunneling",
    automatable: true,
    cisReference: "CIS GCP 3.6",
    nistReference: "AC-4",
  },
  {
    id: "sec-gcp-audit-logging",
    name: "GCP Audit Logging Enabled",
    domain: "logging_monitoring",
    severity: "high",
    provider: "gcp",
    description: "Audit logging must be enabled for all services in all projects",
    checkLogic: "projects.every(p => p.auditConfigs.some(ac => ac.service === 'allServices'))",
    remediationGuidance: "Enable audit logging for all services in the project IAM policy",
    automatable: true,
    cisReference: "CIS GCP 2.1",
    nistReference: "AU-2",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — MITRE ATT&CK Integration
// ═══════════════════════════════════════════════════════════════════════════════

export type MitreTactic =
  | "Reconnaissance"
  | "Resource Development"
  | "Initial Access"
  | "Execution"
  | "Persistence"
  | "Privilege Escalation"
  | "Defense Evasion"
  | "Credential Access"
  | "Discovery"
  | "Lateral Movement"
  | "Collection"
  | "Exfiltration"
  | "Command and Control"
  | "Impact";

export interface MitreTechniqueMapping {
  techniqueId: string;
  name: string;
  tactic: MitreTactic;
  cloudRelevance: "high" | "medium" | "low";
  detectionSources: string[];
  preventionControls: string[];
  provider: "aws" | "azure" | "gcp" | "all";
  description: string;
}

export const MITRE_CLOUD_TECHNIQUES: MitreTechniqueMapping[] = [
  {
    techniqueId: "T1078",
    name: "Valid Accounts",
    tactic: "Initial Access",
    cloudRelevance: "high",
    detectionSources: ["cloudtrail", "azure_activity_log", "gcp_audit_log"],
    preventionControls: ["sec-iam-root-mfa", "sec-azure-ad-mfa", "sec-iam-password-policy"],
    provider: "all",
    description: "Adversaries use valid cloud credentials to gain access",
  },
  {
    techniqueId: "T1078.004",
    name: "Valid Accounts: Cloud Accounts",
    tactic: "Privilege Escalation",
    cloudRelevance: "high",
    detectionSources: ["cloudtrail", "guardduty"],
    preventionControls: ["sec-iam-root-mfa", "sec-iam-no-root-access-keys"],
    provider: "aws",
    description: "Use of cloud account credentials, including root accounts",
  },
  {
    techniqueId: "T1530",
    name: "Data from Cloud Storage",
    tactic: "Collection",
    cloudRelevance: "high",
    detectionSources: ["cloudtrail", "azure_activity_log", "gcp_audit_log"],
    preventionControls: ["sec-data-s3-no-public", "sec-data-s3-encryption"],
    provider: "all",
    description: "Adversaries access data from improperly secured cloud storage",
  },
  {
    techniqueId: "T1098",
    name: "Account Manipulation",
    tactic: "Persistence",
    cloudRelevance: "high",
    detectionSources: ["cloudtrail", "azure_activity_log"],
    preventionControls: ["sec-iam-no-inline-policies"],
    provider: "all",
    description: "Adversaries modify accounts to maintain or escalate access",
  },
  {
    techniqueId: "T1562.007",
    name: "Impair Defenses: Disable or Modify Cloud Firewall",
    tactic: "Defense Evasion",
    cloudRelevance: "high",
    detectionSources: ["cloudtrail", "config_change"],
    preventionControls: ["sec-net-no-public-sg-ssh", "sec-net-no-public-sg-rdp"],
    provider: "aws",
    description: "Adversaries modify security groups or firewalls to allow malicious traffic",
  },
  {
    techniqueId: "T1485",
    name: "Data Destruction",
    tactic: "Impact",
    cloudRelevance: "high",
    detectionSources: ["cloudtrail", "azure_activity_log", "gcp_audit_log"],
    preventionControls: ["sec-data-s3-encryption", "sec-secrets-kms-rotation"],
    provider: "all",
    description: "Adversaries destroy data and backups to cause damage",
  },
  {
    techniqueId: "T1580",
    name: "Cloud Infrastructure Discovery",
    tactic: "Discovery",
    cloudRelevance: "high",
    detectionSources: ["cloudtrail", "guardduty", "gcp_audit_log"],
    preventionControls: ["sec-iam-unused-credentials"],
    provider: "all",
    description: "Adversaries enumerate cloud resources and configurations",
  },
  {
    techniqueId: "T1537",
    name: "Transfer Data to Cloud Account",
    tactic: "Exfiltration",
    cloudRelevance: "high",
    detectionSources: ["cloudtrail", "azure_activity_log"],
    preventionControls: ["sec-data-s3-no-public", "sec-net-vpc-flow-logs"],
    provider: "all",
    description: "Adversaries exfiltrate data by transferring to an account they control",
  },
  {
    techniqueId: "T1535",
    name: "Unused/Unsupported Cloud Regions",
    tactic: "Defense Evasion",
    cloudRelevance: "medium",
    detectionSources: ["cloudtrail"],
    preventionControls: ["sec-log-cloudtrail-enabled"],
    provider: "aws",
    description: "Adversaries create resources in unused regions to avoid detection",
  },
  {
    techniqueId: "T1190",
    name: "Exploit Public-Facing Application",
    tactic: "Initial Access",
    cloudRelevance: "high",
    detectionSources: ["cloudwatch_alarm", "azure_monitor_alert", "gcp_monitoring_alert"],
    preventionControls: ["sec-net-no-public-sg-ssh", "sec-azure-nsg-ssh", "sec-gcp-firewall-ssh"],
    provider: "all",
    description: "Adversaries exploit vulnerabilities in internet-facing applications",
  },
  {
    techniqueId: "T1552.005",
    name: "Unsecured Credentials: Cloud Instance Metadata API",
    tactic: "Credential Access",
    cloudRelevance: "high",
    detectionSources: ["cloudtrail", "guardduty"],
    preventionControls: ["sec-compute-imdsv2"],
    provider: "aws",
    description: "Adversaries access instance metadata to obtain temporary credentials (SSRF attacks)",
  },
  {
    techniqueId: "T1526",
    name: "Cloud Service Discovery",
    tactic: "Discovery",
    cloudRelevance: "medium",
    detectionSources: ["cloudtrail", "azure_activity_log", "gcp_audit_log"],
    preventionControls: ["sec-iam-no-inline-policies", "sec-iam-unused-credentials"],
    provider: "all",
    description: "Adversaries enumerate available cloud services and features",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Vulnerability Management
// ═══════════════════════════════════════════════════════════════════════════════

export type VulnerabilitySource =
  | "inspector"
  | "security_hub"
  | "guardduty"
  | "ecr_scan"
  | "azure_defender"
  | "gcp_scc"
  | "third_party_scanner"
  | "cve_feed";

export type VulnerabilityStatus = "detected" | "confirmed" | "in_remediation" | "patched" | "mitigated" | "accepted" | "false_positive";

export interface VulnerabilityRecord {
  id: string;
  cveId?: string;
  source: VulnerabilitySource;
  provider: "aws" | "azure" | "gcp";
  accountId: string;
  resourceArn: string;
  resourceType: string;
  severity: SecurityFindingSeverity;
  cvssScore?: number;
  status: VulnerabilityStatus;
  detectedAt: string;
  lastSeenAt: string;
  title: string;
  description: string;
  affectedPackage?: string;
  fixedInVersion?: string;
  exploitAvailable: boolean;
  exploitMaturity: "unproven" | "proof_of_concept" | "functional" | "high" | "not_defined";
  remediationAction: string;
  slaDeadline?: string;
}

export interface VulnerabilityPolicy {
  id: string;
  name: string;
  description: string;
  severitySLAs: Record<SecurityFindingSeverity, number>;
  autoRemediateBelow: SecurityFindingSeverity;
  scanFrequencyHours: number;
  excludePatterns: string[];
  notifyOnNew: SecurityFindingSeverity;
}

export const DEFAULT_VULNERABILITY_POLICY: VulnerabilityPolicy = {
  id: "default-vuln-policy",
  name: "Default Vulnerability Policy",
  description: "Standard vulnerability management SLAs and automation rules",
  severitySLAs: {
    critical: 24,
    high: 72,
    medium: 336,
    low: 720,
    informational: -1,
  },
  autoRemediateBelow: "low",
  scanFrequencyHours: 24,
  excludePatterns: [],
  notifyOnNew: "high",
};

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — IAM Analysis & Least Privilege
// ═══════════════════════════════════════════════════════════════════════════════

export type IAMRiskLevel = "critical" | "high" | "medium" | "low";

export interface IAMAnalysisRule {
  id: string;
  name: string;
  description: string;
  provider: "aws" | "azure" | "gcp" | "all";
  riskLevel: IAMRiskLevel;
  pattern: string;
  remediationGuidance: string;
  automatable: boolean;
}

export const IAM_ANALYSIS_RULES: IAMAnalysisRule[] = [
  {
    id: "iam-wildcard-admin",
    name: "Wildcard Admin Access",
    description: "Policy grants Action:* on Resource:* — full admin access",
    provider: "aws",
    riskLevel: "critical",
    pattern: "Effect:Allow AND Action:* AND Resource:*",
    remediationGuidance: "Replace with specific actions and resources following least privilege",
    automatable: false,
  },
  {
    id: "iam-unused-role",
    name: "Unused IAM Role (90+ days)",
    description: "IAM role has not been assumed in over 90 days",
    provider: "aws",
    riskLevel: "medium",
    pattern: "role.lastUsed > 90 days OR role.lastUsed === null",
    remediationGuidance: "Delete unused roles or set permissions boundary to restrict scope",
    automatable: true,
  },
  {
    id: "iam-cross-account-trust",
    name: "Cross-Account Trust Without External ID",
    description: "Role trust policy allows cross-account access without external ID condition",
    provider: "aws",
    riskLevel: "high",
    pattern: "trustPolicy.Principal.AWS !== ownAccountId AND !condition.sts:ExternalId",
    remediationGuidance: "Add sts:ExternalId condition to cross-account trust policies (prevents confused deputy)",
    automatable: false,
  },
  {
    id: "iam-service-wildcard",
    name: "Service Wildcard Permissions",
    description: "Policy grants servicename:* — full access to an entire service",
    provider: "aws",
    riskLevel: "high",
    pattern: "Action contains service:* pattern",
    remediationGuidance: "Scope down to specific actions needed (e.g., s3:GetObject instead of s3:*)",
    automatable: false,
  },
  {
    id: "iam-privilege-escalation-path",
    name: "Privilege Escalation Path",
    description: "User/role can escalate own privileges via iam:PutRolePolicy, iam:CreatePolicyVersion, etc.",
    provider: "aws",
    riskLevel: "critical",
    pattern: "any of: iam:PutRolePolicy, iam:CreatePolicyVersion, iam:AttachRolePolicy, iam:SetDefaultPolicyVersion",
    remediationGuidance: "Remove IAM mutation permissions or add SCP guardrails to prevent self-escalation",
    automatable: false,
  },
  {
    id: "iam-mfa-not-required",
    name: "Sensitive Actions Without MFA Condition",
    description: "Policies for sensitive operations don't require MFA",
    provider: "aws",
    riskLevel: "high",
    pattern: "sensitiveActions AND !condition:aws:MultiFactorAuthPresent",
    remediationGuidance: "Add aws:MultiFactorAuthPresent condition for sensitive actions",
    automatable: true,
  },
  {
    id: "iam-azure-custom-owner",
    name: "Azure Custom Role with Owner Equivalent",
    description: "Custom Azure role grants * actions on * scope — owner equivalent",
    provider: "azure",
    riskLevel: "critical",
    pattern: "permissions[0].actions contains '*' AND assignableScopes contains '/'",
    remediationGuidance: "Scope custom roles to specific actions and resource types",
    automatable: false,
  },
  {
    id: "iam-gcp-primitive-roles",
    name: "GCP Primitive Roles in Use",
    description: "Project uses primitive roles (Owner, Editor, Viewer) instead of predefined roles",
    provider: "gcp",
    riskLevel: "high",
    pattern: "bindings.role IN ['roles/owner', 'roles/editor', 'roles/viewer']",
    remediationGuidance: "Replace primitive roles with predefined or custom roles following least privilege",
    automatable: false,
  },
  {
    id: "iam-service-account-key",
    name: "GCP Service Account with User-Managed Keys",
    description: "Service account has user-managed keys which pose credential leak risk",
    provider: "gcp",
    riskLevel: "high",
    pattern: "serviceAccount.keys.filter(k => k.keyType === 'USER_MANAGED').length > 0",
    remediationGuidance: "Use workload identity federation or GCP-managed keys instead of user-managed keys",
    automatable: false,
  },
  {
    id: "iam-lateral-movement",
    name: "Lateral Movement Risk via Shared Credentials",
    description: "Same credentials used across multiple environments (dev/staging/prod)",
    provider: "all",
    riskLevel: "high",
    pattern: "credential.usedInEnvironments.length > 1 AND credential.usedInEnvironments.includes('production')",
    remediationGuidance: "Use separate credentials per environment with strict environment-level SCPs",
    automatable: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Attack Surface Mapping
// ═══════════════════════════════════════════════════════════════════════════════

export type AttackSurfaceCategory =
  | "public_endpoints"
  | "storage_exposure"
  | "identity_surface"
  | "network_surface"
  | "api_surface"
  | "data_surface";

export interface AttackSurfaceComponent {
  category: AttackSurfaceCategory;
  resourceArn: string;
  resourceType: string;
  provider: "aws" | "azure" | "gcp";
  exposureLevel: "internet" | "vpc" | "account" | "private";
  riskScore: number;
  factors: AttackSurfaceFactor[];
}

export interface AttackSurfaceFactor {
  name: string;
  severity: SecurityFindingSeverity;
  weight: number;
  description: string;
}

export interface AttackSurfaceSnapshot {
  accountId: string;
  provider: "aws" | "azure" | "gcp";
  assessedAt: string;
  totalExposedResources: number;
  internetFacing: number;
  overallRiskScore: number;
  byCategory: Record<AttackSurfaceCategory, CategorySurfaceMetrics>;
  topRisks: AttackSurfaceComponent[];
  trendVsPrevious: "reduced" | "stable" | "increased";
}

export interface CategorySurfaceMetrics {
  resourceCount: number;
  riskScore: number;
  criticalFindings: number;
  internetExposed: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Security Recommendations
// ═══════════════════════════════════════════════════════════════════════════════

export type SecurityRecommendationPriority = "immediate" | "short_term" | "medium_term" | "long_term";

export interface SecurityRecommendation {
  id: string;
  title: string;
  domain: SecurityDomain;
  priority: SecurityRecommendationPriority;
  severity: SecurityFindingSeverity;
  provider: "aws" | "azure" | "gcp" | "all";
  description: string;
  impact: string;
  effort: "low" | "medium" | "high";
  automatable: boolean;
  relatedControls: string[];
  mitreTechniques: string[];
  estimatedRiskReduction: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Security Intelligence Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type SecurityPipelineStageId =
  | "collect"
  | "normalize"
  | "analyze_controls"
  | "assess_vulnerabilities"
  | "analyze_iam"
  | "map_attack_surface"
  | "compute_posture"
  | "generate_recommendations"
  | "risk_rank"
  | "emit_findings"
  | "update_dashboard";

export interface SecurityPipelineStage {
  id: SecurityPipelineStageId;
  name: string;
  order: number;
  timeoutMs: number;
  parallelizable: boolean;
  metricsKey: string;
  description: string;
}

export const SECURITY_PIPELINE: SecurityPipelineStage[] = [
  { id: "collect", name: "Collect", order: 1, timeoutMs: 30_000, parallelizable: false, metricsKey: "security_pipeline.collect", description: "Gather security data from provider APIs and event stream" },
  { id: "normalize", name: "Normalize", order: 2, timeoutMs: 5_000, parallelizable: false, metricsKey: "security_pipeline.normalize", description: "Normalize findings into unified security format" },
  { id: "analyze_controls", name: "Analyze Controls", order: 3, timeoutMs: 30_000, parallelizable: true, metricsKey: "security_pipeline.controls", description: "Evaluate security controls against current state" },
  { id: "assess_vulnerabilities", name: "Assess Vulnerabilities", order: 4, timeoutMs: 30_000, parallelizable: true, metricsKey: "security_pipeline.vulns", description: "Process vulnerability scan results and CVE data" },
  { id: "analyze_iam", name: "Analyze IAM", order: 5, timeoutMs: 60_000, parallelizable: true, metricsKey: "security_pipeline.iam", description: "Deep IAM analysis for least privilege and escalation paths" },
  { id: "map_attack_surface", name: "Map Attack Surface", order: 6, timeoutMs: 30_000, parallelizable: true, metricsKey: "security_pipeline.surface", description: "Enumerate and score internet-facing and exposed resources" },
  { id: "compute_posture", name: "Compute Posture", order: 7, timeoutMs: 10_000, parallelizable: false, metricsKey: "security_pipeline.posture", description: "Aggregate all findings into security posture score" },
  { id: "generate_recommendations", name: "Generate Recommendations", order: 8, timeoutMs: 10_000, parallelizable: false, metricsKey: "security_pipeline.recommendations", description: "Produce prioritized security recommendations" },
  { id: "risk_rank", name: "Risk Rank", order: 9, timeoutMs: 5_000, parallelizable: false, metricsKey: "security_pipeline.rank", description: "Rank all findings by risk-adjusted priority" },
  { id: "emit_findings", name: "Emit Findings", order: 10, timeoutMs: 5_000, parallelizable: false, metricsKey: "security_pipeline.emit", description: "Publish findings to signal detection and notification engine" },
  { id: "update_dashboard", name: "Update Dashboard", order: 11, timeoutMs: 5_000, parallelizable: false, metricsKey: "security_pipeline.dashboard", description: "Push posture metrics and findings to dashboard API" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type SecurityIntegrationTarget =
  | "cloud_event_stream"
  | "signal_detection"
  | "incident_response"
  | "compliance_engine"
  | "notification_engine"
  | "cognitive_loop"
  | "terraform_generation"
  | "execution_safety"
  | "audit_trail"
  | "dashboard_api";

export interface SecurityIntegrationContract {
  target: SecurityIntegrationTarget;
  direction: "inbound" | "outbound" | "bidirectional";
  protocol: "function_call" | "event_bus" | "webhook";
  dataShape: string;
  slaMs: number;
  description: string;
}

export const SECURITY_INTEGRATION_CONTRACTS: SecurityIntegrationContract[] = [
  { target: "cloud_event_stream", direction: "inbound", protocol: "event_bus", dataShape: "CloudEvent(security) → SecurityEventInput", slaMs: 100, description: "Receives security-classified events from the event stream for real-time analysis" },
  { target: "signal_detection", direction: "outbound", protocol: "function_call", dataShape: "SecurityFinding → Signal", slaMs: 200, description: "Security findings are emitted as signals for the cognitive loop" },
  { target: "incident_response", direction: "outbound", protocol: "event_bus", dataShape: "CriticalSecurityFinding → IncidentTrigger", slaMs: 50, description: "Critical security findings auto-create incidents" },
  { target: "compliance_engine", direction: "bidirectional", protocol: "function_call", dataShape: "SecurityControl ↔ ComplianceControl", slaMs: 500, description: "Security controls map to compliance frameworks; compliance gaps inform security posture" },
  { target: "notification_engine", direction: "outbound", protocol: "event_bus", dataShape: "SecurityAlert → NotificationTrigger", slaMs: 200, description: "Security alerts trigger notifications to security teams" },
  { target: "cognitive_loop", direction: "outbound", protocol: "function_call", dataShape: "SecurityPosture → CognitiveContext", slaMs: 1_000, description: "Security posture informs the cognitive loop's risk assessment" },
  { target: "terraform_generation", direction: "outbound", protocol: "function_call", dataShape: "SecurityRemediation → TerraformPlan", slaMs: 5_000, description: "Automatable security remediations generate terraform plans" },
  { target: "execution_safety", direction: "bidirectional", protocol: "function_call", dataShape: "RemediationPlan ↔ SafetyValidation", slaMs: 2_000, description: "Security remediations are validated by execution safety before apply" },
  { target: "audit_trail", direction: "outbound", protocol: "function_call", dataShape: "SecurityEvent → AuditEntry", slaMs: 100, description: "All security findings and posture changes are audited" },
  { target: "dashboard_api", direction: "outbound", protocol: "event_bus", dataShape: "SecurityPosture → DashboardMetrics", slaMs: 5_000, description: "Security posture scores and findings are published to dashboard" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §10 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getSecurityControl(id: string): SecurityControl | undefined {
  return SECURITY_CONTROLS.find(c => c.id === id);
}

export function getControlsByDomain(domain: SecurityDomain): SecurityControl[] {
  return SECURITY_CONTROLS.filter(c => c.domain === domain);
}

export function getControlsByProvider(provider: "aws" | "azure" | "gcp" | "all"): SecurityControl[] {
  return SECURITY_CONTROLS.filter(c => c.provider === provider || c.provider === "all");
}

export function getCriticalSecurityControls(): SecurityControl[] {
  return SECURITY_CONTROLS.filter(c => c.severity === "critical");
}

export function getAutomatableSecurityControls(): SecurityControl[] {
  return SECURITY_CONTROLS.filter(c => c.automatable);
}

export function getMitreTechnique(techniqueId: string): MitreTechniqueMapping | undefined {
  return MITRE_CLOUD_TECHNIQUES.find(t => t.techniqueId === techniqueId);
}

export function getMitreTechniquesByTactic(tactic: MitreTactic): MitreTechniqueMapping[] {
  return MITRE_CLOUD_TECHNIQUES.filter(t => t.tactic === tactic);
}

export function getHighRelevanceTechniques(): MitreTechniqueMapping[] {
  return MITRE_CLOUD_TECHNIQUES.filter(t => t.cloudRelevance === "high");
}

export function getIAMRule(id: string): IAMAnalysisRule | undefined {
  return IAM_ANALYSIS_RULES.find(r => r.id === id);
}

export function getCriticalIAMRules(): IAMAnalysisRule[] {
  return IAM_ANALYSIS_RULES.filter(r => r.riskLevel === "critical");
}

export function getIAMRulesByProvider(provider: "aws" | "azure" | "gcp" | "all"): IAMAnalysisRule[] {
  return IAM_ANALYSIS_RULES.filter(r => r.provider === provider || r.provider === "all");
}

export function getSecurityPipelineStage(id: SecurityPipelineStageId): SecurityPipelineStage | undefined {
  return SECURITY_PIPELINE.find(s => s.id === id);
}

export function getSecurityPipelineOrder(): SecurityPipelineStageId[] {
  return [...SECURITY_PIPELINE].sort((a, b) => a.order - b.order).map(s => s.id);
}

export function getParallelizableSecurityStages(): SecurityPipelineStage[] {
  return SECURITY_PIPELINE.filter(s => s.parallelizable);
}

export function getSecurityIntegration(target: SecurityIntegrationTarget): SecurityIntegrationContract | undefined {
  return SECURITY_INTEGRATION_CONTRACTS.find(c => c.target === target);
}

export function computePostureRating(score: number): SecurityPostureRating {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

export function computeVulnerabilitySLADeadline(
  severity: SecurityFindingSeverity,
  detectedAt: string,
  policy: VulnerabilityPolicy = DEFAULT_VULNERABILITY_POLICY,
): string | null {
  const slaHours = policy.severitySLAs[severity];
  if (slaHours < 0) return null;
  const deadline = new Date(detectedAt);
  deadline.setHours(deadline.getHours() + slaHours);
  return deadline.toISOString();
}

// ═══════════════════════════════════════════════════════════════════════════════
// §11 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface SecurityIntelligenceTestResult {
  name: string;
  passed: boolean;
  detail: string;
}

export function runSecurityIntelligenceTests(): SecurityIntelligenceTestResult[] {
  const results: SecurityIntelligenceTestResult[] = [];
  const assert = (name: string, condition: boolean, detail: string) =>
    results.push({ name, passed: condition, detail });

  // §1 — Security Controls
  assert("Security controls exist", SECURITY_CONTROLS.length >= 24, `Found ${SECURITY_CONTROLS.length} controls`);
  assert("AWS controls", getControlsByProvider("aws").length >= 18, "AWS has most controls");
  assert("Azure controls", getControlsByProvider("azure").length >= 3, "Azure controls present");
  assert("GCP controls", getControlsByProvider("gcp").length >= 2, "GCP controls present");
  assert("Critical controls exist", getCriticalSecurityControls().length >= 6, "Multiple critical controls");
  assert("Automatable controls", getAutomatableSecurityControls().length >= 12, "Most controls automatable");
  assert("All controls have remediation", SECURITY_CONTROLS.every(c => c.remediationGuidance.length > 0), "Remediation guidance");
  assert("Identity domain covered", getControlsByDomain("identity_access").length >= 5, "IAM controls");
  assert("Network domain covered", getControlsByDomain("network").length >= 4, "Network controls");
  assert("Data domain covered", getControlsByDomain("data_protection").length >= 4, "Data controls");

  // §2 — MITRE ATT&CK
  assert("MITRE techniques exist", MITRE_CLOUD_TECHNIQUES.length >= 12, `Found ${MITRE_CLOUD_TECHNIQUES.length} techniques`);
  assert("High relevance techniques", getHighRelevanceTechniques().length >= 9, "High cloud relevance");
  assert("T1078 mapped", getMitreTechnique("T1078") !== undefined, "Valid Accounts technique");
  assert("T1530 mapped", getMitreTechnique("T1530") !== undefined, "Data from Cloud Storage");
  assert("Techniques have detection sources", MITRE_CLOUD_TECHNIQUES.every(t => t.detectionSources.length > 0), "Detection sources defined");
  assert("Techniques have prevention controls", MITRE_CLOUD_TECHNIQUES.every(t => t.preventionControls.length > 0), "Prevention controls linked");

  // §3 — IAM Analysis
  assert("IAM rules exist", IAM_ANALYSIS_RULES.length >= 10, `Found ${IAM_ANALYSIS_RULES.length} rules`);
  assert("Critical IAM rules", getCriticalIAMRules().length >= 2, "Critical IAM findings");
  assert("AWS IAM rules", getIAMRulesByProvider("aws").length >= 6, "AWS IAM coverage");
  assert("Cross-provider IAM", getIAMRulesByProvider("all").length >= 1, "Multi-cloud IAM rules");
  assert("Privilege escalation detected", getIAMRule("iam-privilege-escalation-path") !== undefined, "Priv-esc rule exists");

  // §4 — Vulnerability Policy
  assert("Default policy has SLAs", DEFAULT_VULNERABILITY_POLICY.severitySLAs.critical === 24, "Critical = 24h SLA");
  assert("High SLA is 72h", DEFAULT_VULNERABILITY_POLICY.severitySLAs.high === 72, "High = 72h SLA");
  assert("SLA deadline computation", computeVulnerabilitySLADeadline("critical", "2026-01-01T00:00:00Z") !== null, "Deadline computed");

  // §5 — Pipeline
  assert("Pipeline has 11 stages", SECURITY_PIPELINE.length === 11, `Found ${SECURITY_PIPELINE.length} stages`);
  assert("Pipeline starts with collect", getSecurityPipelineOrder()[0] === "collect", "Collect first");
  assert("Parallelizable stages exist", getParallelizableSecurityStages().length >= 4, "Parallel stages");

  // §6 — Integration Contracts
  assert("Integration contracts exist", SECURITY_INTEGRATION_CONTRACTS.length === 10, `Found ${SECURITY_INTEGRATION_CONTRACTS.length}`);
  assert("Event stream inbound", getSecurityIntegration("cloud_event_stream")?.direction === "inbound", "Receives from event stream");
  assert("Incident response outbound", getSecurityIntegration("incident_response")?.direction === "outbound", "Feeds incidents");

  // §7 — Posture Rating
  assert("Excellent = 90+", computePostureRating(95) === "excellent", "95 → excellent");
  assert("Good = 75-89", computePostureRating(80) === "good", "80 → good");
  assert("Critical = <40", computePostureRating(30) === "critical", "30 → critical");

  return results;
}
