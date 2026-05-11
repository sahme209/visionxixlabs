// ─────────────────────────────────────────────────────────────────────────────
// Compliance Engine
// Continuous compliance assessment against SOC2, HIPAA, PCI-DSS, CIS, NIST,
// GDPR with automated control mapping, evidence collection, and drift alerting
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// §1 — Compliance Architecture
// ═══════════════════════════════════════════════════════════════════════════════

export type ComplianceFrameworkId = "soc2" | "hipaa" | "pci_dss" | "cis" | "nist_800_53" | "gdpr" | "iso_27001" | "fedramp";

export type ComplianceStatus = "compliant" | "non_compliant" | "partially_compliant" | "not_assessed" | "not_applicable" | "remediation_in_progress";

export type ControlSeverity = "critical" | "high" | "medium" | "low" | "informational";

export interface ComplianceFramework {
  id: ComplianceFrameworkId;
  name: string;
  version: string;
  description: string;
  issuer: string;
  controlFamilies: ControlFamily[];
  totalControls: number;
  applicableProviders: ("aws" | "azure" | "gcp")[];
  certificationRequired: boolean;
  auditFrequency: "annual" | "semi_annual" | "quarterly" | "continuous";
}

export interface ControlFamily {
  id: string;
  name: string;
  description: string;
  controlCount: number;
  frameworkId: ComplianceFrameworkId;
}

export const COMPLIANCE_FRAMEWORKS: ComplianceFramework[] = [
  {
    id: "soc2",
    name: "SOC 2 Type II",
    version: "2017",
    description: "Service Organization Control 2 — Trust Services Criteria",
    issuer: "AICPA",
    controlFamilies: [
      { id: "soc2-cc1", name: "Control Environment", description: "Organization and management oversight", controlCount: 5, frameworkId: "soc2" },
      { id: "soc2-cc2", name: "Communication and Information", description: "Internal and external communication", controlCount: 3, frameworkId: "soc2" },
      { id: "soc2-cc3", name: "Risk Assessment", description: "Risk identification and analysis", controlCount: 4, frameworkId: "soc2" },
      { id: "soc2-cc5", name: "Control Activities", description: "Policies and procedures", controlCount: 3, frameworkId: "soc2" },
      { id: "soc2-cc6", name: "Logical and Physical Access", description: "Access controls and authentication", controlCount: 8, frameworkId: "soc2" },
      { id: "soc2-cc7", name: "System Operations", description: "System monitoring and incident response", controlCount: 5, frameworkId: "soc2" },
      { id: "soc2-cc8", name: "Change Management", description: "Change control processes", controlCount: 1, frameworkId: "soc2" },
      { id: "soc2-cc9", name: "Risk Mitigation", description: "Risk mitigation activities", controlCount: 2, frameworkId: "soc2" },
    ],
    totalControls: 31,
    applicableProviders: ["aws", "azure", "gcp"],
    certificationRequired: true,
    auditFrequency: "annual",
  },
  {
    id: "hipaa",
    name: "HIPAA Security Rule",
    version: "2013",
    description: "Health Insurance Portability and Accountability Act — Security Standards",
    issuer: "HHS",
    controlFamilies: [
      { id: "hipaa-admin", name: "Administrative Safeguards", description: "Security management and workforce controls", controlCount: 12, frameworkId: "hipaa" },
      { id: "hipaa-physical", name: "Physical Safeguards", description: "Facility and workstation security", controlCount: 4, frameworkId: "hipaa" },
      { id: "hipaa-technical", name: "Technical Safeguards", description: "Access control, audit, integrity, transmission", controlCount: 9, frameworkId: "hipaa" },
    ],
    totalControls: 25,
    applicableProviders: ["aws", "azure", "gcp"],
    certificationRequired: false,
    auditFrequency: "annual",
  },
  {
    id: "pci_dss",
    name: "PCI DSS",
    version: "4.0",
    description: "Payment Card Industry Data Security Standard",
    issuer: "PCI SSC",
    controlFamilies: [
      { id: "pci-req1", name: "Network Security Controls", description: "Install and maintain network security controls", controlCount: 8, frameworkId: "pci_dss" },
      { id: "pci-req2", name: "Secure Configuration", description: "Apply secure configurations to system components", controlCount: 6, frameworkId: "pci_dss" },
      { id: "pci-req3", name: "Account Data Protection", description: "Protect stored account data", controlCount: 7, frameworkId: "pci_dss" },
      { id: "pci-req4", name: "Transmission Encryption", description: "Protect cardholder data with strong cryptography", controlCount: 3, frameworkId: "pci_dss" },
      { id: "pci-req5", name: "Malware Protection", description: "Protect systems from malicious software", controlCount: 4, frameworkId: "pci_dss" },
      { id: "pci-req6", name: "Secure Development", description: "Develop and maintain secure systems and software", controlCount: 5, frameworkId: "pci_dss" },
      { id: "pci-req7", name: "Access Restriction", description: "Restrict access to system components by business need", controlCount: 3, frameworkId: "pci_dss" },
      { id: "pci-req8", name: "User Identification", description: "Identify users and authenticate access", controlCount: 6, frameworkId: "pci_dss" },
      { id: "pci-req9", name: "Physical Access", description: "Restrict physical access to cardholder data", controlCount: 5, frameworkId: "pci_dss" },
      { id: "pci-req10", name: "Logging and Monitoring", description: "Log and monitor all access to components and data", controlCount: 7, frameworkId: "pci_dss" },
      { id: "pci-req11", name: "Security Testing", description: "Test security of systems and networks regularly", controlCount: 6, frameworkId: "pci_dss" },
      { id: "pci-req12", name: "Security Policy", description: "Support information security with organizational policies", controlCount: 10, frameworkId: "pci_dss" },
    ],
    totalControls: 70,
    applicableProviders: ["aws", "azure", "gcp"],
    certificationRequired: true,
    auditFrequency: "annual",
  },
  {
    id: "cis",
    name: "CIS Benchmarks",
    version: "3.0",
    description: "Center for Internet Security — Cloud Infrastructure Benchmarks",
    issuer: "CIS",
    controlFamilies: [
      { id: "cis-iam", name: "Identity and Access Management", description: "IAM configuration best practices", controlCount: 22, frameworkId: "cis" },
      { id: "cis-storage", name: "Storage", description: "Secure storage configuration", controlCount: 14, frameworkId: "cis" },
      { id: "cis-logging", name: "Logging", description: "Audit logging and monitoring", controlCount: 15, frameworkId: "cis" },
      { id: "cis-networking", name: "Networking", description: "Network security configuration", controlCount: 12, frameworkId: "cis" },
      { id: "cis-compute", name: "Compute", description: "Compute instance security", controlCount: 8, frameworkId: "cis" },
      { id: "cis-database", name: "Database", description: "Database security configuration", controlCount: 10, frameworkId: "cis" },
    ],
    totalControls: 81,
    applicableProviders: ["aws", "azure", "gcp"],
    certificationRequired: false,
    auditFrequency: "continuous",
  },
  {
    id: "nist_800_53",
    name: "NIST 800-53",
    version: "Rev 5",
    description: "Security and Privacy Controls for Information Systems and Organizations",
    issuer: "NIST",
    controlFamilies: [
      { id: "nist-ac", name: "Access Control", description: "Access control policies and mechanisms", controlCount: 25, frameworkId: "nist_800_53" },
      { id: "nist-au", name: "Audit and Accountability", description: "Audit logging and accountability", controlCount: 16, frameworkId: "nist_800_53" },
      { id: "nist-cm", name: "Configuration Management", description: "Configuration control and monitoring", controlCount: 14, frameworkId: "nist_800_53" },
      { id: "nist-cp", name: "Contingency Planning", description: "Backup, recovery, and continuity", controlCount: 13, frameworkId: "nist_800_53" },
      { id: "nist-ia", name: "Identification and Authentication", description: "Identity verification and authentication", controlCount: 12, frameworkId: "nist_800_53" },
      { id: "nist-ir", name: "Incident Response", description: "Incident handling and reporting", controlCount: 10, frameworkId: "nist_800_53" },
      { id: "nist-sc", name: "System and Communications Protection", description: "Boundary protection and cryptography", controlCount: 44, frameworkId: "nist_800_53" },
      { id: "nist-si", name: "System and Information Integrity", description: "Flaw remediation and monitoring", controlCount: 20, frameworkId: "nist_800_53" },
    ],
    totalControls: 154,
    applicableProviders: ["aws", "azure", "gcp"],
    certificationRequired: false,
    auditFrequency: "annual",
  },
  {
    id: "gdpr",
    name: "GDPR",
    version: "2016/679",
    description: "General Data Protection Regulation — Technical Measures",
    issuer: "EU",
    controlFamilies: [
      { id: "gdpr-art25", name: "Data Protection by Design", description: "Privacy by design and default", controlCount: 5, frameworkId: "gdpr" },
      { id: "gdpr-art30", name: "Records of Processing", description: "Processing activity records", controlCount: 3, frameworkId: "gdpr" },
      { id: "gdpr-art32", name: "Security of Processing", description: "Technical and organizational measures", controlCount: 8, frameworkId: "gdpr" },
      { id: "gdpr-art33", name: "Breach Notification", description: "Breach detection and notification", controlCount: 4, frameworkId: "gdpr" },
      { id: "gdpr-art35", name: "Impact Assessment", description: "Data protection impact assessments", controlCount: 3, frameworkId: "gdpr" },
    ],
    totalControls: 23,
    applicableProviders: ["aws", "azure", "gcp"],
    certificationRequired: false,
    auditFrequency: "continuous",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §2 — Control Definitions
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComplianceControl {
  id: string;
  frameworkId: ComplianceFrameworkId;
  familyId: string;
  title: string;
  description: string;
  severity: ControlSeverity;
  automatable: boolean;
  continuousMonitoring: boolean;
  applicableProviders: ("aws" | "azure" | "gcp")[];
  applicableResourceTypes: string[];
  checkLogic: string;
  remediationGuidance: string;
  evidenceTypes: EvidenceType[];
  crossMappings: CrossFrameworkMapping[];
}

export type EvidenceType = "config_snapshot" | "api_response" | "log_entry" | "metric_value" | "policy_document" | "scan_result" | "manual_attestation";

export interface CrossFrameworkMapping {
  targetFramework: ComplianceFrameworkId;
  targetControlId: string;
  mappingStrength: "exact" | "partial" | "related";
}

export const COMPLIANCE_CONTROLS: ComplianceControl[] = [
  // CIS / SOC2 / NIST — Encryption at Rest
  {
    id: "cis-storage-1.1",
    frameworkId: "cis",
    familyId: "cis-storage",
    title: "Ensure S3 buckets have server-side encryption enabled",
    description: "All S3 buckets must have SSE-S3 or SSE-KMS encryption enabled",
    severity: "high",
    automatable: true,
    continuousMonitoring: true,
    applicableProviders: ["aws"],
    applicableResourceTypes: ["aws_s3_bucket"],
    checkLogic: "s3_bucket.server_side_encryption_configuration exists AND sse_algorithm in [AES256, aws:kms]",
    remediationGuidance: "Enable SSE-KMS encryption with organization KMS key",
    evidenceTypes: ["config_snapshot", "api_response"],
    crossMappings: [
      { targetFramework: "soc2", targetControlId: "CC6.1", mappingStrength: "exact" },
      { targetFramework: "hipaa", targetControlId: "164.312(a)(2)(iv)", mappingStrength: "exact" },
      { targetFramework: "pci_dss", targetControlId: "3.4", mappingStrength: "partial" },
      { targetFramework: "nist_800_53", targetControlId: "SC-28", mappingStrength: "exact" },
      { targetFramework: "gdpr", targetControlId: "Art32.1a", mappingStrength: "partial" },
    ],
  },
  // CIS — IAM Root Account MFA
  {
    id: "cis-iam-1.5",
    frameworkId: "cis",
    familyId: "cis-iam",
    title: "Ensure MFA is enabled for root account",
    description: "The root account must have MFA enabled",
    severity: "critical",
    automatable: true,
    continuousMonitoring: true,
    applicableProviders: ["aws"],
    applicableResourceTypes: [],
    checkLogic: "iam.get_account_summary().AccountMFAEnabled == 1",
    remediationGuidance: "Enable hardware MFA on root account via IAM console",
    evidenceTypes: ["api_response"],
    crossMappings: [
      { targetFramework: "soc2", targetControlId: "CC6.1", mappingStrength: "exact" },
      { targetFramework: "nist_800_53", targetControlId: "IA-2(1)", mappingStrength: "exact" },
      { targetFramework: "pci_dss", targetControlId: "8.3.1", mappingStrength: "exact" },
    ],
  },
  // CIS — CloudTrail Enabled
  {
    id: "cis-logging-3.1",
    frameworkId: "cis",
    familyId: "cis-logging",
    title: "Ensure CloudTrail is enabled in all regions",
    description: "CloudTrail must be enabled and configured for all regions",
    severity: "critical",
    automatable: true,
    continuousMonitoring: true,
    applicableProviders: ["aws"],
    applicableResourceTypes: ["aws_cloudtrail"],
    checkLogic: "cloudtrail.is_multi_region_trail == true AND is_logging == true",
    remediationGuidance: "Create multi-region CloudTrail with S3 delivery and log validation",
    evidenceTypes: ["config_snapshot", "api_response"],
    crossMappings: [
      { targetFramework: "soc2", targetControlId: "CC7.2", mappingStrength: "exact" },
      { targetFramework: "hipaa", targetControlId: "164.312(b)", mappingStrength: "exact" },
      { targetFramework: "pci_dss", targetControlId: "10.2", mappingStrength: "exact" },
      { targetFramework: "nist_800_53", targetControlId: "AU-2", mappingStrength: "exact" },
    ],
  },
  // CIS — No Public S3 Buckets
  {
    id: "cis-storage-2.1",
    frameworkId: "cis",
    familyId: "cis-storage",
    title: "Ensure S3 bucket policy does not grant public access",
    description: "S3 bucket policies and ACLs must not allow public access",
    severity: "critical",
    automatable: true,
    continuousMonitoring: true,
    applicableProviders: ["aws"],
    applicableResourceTypes: ["aws_s3_bucket", "aws_s3_bucket_public_access_block"],
    checkLogic: "s3_public_access_block.block_public_acls == true AND block_public_policy == true AND restrict_public_buckets == true",
    remediationGuidance: "Enable S3 Block Public Access at account and bucket level",
    evidenceTypes: ["config_snapshot", "api_response"],
    crossMappings: [
      { targetFramework: "soc2", targetControlId: "CC6.1", mappingStrength: "exact" },
      { targetFramework: "pci_dss", targetControlId: "1.3", mappingStrength: "partial" },
      { targetFramework: "nist_800_53", targetControlId: "AC-3", mappingStrength: "partial" },
    ],
  },
  // CIS — No Default VPC Usage
  {
    id: "cis-networking-4.1",
    frameworkId: "cis",
    familyId: "cis-networking",
    title: "Ensure no security groups allow ingress from 0.0.0.0/0 to port 22",
    description: "SSH access must not be open to the world",
    severity: "high",
    automatable: true,
    continuousMonitoring: true,
    applicableProviders: ["aws"],
    applicableResourceTypes: ["aws_security_group"],
    checkLogic: "security_group.ingress_rules NOT contains (cidr=0.0.0.0/0 AND port=22)",
    remediationGuidance: "Restrict SSH access to specific CIDR ranges or use SSM Session Manager",
    evidenceTypes: ["config_snapshot"],
    crossMappings: [
      { targetFramework: "soc2", targetControlId: "CC6.6", mappingStrength: "exact" },
      { targetFramework: "pci_dss", targetControlId: "1.2.1", mappingStrength: "exact" },
      { targetFramework: "nist_800_53", targetControlId: "AC-4", mappingStrength: "partial" },
    ],
  },
  // CIS — RDS Encryption
  {
    id: "cis-database-5.1",
    frameworkId: "cis",
    familyId: "cis-database",
    title: "Ensure RDS instances have encryption at rest enabled",
    description: "All RDS instances must use encrypted storage",
    severity: "high",
    automatable: true,
    continuousMonitoring: true,
    applicableProviders: ["aws"],
    applicableResourceTypes: ["aws_db_instance", "aws_rds_cluster"],
    checkLogic: "db_instance.storage_encrypted == true",
    remediationGuidance: "Create encrypted snapshot, restore from encrypted snapshot, then swap",
    evidenceTypes: ["config_snapshot", "api_response"],
    crossMappings: [
      { targetFramework: "hipaa", targetControlId: "164.312(a)(2)(iv)", mappingStrength: "exact" },
      { targetFramework: "pci_dss", targetControlId: "3.4", mappingStrength: "exact" },
      { targetFramework: "nist_800_53", targetControlId: "SC-28", mappingStrength: "exact" },
    ],
  },
  // CIS — IAM Password Policy
  {
    id: "cis-iam-1.8",
    frameworkId: "cis",
    familyId: "cis-iam",
    title: "Ensure IAM password policy requires minimum length of 14",
    description: "Account password policy must enforce minimum 14-character passwords",
    severity: "medium",
    automatable: true,
    continuousMonitoring: true,
    applicableProviders: ["aws"],
    applicableResourceTypes: [],
    checkLogic: "iam.get_account_password_policy().MinimumPasswordLength >= 14",
    remediationGuidance: "Update IAM account password policy to require 14+ characters",
    evidenceTypes: ["api_response"],
    crossMappings: [
      { targetFramework: "nist_800_53", targetControlId: "IA-5(1)", mappingStrength: "exact" },
      { targetFramework: "pci_dss", targetControlId: "8.2.3", mappingStrength: "exact" },
    ],
  },
  // CIS — EBS Encryption
  {
    id: "cis-compute-6.1",
    frameworkId: "cis",
    familyId: "cis-compute",
    title: "Ensure EBS volume encryption is enabled by default",
    description: "EBS default encryption must be enabled in all regions",
    severity: "high",
    automatable: true,
    continuousMonitoring: true,
    applicableProviders: ["aws"],
    applicableResourceTypes: ["aws_ebs_volume"],
    checkLogic: "ec2.get_ebs_encryption_by_default() == true",
    remediationGuidance: "Enable EBS default encryption via EC2 settings in each region",
    evidenceTypes: ["api_response"],
    crossMappings: [
      { targetFramework: "hipaa", targetControlId: "164.312(a)(2)(iv)", mappingStrength: "exact" },
      { targetFramework: "nist_800_53", targetControlId: "SC-28", mappingStrength: "exact" },
    ],
  },
  // SOC2 — Access Reviews
  {
    id: "soc2-cc6.2",
    frameworkId: "soc2",
    familyId: "soc2-cc6",
    title: "Prior to issuing system credentials, registered and authorized users are identified",
    description: "User access must be provisioned based on authorization and reviewed periodically",
    severity: "high",
    automatable: false,
    continuousMonitoring: false,
    applicableProviders: ["aws", "azure", "gcp"],
    applicableResourceTypes: [],
    checkLogic: "Manual: Verify access review process documentation and recent review records",
    remediationGuidance: "Implement quarterly access reviews with documented approval workflow",
    evidenceTypes: ["manual_attestation", "policy_document"],
    crossMappings: [
      { targetFramework: "nist_800_53", targetControlId: "AC-2", mappingStrength: "exact" },
      { targetFramework: "pci_dss", targetControlId: "7.1", mappingStrength: "exact" },
    ],
  },
  // HIPAA — Transmission Security
  {
    id: "hipaa-tech-4.1",
    frameworkId: "hipaa",
    familyId: "hipaa-technical",
    title: "Implement encryption for ePHI in transit",
    description: "All ePHI data in transit must be encrypted with TLS 1.2+",
    severity: "critical",
    automatable: true,
    continuousMonitoring: true,
    applicableProviders: ["aws", "azure", "gcp"],
    applicableResourceTypes: ["aws_lb_listener", "aws_cloudfront_distribution", "azurerm_application_gateway"],
    checkLogic: "listener.protocol == HTTPS AND ssl_policy.min_tls_version >= TLSv1.2",
    remediationGuidance: "Configure TLS 1.2+ on all load balancers and enforce HTTPS-only",
    evidenceTypes: ["config_snapshot", "scan_result"],
    crossMappings: [
      { targetFramework: "pci_dss", targetControlId: "4.1", mappingStrength: "exact" },
      { targetFramework: "nist_800_53", targetControlId: "SC-8", mappingStrength: "exact" },
      { targetFramework: "gdpr", targetControlId: "Art32.1a", mappingStrength: "partial" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §3 — Assessment Model
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComplianceAssessment {
  id: string;
  orgId: string;
  frameworkId: ComplianceFrameworkId;
  provider: "aws" | "azure" | "gcp" | "all";
  assessedAt: string;
  status: ComplianceStatus;
  score: ComplianceScore;
  controlResults: ControlAssessmentResult[];
  findings: ComplianceFinding[];
  evidenceCollected: EvidenceRecord[];
  nextAssessmentDue: string;
}

export interface ComplianceScore {
  overallPercent: number;
  byFamily: Record<string, FamilyScore>;
  bySeverity: Record<ControlSeverity, SeverityScore>;
  trend: "improving" | "declining" | "stable";
  previousScore: number | null;
  deltaPercent: number | null;
}

export interface FamilyScore {
  familyId: string;
  familyName: string;
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  notAssessedControls: number;
  scorePercent: number;
}

export interface SeverityScore {
  totalControls: number;
  compliantControls: number;
  nonCompliantControls: number;
  compliancePercent: number;
}

export interface ControlAssessmentResult {
  controlId: string;
  status: ComplianceStatus;
  assessedAt: string;
  assessmentMethod: "automated" | "manual" | "hybrid";
  evidence: string[];
  findings: string[];
  remediationStatus: "not_needed" | "planned" | "in_progress" | "completed" | "accepted_risk";
  notes: string;
}

export interface ComplianceFinding {
  id: string;
  controlId: string;
  frameworkId: ComplianceFrameworkId;
  severity: ControlSeverity;
  title: string;
  description: string;
  affectedResources: string[];
  provider: "aws" | "azure" | "gcp";
  region: string;
  detectedAt: string;
  remediationGuidance: string;
  autoRemediable: boolean;
  status: FindingStatus;
  assignedTo: string | null;
  dueDate: string | null;
}

export type FindingStatus = "open" | "in_progress" | "remediated" | "accepted_risk" | "false_positive" | "suppressed";

export interface EvidenceRecord {
  id: string;
  controlId: string;
  type: EvidenceType;
  source: string;
  collectedAt: string;
  data: Record<string, unknown>;
  expiresAt: string;
  verified: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §4 — Continuous Monitoring
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComplianceMonitorConfig {
  orgId: string;
  enabledFrameworks: ComplianceFrameworkId[];
  scanFrequency: Record<ComplianceFrameworkId, ContinuousScanFrequency>;
  autoRemediationEnabled: boolean;
  autoRemediationMaxSeverity: ControlSeverity;
  alertOnDrift: boolean;
  driftNotificationChannels: string[];
  evidenceRetentionDays: number;
}

export type ContinuousScanFrequency = "real_time" | "hourly" | "daily" | "weekly" | "monthly";

export interface ComplianceDriftEvent {
  id: string;
  orgId: string;
  controlId: string;
  frameworkId: ComplianceFrameworkId;
  previousStatus: ComplianceStatus;
  newStatus: ComplianceStatus;
  driftedAt: string;
  affectedResources: string[];
  triggeringChange: string;
  autoRemediated: boolean;
  remediatedAt: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §5 — Audit Readiness
// ═══════════════════════════════════════════════════════════════════════════════

export interface AuditReadinessReport {
  orgId: string;
  frameworkId: ComplianceFrameworkId;
  generatedAt: string;
  overallReadiness: "ready" | "mostly_ready" | "gaps_exist" | "not_ready";
  readinessScore: number;
  gapAnalysis: AuditGap[];
  evidenceCompleteness: EvidenceCompleteness;
  remediationBacklog: RemediationBacklogSummary;
  estimatedTimeToReady: number;
  recommendations: AuditRecommendation[];
}

export interface AuditGap {
  controlId: string;
  controlTitle: string;
  severity: ControlSeverity;
  gapType: "missing_evidence" | "non_compliant" | "not_assessed" | "stale_evidence" | "manual_review_needed";
  estimatedEffort: "low" | "medium" | "high";
  remediationPath: string;
}

export interface EvidenceCompleteness {
  totalRequired: number;
  collected: number;
  verified: number;
  stale: number;
  missing: number;
  completenessPercent: number;
}

export interface RemediationBacklogSummary {
  totalFindings: number;
  openFindings: number;
  inProgressFindings: number;
  criticalOpen: number;
  highOpen: number;
  averageAgeDays: number;
  oldestFindingDays: number;
}

export interface AuditRecommendation {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  description: string;
  estimatedEffort: "low" | "medium" | "high";
  automatable: boolean;
  impactOnReadiness: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// §6 — Compliance Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

export type CompliancePipelineStageId =
  | "framework_selection"
  | "control_mapping"
  | "resource_discovery"
  | "automated_assessment"
  | "evidence_collection"
  | "manual_review_queue"
  | "finding_generation"
  | "remediation_tracking"
  | "score_computation"
  | "report_generation"
  | "drift_monitoring"
  | "audit_preparation";

export interface CompliancePipelineStage {
  id: CompliancePipelineStageId;
  name: string;
  description: string;
  order: number;
  required: boolean;
  timeoutMs: number;
  automatable: boolean;
  dependsOn: CompliancePipelineStageId[];
}

export const COMPLIANCE_PIPELINE: CompliancePipelineStage[] = [
  { id: "framework_selection", name: "Framework Selection", description: "Select applicable compliance frameworks", order: 1, required: true, timeoutMs: 5_000, automatable: true, dependsOn: [] },
  { id: "control_mapping", name: "Control Mapping", description: "Map controls to provider resources and configs", order: 2, required: true, timeoutMs: 15_000, automatable: true, dependsOn: ["framework_selection"] },
  { id: "resource_discovery", name: "Resource Discovery", description: "Discover in-scope resources across providers", order: 3, required: true, timeoutMs: 120_000, automatable: true, dependsOn: ["control_mapping"] },
  { id: "automated_assessment", name: "Automated Assessment", description: "Run automated checks against discovered resources", order: 4, required: true, timeoutMs: 300_000, automatable: true, dependsOn: ["resource_discovery"] },
  { id: "evidence_collection", name: "Evidence Collection", description: "Collect and store compliance evidence", order: 5, required: true, timeoutMs: 120_000, automatable: true, dependsOn: ["automated_assessment"] },
  { id: "manual_review_queue", name: "Manual Review Queue", description: "Queue non-automatable controls for human review", order: 6, required: false, timeoutMs: 0, automatable: false, dependsOn: ["automated_assessment"] },
  { id: "finding_generation", name: "Finding Generation", description: "Generate compliance findings from assessment results", order: 7, required: true, timeoutMs: 30_000, automatable: true, dependsOn: ["evidence_collection"] },
  { id: "remediation_tracking", name: "Remediation Tracking", description: "Track and manage finding remediation", order: 8, required: true, timeoutMs: 15_000, automatable: true, dependsOn: ["finding_generation"] },
  { id: "score_computation", name: "Score Computation", description: "Compute compliance scores across frameworks", order: 9, required: true, timeoutMs: 10_000, automatable: true, dependsOn: ["finding_generation"] },
  { id: "report_generation", name: "Report Generation", description: "Generate compliance reports and dashboards", order: 10, required: true, timeoutMs: 30_000, automatable: true, dependsOn: ["score_computation"] },
  { id: "drift_monitoring", name: "Drift Monitoring", description: "Monitor for compliance drift in real-time", order: 11, required: true, timeoutMs: 0, automatable: true, dependsOn: ["automated_assessment"] },
  { id: "audit_preparation", name: "Audit Preparation", description: "Prepare audit-ready packages with evidence", order: 12, required: false, timeoutMs: 60_000, automatable: true, dependsOn: ["report_generation"] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §7 — Integration Contracts
// ═══════════════════════════════════════════════════════════════════════════════

export type ComplianceIntegrationTarget =
  | "signal_detection"
  | "governance_engine"
  | "terraform_generation"
  | "execution_safety"
  | "memory_system"
  | "observability"
  | "notification_system"
  | "incident_response"
  | "cost_intelligence"
  | "infrastructure_intelligence";

export interface ComplianceIntegrationContract {
  target: ComplianceIntegrationTarget;
  direction: "consumes" | "produces" | "bidirectional";
  description: string;
  dataFlow: string;
}

export const COMPLIANCE_INTEGRATION_CONTRACTS: ComplianceIntegrationContract[] = [
  { target: "signal_detection", direction: "produces", description: "Generates compliance drift signals", dataFlow: "ComplianceDrift → OperationalSignal" },
  { target: "governance_engine", direction: "bidirectional", description: "Enforces compliance policies, receives policy updates", dataFlow: "CompliancePolicy ↔ GovernanceDecision" },
  { target: "terraform_generation", direction: "produces", description: "Validates generated IaC against compliance controls", dataFlow: "ComplianceCheck → ValidationResult" },
  { target: "execution_safety", direction: "produces", description: "Blocks non-compliant changes at execution time", dataFlow: "ComplianceGate → ExecutionDecision" },
  { target: "memory_system", direction: "produces", description: "Records compliance history and remediation outcomes", dataFlow: "ComplianceRecord → OperationalMemory" },
  { target: "observability", direction: "produces", description: "Emits compliance metrics and assessment traces", dataFlow: "ComplianceMetric → ObservabilityPipeline" },
  { target: "notification_system", direction: "produces", description: "Sends compliance alerts and drift notifications", dataFlow: "ComplianceAlert → NotificationChannel" },
  { target: "incident_response", direction: "produces", description: "Escalates critical compliance violations as incidents", dataFlow: "ComplianceViolation → IncidentCreation" },
  { target: "cost_intelligence", direction: "consumes", description: "Uses cost data for compliance resource prioritization", dataFlow: "ResourceCost → PrioritizationInput" },
  { target: "infrastructure_intelligence", direction: "consumes", description: "Uses topology for scope and blast radius assessment", dataFlow: "TopologyData → ScopeAnalysis" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// §8 — Query Functions
// ═══════════════════════════════════════════════════════════════════════════════

export function getComplianceFramework(id: ComplianceFrameworkId): ComplianceFramework | undefined {
  return COMPLIANCE_FRAMEWORKS.find((f) => f.id === id);
}

export function getFrameworksByProvider(provider: "aws" | "azure" | "gcp"): ComplianceFramework[] {
  return COMPLIANCE_FRAMEWORKS.filter((f) => f.applicableProviders.includes(provider));
}

export function getCertificationRequiredFrameworks(): ComplianceFramework[] {
  return COMPLIANCE_FRAMEWORKS.filter((f) => f.certificationRequired);
}

export function getComplianceControl(id: string): ComplianceControl | undefined {
  return COMPLIANCE_CONTROLS.find((c) => c.id === id);
}

export function getControlsByFramework(frameworkId: ComplianceFrameworkId): ComplianceControl[] {
  return COMPLIANCE_CONTROLS.filter((c) => c.frameworkId === frameworkId);
}

export function getControlsByFamily(familyId: string): ComplianceControl[] {
  return COMPLIANCE_CONTROLS.filter((c) => c.familyId === familyId);
}

export function getAutomatableControls(): ComplianceControl[] {
  return COMPLIANCE_CONTROLS.filter((c) => c.automatable);
}

export function getCriticalControls(): ComplianceControl[] {
  return COMPLIANCE_CONTROLS.filter((c) => c.severity === "critical");
}

export function getControlsByProvider(provider: "aws" | "azure" | "gcp"): ComplianceControl[] {
  return COMPLIANCE_CONTROLS.filter((c) => c.applicableProviders.includes(provider));
}

export function getCrossFrameworkMappings(controlId: string): CrossFrameworkMapping[] {
  const control = getComplianceControl(controlId);
  return control?.crossMappings ?? [];
}

export function getCompliancePipelineStage(id: CompliancePipelineStageId): CompliancePipelineStage | undefined {
  return COMPLIANCE_PIPELINE.find((s) => s.id === id);
}

export function getCompliancePipelineOrder(): CompliancePipelineStageId[] {
  return [...COMPLIANCE_PIPELINE].sort((a, b) => a.order - b.order).map((s) => s.id);
}

export function getComplianceIntegration(target: ComplianceIntegrationTarget): ComplianceIntegrationContract | undefined {
  return COMPLIANCE_INTEGRATION_CONTRACTS.find((c) => c.target === target);
}

export function computeComplianceScore(results: ControlAssessmentResult[]): number {
  if (results.length === 0) return 0;
  const compliant = results.filter((r) => r.status === "compliant" || r.status === "not_applicable").length;
  return Math.round((compliant / results.length) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// §9 — Tests
// ═══════════════════════════════════════════════════════════════════════════════

export interface ComplianceEngineTestResult {
  name: string;
  passed: boolean;
  message: string;
}

export function runComplianceEngineTests(): ComplianceEngineTestResult[] {
  const results: ComplianceEngineTestResult[] = [];
  const assert = (name: string, condition: boolean, msg: string) => {
    results.push({ name, passed: condition, message: condition ? "OK" : msg });
  };

  // §1 — Frameworks
  assert("frameworks-6", COMPLIANCE_FRAMEWORKS.length === 6, "Should have 6 compliance frameworks");
  assert("soc2-exists", getComplianceFramework("soc2") !== undefined, "SOC2 should exist");
  assert("hipaa-exists", getComplianceFramework("hipaa") !== undefined, "HIPAA should exist");
  assert("pci-exists", getComplianceFramework("pci_dss") !== undefined, "PCI-DSS should exist");
  assert("cis-exists", getComplianceFramework("cis") !== undefined, "CIS should exist");
  assert("nist-exists", getComplianceFramework("nist_800_53") !== undefined, "NIST 800-53 should exist");
  assert("gdpr-exists", getComplianceFramework("gdpr") !== undefined, "GDPR should exist");
  assert("all-providers-covered", COMPLIANCE_FRAMEWORKS.every((f) => f.applicableProviders.length >= 2), "All frameworks should cover 2+ providers");
  assert("certification-frameworks", getCertificationRequiredFrameworks().length >= 2, "Should have 2+ certification-required frameworks");
  assert("aws-frameworks", getFrameworksByProvider("aws").length === 6, "All frameworks should apply to AWS");

  // §2 — Controls
  assert("controls-10", COMPLIANCE_CONTROLS.length === 10, "Should have 10 compliance controls");
  assert("automatable-controls", getAutomatableControls().length >= 8, "Should have 8+ automatable controls");
  assert("critical-controls", getCriticalControls().length >= 3, "Should have 3+ critical controls");
  assert("control-lookup", getComplianceControl("cis-storage-1.1")?.severity === "high", "S3 encryption should be high severity");
  assert("cross-mappings-exist", getCrossFrameworkMappings("cis-storage-1.1").length >= 4, "S3 encryption should map to 4+ frameworks");
  assert("aws-controls", getControlsByProvider("aws").length >= 8, "AWS should have 8+ controls");
  assert("cis-controls", getControlsByFramework("cis").length >= 6, "CIS should have 6+ controls");
  assert("all-controls-have-check-logic", COMPLIANCE_CONTROLS.every((c) => c.checkLogic.length > 0), "All controls must have check logic");
  assert("all-controls-have-remediation", COMPLIANCE_CONTROLS.every((c) => c.remediationGuidance.length > 0), "All controls must have remediation guidance");

  // §6 — Pipeline
  assert("pipeline-12-stages", COMPLIANCE_PIPELINE.length === 12, "Should have 12 pipeline stages");
  assert("pipeline-ordered", COMPLIANCE_PIPELINE.every((s, i) => i === 0 || s.order >= COMPLIANCE_PIPELINE[i - 1].order), "Pipeline should be ordered");
  assert("framework-selection-first", getCompliancePipelineStage("framework_selection")?.order === 1, "Framework selection should be first");

  // §7 — Integration Contracts
  assert("integration-contracts-10", COMPLIANCE_INTEGRATION_CONTRACTS.length === 10, "Should have 10 integration contracts");
  assert("governance-bidirectional", getComplianceIntegration("governance_engine")?.direction === "bidirectional", "Governance should be bidirectional");
  assert("incident-integration", getComplianceIntegration("incident_response")?.direction === "produces", "Should produce to incident response");

  // §8 — Score Computation
  const mockResults: ControlAssessmentResult[] = [
    { controlId: "c1", status: "compliant", assessedAt: "", assessmentMethod: "automated", evidence: [], findings: [], remediationStatus: "not_needed", notes: "" },
    { controlId: "c2", status: "non_compliant", assessedAt: "", assessmentMethod: "automated", evidence: [], findings: [], remediationStatus: "planned", notes: "" },
    { controlId: "c3", status: "compliant", assessedAt: "", assessmentMethod: "automated", evidence: [], findings: [], remediationStatus: "not_needed", notes: "" },
    { controlId: "c4", status: "not_applicable", assessedAt: "", assessmentMethod: "manual", evidence: [], findings: [], remediationStatus: "not_needed", notes: "" },
  ];
  assert("compliance-score-75", computeComplianceScore(mockResults) === 75, "3/4 compliant should be 75%");
  assert("compliance-score-empty", computeComplianceScore([]) === 0, "Empty results should be 0%");

  return results;
}
