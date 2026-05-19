/**
 * In-app help knowledge base.
 *
 * Single source of truth for every dashboard surface and connector:
 * one paragraph of plain-English explanation, the env vars or
 * permissions required to make it live, and the safety contract it
 * carries. Powers /dashboard/help and the contextual help bubble on
 * every page.
 *
 * Why a typed table instead of MDX files: every entry is grounded in
 * the validation matrix + the surface's route + the safety contract.
 * Adding a new entry is a deliberate edit, the index lookup is O(n)
 * but n is tiny, and the same source feeds both browse and search.
 *
 * Hard rules:
 *   - Pure data. No network, no SDK. Safe to import anywhere.
 *   - Every entry has an evidenceRef pointing to the canonical
 *     library / route / page file. If you change a feature, update
 *     the entry. If you delete a feature, delete the entry.
 */

export type HelpCategory =
  | "operator"        // Command Center, AGI Cockpit, Autonomy Cockpit
  | "providers"       // AWS / Azure / GCP / GitHub
  | "telemetry"       // CloudWatch / Datadog / Sentry / Dynatrace / NR / Azure Monitor / GCP Monitoring
  | "security"        // GuardDuty, KMS, IAM, RBAC, SCP
  | "cost"            // FinOps, Cost Explorer, Cost Explainer
  | "containers"      // EKS / AKS / GKE / Containers / K8s EOL
  | "autonomy"        // Charter, Runbooks, Queue, Policy previews, SCP simulator, Terraform draft
  | "notifications"   // Outbound lane, dispatch routes, history
  | "audit"           // CloudTrail, Audit log, Trace store
  | "setup";          // Setup wizard, integrations, env vars

export interface HelpEntry {
  id: string;
  title: string;
  category: HelpCategory;
  /** Operator-readable paragraph — what this surface does + why. */
  description: string;
  /** Operator-readable preconditions to make this live. */
  requirements: string[];
  /** Dashboard route to open this surface, when applicable. */
  href?: string;
  /** Safety contract literal carried by the route. */
  safetyContract?: string;
  /** Canonical evidence ref (lib file / route / page). */
  evidenceRef: string;
  /** Free-form keywords for the search scorer. */
  keywords: string[];
}

export const HELP_ENTRIES: HelpEntry[] = [
  // ---------------------------------------------------------------------------
  // Operator
  // ---------------------------------------------------------------------------
  {
    id: "command-center",
    title: "Command Center",
    category: "operator",
    description:
      "The top-of-funnel landing page. Aggregates the most operator-critical signals (active risks, current autonomy cycle, last deploy, recent CloudTrail events) into one dashboard. Read-only.",
    requirements: ["At least one cloud connector wired (AWS/Azure/GCP) so the panels have data."],
    href: "/dashboard/command-center",
    safetyContract: "command_center_read_only",
    evidenceRef: "app/dashboard/command-center/page.tsx",
    keywords: ["home", "landing", "overview", "summary", "operator"],
  },
  {
    id: "agi-cockpit",
    title: "AGI Cockpit",
    category: "operator",
    description:
      "Live view of the autonomy loop's per-stage transcript (detect → reason → simulate → policy_gate → boundary → approve → execute → verify → audit). Shows where the loop currently is and why every candidate action passed or halted.",
    requirements: ["AUTONOMY_SCHEDULER_ENABLED=true if you want it to run unattended."],
    href: "/dashboard/agi",
    safetyContract: "autonomy_gated_no_unsafe_execution",
    evidenceRef: "app/dashboard/agi/page.tsx",
    keywords: ["agi", "loop", "stages", "autonomy", "cockpit"],
  },
  {
    id: "autonomy-cockpit",
    title: "Autonomy Cockpit",
    category: "operator",
    description:
      "Run a one-off autonomy cycle on demand. Pick a charter mode (observer / review / assisted / autonomous), trigger a tick, and read the per-candidate decision tree. Mirrors the cron scheduler but operator-driven.",
    requirements: ["Auth + at least one cloud connector configured."],
    href: "/dashboard/autonomy",
    safetyContract: "autonomy_gated_no_unsafe_execution",
    evidenceRef: "app/dashboard/autonomy/page.tsx",
    keywords: ["cycle", "tick", "on-demand", "manual", "autonomy"],
  },

  // ---------------------------------------------------------------------------
  // Providers
  // ---------------------------------------------------------------------------
  {
    id: "aws-services",
    title: "AWS Services Inventory",
    category: "providers",
    description:
      "One consolidated AWS read across 15 services in parallel (Lambda + RDS + IAM + S3 + EC2 + VPC + SGs + ELB + SNS + SQS + SSM + CW Log Groups + ACM + GuardDuty + Secrets Manager + Backup + WAFv2). Per-section failure isolation.",
    requirements: [
      "AWS_INVENTORY_EXTRACT_ENABLED=true",
      "AWS_CONNECTOR_BROKER_ACCESS_KEY_ID + AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY (or AWS_USE_DIRECT_CREDS for single-account testing).",
      "Read-only permissions for every probed service (see scripts/fix-aws-permissions.mjs).",
    ],
    href: "/dashboard/aws-services",
    safetyContract: "aws_service_inventory_read_only",
    evidenceRef: "lib/cloud/aws/awsServiceInventoryExtractor.ts",
    keywords: ["aws", "ec2", "s3", "rds", "lambda", "iam", "vpc", "inventory"],
  },
  {
    id: "cloud-inventory",
    title: "Cloud Inventory",
    category: "providers",
    description:
      "One pane of glass across AWS + Azure + GCP. Compute / storage / database totals + per-cloud posture chips (public exposure, unencrypted, identity weaknesses). Single typed result.",
    requirements: ["At least one of AWS/Azure/GCP wired."],
    href: "/dashboard/cloud-inventory",
    safetyContract: "aws_service_inventory_read_only",
    evidenceRef: "lib/cloud/unifiedInventoryBuilder.ts",
    keywords: ["unified", "all-clouds", "inventory", "totals", "compute", "storage"],
  },
  {
    id: "network-topology",
    title: "Network Topology",
    category: "providers",
    description:
      "Cross-cloud node-link graph of every VPC / VNet / GCP network, with subnets and peerings. Internet-facing networks are highlighted in rose. Hover a VPC for highlight.",
    requirements: ["AWS/Azure/GCP credentials with network:Describe* / VirtualNetworks read / compute.networks read."],
    href: "/dashboard/network-topology",
    safetyContract: "aws_service_inventory_read_only",
    evidenceRef: "lib/cloud/networkTopologyBuilder.ts",
    keywords: ["vpc", "vnet", "peering", "topology", "subnet", "network"],
  },
  {
    id: "cloudtrail",
    title: "CloudTrail Audit Tail",
    category: "audit",
    description:
      "Live AWS CloudTrail management-plane events with severity classification. Root-user activity, IAM key mutations, deletions, failed ConsoleLogin → critical / high. Lookback selector 15m / 1h / 6h / 24h.",
    requirements: ["AWS broker IAM role with cloudtrail:LookupEvents."],
    href: "/dashboard/cloudtrail",
    safetyContract: "audit_read_only",
    evidenceRef: "lib/cloud/aws/awsCloudTrailExtractor.ts",
    keywords: ["audit", "cloudtrail", "events", "tail", "console", "login"],
  },

  // ---------------------------------------------------------------------------
  // Cost
  // ---------------------------------------------------------------------------
  {
    id: "cost-overview",
    title: "Cost Overview",
    category: "cost",
    description:
      "Cross-cloud cost dashboard merging AWS Cost Explorer + Azure Cost Management + GCP Billing + GitHub + Stripe + Vercel. Stat ribbon (providers reporting / Last 30d / Prev 30d / Δ%) + anomaly panel + per-provider cards.",
    requirements: [
      "AWS Cost Explorer activated in the AWS console (one-time account-level toggle).",
      "Azure: Cost Management Reader on the subscription.",
      "GCP: BigQuery billing export configured.",
    ],
    href: "/dashboard/cost-overview",
    safetyContract: "billing_summary_read_only",
    evidenceRef: "app/dashboard/cost-overview/page.tsx",
    keywords: ["finops", "cost", "spend", "billing", "anomaly", "delta"],
  },
  {
    id: "cost-explainer",
    title: "Cost Anomaly Explainer",
    category: "cost",
    description:
      "Every billing anomaly is correlated against the live CloudTrail tail. Primary suspect when matchScore ≥ 0.7, plausible at ≥ 0.45, no_correlation when nothing scores above the threshold. Confidence is multiplied by the anomaly's own confidence.",
    requirements: [
      "Same as Cost Overview + CloudTrail (cloudtrail:LookupEvents).",
    ],
    href: "/dashboard/cost-explainer",
    safetyContract: "billing_summary_read_only",
    evidenceRef: "lib/billing/costAnomalyExplainer.ts",
    keywords: ["cost", "anomaly", "explain", "attribute", "cloudtrail", "correlation"],
  },

  // ---------------------------------------------------------------------------
  // Security
  // ---------------------------------------------------------------------------
  {
    id: "cloud-security",
    title: "Cloud Security",
    category: "security",
    description:
      "Cross-cloud security findings — AWS GuardDuty + Azure Defender for Cloud + GCP Security Command Center — folded into one typed SecurityFinding[] with severity normalized across providers.",
    requirements: [
      "AWS: GuardDuty enabled in the region + guardduty:ListFindings.",
      "Azure: Microsoft.Security/securityContacts read.",
      "GCP: Security Command Center API enabled + securitycenter.findings.list.",
    ],
    href: "/dashboard/cloud-security",
    safetyContract: "multi_cloud_security_read_only",
    evidenceRef: "lib/cloud/multiCloudSecurityBuilder.ts",
    keywords: ["guardduty", "defender", "scc", "security", "findings", "threats"],
  },

  // ---------------------------------------------------------------------------
  // Containers
  // ---------------------------------------------------------------------------
  {
    id: "containers",
    title: "Container Orchestration",
    category: "containers",
    description:
      "Unified view of every cluster across AWS ECS + EKS, Azure AKS, and GCP GKE. Per-cluster: node count, pod count, workload risk flags (privileged, hostNetwork, allowPrivilegeEscalation), public endpoint count, EOL k8s detection.",
    requirements: [
      "AWS: ecs:ListClusters + eks:ListClusters + describe permissions.",
      "Azure: Microsoft.ContainerService/managedClusters/listClusterUserCredential/action.",
      "GCP: container.clusters.list.",
    ],
    href: "/dashboard/containers",
    safetyContract: "container_orchestration_read_only",
    evidenceRef: "lib/containers/containerOrchestrationBuilder.ts",
    keywords: ["ecs", "eks", "aks", "gke", "kubernetes", "containers", "pods"],
  },
  {
    id: "k8s-eol",
    title: "Kubernetes EOL Upgrade Planner",
    category: "containers",
    description:
      "Filters all clusters to the ones running an EOL control-plane minor. Groups by provider, shows the EOL → target version arrow chip, and surfaces workloads with upgrade-risk flags.",
    requirements: ["Same as Container Orchestration."],
    href: "/dashboard/k8s-eol",
    safetyContract: "container_orchestration_read_only",
    evidenceRef: "app/dashboard/k8s-eol/page.tsx",
    keywords: ["eol", "kubernetes", "upgrade", "version", "deprecated"],
  },

  // ---------------------------------------------------------------------------
  // Autonomy
  // ---------------------------------------------------------------------------
  {
    id: "charter",
    title: "Autonomy Charter",
    category: "autonomy",
    description:
      "Per-tenant override of the autonomy charter. Pick a mode (observer/review/assisted/autonomous). Mode picks the default boundary classes; per-cycle cap clamps how many candidate actions per cron tick. Unsafe classes always halt regardless.",
    requirements: ["Auth — operator role."],
    href: "/dashboard/charter",
    safetyContract: "policy_governance_read_only",
    evidenceRef: "lib/autonomy/tenantCharterStore.ts",
    keywords: ["charter", "mode", "observer", "autonomous", "tenant"],
  },
  {
    id: "runbooks",
    title: "Remediation Runbooks",
    category: "autonomy",
    description:
      "For every high/critical CloudTrail event, Axiom drafts a typed RemediationRunbook with a reversal action and a hardening policy. Nothing executes — operators review and stage to the approval queue.",
    requirements: ["CloudTrail extractor live (cloudtrail:LookupEvents)."],
    href: "/dashboard/runbooks",
    safetyContract: "approval_only_no_execution",
    evidenceRef: "lib/autonomy/remediationRunbookGenerator.ts",
    keywords: ["runbook", "remediation", "reversal", "hardening", "fix"],
  },
  {
    id: "runbook-queue",
    title: "Runbook Approval Queue",
    category: "autonomy",
    description:
      "Every runbook promoted from /dashboard/runbooks lands here. Approve or reject — the decision is durably recorded but Axiom does not apply the change. The IaC pipeline owns execution.",
    requirements: ["DATABASE_URL wired (Prisma Postgres)."],
    href: "/dashboard/runbooks/queue",
    safetyContract: "approval_only_no_execution",
    evidenceRef: "lib/autonomy/runbookQueueStore.ts",
    keywords: ["approval", "queue", "approve", "reject", "decision"],
  },
  {
    id: "policy-previews",
    title: "Policy Previews",
    category: "autonomy",
    description:
      "Every runbook's hardening action becomes ready-to-paste SCP / Azure Policy / GCP Org Policy JSON. Copy, paste into your IaC stack, apply. Per-preview 'tf' button opens a Terraform HCL draft modal.",
    requirements: ["Runbooks (CloudTrail) live."],
    href: "/dashboard/policy-previews",
    safetyContract: "approval_only_no_execution",
    evidenceRef: "lib/autonomy/policyPreviewGenerator.ts",
    keywords: ["scp", "policy", "guardrail", "deny", "terraform", "hcl"],
  },
  {
    id: "scp-simulator",
    title: "SCP / IAM Policy Simulator",
    category: "autonomy",
    description:
      "Pure local evaluator — no AWS SDK call. Paste a candidate SCP and a synthetic request, see whether the policy would Allow / Deny / not apply. Statement-by-statement reasoning. Unknown condition operators are reported (never faked).",
    requirements: ["None — runs entirely server-side without credentials."],
    href: "/dashboard/scp-simulator",
    safetyContract: "approval_only_no_execution",
    evidenceRef: "lib/autonomy/scpSimulator.ts",
    keywords: ["simulator", "simulate", "scp", "policy", "test", "preview"],
  },

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  {
    id: "outbound-notifications",
    title: "Outbound Notifications (Slack/Teams)",
    category: "notifications",
    description:
      "When the autonomy loop halts at needs_human or surfaces a critical signal, this lane proactively pings humans via Slack / Microsoft Teams / signed generic webhook. Deduped per signal id within a 10-minute window. Email transport is pending.",
    requirements: [
      "Set SLACK_WEBHOOK_URL and/or TEAMS_WEBHOOK_URL and/or OUTBOUND_WEBHOOK_URL.",
      "Optional OUTBOUND_WEBHOOK_SECRET enables HMAC-SHA256 signing.",
    ],
    href: "/dashboard/notifications-outbound",
    safetyContract: "notification_read_only",
    evidenceRef: "lib/notifications/outboundNotificationLane.ts",
    keywords: ["slack", "teams", "webhook", "page", "notify", "alert"],
  },

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  {
    id: "setup",
    title: "Setup Wizard",
    category: "setup",
    description:
      "Walks an operator through connecting every provider in order: AWS broker creds → AWS test extract → Azure SP → GCP service account → GitHub PAT → Slack webhook. Each step is honest about what's still preview vs live.",
    requirements: ["Auth."],
    href: "/dashboard/setup",
    safetyContract: "setup_review_only_no_execution",
    evidenceRef: "app/dashboard/setup/page.tsx",
    keywords: ["setup", "wizard", "onboarding", "connect", "configure", "first-run"],
  },
  {
    id: "integration-health",
    title: "Integration Health",
    category: "setup",
    description:
      "Single-screen view of every integration's current connectivity state: live / partial / preview / blocked / disabled. Each entry links to its own surface and lists the missing requirements.",
    requirements: ["Auth."],
    href: "/dashboard/integrations/health",
    safetyContract: "integration_health_read_only",
    evidenceRef: "lib/integrations/integrationHealthChecker.ts",
    keywords: ["integration", "health", "status", "connector", "live", "preview"],
  },
];

/** Lookup by id; returns undefined when unknown. */
export function findHelpEntry(id: string): HelpEntry | undefined {
  return HELP_ENTRIES.find((e) => e.id === id);
}

/** Group all entries by category in declaration order. */
export function helpEntriesByCategory(): Record<HelpCategory, HelpEntry[]> {
  const grouped: Record<HelpCategory, HelpEntry[]> = {
    operator: [],
    providers: [],
    telemetry: [],
    security: [],
    cost: [],
    containers: [],
    autonomy: [],
    notifications: [],
    audit: [],
    setup: [],
  };
  for (const entry of HELP_ENTRIES) {
    grouped[entry.category].push(entry);
  }
  return grouped;
}

export const CATEGORY_LABEL: Record<HelpCategory, string> = {
  operator: "Operator",
  providers: "Providers",
  telemetry: "Telemetry",
  security: "Security",
  cost: "Cost",
  containers: "Containers",
  autonomy: "Autonomy",
  notifications: "Notifications",
  audit: "Audit",
  setup: "Setup",
};
