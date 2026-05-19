/**
 * Multi-Cloud Security Findings — typed contract.
 *
 * One canonical shape for security alerts across:
 *   - AWS GuardDuty
 *   - Azure Defender for Cloud (Microsoft Defender)
 *   - GCP Security Command Center
 *
 * The autonomy loop, Risk Queue, and AGI cockpit all consume this
 * shape — no per-cloud branching downstream.
 *
 * safetyContract literal 'multi_cloud_security_read_only'.
 */

export type SecurityCloud = "aws" | "azure" | "gcp";

export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "informational" | "unknown";

export type SecurityState = "active" | "resolved" | "dismissed" | "in_progress" | "unknown";

export type SecuritySourceMode = "live" | "preview" | "blocked" | "disabled" | "unknown";

export interface SecurityFinding {
  id: string;
  cloud: SecurityCloud;
  /** Vendor-native finding type / category. */
  category: string;
  title: string;
  severity: SecuritySeverity;
  state: SecurityState;
  /** Affected resource ARN/ID. */
  resourceId?: string;
  resourceType?: string;
  region?: string;
  /** Vendor-native first-seen timestamp. */
  firstSeenAt?: string;
  lastSeenAt?: string;
  /** Vendor-native external console link. */
  externalUrl?: string;
}

export interface SecurityCloudSection {
  cloud: SecurityCloud;
  mode: SecuritySourceMode;
  /** True when the cloud's security service is enabled at the account level. */
  serviceEnabled: boolean;
  total: number;
  bySeverity: Record<SecuritySeverity, number>;
  findings: SecurityFinding[];
  limitations: string[];
}

export interface MultiCloudSecurityReport {
  generatedAt: string;
  tenantId?: string;
  aws: SecurityCloudSection;
  azure: SecurityCloudSection;
  gcp: SecurityCloudSection;
  /** Cross-cloud totals. */
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    /** Number of clouds with the security service actually enabled. */
    enabledCloudCount: number;
  };
  overallSourceMode: SecuritySourceMode;
  safetyContract: "multi_cloud_security_read_only";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function emptySecurityCloudSection(cloud: SecurityCloud): SecurityCloudSection {
  return {
    cloud,
    mode: "preview",
    serviceEnabled: false,
    total: 0,
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0, informational: 0, unknown: 0 },
    findings: [],
    limitations: [],
  };
}

export function summarizeFindings(findings: SecurityFinding[]): SecurityCloudSection["bySeverity"] {
  const r: SecurityCloudSection["bySeverity"] = { critical: 0, high: 0, medium: 0, low: 0, informational: 0, unknown: 0 };
  for (const f of findings) r[f.severity]++;
  return r;
}
