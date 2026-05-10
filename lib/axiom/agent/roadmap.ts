/**
 * Axiom Agent — 5-Year Infrastructure Intelligence Roadmap
 *
 * This file is both documentation and executable code. The roadmap
 * is structured as typed data so it can be rendered in the product,
 * used for progress tracking, and queried by the agent itself.
 *
 * Philosophy:
 *   - AGI is a direction, not a destination. We're building toward
 *     autonomous infrastructure reasoning, not general intelligence.
 *   - Every capability must earn trust before gaining autonomy.
 *   - Humans remain the authority on risk, policy, and org values.
 *   - The agent gets better by remembering, not by guessing.
 *
 * Current state (as of 2026-05):
 *   30 agent modules, ~25,000 lines of typed infrastructure intelligence.
 *   AWS operational. Azure/GCP schema-ready. No production apply yet.
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. ROADMAP TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type RoadmapPhase = "mvp" | "near_term" | "mid_term" | "long_term" | "horizon";

export type MilestoneStatus =
  | "completed"
  | "in_progress"
  | "planned"
  | "research"
  | "deferred";

export type MilestoneCategory =
  | "core_agent"
  | "cloud_coverage"
  | "safety"
  | "intelligence"
  | "enterprise"
  | "autonomy"
  | "observability"
  | "integration";

export type Milestone = {
  id: string;
  phase: RoadmapPhase;
  category: MilestoneCategory;
  name: string;
  description: string;
  status: MilestoneStatus;
  targetQuarter: string;           // e.g. "2026-Q3"
  dependencies: string[];          // milestone IDs
  modules: string[];               // files that implement this
  technicalRequirements: string[];
  orgRequirements: string[];
  bottlenecks: string[];
  autonomyLevel: AutonomyGate;
  metrics: SuccessMetric[];
};

export type AutonomyGate =
  | "human_only"                   // agent advises, human acts
  | "human_approved"               // agent proposes, human approves
  | "agent_with_guardrails"        // agent acts within bounds, human monitors
  | "agent_supervised"             // agent acts, human reviews after
  | "agent_autonomous";            // agent acts independently (ONLY for safe reads)

export type SuccessMetric = {
  name: string;
  target: string;
  measurement: string;
};

export type BottleneckCategory =
  | "data_quality"
  | "provider_api"
  | "trust_building"
  | "org_adoption"
  | "regulatory"
  | "technical_complexity"
  | "cost";

export type Bottleneck = {
  id: string;
  category: BottleneckCategory;
  description: string;
  affectedMilestones: string[];
  mitigation: string;
  severity: "blocking" | "significant" | "manageable";
};

export type NeverAutomate = {
  domain: string;
  reason: string;
  humanRole: string;
  agentRole: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. YEAR 1 — MVP (2026 H1-H2): Prove Value on AWS
// ═══════════════════════════════════════════════════════════════════════════

const YEAR_1: Milestone[] = [
  {
    id: "m-1.1",
    phase: "mvp",
    category: "core_agent",
    name: "Read-Only Cloud Intelligence",
    description: "Agent scans AWS accounts, identifies waste, risk, and drift. Produces prioritized recommendations with evidence. Zero write operations.",
    status: "completed",
    targetQuarter: "2026-Q1",
    dependencies: [],
    modules: [
      "cloudSnapshot.ts",
      "runAgent.ts",
      "prioritizer.ts",
      "recommendationBuilder.ts",
      "reasoningEngine.ts",
      "explainabilityEngine.ts",
    ],
    technicalRequirements: [
      "AWS connector with read-only IAM role",
      "Snapshot normalization schema",
      "Finding classification pipeline",
      "Priority scoring with evidence",
    ],
    orgRequirements: [
      "AWS account access with ReadOnlyAccess policy",
      "Organization admin to configure first scan",
    ],
    bottlenecks: ["AWS API rate limits on large accounts", "Snapshot staleness for fast-changing infra"],
    autonomyLevel: "human_only",
    metrics: [
      { name: "Finding accuracy", target: ">80% actionable", measurement: "% of findings that lead to human action" },
      { name: "Scan coverage", target: "100% of connected accounts", measurement: "Accounts scanned / accounts connected" },
    ],
  },
  {
    id: "m-1.2",
    phase: "mvp",
    category: "core_agent",
    name: "Terraform & CLI Generation",
    description: "For every recommendation, generate the exact Terraform HCL and CLI command to implement it. Human copies and runs.",
    status: "completed",
    targetQuarter: "2026-Q1",
    dependencies: ["m-1.1"],
    modules: ["toolFramework.ts"],
    technicalRequirements: [
      "Terraform HCL generator for each ActionType",
      "AWS CLI command generator",
      "Dry-run command variants",
    ],
    orgRequirements: ["Terraform state access for import (optional)"],
    bottlenecks: ["Keeping generated code in sync with provider API changes"],
    autonomyLevel: "human_only",
    metrics: [
      { name: "Code correctness", target: ">95% valid HCL", measurement: "terraform validate pass rate" },
    ],
  },
  {
    id: "m-1.3",
    phase: "mvp",
    category: "safety",
    name: "Approval & RBAC System",
    description: "Multi-role access control with approval chains. No action executes without explicit human approval through a typed workflow.",
    status: "completed",
    targetQuarter: "2026-Q2",
    dependencies: ["m-1.1"],
    modules: ["rbacEngine.ts", "autopilot.ts"],
    technicalRequirements: [
      "Role hierarchy (viewer → operator → admin → owner)",
      "Approval chains with voting",
      "Audit logging for every authorization decision",
    ],
    orgRequirements: [
      "Org admin assigns roles",
      "Define approval policy (who can approve what)",
    ],
    bottlenecks: ["Getting orgs to define policies upfront"],
    autonomyLevel: "human_approved",
    metrics: [
      { name: "Approval latency", target: "<24h for medium risk", measurement: "Median time from proposal to decision" },
    ],
  },
  {
    id: "m-1.4",
    phase: "mvp",
    category: "core_agent",
    name: "Phased Execution with Rollback",
    description: "Agent can apply approved changes to AWS. Canary validation, blast radius enforcement, automatic rollback on failure.",
    status: "in_progress",
    targetQuarter: "2026-Q3",
    dependencies: ["m-1.3"],
    modules: [
      "operationOrchestrator.ts",
      "planningEngine.ts",
      "applyEngine.ts",
      "rollbackPlanner.ts",
      "verificationEngine.ts",
    ],
    technicalRequirements: [
      "AWS write permissions scoped per action type",
      "Pre-change state capture for rollback",
      "Post-change verification against success criteria",
      "Canary: smallest region first, metrics validation",
      "Blast radius: max 50 resources per step",
    ],
    orgRequirements: [
      "AWS IAM role with scoped write permissions",
      "Maintenance window definition",
      "Incident response contact for rollback notifications",
    ],
    bottlenecks: [
      "Earning customer trust for write operations",
      "AWS API inconsistency between services",
      "Rollback isn't always possible (e.g., deleted resources)",
    ],
    autonomyLevel: "human_approved",
    metrics: [
      { name: "Execution success rate", target: ">95%", measurement: "Actions succeeded / actions attempted" },
      { name: "Rollback success rate", target: ">99%", measurement: "Rollbacks succeeded / rollbacks attempted" },
      { name: "Verification pass rate", target: ">90%", measurement: "Verifications passed / verifications run" },
    ],
  },
  {
    id: "m-1.5",
    phase: "mvp",
    category: "observability",
    name: "Monitoring & Drift Detection",
    description: "Continuous monitoring detects infrastructure drift, configuration changes, and anomalies between scans.",
    status: "completed",
    targetQuarter: "2026-Q2",
    dependencies: ["m-1.1"],
    modules: ["monitoringAgent.ts", "driftEngine.ts", "observability.ts"],
    technicalRequirements: [
      "Snapshot diffing with 8 change categories",
      "Alert deduplication and suppression",
      "Drift detection against approved execution plans",
    ],
    orgRequirements: ["Notification channel configuration (Slack/email)"],
    bottlenecks: ["Alert fatigue if thresholds are too sensitive"],
    autonomyLevel: "agent_with_guardrails",
    metrics: [
      { name: "Drift detection latency", target: "<15 minutes", measurement: "Time from change to alert" },
      { name: "False positive rate", target: "<10%", measurement: "Suppressed / total alerts" },
    ],
  },
  {
    id: "m-1.6",
    phase: "mvp",
    category: "intelligence",
    name: "Governance & Compliance Engine",
    description: "Declarative policy engine covering cost, security, resilience, and compliance. Violations are explained and mapped to remediation.",
    status: "completed",
    targetQuarter: "2026-Q2",
    dependencies: ["m-1.1"],
    modules: ["governanceEngine.ts"],
    technicalRequirements: [
      "10 rule types covering cost/security/resilience",
      "Scope filtering by provider/region/environment/tags",
      "4 enforcement levels (audit → block)",
      "Compliance scoring per policy domain",
    ],
    orgRequirements: [
      "Choose policy preset (startup/enterprise/regulated) or define custom",
    ],
    bottlenecks: ["Mapping org compliance requirements to machine-readable rules"],
    autonomyLevel: "human_only",
    metrics: [
      { name: "Policy coverage", target: ">80% of resources evaluated", measurement: "Resources evaluated / total resources" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 3. YEAR 2 — NEAR-TERM (2027): Multi-Cloud & Trust
// ═══════════════════════════════════════════════════════════════════════════

const YEAR_2: Milestone[] = [
  {
    id: "m-2.1",
    phase: "near_term",
    category: "cloud_coverage",
    name: "Azure Full Support",
    description: "Complete Azure connector: snapshot, findings, Terraform generation, execution, and verification. Feature parity with AWS.",
    status: "planned",
    targetQuarter: "2027-Q1",
    dependencies: ["m-1.4"],
    modules: ["providerRegistry.ts", "cloudSnapshot.ts"],
    technicalRequirements: [
      "Azure Resource Graph API integration",
      "Azure Cost Management API",
      "ARM template / Terraform azurerm generation",
      "Azure RBAC mapping to Axiom roles",
    ],
    orgRequirements: [
      "Azure service principal with Reader role",
      "Azure subscription enumeration",
    ],
    bottlenecks: [
      "Azure API surface is much larger than AWS",
      "Azure resource naming inconsistencies across services",
    ],
    autonomyLevel: "human_approved",
    metrics: [
      { name: "Azure feature parity", target: "100% of AWS capabilities", measurement: "Azure actions / AWS actions" },
    ],
  },
  {
    id: "m-2.2",
    phase: "near_term",
    category: "cloud_coverage",
    name: "GCP Full Support",
    description: "Complete GCP connector: snapshot, findings, Terraform generation, execution, and verification.",
    status: "planned",
    targetQuarter: "2027-Q2",
    dependencies: ["m-1.4"],
    modules: ["providerRegistry.ts", "cloudSnapshot.ts"],
    technicalRequirements: [
      "GCP Asset Inventory API",
      "GCP Billing API",
      "google provider Terraform generation",
      "GCP IAM mapping",
    ],
    orgRequirements: [
      "GCP service account with Viewer role",
      "GCP project enumeration",
    ],
    bottlenecks: ["GCP project-centric model vs AWS account-centric"],
    autonomyLevel: "human_approved",
    metrics: [
      { name: "GCP feature parity", target: "100% of AWS capabilities", measurement: "GCP actions / AWS actions" },
    ],
  },
  {
    id: "m-2.3",
    phase: "near_term",
    category: "intelligence",
    name: "Cross-Cloud Reasoning",
    description: "Agent reasons across AWS + Azure + GCP simultaneously. Identifies cross-cloud optimization opportunities, redundancies, and migration candidates.",
    status: "planned",
    targetQuarter: "2027-Q3",
    dependencies: ["m-2.1", "m-2.2"],
    modules: ["multiCloudSummary.ts", "multiCloudPrioritizer.ts", "reasoningEngine.ts"],
    technicalRequirements: [
      "Unified resource taxonomy across providers",
      "Cross-cloud cost normalization",
      "Provider-specific advantage scoring",
      "Migration feasibility analysis",
    ],
    orgRequirements: [
      "At least 2 cloud providers connected",
      "Cross-cloud team coordination",
    ],
    bottlenecks: [
      "Comparing unlike resources across providers",
      "Data egress costs make some migrations uneconomical",
    ],
    autonomyLevel: "human_only",
    metrics: [
      { name: "Cross-cloud insights", target: ">5 per multi-cloud scan", measurement: "Unique cross-cloud findings per run" },
    ],
  },
  {
    id: "m-2.4",
    phase: "near_term",
    category: "intelligence",
    name: "Persistent Agent Memory",
    description: "Agent remembers past runs, incidents, approvals, and org patterns. Uses memory to improve recommendations over time.",
    status: "completed",
    targetQuarter: "2027-Q1",
    dependencies: ["m-1.4"],
    modules: [
      "memorySystem.ts",
      "cognitiveArchitecture.ts",
      "reflectionEngine.ts",
      "workflowIntelligence.ts",
    ],
    technicalRequirements: [
      "4-tier memory: episodic, semantic, procedural, organizational",
      "Memory aging with confidence decay",
      "Query interface with relevance scoring",
      "Reflection loop: measure → learn → adapt",
    ],
    orgRequirements: ["Database storage for memory persistence"],
    bottlenecks: [
      "Memory staleness — infrastructure changes faster than memory ages",
      "Cold start: no memory for new orgs",
    ],
    autonomyLevel: "agent_with_guardrails",
    metrics: [
      { name: "Recommendation improvement", target: ">10% YoY", measurement: "Approval rate increase over baseline" },
      { name: "Noise reduction", target: ">20% fewer suppressed", measurement: "Suppressed alerts / total alerts trend" },
    ],
  },
  {
    id: "m-2.5",
    phase: "near_term",
    category: "safety",
    name: "Autonomy Ladder with Earned Trust",
    description: "Six-level autonomy system. Agent starts at L0 (deterministic) and can be promoted by admins based on track record. Never self-promotes.",
    status: "completed",
    targetQuarter: "2027-Q1",
    dependencies: ["m-1.3", "m-2.4"],
    modules: ["cognitiveArchitecture.ts", "adaptiveBehavior.ts"],
    technicalRequirements: [
      "L0 Deterministic → L5 Reflective autonomy ladder",
      "Promotion requires admin approval + track record metrics",
      "Safety bounds enforced at each level",
      "Autonomy can only decrease automatically (on incidents)",
    ],
    orgRequirements: [
      "Admin reviews autonomy promotion requests",
      "Incident response plan for autonomy downgrades",
    ],
    bottlenecks: ["Building sufficient track record takes months"],
    autonomyLevel: "human_approved",
    metrics: [
      { name: "Trust score", target: "Monotonically increasing for safe orgs", measurement: "Composite safety + success metric" },
    ],
  },
  {
    id: "m-2.6",
    phase: "near_term",
    category: "enterprise",
    name: "Workflow Automation",
    description: "Event-driven workflows: on scan complete → evaluate policies → generate plan → notify team → await approval. Customizable per org.",
    status: "completed",
    targetQuarter: "2027-Q2",
    dependencies: ["m-1.5", "m-1.6"],
    modules: ["workflowEngine.ts"],
    technicalRequirements: [
      "6 trigger types (schedule, scan, alert, approval, threshold, manual)",
      "8 action types (scan, plan, terraform, CLI, notify, apply, summarize)",
      "Condition evaluation with AND/OR logic",
      "Execution history and metrics",
    ],
    orgRequirements: ["Define at least one workflow"],
    bottlenecks: ["Complex workflow debugging when conditions interact"],
    autonomyLevel: "agent_with_guardrails",
    metrics: [
      { name: "Workflow reliability", target: ">99% completion", measurement: "Successful executions / total triggers" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 4. YEAR 3 — MID-TERM (2028): Proactive Intelligence
// ═══════════════════════════════════════════════════════════════════════════

const YEAR_3: Milestone[] = [
  {
    id: "m-3.1",
    phase: "mid_term",
    category: "intelligence",
    name: "Predictive Cost Modeling",
    description: "Agent projects infrastructure costs 30/60/90 days forward based on growth trends, commitment utilization, and seasonal patterns from memory.",
    status: "research",
    targetQuarter: "2028-Q1",
    dependencies: ["m-2.4", "m-2.3"],
    modules: [],
    technicalRequirements: [
      "Time-series cost modeling per resource class",
      "Growth trend extrapolation from memory",
      "Commitment coverage analysis (RI/SP utilization)",
      "Seasonal pattern detection",
      "Confidence intervals on all projections",
    ],
    orgRequirements: [
      "6+ months of scan history for accurate trends",
      "Cost allocation tags in place",
    ],
    bottlenecks: [
      "Prediction accuracy degrades beyond 90 days",
      "Org restructuring invalidates historical patterns",
    ],
    autonomyLevel: "human_only",
    metrics: [
      { name: "30-day cost forecast accuracy", target: "±10%", measurement: "|predicted - actual| / actual" },
    ],
  },
  {
    id: "m-3.2",
    phase: "mid_term",
    category: "intelligence",
    name: "Proactive Resilience Planning",
    description: "Agent identifies resilience gaps before incidents occur. Simulates failure scenarios and recommends hardening, based on real org incident history.",
    status: "research",
    targetQuarter: "2028-Q2",
    dependencies: ["m-2.4", "m-1.5"],
    modules: [],
    technicalRequirements: [
      "Failure mode enumeration per resource type",
      "Blast radius simulation",
      "Recovery time estimation from past incidents",
      "Dependency graph construction from network/IAM data",
      "Resilience scoring per service",
    ],
    orgRequirements: [
      "Incident history integrated into agent memory",
      "Service dependency map (manual or auto-discovered)",
    ],
    bottlenecks: [
      "Dependency discovery requires network flow data most orgs don't have",
      "Simulating cascading failures is computationally expensive",
    ],
    autonomyLevel: "human_only",
    metrics: [
      { name: "Resilience gap detection", target: ">80% of gaps found pre-incident", measurement: "Gaps identified before incident / total gaps" },
    ],
  },
  {
    id: "m-3.3",
    phase: "mid_term",
    category: "autonomy",
    name: "Safe Auto-Apply for Low-Risk Actions",
    description: "Agent automatically applies pre-approved low-risk actions (e.g., right-sizing idle dev instances, applying missing tags) without per-action approval. Admin pre-approves action classes.",
    status: "planned",
    targetQuarter: "2028-Q2",
    dependencies: ["m-2.5", "m-1.4"],
    modules: ["autopilot.ts", "operationOrchestrator.ts"],
    technicalRequirements: [
      "Action class pre-approval framework",
      "Risk scoring that never under-estimates",
      "Auto-apply only in non-production environments by default",
      "Kill switch: admin can disable instantly",
      "Every auto-apply logged with full rationale",
    ],
    orgRequirements: [
      "Admin explicitly enables auto-apply per action class",
      "Define production vs non-production environments",
      "Notification channel for auto-apply actions",
    ],
    bottlenecks: [
      "Legal review for auto-apply in regulated industries",
      "One bad auto-apply destroys trust for months",
    ],
    autonomyLevel: "agent_with_guardrails",
    metrics: [
      { name: "Auto-apply accuracy", target: ">99.5%", measurement: "Successful auto-applies / total auto-applies" },
      { name: "Zero critical incidents", target: "0 critical incidents from auto-apply", measurement: "Count" },
    ],
  },
  {
    id: "m-3.4",
    phase: "mid_term",
    category: "enterprise",
    name: "Multi-Tenant Fleet Intelligence",
    description: "For MSPs and large enterprises: agent operates across hundreds of accounts with shared learning (anonymized) and per-tenant isolation.",
    status: "research",
    targetQuarter: "2028-Q3",
    dependencies: ["m-2.3", "m-2.4"],
    modules: [],
    technicalRequirements: [
      "Tenant isolation for all data and memory",
      "Anonymized pattern sharing (opt-in)",
      "Fleet-wide anomaly detection",
      "Hierarchical RBAC (fleet admin → tenant admin → operator)",
    ],
    orgRequirements: [
      "MSP or enterprise with 10+ cloud accounts",
      "Compliance review for cross-tenant learning",
    ],
    bottlenecks: [
      "Cross-tenant learning must not leak proprietary infrastructure details",
      "Fleet scale requires background processing architecture",
    ],
    autonomyLevel: "human_approved",
    metrics: [
      { name: "Fleet coverage", target: ">95% of accounts scanned on schedule", measurement: "Accounts scanned / accounts enrolled" },
    ],
  },
  {
    id: "m-3.5",
    phase: "mid_term",
    category: "integration",
    name: "CI/CD & GitOps Integration",
    description: "Agent reviews infrastructure changes in pull requests. Flags policy violations, cost impact, and risk before merge. Comments directly on PRs.",
    status: "planned",
    targetQuarter: "2028-Q1",
    dependencies: ["m-1.6", "m-1.2"],
    modules: [],
    technicalRequirements: [
      "Terraform plan parsing",
      "PR comment API integration (GitHub, GitLab)",
      "Pre-merge policy evaluation",
      "Cost delta estimation from plan",
    ],
    orgRequirements: [
      "GitHub/GitLab App installation",
      "Terraform used for infrastructure management",
    ],
    bottlenecks: ["Terraform plan parsing covers ~60% of real-world HCL patterns"],
    autonomyLevel: "human_only",
    metrics: [
      { name: "PR review coverage", target: ">90% of infra PRs reviewed", measurement: "PRs reviewed / PRs with infra changes" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 5. YEAR 4 — LONG-TERM (2029): Operational Intelligence
// ═══════════════════════════════════════════════════════════════════════════

const YEAR_4: Milestone[] = [
  {
    id: "m-4.1",
    phase: "long_term",
    category: "intelligence",
    name: "Causal Infrastructure Reasoning",
    description: "Agent understands WHY infrastructure is configured a certain way, not just WHAT it is. Uses commit history, incident history, and team context to reason about intent.",
    status: "research",
    targetQuarter: "2029-Q1",
    dependencies: ["m-3.1", "m-3.2", "m-3.5"],
    modules: [],
    technicalRequirements: [
      "Commit-to-resource mapping (who changed what, when, and PR context)",
      "Intent inference from change patterns",
      "Exception understanding (why is this resource different?)",
      "Confidence scoring for inferred intent",
    ],
    orgRequirements: [
      "Git history access for infrastructure repos",
      "Team structure and ownership data",
    ],
    bottlenecks: [
      "Intent is often undocumented — inference is inherently uncertain",
      "Requires LLM integration for natural language understanding of PRs/commits",
    ],
    autonomyLevel: "human_only",
    metrics: [
      { name: "Intent inference accuracy", target: ">70%", measurement: "Human-validated intent matches / total inferences" },
    ],
  },
  {
    id: "m-4.2",
    phase: "long_term",
    category: "autonomy",
    name: "Self-Healing Workflows",
    description: "For pre-approved failure modes, agent detects the issue, generates a fix, applies it, and verifies — all without human intervention. Limited to known, rehearsed scenarios.",
    status: "research",
    targetQuarter: "2029-Q2",
    dependencies: ["m-3.3", "m-3.2"],
    modules: [],
    technicalRequirements: [
      "Failure mode catalog with rehearsed remediations",
      "Runbook-to-code compilation",
      "Automated remediation with mandatory verification",
      "Incident auto-creation and stakeholder notification",
      "Self-healing disabled for unknown failure modes",
    ],
    orgRequirements: [
      "Runbooks documented and linked to failure modes",
      "Self-healing rehearsal in staging before production",
      "24/7 escalation path for self-healing failures",
    ],
    bottlenecks: [
      "Novel failures can't be self-healed — only rehearsed ones",
      "Self-healing that makes things worse is catastrophic for trust",
    ],
    autonomyLevel: "agent_supervised",
    metrics: [
      { name: "MTTR reduction", target: ">50% vs manual", measurement: "Self-heal resolution time / manual resolution time" },
      { name: "False remediation rate", target: "<1%", measurement: "Incorrect self-heals / total self-heals" },
    ],
  },
  {
    id: "m-4.3",
    phase: "long_term",
    category: "intelligence",
    name: "Organization-Wide Infrastructure Memory",
    description: "Agent builds a living model of the organization's infrastructure philosophy: risk tolerance, change velocity, team structures, compliance posture, seasonal patterns, and institutional knowledge.",
    status: "research",
    targetQuarter: "2029-Q3",
    dependencies: ["m-2.4", "m-3.4"],
    modules: ["memorySystem.ts"],
    technicalRequirements: [
      "Organizational store with identity, culture, and compliance data",
      "Team preference learning from approval patterns",
      "Institutional knowledge extraction from incidents and postmortems",
      "Cross-team pattern sharing with privacy controls",
    ],
    orgRequirements: [
      "2+ years of agent usage history",
      "Postmortem data accessible to agent",
    ],
    bottlenecks: [
      "Organizational knowledge is subjective and contested",
      "Personnel changes invalidate learned preferences",
    ],
    autonomyLevel: "agent_with_guardrails",
    metrics: [
      { name: "Personalization score", target: ">80%", measurement: "Recommendations aligned with org preferences / total recommendations" },
    ],
  },
  {
    id: "m-4.4",
    phase: "long_term",
    category: "enterprise",
    name: "FinOps Integration",
    description: "Deep integration with FinOps workflows: showback/chargeback, commitment portfolio optimization, budget alerting, and team-level cost accountability.",
    status: "research",
    targetQuarter: "2029-Q1",
    dependencies: ["m-3.1", "m-2.3"],
    modules: [],
    technicalRequirements: [
      "Cost allocation by team/service/environment",
      "Commitment portfolio modeling (RI + SP + spot)",
      "Budget tracking with anomaly detection",
      "Savings waterfall: identified → approved → realized",
    ],
    orgRequirements: [
      "Cost allocation tags enforced",
      "FinOps team engagement",
      "Budget ownership defined",
    ],
    bottlenecks: [
      "Cost data accuracy varies wildly across providers",
      "Shared resource attribution is unsolved in general",
    ],
    autonomyLevel: "human_only",
    metrics: [
      { name: "Savings realized", target: ">$1M annual for enterprise", measurement: "Verified monthly savings * 12" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 6. YEAR 5 — HORIZON (2030): Infrastructure AGI Direction
// ═══════════════════════════════════════════════════════════════════════════

const YEAR_5: Milestone[] = [
  {
    id: "m-5.1",
    phase: "horizon",
    category: "intelligence",
    name: "Continuous Operational Reasoning",
    description: "Agent operates as a persistent reasoning process, not a batch scanner. Continuously observes, reasons about, and acts on infrastructure state changes in near-real-time.",
    status: "research",
    targetQuarter: "2030-Q1",
    dependencies: ["m-4.1", "m-4.2"],
    modules: ["cognitiveArchitecture.ts"],
    technicalRequirements: [
      "Event-driven observation (CloudTrail, Azure Activity, GCP Audit)",
      "Streaming reasoning pipeline",
      "Priority queue for action proposals",
      "Resource budget management for continuous processing",
    ],
    orgRequirements: [
      "Event streaming infrastructure (CloudTrail → agent)",
      "Compute budget for continuous agent operation",
    ],
    bottlenecks: [
      "Event volume at scale (millions/day) requires aggressive filtering",
      "Continuous reasoning costs real money",
    ],
    autonomyLevel: "agent_supervised",
    metrics: [
      { name: "Event-to-insight latency", target: "<5 minutes", measurement: "Time from cloud event to actionable recommendation" },
    ],
  },
  {
    id: "m-5.2",
    phase: "horizon",
    category: "autonomy",
    name: "Predictive Infrastructure Orchestration",
    description: "Agent anticipates infrastructure needs based on business signals (deploy calendar, traffic forecasts, seasonal patterns) and pre-provisions resources before demand arrives.",
    status: "research",
    targetQuarter: "2030-Q2",
    dependencies: ["m-5.1", "m-3.1", "m-4.3"],
    modules: [],
    technicalRequirements: [
      "Business signal ingestion (deploy pipelines, traffic data)",
      "Demand prediction models per service",
      "Pre-provisioning with cost-awareness",
      "Auto-scaling policy generation",
    ],
    orgRequirements: [
      "Business metrics accessible to agent",
      "Deploy calendar integration",
    ],
    bottlenecks: [
      "Business signals are noisy and hard to correlate with infra needs",
      "Over-provisioning wastes money; under-provisioning causes outages",
    ],
    autonomyLevel: "human_approved",
    metrics: [
      { name: "Prediction accuracy", target: ">80% of scaling events anticipated", measurement: "Pre-provisioned / total scaling events" },
    ],
  },
  {
    id: "m-5.3",
    phase: "horizon",
    category: "intelligence",
    name: "Multi-Agent Infrastructure Coordination",
    description: "Multiple specialized agents (cost, security, resilience, compliance) coordinate through a shared reasoning layer. Each agent has domain expertise; the coordinator resolves conflicts.",
    status: "research",
    targetQuarter: "2030-Q4",
    dependencies: ["m-5.1", "m-4.3"],
    modules: [],
    technicalRequirements: [
      "Agent specialization framework",
      "Conflict resolution protocol",
      "Shared working memory with access control",
      "Coordinator agent with veto power",
    ],
    orgRequirements: [
      "Organizational trust in multi-agent system",
      "Clear escalation paths for agent disagreements",
    ],
    bottlenecks: [
      "Agent coordination adds latency and complexity",
      "Debugging multi-agent interactions is extremely hard",
      "Trust is harder to build for systems humans can't fully trace",
    ],
    autonomyLevel: "agent_supervised",
    metrics: [
      { name: "Cross-domain optimization", target: ">20% better than single-agent", measurement: "Multi-agent recommendations vs single-agent baseline" },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 7. THINGS THAT SHOULD NEVER BE FULLY AUTONOMOUS
// ═══════════════════════════════════════════════════════════════════════════

export const NEVER_FULLY_AUTONOMOUS: NeverAutomate[] = [
  {
    domain: "Production database deletion or migration",
    reason: "Data loss is irreversible. No amount of verification eliminates the risk of wrong-database mistakes.",
    humanRole: "Approve every production database operation. Verify backup freshness before migration.",
    agentRole: "Generate migration plan, verify backups exist, run in staging first, present risk analysis.",
  },
  {
    domain: "Security policy changes (IAM, firewall, encryption)",
    reason: "Security misconfigurations have unbounded blast radius and may not be detectable until exploited.",
    humanRole: "Review and approve all security policy changes. Verify compliance impact.",
    agentRole: "Detect overly permissive policies, generate least-privilege recommendations, flag drift.",
  },
  {
    domain: "Commitment purchases (Reserved Instances, Savings Plans)",
    reason: "Financial commitments are binding for 1-3 years. Wrong purchases waste hundreds of thousands of dollars.",
    humanRole: "Approve all commitment purchases. Validate utilization projections.",
    agentRole: "Analyze usage patterns, model commitment scenarios, recommend optimal portfolio.",
  },
  {
    domain: "Cross-region or cross-cloud data movement",
    reason: "Data sovereignty, egress costs, and compliance requirements make this a legal and financial decision.",
    humanRole: "Approve data movement. Verify compliance with data residency requirements.",
    agentRole: "Identify migration candidates, estimate costs and latency impact, flag compliance constraints.",
  },
  {
    domain: "Autonomy level changes",
    reason: "Self-promoting autonomy is the definition of unsafe AI behavior. Trust must be granted, never taken.",
    humanRole: "Review agent track record and explicitly promote or demote autonomy level.",
    agentRole: "Report performance metrics, flag when track record supports promotion, accept demotion on incidents.",
  },
  {
    domain: "Incident response for novel failures",
    reason: "Unknown failure modes require creative problem-solving and business context that agents lack.",
    humanRole: "Lead incident response. Make judgment calls about tradeoffs.",
    agentRole: "Provide context from memory (similar past incidents, recent changes), suggest rehearsed mitigations, gather diagnostics.",
  },
  {
    domain: "Organizational policy definition",
    reason: "Policies reflect business values, risk appetite, and regulatory requirements — not technical optimization.",
    humanRole: "Define governance policies, compliance requirements, and risk tolerance.",
    agentRole: "Suggest policy templates based on industry, flag gaps in coverage, evaluate policy effectiveness.",
  },
  {
    domain: "Multi-tenant data access decisions",
    reason: "Cross-tenant data access is a privacy and legal boundary that must never be crossed algorithmically.",
    humanRole: "Define tenant isolation policies. Audit cross-tenant access attempts.",
    agentRole: "Enforce tenant isolation. Flag potential leakage. Never access cross-tenant data without explicit admin override.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 8. KNOWN BOTTLENECKS
// ═══════════════════════════════════════════════════════════════════════════

export const BOTTLENECKS: Bottleneck[] = [
  {
    id: "b-1",
    category: "trust_building",
    description: "Earning customer trust for write operations takes 3-6 months of flawless read-only operation per org",
    affectedMilestones: ["m-1.4", "m-3.3", "m-4.2"],
    mitigation: "Start read-only. Graduate to dry-run. Then non-prod writes. Then prod writes. Each stage builds evidence.",
    severity: "blocking",
  },
  {
    id: "b-2",
    category: "provider_api",
    description: "Cloud provider APIs are inconsistent, rate-limited, and sometimes wrong. Each provider has different semantics for 'the same' operation.",
    affectedMilestones: ["m-2.1", "m-2.2", "m-2.3"],
    mitigation: "Abstraction layer in cloudSnapshot.ts. Provider-specific handlers behind unified interface. Extensive integration testing.",
    severity: "significant",
  },
  {
    id: "b-3",
    category: "data_quality",
    description: "Infrastructure snapshots are point-in-time. Fast-changing environments (auto-scaling, spot instances) may have stale data by the time the agent acts.",
    affectedMilestones: ["m-1.4", "m-5.1"],
    mitigation: "Pre-execution resource state verification. Optimistic concurrency with retry. Event-driven updates in Year 5.",
    severity: "significant",
  },
  {
    id: "b-4",
    category: "org_adoption",
    description: "Enterprise adoption requires SSO, audit logging, compliance certifications (SOC2, ISO27001), and procurement cycles",
    affectedMilestones: ["m-3.4", "m-4.4"],
    mitigation: "Build compliance infrastructure in parallel. SOC2 Type II by Year 2.",
    severity: "significant",
  },
  {
    id: "b-5",
    category: "technical_complexity",
    description: "Multi-agent coordination (Year 5) is an unsolved research problem. No production system has done this well for infrastructure.",
    affectedMilestones: ["m-5.3"],
    mitigation: "Start with specialization without coordination. Add coordination incrementally. Keep single-agent as fallback.",
    severity: "blocking",
  },
  {
    id: "b-6",
    category: "regulatory",
    description: "EU AI Act and emerging AI regulations may require explainability, human oversight, and risk classification for autonomous infrastructure agents.",
    affectedMilestones: ["m-3.3", "m-4.2", "m-5.2"],
    mitigation: "Explainability engine already built. Every action has rationale and evidence. Audit trail from day one.",
    severity: "manageable",
  },
  {
    id: "b-7",
    category: "cost",
    description: "Continuous reasoning (Year 5) costs real compute. At scale, the agent's own infrastructure cost becomes a line item.",
    affectedMilestones: ["m-5.1", "m-5.3"],
    mitigation: "Agent must demonstrate ROI > cost. Start with batch, move to event-driven, only go continuous where justified.",
    severity: "manageable",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 9. CAPABILITY PROGRESSION MATRIX
// ═══════════════════════════════════════════════════════════════════════════

export type CapabilityLevel = "none" | "basic" | "intermediate" | "advanced" | "expert";

export type CapabilityProgression = {
  capability: string;
  year1: CapabilityLevel;
  year2: CapabilityLevel;
  year3: CapabilityLevel;
  year4: CapabilityLevel;
  year5: CapabilityLevel;
};

export const CAPABILITY_MATRIX: CapabilityProgression[] = [
  { capability: "AWS Operations",           year1: "intermediate", year2: "advanced",     year3: "expert",        year4: "expert",        year5: "expert" },
  { capability: "Azure Operations",         year1: "none",         year2: "intermediate", year3: "advanced",      year4: "expert",        year5: "expert" },
  { capability: "GCP Operations",           year1: "none",         year2: "intermediate", year3: "advanced",      year4: "expert",        year5: "expert" },
  { capability: "Cost Optimization",        year1: "basic",        year2: "intermediate", year3: "advanced",      year4: "expert",        year5: "expert" },
  { capability: "Security Posture",         year1: "basic",        year2: "intermediate", year3: "intermediate",  year4: "advanced",      year5: "expert" },
  { capability: "Resilience Planning",      year1: "none",         year2: "basic",        year3: "intermediate",  year4: "advanced",      year5: "expert" },
  { capability: "Autonomous Execution",     year1: "none",         year2: "basic",        year3: "intermediate",  year4: "intermediate",  year5: "advanced" },
  { capability: "Predictive Intelligence",  year1: "none",         year2: "none",         year3: "basic",         year4: "intermediate",  year5: "advanced" },
  { capability: "Organizational Learning",  year1: "none",         year2: "basic",        year3: "intermediate",  year4: "advanced",      year5: "advanced" },
  { capability: "Self-Healing",             year1: "none",         year2: "none",         year3: "none",          year4: "basic",         year5: "intermediate" },
  { capability: "Multi-Agent Coordination", year1: "none",         year2: "none",         year3: "none",          year4: "none",          year5: "basic" },
  { capability: "CI/CD Integration",        year1: "none",         year2: "none",         year3: "basic",         year4: "intermediate",  year5: "advanced" },
];

// ═══════════════════════════════════════════════════════════════════════════
// 10. FULL ROADMAP EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export const FULL_ROADMAP: Milestone[] = [
  ...YEAR_1,
  ...YEAR_2,
  ...YEAR_3,
  ...YEAR_4,
  ...YEAR_5,
];

export function getRoadmapByPhase(phase: RoadmapPhase): Milestone[] {
  return FULL_ROADMAP.filter((m) => m.phase === phase);
}

export function getRoadmapByCategory(category: MilestoneCategory): Milestone[] {
  return FULL_ROADMAP.filter((m) => m.category === category);
}

export function getRoadmapProgress(): {
  total: number;
  completed: number;
  inProgress: number;
  planned: number;
  research: number;
  percentComplete: number;
} {
  const total = FULL_ROADMAP.length;
  const completed = FULL_ROADMAP.filter((m) => m.status === "completed").length;
  const inProgress = FULL_ROADMAP.filter((m) => m.status === "in_progress").length;
  const planned = FULL_ROADMAP.filter((m) => m.status === "planned").length;
  const research = FULL_ROADMAP.filter((m) => m.status === "research").length;
  return {
    total,
    completed,
    inProgress,
    planned,
    research,
    percentComplete: Math.round((completed / total) * 100),
  };
}

export function getBlockingBottlenecks(): Bottleneck[] {
  return BOTTLENECKS.filter((b) => b.severity === "blocking");
}

export function getMilestoneById(id: string): Milestone | undefined {
  return FULL_ROADMAP.find((m) => m.id === id);
}

export function getDependencyChain(milestoneId: string): Milestone[] {
  const chain: Milestone[] = [];
  const visited = new Set<string>();

  function walk(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const m = getMilestoneById(id);
    if (!m) return;
    for (const dep of m.dependencies) {
      walk(dep);
    }
    chain.push(m);
  }

  walk(milestoneId);
  return chain;
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. TESTS
// ═══════════════════════════════════════════════════════════════════════════

export type RoadmapTestResult = { name: string; passed: boolean; detail: string };

export function runRoadmapTests(): RoadmapTestResult[] {
  const results: RoadmapTestResult[] = [];

  function assert(name: string, fn: () => boolean, detail: string) {
    try {
      results.push({ name, passed: fn(), detail });
    } catch (e) {
      results.push({ name, passed: false, detail: `threw: ${e}` });
    }
  }

  // Test 1: All milestones have unique IDs
  const ids = FULL_ROADMAP.map((m) => m.id);
  assert("unique IDs", () => new Set(ids).size === ids.length, `total=${ids.length}, unique=${new Set(ids).size}`);

  // Test 2: All dependencies reference valid milestones
  const validIds = new Set(ids);
  const badDeps = FULL_ROADMAP.flatMap((m) => m.dependencies.filter((d) => !validIds.has(d)));
  assert("valid dependencies", () => badDeps.length === 0, `bad deps: ${badDeps.join(", ") || "none"}`);

  // Test 3: No circular dependencies
  function hasCycle(): boolean {
    const visited = new Set<string>();
    const inStack = new Set<string>();
    function dfs(id: string): boolean {
      if (inStack.has(id)) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      inStack.add(id);
      const m = getMilestoneById(id);
      for (const dep of m?.dependencies ?? []) {
        if (dfs(dep)) return true;
      }
      inStack.delete(id);
      return false;
    }
    return FULL_ROADMAP.some((m) => dfs(m.id));
  }
  assert("no cycles", () => !hasCycle(), "dependency graph is acyclic");

  // Test 4: Every phase has milestones
  const phases: RoadmapPhase[] = ["mvp", "near_term", "mid_term", "long_term", "horizon"];
  for (const phase of phases) {
    const count = getRoadmapByPhase(phase).length;
    assert(`phase ${phase} has milestones`, () => count > 0, `count=${count}`);
  }

  // Test 9: Progress computes correctly
  const progress = getRoadmapProgress();
  assert("progress computes", () =>
    progress.total === FULL_ROADMAP.length && progress.percentComplete >= 0 && progress.percentComplete <= 100,
    `total=${progress.total}, pct=${progress.percentComplete}%`);

  // Test 10: Never-autonomous list is non-empty
  assert("never-autonomous defined", () => NEVER_FULLY_AUTONOMOUS.length >= 5,
    `count=${NEVER_FULLY_AUTONOMOUS.length}`);

  // Test 11: Bottlenecks reference valid milestones
  const badBottlenecks = BOTTLENECKS.flatMap((b) => b.affectedMilestones.filter((m) => !validIds.has(m)));
  assert("bottleneck milestones valid", () => badBottlenecks.length === 0,
    `bad refs: ${badBottlenecks.join(", ") || "none"}`);

  // Test 12: Capability matrix covers all 5 years
  assert("capability matrix complete", () =>
    CAPABILITY_MATRIX.every((c) => c.year1 && c.year2 && c.year3 && c.year4 && c.year5),
    `capabilities=${CAPABILITY_MATRIX.length}`);

  // Test 13: Dependency chain resolves
  const chain = getDependencyChain("m-5.3");
  assert("dependency chain resolves", () => chain.length > 1 && chain[chain.length - 1].id === "m-5.3",
    `chain length=${chain.length}`);

  // Test 14: Blocking bottlenecks identified
  const blocking = getBlockingBottlenecks();
  assert("blocking bottlenecks found", () => blocking.length > 0,
    `blocking=${blocking.length}`);

  // Test 15: Autonomy never exceeds agent_supervised for Year 1
  const y1Autonomy = YEAR_1.every((m) =>
    m.autonomyLevel !== "agent_autonomous" &&
    (m.autonomyLevel !== "agent_supervised"),
  );
  assert("year 1 autonomy constrained", () => y1Autonomy,
    `all year 1 milestones are human_only or human_approved or agent_with_guardrails`);

  return results;
}
