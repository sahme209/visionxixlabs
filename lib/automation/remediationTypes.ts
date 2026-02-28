/**
 * Cloud Automation: Remediation types and registry.
 * Each playbook type maps to Observe/Plan/Act logic.
 */

export type RemediationType =
  | "cost_idle_resources"
  | "drift_config"
  | "cicd_gap"
  | "security_hardening"
  | "compliance_drift";

export interface RemediationPlaybook {
  id: RemediationType;
  name: string;
  description: string;
  /** Requires GitHub connector for PR-based fixes */
  requiresGithub: boolean;
  /** Requires cloud connector (AWS/Azure/GCP) for API-based fixes */
  requiresCloud?: boolean;
}

export const REMEDIATION_PLAYBOOKS: RemediationPlaybook[] = [
  {
    id: "cost_idle_resources",
    name: "Cost: Idle Resources",
    description: "Identify and remediate idle EC2/VM instances, orphaned volumes, unattached IPs. Generates IaC/script or cloud API calls.",
    requiresGithub: true,
    requiresCloud: false,
  },
  {
    id: "drift_config",
    name: "Drift: Config Reconciliation",
    description: "Detect config drift between IaC and live infra. Generate PRs to align state.",
    requiresGithub: true,
    requiresCloud: true,
  },
  {
    id: "cicd_gap",
    name: "CI/CD: Gap Fix",
    description: "Scan repos for missing tests, security scans, deployment gates. Generate workflow PRs.",
    requiresGithub: true,
    requiresCloud: false,
  },
  {
    id: "security_hardening",
    name: "Security: Posture Hardening",
    description: "IAM least-privilege, NSG rules, encryption. Generate policy PRs.",
    requiresGithub: true,
    requiresCloud: true,
  },
  {
    id: "compliance_drift",
    name: "Compliance: Drift Remediation",
    description: "Policy targets (encryption, MFA, tags). Auto-remediate within approval gates.",
    requiresGithub: true,
    requiresCloud: true,
  },
];

export function getPlaybook(type: RemediationType): RemediationPlaybook | undefined {
  return REMEDIATION_PLAYBOOKS.find((p) => p.id === type);
}
