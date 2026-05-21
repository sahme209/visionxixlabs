/**
 * Sub-tool catalog — single source of truth.
 *
 * Each sub-tool is a department in the AI-powered company OS. Adding
 * a new sub-tool is a one-line append here; the sub-tools center
 * (/dashboard/sub-tools) and the dynamic detail page
 * (/dashboard/sub-tools/[slug]) both render off of this catalog.
 *
 * Catalog is intentionally a typed static config rather than a Prisma
 * model. It describes intent + which existing dashboard surfaces it
 * owns. Runtime state (current tasks, recent runs, open approvals)
 * comes from the live tables (AxiomAgentRun, AxiomApprovalRequest,
 * AxiomAuditEvent) — wiring those into this catalog is a planned
 * follow-up.
 */

export type SubToolCategory = "technical_ops" | "business_ops" | "ai_ops";

export type SubToolMaturity = "active" | "partial" | "planned";

/**
 * Hard product-layer separation.
 *
 *   "client"          — shown to client tenants inside /dashboard/*.
 *                       This is the SaaS product clients pay for.
 *   "internal_admin"  — shown ONLY to VisionXIXLabs operators inside
 *                       /admin/*. Never leaks into a client workspace.
 *
 * Adding a sub-tool means deciding which layer it belongs in. The
 * sub-tools center filters by layer; marketing-ops + sales-ops
 * (running OUR LinkedIn / OUR sales pipeline) live in internal_admin,
 * while cloud-ops / devops / security / observability (running the
 * CLIENT's surfaces) live in client.
 */
export type ProductLayer = "client" | "internal_admin";

export interface SubToolDefinition {
  /** URL slug under /dashboard/sub-tools/[slug] (client) or /admin/sub-tools/[slug] (internal). */
  slug: string;
  /** Display name. */
  name: string;
  category: SubToolCategory;
  maturity: SubToolMaturity;
  /**
   * Which product layer this sub-tool belongs to. The client sub-tools
   * center filters by layer === "client"; internal admin tools live
   * under /admin/* and are never shown to client tenants.
   *
   * Default for legacy entries (no explicit layer) is "client", because
   * the historical catalog only covered the client product. Adding a
   * new sub-tool should always set this explicitly.
   */
  productLayer?: ProductLayer;
  /** One-line positioning. */
  purpose: string;
  /** Two-sentence operator-facing description. */
  description: string;
  /** Dashboard routes this sub-tool already owns inside the cockpit. */
  ownedRoutes: ReadonlyArray<{ href: string; label: string }>;
  /** lib/agents/* modules wired into this sub-tool. */
  agentKernels: readonly string[];
  /** Connector ids this sub-tool speaks to. */
  connectors: readonly string[];
  /** Categories of gap finding this sub-tool reports. */
  gapCategories: readonly string[];
  /** Categories of automation this sub-tool can stage. */
  automationCategories: readonly string[];
  /** What's not done yet — explicit scope honesty. */
  notCoveredYet?: string;
}

export const SUB_TOOLS: readonly SubToolDefinition[] = [
  // =====================================================================
  // TECHNICAL OPERATIONS
  // =====================================================================
  {
    slug: "cloud-ops",
    name: "Cloud Operations",
    category: "technical_ops",
    maturity: "active",
    purpose: "Multi-cloud posture, cost, resilience, and remediation.",
    description:
      "Continuous posture across AWS, Azure, and GCP. Surfaces drift, weak IAM, missing backups, and oversized compute — and stages approval-gated Terraform fixes.",
    ownedRoutes: [
      { href: "/dashboard/multi-cloud",      label: "Multi-cloud overview" },
      { href: "/dashboard/aws",              label: "AWS" },
      { href: "/dashboard/azure",            label: "Azure" },
      { href: "/dashboard/gcp",              label: "GCP" },
      { href: "/dashboard/cloud-inventory",  label: "Cloud inventory" },
      { href: "/dashboard/cost-overview",    label: "Cost overview" },
      { href: "/dashboard/cost-explainer",   label: "Cost explainer" },
      { href: "/dashboard/finops",           label: "FinOps" },
      { href: "/dashboard/resilience",       label: "Resilience" },
      { href: "/dashboard/reliability",      label: "Reliability" },
      { href: "/dashboard/network-topology", label: "Network topology" },
    ],
    agentKernels: ["reasonerHypothesisWeaver", "simulatorSandboxSpec", "policyGateEvaluator", "boundaryGateCatalog"],
    connectors: ["aws", "azure", "gcp"],
    gapCategories: ["missing_backup", "weak_iam", "public_resource", "oversized_compute", "drift_detected", "cost_anomaly"],
    automationCategories: ["aws_backup_scan", "terraform_plan_apply", "resilience_audit", "cost_recommendation"],
    notCoveredYet: "Azure / GCP write paths are read-only today — only AWS supports approved mutations.",
  },
  {
    slug: "devops",
    name: "DevOps Operations",
    category: "technical_ops",
    maturity: "active",
    purpose: "Pipelines, deploys, release-readiness, and rollback planning.",
    description:
      "Pipeline health, deploy-window enforcement, failed-build diagnosis, and rollback proposals across GitHub Actions and Azure DevOps.",
    ownedRoutes: [
      { href: "/dashboard/cicd",                label: "CI/CD cockpit" },
      { href: "/dashboard/releaseops",          label: "Release ops" },
      { href: "/dashboard/github",              label: "GitHub" },
      { href: "/dashboard/integrations/github", label: "GitHub setup" },
      { href: "/dashboard/runbooks",            label: "Runbooks" },
      { href: "/dashboard/orchestration",       label: "Orchestration" },
    ],
    agentKernels: ["specWriter", "testCoverageProposer", "refactorSequencer", "migrationCoordinator"],
    connectors: ["github", "azure_devops"],
    gapCategories: ["pipeline_flaky", "missing_rollback", "secret_in_repo", "stale_branch", "weak_review"],
    automationCategories: ["pipeline_repair", "release_readiness", "rollback_drafter"],
    notCoveredYet: "GitLab and Bitbucket are planned, not shipped.",
  },
  {
    slug: "security",
    name: "Security Operations",
    category: "technical_ops",
    maturity: "active",
    purpose: "IAM risk, exposed-secret detection, misconfiguration, and compliance.",
    description:
      "Continuous scanning for IAM drift, public buckets, exposed secrets, and misconfigurations. Compliance packets generated on demand.",
    ownedRoutes: [
      { href: "/dashboard/security",          label: "Security overview" },
      { href: "/dashboard/cloud-security",    label: "Cloud security" },
      { href: "/dashboard/security-scanner",  label: "Security scanner" },
      { href: "/dashboard/compliance-packet", label: "Compliance packet" },
      { href: "/dashboard/policies",          label: "Policies" },
      { href: "/dashboard/policy-previews",   label: "Policy previews" },
      { href: "/dashboard/governance",        label: "Governance" },
      { href: "/dashboard/cloudtrail",        label: "CloudTrail" },
    ],
    agentKernels: ["policyGateEvaluator", "boundaryGateCatalog", "approverPacketAssembler"],
    connectors: ["aws", "azure", "gcp"],
    gapCategories: ["public_resource", "exposed_secret", "weak_iam", "missing_mfa", "stale_credential", "kev_match"],
    automationCategories: ["iam_least_priv", "secret_rotation", "kev_correlation", "compliance_packet"],
  },
  {
    slug: "observability",
    name: "Observability",
    category: "technical_ops",
    maturity: "partial",
    purpose: "Alerts, traces, metrics, incidents, and AI-generated timelines.",
    description:
      "Incident timeline construction, alert-noise reduction, and AI-generated postmortems. Surfaces sit on top of the bus's typed signals.",
    ownedRoutes: [
      { href: "/dashboard/traces",                 label: "Traces" },
      { href: "/dashboard/topology",               label: "Topology" },
      { href: "/dashboard/notifications",          label: "Notifications" },
      { href: "/dashboard/notifications-outbound", label: "Outbound (Slack / Teams)" },
      { href: "/dashboard/outbound-digest",        label: "Outbound digest" },
    ],
    agentKernels: ["detectorSignalEmitter", "reasonerHypothesisWeaver", "verifierPostExecChecker"],
    connectors: ["cloudwatch", "dynatrace", "grafana", "prometheus"],
    gapCategories: ["noisy_alert", "missing_dashboard", "no_postmortem", "missing_slo"],
    automationCategories: ["alert_noise_reduce", "postmortem_drafter", "dashboard_proposal"],
    notCoveredYet: "Dynatrace / Grafana / Prometheus ingest is planned — only CloudWatch is reading today.",
  },
  {
    slug: "database-ops",
    name: "Database Operations",
    category: "technical_ops",
    maturity: "planned",
    purpose: "Schema review, query perf, backups, migration risk.",
    description:
      "Schema review, slow-query proposals, backup coverage, and migration risk assessment for PostgreSQL / MySQL / MongoDB.",
    ownedRoutes: [],
    agentKernels: ["migrationCoordinator", "specWriter"],
    connectors: ["postgresql", "mysql", "mongodb"],
    gapCategories: ["missing_backup", "slow_query", "no_index", "schema_drift"],
    automationCategories: ["migration_runbook", "slow_query_audit", "backup_verify"],
    notCoveredYet: "Database connectors and the cockpit surface are on the next planning batch.",
  },
  {
    slug: "infrastructure",
    name: "Infrastructure",
    category: "technical_ops",
    maturity: "partial",
    purpose: "Kubernetes, Docker, Terraform, networking, certificates.",
    description:
      "Kubernetes workload drift, image-scan posture, Terraform validity, certificate expiry, and DNS sanity.",
    ownedRoutes: [
      { href: "/dashboard/containers", label: "Containers" },
      { href: "/dashboard/k8s-eol",    label: "Kubernetes EOL" },
    ],
    agentKernels: ["reasonerHypothesisWeaver", "boundaryGateCatalog"],
    connectors: ["kubernetes", "docker", "terraform_cloud"],
    gapCategories: ["k8s_eol", "untagged_image", "tf_drift", "cert_expiring", "dns_misconfig"],
    automationCategories: ["k8s_upgrade_plan", "tf_validate", "cert_renewal"],
  },
  {
    slug: "it-support",
    name: "IT Support",
    category: "technical_ops",
    maturity: "partial",
    purpose: "Internal employee IT — access, devices, software.",
    description:
      "Internal helpdesk for access requests, device issues, software installs. Routes tickets through Slack / Teams / Outlook intake.",
    ownedRoutes: [
      { href: "/dashboard/help",             label: "Help & docs" },
      { href: "/dashboard/help-suggestions", label: "Doc suggestions" },
      { href: "/dashboard/help-analytics",   label: "Help analytics" },
    ],
    agentKernels: ["axiomAssistantAgent", "contactResolutionAgent"],
    connectors: ["slack", "microsoft_teams", "outlook"],
    gapCategories: ["unassigned_ticket", "missing_runbook", "long_resolution"],
    automationCategories: ["ticket_routing", "access_request_drafter"],
  },
  {
    slug: "asset-management",
    name: "Asset Management",
    category: "technical_ops",
    maturity: "planned",
    purpose: "Laptops, servers, licenses, software subscriptions, renewals.",
    description:
      "Inventory of company assets — devices, licenses, cloud resources — with expiry tracking and renewal reminders.",
    ownedRoutes: [],
    agentKernels: ["axiomAssistantAgent"],
    connectors: ["aws", "azure", "gcp", "stripe"],
    gapCategories: ["license_expiring", "unused_software", "untracked_device"],
    automationCategories: ["renewal_reminder", "license_audit"],
    notCoveredYet: "Asset Management surface is in design — Prisma models + cockpit page are queued.",
  },

  // =====================================================================
  // BUSINESS OPERATIONS
  // =====================================================================
  {
    slug: "hr",
    name: "HR Operations",
    category: "business_ops",
    maturity: "planned",
    purpose: "Employee onboarding, offboarding, access checklists, internal policy.",
    description:
      "Employee lifecycle workflows — onboarding checklists, role-based access provisioning hand-offs to IT, internal policy distribution, document collection.",
    ownedRoutes: [],
    agentKernels: ["axiomAssistantAgent"],
    connectors: ["slack", "microsoft_teams", "outlook"],
    gapCategories: ["missing_onboarding_step", "stale_access", "missing_policy_ack"],
    automationCategories: ["onboarding_checklist", "welcome_email_drafter", "access_request"],
    notCoveredYet: "HR Ops models, agent specialisation, and cockpit page are scoped for an upcoming batch.",
  },
  {
    slug: "customer-support",
    name: "Customer Support",
    category: "business_ops",
    maturity: "partial",
    purpose: "Tickets, reply drafts, SLA tracking, customer sentiment.",
    description:
      "Ticket routing, AI-drafted reply suggestions (operator-approved before send), SLA + sentiment tracking, and knowledge-base updates.",
    ownedRoutes: [
      { href: "/dashboard/help",           label: "Help & docs" },
      { href: "/dashboard/help-analytics", label: "Help analytics" },
    ],
    agentKernels: ["axiomAssistantAgent", "contactResolutionAgent"],
    connectors: ["slack", "microsoft_teams", "outlook"],
    gapCategories: ["unanswered_ticket", "sla_breach", "missing_kb_article"],
    automationCategories: ["reply_drafter", "ticket_classifier", "kb_proposal"],
    notCoveredYet: "Reply send-out is staged-only — an operator must approve before any outbound customer message.",
  },
  {
    slug: "business-ops",
    name: "Business Operations",
    category: "business_ops",
    maturity: "partial",
    purpose: "Internal workflows, company tasks, process gaps, reports.",
    description:
      "Recurring company processes, internal task tracking, process-gap detection, executive summary reports.",
    ownedRoutes: [
      { href: "/dashboard/executive-summary", label: "Executive summary" },
      { href: "/dashboard/tenant-insights",   label: "Tenant insights" },
    ],
    agentKernels: ["axiomAssistantAgent", "improverProposalSynthesizer"],
    connectors: ["slack", "microsoft_teams"],
    gapCategories: ["stale_process", "missing_owner", "missed_review"],
    automationCategories: ["status_report", "process_audit"],
  },
  {
    slug: "marketing-ops",
    name: "VisionXIXLabs Marketing (internal)",
    category: "business_ops",
    maturity: "partial",
    productLayer: "internal_admin",
    purpose: "Internal-only cockpit for VisionXIXLabs' OWN LinkedIn / X marketing pipeline.",
    description:
      "Surfaces VisionXIXLabs' company-side marketing automation — drafts for OUR LinkedIn / X / blog channels, scheduler, payload preview. Lives at /admin/marketing. Not exposed to client tenants. Each client gets their own outbound automation under /dashboard/automation, scoped to their workspace.",
    ownedRoutes: [
      { href: "/admin/marketing", label: "Internal marketing cockpit" },
    ],
    agentKernels: ["marketingContentDrafter", "socialPostScheduler", "axiomAssistantAgent"],
    connectors: ["linkedin", "slack", "outlook"],
    gapCategories: ["stale_draft", "missed_milestone_post", "incident_silence"],
    automationCategories: ["draft_from_changelog", "scheduled_post_send", "incident_announcement"],
    notCoveredYet:
      "Live LinkedIn POST + token storage is scoped — today the cockpit previews bytes only. X / blog publishing planned.",
  },
  {
    slug: "sales",
    name: "VisionXIXLabs Sales (internal)",
    category: "business_ops",
    maturity: "partial",
    productLayer: "internal_admin",
    purpose: "VisionXIXLabs' OWN sales pipeline — leads, proposals, follow-ups, meeting summaries.",
    description:
      "Lead capture, AI-drafted proposals + follow-up emails, meeting summaries with action items, all for VisionXIXLabs' own outbound sales. Lives at /admin/sales. Approval-gated before any external contact. Client tenants do NOT see this — they have their own customer-support tools under /dashboard/customer-support.",
    ownedRoutes: [
      { href: "/admin/leads", label: "Lead pipeline" },
    ],
    agentKernels: ["contactResolutionAgent", "salesLeadEnricher", "axiomAssistantAgent"],
    connectors: ["stripe", "outlook"],
    gapCategories: ["overdue_followup", "missing_proposal", "unsigned_contract"],
    automationCategories: ["proposal_drafter", "followup_reminder", "meeting_summary"],
    notCoveredYet: "Proposal send-out is approval-gated — drafts surface in the approval queue, not the customer's inbox.",
  },
  {
    slug: "finance",
    name: "Finance Operations",
    category: "business_ops",
    maturity: "partial",
    purpose: "Invoices, payments, subscriptions, expense categorisation, cost reports.",
    description:
      "Subscription state, invoice + payment tracking, cloud cost mirror, budget alerts. Connects to Stripe for the platform's own billing.",
    ownedRoutes: [
      { href: "/dashboard/billing",        label: "Billing & plans" },
      { href: "/dashboard/cost-overview",  label: "Cost overview" },
      { href: "/dashboard/cost-explainer", label: "Cost explainer" },
    ],
    agentKernels: ["axiomAssistantAgent"],
    connectors: ["stripe"],
    gapCategories: ["overdue_invoice", "budget_breach", "uncategorised_expense"],
    automationCategories: ["invoice_reminder", "budget_alert"],
  },
  {
    slug: "legal-compliance",
    name: "Legal / Compliance",
    category: "business_ops",
    maturity: "partial",
    purpose: "Contracts, compliance checklists, risk register, audit logs.",
    description:
      "Contract summarisation, compliance checklist tracking, risk register, audit log review.",
    ownedRoutes: [
      { href: "/dashboard/compliance-packet", label: "Compliance packet" },
      { href: "/dashboard/policies",          label: "Policies" },
      { href: "/dashboard/governance",        label: "Governance" },
      { href: "/dashboard/audit",             label: "Audit log" },
    ],
    agentKernels: ["policyGateEvaluator"],
    connectors: ["aws", "azure", "gcp"],
    gapCategories: ["overdue_review", "missing_policy", "expired_contract"],
    automationCategories: ["evidence_packet", "policy_audit"],
  },
  {
    slug: "procurement",
    name: "Procurement / Vendor",
    category: "business_ops",
    maturity: "planned",
    purpose: "Vendors, purchase requests, renewals, vendor risk.",
    description:
      "Vendor tracking, purchase request workflows, renewal reminders, vendor risk + contract expiry.",
    ownedRoutes: [],
    agentKernels: ["axiomAssistantAgent"],
    connectors: ["stripe", "outlook"],
    gapCategories: ["expiring_vendor", "stale_vendor_risk", "untracked_subscription"],
    automationCategories: ["renewal_reminder", "vendor_risk_check"],
    notCoveredYet: "Procurement is on the next planning batch — current surface is read-only references.",
  },
  {
    slug: "project-management",
    name: "Project Management",
    category: "business_ops",
    maturity: "planned",
    purpose: "Projects, tasks, milestones, owners, status reports.",
    description:
      "Project + task tracking, milestone status, ownership, dependency resolution, AI-generated status reports.",
    ownedRoutes: [],
    agentKernels: ["axiomAssistantAgent", "improverProposalSynthesizer"],
    connectors: ["slack", "microsoft_teams"],
    gapCategories: ["missing_owner", "stale_status", "blocked_task"],
    automationCategories: ["status_report", "dependency_check"],
  },
  {
    slug: "documentation",
    name: "Documentation Center",
    category: "business_ops",
    maturity: "partial",
    purpose: "Internal docs, runbooks, SOPs, auto-generated documentation.",
    description:
      "Documentation source-of-truth — runbooks, SOPs, technical / HR / support docs — with AI-suggested doc updates from recent activity.",
    ownedRoutes: [
      { href: "/dashboard/help",             label: "Help & docs" },
      { href: "/dashboard/help-suggestions", label: "Doc suggestions" },
      { href: "/dashboard/runbooks",         label: "Runbooks" },
    ],
    agentKernels: ["axiomAssistantAgent", "improverProposalSynthesizer"],
    connectors: ["slack"],
    gapCategories: ["stale_doc", "missing_runbook", "broken_link"],
    automationCategories: ["doc_proposal", "runbook_drafter"],
  },
  {
    slug: "knowledge-base",
    name: "Knowledge Base",
    category: "business_ops",
    maturity: "partial",
    purpose: "Company knowledge, RAG-ready sources, incident history, agent memory.",
    description:
      "Knowledge sources fed into agent retrieval — incident history, security policies, engineering standards, support answers.",
    ownedRoutes: [
      { href: "/dashboard/memory",  label: "Memory" },
      { href: "/dashboard/sources", label: "Sources" },
    ],
    agentKernels: ["axiomAssistantAgent"],
    connectors: ["slack"],
    gapCategories: ["stale_kb", "low_coverage", "uncited_answer"],
    automationCategories: ["kb_proposal", "answer_grading"],
  },
];

export function getSubTool(slug: string): SubToolDefinition | undefined {
  return SUB_TOOLS.find((s) => s.slug === slug);
}

export function subToolsByCategory(category: SubToolCategory): readonly SubToolDefinition[] {
  return SUB_TOOLS.filter((s) => s.category === category);
}

/** Layer defaults to "client" for legacy entries that pre-date the field. */
export function getSubToolLayer(t: SubToolDefinition): ProductLayer {
  return t.productLayer ?? "client";
}

/** Client tenants only ever see this slice of the catalog. */
export function clientSubTools(): readonly SubToolDefinition[] {
  return SUB_TOOLS.filter((s) => getSubToolLayer(s) === "client");
}

/** VisionXIXLabs admins see this slice under /admin/*. */
export function internalAdminSubTools(): readonly SubToolDefinition[] {
  return SUB_TOOLS.filter((s) => getSubToolLayer(s) === "internal_admin");
}

export const SUB_TOOL_CATEGORY_META: Record<
  SubToolCategory,
  { label: string; description: string; tone: string }
> = {
  technical_ops: {
    label: "Technical Operations",
    description: "Cloud, DevOps, Security, Observability, Database, Infrastructure, IT Support, Asset Management.",
    tone: "from-cyan-500/12 via-indigo-500/8 to-transparent",
  },
  business_ops: {
    label: "Business Operations",
    description: "HR, Customer Support, Business Ops, Sales, Finance, Legal, Procurement, Projects, Docs, Knowledge.",
    tone: "from-fuchsia-500/12 via-violet-500/8 to-transparent",
  },
  ai_ops: {
    label: "AI Operations",
    description: "Agent workforce, automation engine, model registry, learning events, gap detection, approvals, audit.",
    tone: "from-emerald-500/12 via-cyan-500/6 to-transparent",
  },
};

export const SUB_TOOL_MATURITY_META: Record<
  SubToolMaturity,
  { label: string; tone: string }
> = {
  active:  { label: "Active",  tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  partial: { label: "Partial", tone: "border-amber-500/30   bg-amber-500/10   text-amber-300"  },
  planned: { label: "Planned", tone: "border-zinc-500/30    bg-zinc-500/10    text-zinc-400"   },
};
