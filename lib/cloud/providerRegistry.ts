/**
 * Provider capability registry — typed truth about what each cloud provider
 * supports today. Single source of truth for status pills, capability matrices,
 * onboarding eligibility, and roadmap UI.
 *
 * No fake claims here. Every capability flag must reflect the actual
 * implementation state in lib/connectors and lib/plugins.
 */

import type { CloudProvider } from "@/lib/connectors/interface";

/** Capability lifecycle states. */
export type CapabilityStatus =
  | "live"          // Production-ready: implemented, tested, used by real customers
  | "preview"       // Working but not production-grade — opt-in early access
  | "building"      // Active development — visible in UI but not usable
  | "planned"       // Committed roadmap item — has an ETA
  | "research";     // Exploration — no commitment yet

export interface CapabilityRecord {
  key: CapabilityKey;
  label: string;
  status: CapabilityStatus;
  /** When status === "planned", the target quarter/year (e.g., "Q2 2026"). */
  eta?: string;
  /** One-line description used in capability matrices and onboarding screens. */
  description: string;
  /** Docs anchor that explains this capability in depth. */
  docsHref?: string;
}

/** The full set of operational capabilities Axiom can offer per provider. */
export type CapabilityKey =
  | "onboarding"          // Connection flow (IAM role / SP / SA)
  | "scan"                // Infrastructure enumeration
  | "snapshot"            // Typed snapshot persistence
  | "topology"            // Resource graph + relationships
  | "signals"             // Deterministic finding signals
  | "reasoning"           // 12-step cognitive loop
  | "execution_plan"      // Phased plan with Terraform
  | "terraform_export"    // Downloadable IaC
  | "cli_export"          // Downloadable CLI commands
  | "execution_apply"     // Cloud execution by Axiom
  | "approval_gate"       // Multi-tier approval enforcement
  | "rollback"            // Pre-verified rollback paths
  | "audit"               // Immutable audit fabric
  | "monitoring"          // Continuous workflows
  | "drift"               // Out-of-band change detection
  | "cost_signals"        // Cost optimization signals
  | "security_signals"    // Security posture signals
  | "compliance"          // SOC 2 / ISO 27001 mapping
  | "memory"              // 90-day operational memory
  | "scheduled_scans";    // Recurring workflows

export interface ProviderRegistryEntry {
  provider: CloudProvider;
  displayName: string;
  shortName: string;
  /** Overall provider readiness as a percentage (0–100). Derived from capability mix. */
  readiness: number;
  /** Headline status used by status pills across the platform. */
  status: "operational" | "expanding" | "planned";
  /** Honest, single-sentence status copy for marketing/onboarding surfaces. */
  statusCopy: string;
  /** ETA for full feature parity with the lead provider (AWS). */
  fullParityEta?: string;
  /** Authentication model — used by onboarding wizards. */
  authModel: {
    primary: string;
    secondary?: string;
    docsHref: string;
  };
  /** All 20 capabilities for this provider with their current status. */
  capabilities: CapabilityRecord[];
}

const AWS_CAPABILITIES: CapabilityRecord[] = [
  { key: "onboarding", label: "IAM role onboarding", status: "live", description: "Read-only role with External ID; one-click CloudFormation or manual.", docsHref: "/docs/aws-setup" },
  { key: "scan", label: "Infrastructure scan", status: "live", description: "Enumeration across EC2, S3, RDS, IAM, VPC, CloudWatch, Cost Explorer.", docsHref: "/docs/scanning" },
  { key: "snapshot", label: "Typed snapshot persistence", status: "live", description: "Normalized resource graph stored per scan with diff support.", docsHref: "/docs/architecture" },
  { key: "topology", label: "Topology mapping", status: "live", description: "Provider → region → VPC/subnet → resource graph rendered live.", docsHref: "/docs/architecture" },
  { key: "signals", label: "Signal engine", status: "live", description: "Deterministic findings across cost, security, drift, performance.", docsHref: "/docs/scanning" },
  { key: "reasoning", label: "12-step reasoning loop", status: "live", description: "Observe → interpret → reason → plan → verify → execute with audit trace.", docsHref: "/docs/execution-plans" },
  { key: "execution_plan", label: "Execution plans", status: "live", description: "Phased plans with dependency-aware sequencing and risk classification.", docsHref: "/docs/execution-plans" },
  { key: "terraform_export", label: "Terraform export", status: "live", description: "Downloadable per-phase Terraform with rollback directory and README.", docsHref: "/docs/terraform-export" },
  { key: "cli_export", label: "CLI export", status: "live", description: "AWS CLI command sequences for one-shot or pipeline use.", docsHref: "/docs/terraform-export" },
  { key: "execution_apply", label: "Cloud execution", status: "live", description: "Approval-gated apply via separate execution role; per action class.", docsHref: "/docs/execution-plans" },
  { key: "approval_gate", label: "Approval workflow", status: "live", description: "Multi-tier approval; Trust Ladder for measured autonomy escalation.", docsHref: "/docs/approval-workflow" },
  { key: "rollback", label: "Rollback orchestration", status: "live", description: "Pre-verified rollback with measured RTO; auto-fires on health failure.", docsHref: "/docs/rollback" },
  { key: "audit", label: "Audit fabric", status: "live", description: "Immutable trail of every action; SOC 2 / ISO 27001 control mapping.", docsHref: "/docs/audit-logs" },
  { key: "monitoring", label: "Continuous monitoring", status: "live", description: "Recurring scans, drift checks, cost anomaly watch, compliance sweeps.", docsHref: "/docs/scanning" },
  { key: "drift", label: "Drift detection", status: "live", description: "Out-of-band changes triaged within configurable window (default 12h).", docsHref: "/docs/scanning" },
  { key: "cost_signals", label: "Cost signals", status: "live", description: "Rightsizing, idle resources, oversized EC2/RDS, reserved-instance gaps.", docsHref: "/docs/scanning" },
  { key: "security_signals", label: "Security signals", status: "live", description: "Public exposure, IAM over-permissioning, encryption gaps, drift in SGs.", docsHref: "/docs/scanning" },
  { key: "compliance", label: "Compliance mapping", status: "live", description: "SOC 2 + ISO 27001 control mapping; HIPAA on Enterprise tier.", docsHref: "/docs/security-model" },
  { key: "memory", label: "Operational memory", status: "live", description: "90-day history; per-service confidence calibration.", docsHref: "/docs/architecture" },
  { key: "scheduled_scans", label: "Scheduled workflows", status: "live", description: "Hourly / daily / weekly recurring scans with operational dashboards.", docsHref: "/docs/scanning" },
];

const AZURE_CAPABILITIES: CapabilityRecord[] = [
  { key: "onboarding", label: "Service Principal onboarding", status: "live", description: "Federated identity preferred; client secret fallback supported.", docsHref: "/docs/azure-setup" },
  { key: "scan", label: "Infrastructure scan", status: "live", description: "VM, Storage, Network, IAM, subscription-scoped enumeration.", docsHref: "/docs/scanning" },
  { key: "snapshot", label: "Typed snapshot persistence", status: "live", description: "Same normalized snapshot model as AWS.", docsHref: "/docs/architecture" },
  { key: "topology", label: "Topology mapping", status: "live", description: "Azure resources visible in the cross-cloud topology graph.", docsHref: "/docs/architecture" },
  { key: "signals", label: "Signal engine", status: "building", eta: "Q2 2026", description: "Cost waste, security exposure, drift signals adapted for Azure.", docsHref: "/docs/azure-setup" },
  { key: "reasoning", label: "12-step reasoning loop", status: "planned", eta: "Q2 2026", description: "Cognitive loop adapted to Azure resource model.", docsHref: "/docs/azure-setup" },
  { key: "execution_plan", label: "Execution plans", status: "planned", eta: "Q2 2026", description: "Phased Bicep / Terraform plans for Azure.", docsHref: "/docs/azure-setup" },
  { key: "terraform_export", label: "Terraform export", status: "planned", eta: "Q2 2026", description: "Downloadable Terraform for Azure resources.", docsHref: "/docs/azure-setup" },
  { key: "cli_export", label: "CLI export", status: "planned", eta: "Q2 2026", description: "Azure CLI command export for plans.", docsHref: "/docs/azure-setup" },
  { key: "execution_apply", label: "Cloud execution", status: "planned", eta: "Q2 2026", description: "Approval-gated apply via separate execution role.", docsHref: "/docs/azure-setup" },
  { key: "approval_gate", label: "Approval workflow", status: "live", description: "Shared approval gate model with AWS executions.", docsHref: "/docs/approval-workflow" },
  { key: "rollback", label: "Rollback orchestration", status: "planned", eta: "Q2 2026", description: "Pre-verified rollback for Azure changes.", docsHref: "/docs/rollback" },
  { key: "audit", label: "Audit fabric", status: "live", description: "Same audit fabric as AWS — Azure events flow into AxiomAuditEvent.", docsHref: "/docs/audit-logs" },
  { key: "monitoring", label: "Continuous monitoring", status: "preview", description: "Recurring Azure scans + drift detection live; full workflow set Q2 2026.", docsHref: "/docs/scanning" },
  { key: "drift", label: "Drift detection", status: "preview", description: "Basic drift detection live; advanced triage Q2 2026.", docsHref: "/docs/scanning" },
  { key: "cost_signals", label: "Cost signals", status: "building", eta: "Q2 2026", description: "Cost Management read role wired; signal engine in development.", docsHref: "/docs/azure-setup" },
  { key: "security_signals", label: "Security signals", status: "building", eta: "Q2 2026", description: "NSG audit + IAM over-permissioning signals in development.", docsHref: "/docs/azure-setup" },
  { key: "compliance", label: "Compliance mapping", status: "planned", eta: "Q3 2026", description: "SOC 2 / ISO 27001 control mapping for Azure resources.", docsHref: "/docs/security-model" },
  { key: "memory", label: "Operational memory", status: "live", description: "Azure events feed the same operational memory as AWS.", docsHref: "/docs/architecture" },
  { key: "scheduled_scans", label: "Scheduled workflows", status: "preview", description: "Daily scan cadence available; richer workflow library Q2 2026.", docsHref: "/docs/scanning" },
];

const GCP_CAPABILITIES: CapabilityRecord[] = [
  { key: "onboarding", label: "Service Account onboarding", status: "live", description: "Workload identity federation preferred; JSON key fallback (30d rotation).", docsHref: "/docs/gcp-setup" },
  { key: "scan", label: "Infrastructure scan", status: "live", description: "Compute Engine, Cloud Storage, Networking, IAM scanning at project/folder scope.", docsHref: "/docs/scanning" },
  { key: "snapshot", label: "Typed snapshot persistence", status: "live", description: "Same normalized snapshot model as AWS.", docsHref: "/docs/architecture" },
  { key: "topology", label: "Topology mapping", status: "live", description: "GCP resources visible in cross-cloud topology graph.", docsHref: "/docs/architecture" },
  { key: "signals", label: "Signal engine", status: "building", eta: "Q3 2026", description: "Cost waste, security exposure, drift signals adapted for GCP.", docsHref: "/docs/gcp-setup" },
  { key: "reasoning", label: "12-step reasoning loop", status: "planned", eta: "Q3 2026", description: "Cognitive loop adapted to GCP resource model.", docsHref: "/docs/gcp-setup" },
  { key: "execution_plan", label: "Execution plans", status: "planned", eta: "Q3 2026", description: "Phased Terraform plans for GCP.", docsHref: "/docs/gcp-setup" },
  { key: "terraform_export", label: "Terraform export", status: "planned", eta: "Q3 2026", description: "Downloadable Terraform for GCP resources.", docsHref: "/docs/gcp-setup" },
  { key: "cli_export", label: "CLI export", status: "planned", eta: "Q3 2026", description: "gcloud CLI command export for plans.", docsHref: "/docs/gcp-setup" },
  { key: "execution_apply", label: "Cloud execution", status: "planned", eta: "Q3 2026", description: "Approval-gated apply via separate execution role.", docsHref: "/docs/gcp-setup" },
  { key: "approval_gate", label: "Approval workflow", status: "live", description: "Shared approval gate with AWS/Azure executions.", docsHref: "/docs/approval-workflow" },
  { key: "rollback", label: "Rollback orchestration", status: "planned", eta: "Q3 2026", description: "Pre-verified rollback for GCP changes.", docsHref: "/docs/rollback" },
  { key: "audit", label: "Audit fabric", status: "live", description: "GCP events flow into the same AxiomAuditEvent fabric.", docsHref: "/docs/audit-logs" },
  { key: "monitoring", label: "Continuous monitoring", status: "preview", description: "Recurring GCP scans + drift detection live; richer monitoring Q3 2026.", docsHref: "/docs/scanning" },
  { key: "drift", label: "Drift detection", status: "preview", description: "Basic drift detection live; advanced triage Q3 2026.", docsHref: "/docs/scanning" },
  { key: "cost_signals", label: "Cost signals", status: "building", eta: "Q3 2026", description: "Cloud Billing read role wired; signal engine in development.", docsHref: "/docs/gcp-setup" },
  { key: "security_signals", label: "Security signals", status: "building", eta: "Q3 2026", description: "Firewall + IAM over-permissioning signals in development.", docsHref: "/docs/gcp-setup" },
  { key: "compliance", label: "Compliance mapping", status: "planned", eta: "Q4 2026", description: "SOC 2 / ISO 27001 control mapping for GCP resources.", docsHref: "/docs/security-model" },
  { key: "memory", label: "Operational memory", status: "live", description: "GCP events feed the same operational memory.", docsHref: "/docs/architecture" },
  { key: "scheduled_scans", label: "Scheduled workflows", status: "preview", description: "Daily scan cadence available; richer workflow library Q3 2026.", docsHref: "/docs/scanning" },
];

export const PROVIDER_REGISTRY: Record<CloudProvider, ProviderRegistryEntry> = {
  aws: {
    provider: "aws",
    displayName: "Amazon Web Services",
    shortName: "AWS",
    readiness: 100,
    status: "operational",
    statusCopy: "Full operations — scan, reasoning, execution, approval, rollback, monitoring.",
    authModel: { primary: "IAM Role + External ID", docsHref: "/docs/aws-setup" },
    capabilities: AWS_CAPABILITIES,
  },
  azure: {
    provider: "azure",
    displayName: "Microsoft Azure",
    shortName: "Azure",
    readiness: 55,
    status: "expanding",
    statusCopy: "Scan + topology live. Reasoning + execution rolling out Q2 2026.",
    fullParityEta: "Q2 2026",
    authModel: { primary: "Service Principal", secondary: "Federated identity", docsHref: "/docs/azure-setup" },
    capabilities: AZURE_CAPABILITIES,
  },
  gcp: {
    provider: "gcp",
    displayName: "Google Cloud Platform",
    shortName: "GCP",
    readiness: 50,
    status: "expanding",
    statusCopy: "Scan + topology live. Reasoning + execution rolling out Q3 2026.",
    fullParityEta: "Q3 2026",
    authModel: { primary: "Service Account", secondary: "Workload identity federation", docsHref: "/docs/gcp-setup" },
    capabilities: GCP_CAPABILITIES,
  },
};

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Return the registry entry for a provider. */
export function getProvider(provider: CloudProvider): ProviderRegistryEntry {
  return PROVIDER_REGISTRY[provider];
}

/** Return a specific capability for a provider, or undefined. */
export function getCapability(provider: CloudProvider, key: CapabilityKey): CapabilityRecord | undefined {
  return PROVIDER_REGISTRY[provider].capabilities.find((c) => c.key === key);
}

/** Check whether a provider supports a capability at "live" status. */
export function isCapabilityLive(provider: CloudProvider, key: CapabilityKey): boolean {
  return getCapability(provider, key)?.status === "live";
}

/** Return all providers, sorted by readiness descending. */
export function listProviders(): ProviderRegistryEntry[] {
  return Object.values(PROVIDER_REGISTRY).sort((a, b) => b.readiness - a.readiness);
}

/** Count capabilities by status for a given provider. */
export function capabilitySummary(provider: CloudProvider): Record<CapabilityStatus, number> {
  const out: Record<CapabilityStatus, number> = { live: 0, preview: 0, building: 0, planned: 0, research: 0 };
  for (const cap of PROVIDER_REGISTRY[provider].capabilities) out[cap.status]++;
  return out;
}
