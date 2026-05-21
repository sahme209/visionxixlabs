/**
 * Platform seed-demo data.
 *
 * Every record here is explicitly tagged `kind: "seed_demo"` and the
 * cockpit must render a visible "demo data" badge next to seeded rows.
 *
 * This is a deliberate stand-in until the corresponding Prisma models
 * land. Until then, the sub-tool detail, gaps, learning, automation,
 * desktop-agents, and model-registry pages read from this module so
 * the surfaces ship without forcing risky schema migrations.
 *
 * When the real models exist, swap the importers — the consumers are
 * already typed against these shapes.
 */

import type { SubToolDefinition } from "./subToolCatalog";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type GapSeverity = "info" | "warn" | "high" | "critical";

export type ApprovalState =
  | "pending"
  | "approved"
  | "applied"
  | "rejected"
  | "expired";

export type AutomationRunStatus =
  | "succeeded"
  | "running"
  | "failed"
  | "dry_run"
  | "awaiting_approval";

export type DesktopOS = "macos" | "windows" | "linux";

export type ModelStatus =
  | "approved"
  | "candidate"
  | "evaluating"
  | "rejected"
  | "installed";

export type LearningSource =
  | "approval_accepted"
  | "approval_rejected"
  | "incident_resolved"
  | "automation_failed"
  | "user_correction"
  | "agent_collaboration";

interface DemoRecord {
  kind: "seed_demo";
}

export interface DemoAutomationScript extends DemoRecord {
  id: string;
  name: string;
  language: "python" | "typescript" | "bash";
  subToolSlug: SubToolDefinition["slug"];
  category: string;
  purpose: string;
  requiredConnector: string;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  dryRunSupported: boolean;
  executionMode: "cloud" | "desktop";
  lastRunAt?: string; // ISO
  lastRunStatus?: AutomationRunStatus;
  ownerAgentModule: string;
}

export interface DemoAutomationRun extends DemoRecord {
  id: string;
  scriptId: string;
  scriptName: string;
  status: AutomationRunStatus;
  startedAt: string;
  durationMs: number;
  riskLevel: RiskLevel;
  approverEmail?: string;
  rollbackNote?: string;
  outputSummary: string;
}

export interface DemoDesktopAgent extends DemoRecord {
  id: string;
  hostname: string;
  os: DesktopOS;
  appVersion: string;
  userEmail: string;
  lastSeenAt: string;
  status: "online" | "stale" | "paused";
  localCapabilities: readonly string[];
  pendingTasks: number;
  completedToday: number;
  installedModels: readonly string[];
}

export interface DemoLocalModel extends DemoRecord {
  id: string;
  name: string;
  source: "open_source" | "vendor" | "internal";
  license: string;
  modelType: "coding" | "reasoning" | "embedding" | "log_analysis" | "doc";
  parameterCount: string;
  hardware: string;
  mode: "local" | "cloud" | "hybrid";
  status: ModelStatus;
  evaluationScore?: number; // 0..1
  riskLevel: RiskLevel;
  supportedAgents: readonly string[];
  notes?: string;
}

export interface DemoGapFinding extends DemoRecord {
  id: string;
  title: string;
  subToolSlug: SubToolDefinition["slug"];
  category: string;
  severity: GapSeverity;
  detectedByAgent: string;
  evidence: string;
  recommendation: string;
  automationAvailable: boolean;
  approvalRequired: boolean;
  detectedAt: string;
  status: "open" | "scheduled" | "resolved" | "ignored";
}

export interface DemoLearningEvent extends DemoRecord {
  id: string;
  source: LearningSource;
  agentModule: string;
  subToolSlug: SubToolDefinition["slug"];
  confidence: number; // 0..1
  evidence: string;
  recommendation: string;
  humanApproved: boolean;
  applied: boolean;
  occurredAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// Seed data — every row clearly tagged `kind: "seed_demo"`.
// ─────────────────────────────────────────────────────────────────────

export const DEMO_SCRIPTS: readonly DemoAutomationScript[] = [
  { kind: "seed_demo", id: "scr-001", name: "AWS backup coverage scan",      language: "python",     subToolSlug: "cloud-ops",        category: "aws_backup_scan",       purpose: "Inventory backup configurations across RDS, EBS, DynamoDB.",                          requiredConnector: "aws",      riskLevel: "low",      approvalRequired: false, dryRunSupported: true,  executionMode: "cloud",   lastRunAt: "2026-05-21T06:14:00Z", lastRunStatus: "succeeded",        ownerAgentModule: "detectorSignalEmitter" },
  { kind: "seed_demo", id: "scr-002", name: "GitHub pipeline failure triage", language: "typescript", subToolSlug: "devops",           category: "pipeline_repair",       purpose: "Cluster recent failed runs and propose a triage note per cluster.",                  requiredConnector: "github",   riskLevel: "low",      approvalRequired: false, dryRunSupported: true,  executionMode: "cloud",   lastRunAt: "2026-05-21T03:42:00Z", lastRunStatus: "succeeded",        ownerAgentModule: "reasonerHypothesisWeaver" },
  { kind: "seed_demo", id: "scr-003", name: "Terraform plan + approve",       language: "python",     subToolSlug: "cloud-ops",        category: "terraform_plan_apply",  purpose: "Generate a plan, attach to an approval packet, apply on approval.",                  requiredConnector: "aws",      riskLevel: "high",     approvalRequired: true,  dryRunSupported: true,  executionMode: "cloud",   lastRunAt: "2026-05-20T19:11:00Z", lastRunStatus: "awaiting_approval",ownerAgentModule: "approverPacketAssembler" },
  { kind: "seed_demo", id: "scr-004", name: "Secret-in-repo scanner",         language: "python",     subToolSlug: "security",         category: "exposed_secret",        purpose: "Scan public + private repos for known secret patterns.",                              requiredConnector: "github",   riskLevel: "medium",   approvalRequired: false, dryRunSupported: true,  executionMode: "cloud",   lastRunAt: "2026-05-21T04:02:00Z", lastRunStatus: "succeeded",        ownerAgentModule: "detectorSignalEmitter" },
  { kind: "seed_demo", id: "scr-005", name: "IAM least-privilege proposal",   language: "python",     subToolSlug: "security",         category: "iam_least_priv",        purpose: "Diff effective vs. needed permissions per role; stage tightening proposal.",         requiredConnector: "aws",      riskLevel: "high",     approvalRequired: true,  dryRunSupported: true,  executionMode: "cloud",   lastRunAt: "2026-05-20T22:34:00Z", lastRunStatus: "awaiting_approval",ownerAgentModule: "policyGateEvaluator" },
  { kind: "seed_demo", id: "scr-006", name: "K8s upgrade plan",               language: "python",     subToolSlug: "infrastructure",   category: "k8s_upgrade_plan",      purpose: "Plan node + control-plane upgrade with workload risk per step.",                     requiredConnector: "kubernetes", riskLevel: "high",   approvalRequired: true,  dryRunSupported: true,  executionMode: "cloud",   lastRunAt: "2026-05-19T15:00:00Z", lastRunStatus: "dry_run",          ownerAgentModule: "refactorSequencer" },
  { kind: "seed_demo", id: "scr-007", name: "Slow-query audit",               language: "python",     subToolSlug: "database-ops",     category: "slow_query_audit",      purpose: "Read pg_stat_statements, rank top 20 by total time, propose indexes.",                requiredConnector: "postgresql", riskLevel: "low",  approvalRequired: false, dryRunSupported: true,  executionMode: "cloud",   ownerAgentModule: "specWriter" },
  { kind: "seed_demo", id: "scr-008", name: "Postmortem drafter",             language: "typescript", subToolSlug: "observability",    category: "postmortem_drafter",    purpose: "Build a post-incident timeline + draft postmortem from audit + traces.",              requiredConnector: "cloudwatch", riskLevel: "low",  approvalRequired: false, dryRunSupported: true,  executionMode: "cloud",   lastRunAt: "2026-05-20T08:15:00Z", lastRunStatus: "succeeded",        ownerAgentModule: "improverProposalSynthesizer" },
  { kind: "seed_demo", id: "scr-009", name: "Onboarding checklist generator", language: "typescript", subToolSlug: "hr",               category: "onboarding_checklist",  purpose: "Generate role-based onboarding checklist + IT access request draft.",                 requiredConnector: "slack",    riskLevel: "low",      approvalRequired: true,  dryRunSupported: true,  executionMode: "cloud",   ownerAgentModule: "axiomAssistantAgent" },
  { kind: "seed_demo", id: "scr-010", name: "Customer reply drafter",         language: "typescript", subToolSlug: "customer-support", category: "reply_drafter",         purpose: "Draft a customer reply from ticket context. Operator approves before send.",         requiredConnector: "outlook",  riskLevel: "medium",   approvalRequired: true,  dryRunSupported: true,  executionMode: "cloud",   lastRunAt: "2026-05-21T07:55:00Z", lastRunStatus: "awaiting_approval",ownerAgentModule: "axiomAssistantAgent" },
  { kind: "seed_demo", id: "scr-011", name: "Invoice reminder generator",     language: "typescript", subToolSlug: "finance",          category: "invoice_reminder",      purpose: "Draft polite reminder emails for overdue invoices.",                                  requiredConnector: "stripe",   riskLevel: "low",      approvalRequired: true,  dryRunSupported: true,  executionMode: "cloud",   ownerAgentModule: "axiomAssistantAgent" },
  { kind: "seed_demo", id: "scr-012", name: "Vendor renewal reminder",        language: "typescript", subToolSlug: "procurement",      category: "renewal_reminder",      purpose: "Surface vendor contracts expiring inside 60d, draft renewal email.",                  requiredConnector: "outlook",  riskLevel: "low",      approvalRequired: true,  dryRunSupported: true,  executionMode: "cloud",   ownerAgentModule: "axiomAssistantAgent" },
  { kind: "seed_demo", id: "scr-013", name: "Local Git repo audit",           language: "python",     subToolSlug: "devops",           category: "pipeline_repair",       purpose: "On a developer machine — analyse the local repo for stale branches + uncommitted work.", requiredConnector: "github",  riskLevel: "low",      approvalRequired: false, dryRunSupported: true,  executionMode: "desktop", lastRunAt: "2026-05-21T08:09:00Z", lastRunStatus: "succeeded",       ownerAgentModule: "axiomWorkflowExecutor" },
  { kind: "seed_demo", id: "scr-014", name: "Local Docker health check",      language: "bash",       subToolSlug: "infrastructure",   category: "k8s_upgrade_plan",      purpose: "Local Docker daemon + container state diagnostic.",                                   requiredConnector: "docker",   riskLevel: "low",      approvalRequired: false, dryRunSupported: true,  executionMode: "desktop", ownerAgentModule: "axiomWorkflowExecutor" },
];

export const DEMO_AUTOMATION_RUNS: readonly DemoAutomationRun[] = [
  { kind: "seed_demo", id: "run-1001", scriptId: "scr-001", scriptName: "AWS backup coverage scan",       status: "succeeded",         startedAt: "2026-05-21T06:14:00Z", durationMs: 38_241,  riskLevel: "low",      outputSummary: "32 resources scanned. 3 unprotected RDS instances surfaced — gap rows created." },
  { kind: "seed_demo", id: "run-1002", scriptId: "scr-003", scriptName: "Terraform plan + approve",       status: "awaiting_approval", startedAt: "2026-05-20T19:11:00Z", durationMs: 11_009,  riskLevel: "high",     outputSummary: "Plan attached to approval packet AP-2031. 4 resource changes, blast radius: account-scope.", rollbackNote: "terraform apply previous-state.tfstate" },
  { kind: "seed_demo", id: "run-1003", scriptId: "scr-005", scriptName: "IAM least-privilege proposal",   status: "awaiting_approval", startedAt: "2026-05-20T22:34:00Z", durationMs: 14_412,  riskLevel: "high",     outputSummary: "7 roles drift > 30% from effective use. Tightening proposal staged on AP-2032.", rollbackNote: "iam:PutRolePolicy with prior policy doc; saved." },
  { kind: "seed_demo", id: "run-1004", scriptId: "scr-008", scriptName: "Postmortem drafter",             status: "succeeded",         startedAt: "2026-05-20T08:15:00Z", durationMs:  9_881,  riskLevel: "low",      outputSummary: "Incident INC-509 timeline built. Postmortem draft ready for engineering review." },
  { kind: "seed_demo", id: "run-1005", scriptId: "scr-002", scriptName: "GitHub pipeline failure triage", status: "succeeded",         startedAt: "2026-05-21T03:42:00Z", durationMs:  4_022,  riskLevel: "low",      outputSummary: "23 failed runs clustered into 4 root causes. Triage notes posted to #eng-ci-fail." },
  { kind: "seed_demo", id: "run-1006", scriptId: "scr-010", scriptName: "Customer reply drafter",         status: "awaiting_approval", startedAt: "2026-05-21T07:55:00Z", durationMs:  2_138,  riskLevel: "medium",   approverEmail: "sam.awan91@gmail.com", outputSummary: "Drafted reply for ticket SUPP-4421. Awaiting operator approval before send." },
  { kind: "seed_demo", id: "run-1007", scriptId: "scr-013", scriptName: "Local Git repo audit",           status: "succeeded",         startedAt: "2026-05-21T08:09:00Z", durationMs:  7_512,  riskLevel: "low",      outputSummary: "Local audit on dev-mbp-04: 3 stale branches, no uncommitted work, .env tracked clean." },
  { kind: "seed_demo", id: "run-1008", scriptId: "scr-006", scriptName: "K8s upgrade plan",               status: "dry_run",           startedAt: "2026-05-19T15:00:00Z", durationMs: 22_004,  riskLevel: "high",     outputSummary: "Dry-run plan for prod-eks-01: 4 node-pool upgrades, 2 workload re-shedules. No mutation." },
];

export const DEMO_DESKTOP_AGENTS: readonly DemoDesktopAgent[] = [
  { kind: "seed_demo", id: "dev-101", hostname: "dev-mbp-04",      os: "macos",   appVersion: "0.4.2", userEmail: "sam.awan91@gmail.com",      lastSeenAt: "2026-05-21T08:21:00Z", status: "online", localCapabilities: ["git", "docker", "terraform", "aws-cli", "kubectl", "python", "node"], pendingTasks: 1, completedToday: 6, installedModels: ["mdl-coder-7b"] },
  { kind: "seed_demo", id: "dev-102", hostname: "ops-thinkpad-12", os: "windows", appVersion: "0.4.1", userEmail: "ops.lead@example.com",      lastSeenAt: "2026-05-21T07:42:00Z", status: "online", localCapabilities: ["git", "docker", "aws-cli", "azure-cli"],                            pendingTasks: 0, completedToday: 3, installedModels: [] },
  { kind: "seed_demo", id: "dev-103", hostname: "sre-ubuntu-03",   os: "linux",   appVersion: "0.4.2", userEmail: "sre.oncall@example.com",    lastSeenAt: "2026-05-20T19:15:00Z", status: "stale",  localCapabilities: ["git", "docker", "kubectl", "terraform", "python"],                   pendingTasks: 2, completedToday: 0, installedModels: ["mdl-coder-7b", "mdl-embed-tiny"] },
  { kind: "seed_demo", id: "dev-104", hostname: "build-runner-01", os: "linux",   appVersion: "0.4.0", userEmail: "ci@example.com",            lastSeenAt: "2026-05-21T08:30:00Z", status: "online", localCapabilities: ["git", "docker", "node", "python"],                                  pendingTasks: 0, completedToday: 14,installedModels: [] },
  { kind: "seed_demo", id: "dev-105", hostname: "ops-mbp-09",      os: "macos",   appVersion: "0.3.9", userEmail: "ops.intern@example.com",    lastSeenAt: "2026-05-21T08:05:00Z", status: "paused", localCapabilities: ["git", "aws-cli"],                                                    pendingTasks: 0, completedToday: 0, installedModels: [] },
];

export const DEMO_LOCAL_MODELS: readonly DemoLocalModel[] = [
  { kind: "seed_demo", id: "mdl-coder-7b",    name: "Open-Coder 7B",          source: "open_source", license: "Apache-2.0", modelType: "coding",        parameterCount: "7B",  hardware: "16 GB GPU or M2 + 32 GB RAM", mode: "local",  status: "approved",   evaluationScore: 0.74, riskLevel: "low",      supportedAgents: ["specWriter", "testCoverageProposer", "refactorSequencer"], notes: "Approved for code-drafting kernels only — never autonomous apply." },
  { kind: "seed_demo", id: "mdl-reason-13b",  name: "Open-Reason 13B",        source: "open_source", license: "Apache-2.0", modelType: "reasoning",     parameterCount: "13B", hardware: "24 GB GPU",                       mode: "hybrid", status: "candidate",  evaluationScore: 0.68, riskLevel: "medium",   supportedAgents: ["reasonerHypothesisWeaver", "improverProposalSynthesizer"] },
  { kind: "seed_demo", id: "mdl-embed-tiny",  name: "Tiny Embed",             source: "open_source", license: "MIT",        modelType: "embedding",     parameterCount: "33M", hardware: "CPU",                             mode: "local",  status: "installed",  evaluationScore: 0.81, riskLevel: "low",      supportedAgents: ["axiomAssistantAgent"], notes: "RAG index for /dashboard/sources." },
  { kind: "seed_demo", id: "mdl-log-3b",      name: "LogReader 3B",           source: "open_source", license: "Apache-2.0", modelType: "log_analysis",  parameterCount: "3B",  hardware: "8 GB GPU or M-series",            mode: "local",  status: "evaluating", evaluationScore: 0.51, riskLevel: "low",      supportedAgents: ["detectorSignalEmitter"], notes: "Held until eval score exceeds 0.7." },
  { kind: "seed_demo", id: "mdl-doc-7b",      name: "DocReader 7B",           source: "open_source", license: "Apache-2.0", modelType: "doc",           parameterCount: "7B",  hardware: "16 GB GPU",                       mode: "local",  status: "candidate",  evaluationScore: 0.62, riskLevel: "low",      supportedAgents: ["axiomAssistantAgent"] },
  { kind: "seed_demo", id: "mdl-vendor-pro",  name: "Vendor Cloud Pro",       source: "vendor",      license: "Commercial", modelType: "reasoning",     parameterCount: "≈200B", hardware: "Cloud API",                     mode: "cloud",  status: "approved",   evaluationScore: 0.88, riskLevel: "medium",   supportedAgents: ["reasonerHypothesisWeaver", "axiomAssistantAgent"], notes: "Cloud provider — operator approves every cloud invocation; redaction applied up front." },
  { kind: "seed_demo", id: "mdl-rejected-x",  name: "Unverified-7B",          source: "open_source", license: "non-commercial", modelType: "coding",    parameterCount: "7B",  hardware: "16 GB GPU",                       mode: "local",  status: "rejected",   evaluationScore: 0.31, riskLevel: "high",     supportedAgents: [], notes: "Rejected — license incompatible + below evaluation threshold." },
];

export const DEMO_GAPS: readonly DemoGapFinding[] = [
  { kind: "seed_demo", id: "gap-001", title: "RDS instance prod-db-02 has no automated backup", subToolSlug: "cloud-ops",        category: "missing_backup",      severity: "high",     detectedByAgent: "detectorSignalEmitter",     evidence: "rds:DescribeDBInstance returned BackupRetentionPeriod=0 on 2026-05-21T06:14Z.", recommendation: "Enable 7-day automated backup window via Terraform; staged proposal AP-2031.",                                                       automationAvailable: true,  approvalRequired: true,  detectedAt: "2026-05-21T06:14:00Z", status: "scheduled" },
  { kind: "seed_demo", id: "gap-002", title: "S3 bucket public-uploads is public",              subToolSlug: "security",         category: "public_resource",    severity: "critical", detectedByAgent: "detectorSignalEmitter",     evidence: "s3:GetBucketPolicyStatus returned IsPublic=true.",                                                                  recommendation: "Apply BlockPublicAcls + RestrictPublicBuckets via approval packet.",                                                                  automationAvailable: true,  approvalRequired: true,  detectedAt: "2026-05-21T05:48:00Z", status: "open" },
  { kind: "seed_demo", id: "gap-003", title: "IAM role build-runner-write drift > 30%",          subToolSlug: "security",         category: "weak_iam",            severity: "high",     detectedByAgent: "policyGateEvaluator",       evidence: "CloudTrail: 23 distinct actions called; policy grants 89 distinct actions.",                                          recommendation: "Tighten policy via IAM least-privilege proposal; AP-2032 awaiting approval.",                                                          automationAvailable: true,  approvalRequired: true,  detectedAt: "2026-05-20T22:34:00Z", status: "scheduled" },
  { kind: "seed_demo", id: "gap-004", title: "Pipeline 'main' flake rate 18%",                   subToolSlug: "devops",           category: "pipeline_flaky",      severity: "warn",     detectedByAgent: "reasonerHypothesisWeaver",  evidence: "23 failed runs / 128 total over the last 14d; clustered into 4 root causes.",                                       recommendation: "Auto-retry once for known transient failures; quarantine the timing-sensitive test.",                                                  automationAvailable: true,  approvalRequired: false, detectedAt: "2026-05-21T03:42:00Z", status: "open" },
  { kind: "seed_demo", id: "gap-005", title: "Alert 'cpu>80% 5m' fires 47x/day on prod-web",     subToolSlug: "observability",    category: "noisy_alert",         severity: "warn",     detectedByAgent: "improverProposalSynthesizer", evidence: "47 fires + 0 incidents created over the last 7d.",                                                                  recommendation: "Raise threshold to 90% for 10m and pair with request-error-rate predicate.",                                                            automationAvailable: true,  approvalRequired: false, detectedAt: "2026-05-20T11:09:00Z", status: "open" },
  { kind: "seed_demo", id: "gap-006", title: "Slow query 1.4s p95 on orders.customer_id lookup",  subToolSlug: "database-ops",     category: "no_index",            severity: "warn",     detectedByAgent: "specWriter",                evidence: "pg_stat_statements: total_exec_time = 12h over 30d; no index on customer_id.",                                       recommendation: "Add idx_orders_customer_id; migration drafted via migrationCoordinator.",                                                              automationAvailable: true,  approvalRequired: true,  detectedAt: "2026-05-20T17:22:00Z", status: "open" },
  { kind: "seed_demo", id: "gap-007", title: "EKS prod cluster on v1.27 (EOL 2026-07-24)",       subToolSlug: "infrastructure",   category: "k8s_eol",             severity: "high",     detectedByAgent: "boundaryGateCatalog",       evidence: "describeCluster returned version=1.27. AWS EKS EOL date: 2026-07-24.",                                              recommendation: "Plan upgrade to v1.30 in two control-plane + node-pool steps.",                                                                       automationAvailable: true,  approvalRequired: true,  detectedAt: "2026-05-19T15:00:00Z", status: "scheduled" },
  { kind: "seed_demo", id: "gap-008", title: "12 tickets open > 48h with no assignee",            subToolSlug: "it-support",       category: "unassigned_ticket",   severity: "warn",     detectedByAgent: "axiomAssistantAgent",       evidence: "Slack #it-help: 12 threads with no resolution emoji + no assignee posted in 48h.",                                  recommendation: "Auto-route to the on-call IT engineer; surface in /dashboard/help.",                                                                    automationAvailable: true,  approvalRequired: false, detectedAt: "2026-05-21T07:15:00Z", status: "open" },
  { kind: "seed_demo", id: "gap-009", title: "3 new hires missing onboarding step 'IAM access'",  subToolSlug: "hr",               category: "missing_onboarding_step", severity: "high", detectedByAgent: "axiomAssistantAgent",       evidence: "Onboarding checklist row 'IAM access' incomplete > 5d for 3 employees.",                                            recommendation: "Stage IT access requests; route through IT support approval.",                                                                          automationAvailable: true,  approvalRequired: true,  detectedAt: "2026-05-20T13:30:00Z", status: "open" },
  { kind: "seed_demo", id: "gap-010", title: "4 support tickets w/ SLA breach risk",              subToolSlug: "customer-support", category: "sla_breach",          severity: "high",     detectedByAgent: "axiomAssistantAgent",       evidence: "4 tickets > 22h with no operator reply; SLA = 24h.",                                                                recommendation: "Draft reply via reply_drafter; operator approves before send.",                                                                         automationAvailable: true,  approvalRequired: true,  detectedAt: "2026-05-21T07:55:00Z", status: "scheduled" },
  { kind: "seed_demo", id: "gap-011", title: "Invoice INV-3098 overdue 14 days",                   subToolSlug: "finance",          category: "overdue_invoice",     severity: "warn",     detectedByAgent: "axiomAssistantAgent",       evidence: "Stripe: invoice INV-3098 amount=$4,200, due 2026-05-07, status=open.",                                              recommendation: "Stage polite reminder email via invoice_reminder; operator approves.",                                                                  automationAvailable: true,  approvalRequired: true,  detectedAt: "2026-05-21T01:00:00Z", status: "open" },
  { kind: "seed_demo", id: "gap-012", title: "Vendor 'Acme Logging' contract expires in 18d",     subToolSlug: "procurement",      category: "expiring_vendor",     severity: "info",     detectedByAgent: "axiomAssistantAgent",       evidence: "Contract record indicates expiry 2026-06-08.",                                                                    recommendation: "Stage renewal reminder email; review vendor risk score before renew.",                                                                   automationAvailable: true,  approvalRequired: true,  detectedAt: "2026-05-21T02:30:00Z", status: "open" },
  { kind: "seed_demo", id: "gap-013", title: "Runbook 'rds-failover' last reviewed 9 months ago", subToolSlug: "documentation",    category: "stale_doc",           severity: "info",     detectedByAgent: "improverProposalSynthesizer", evidence: "Doc 'rds-failover.md' last_modified=2025-08-12; referenced in 4 recent incidents.",                                 recommendation: "Stage doc-refresh proposal — diff vs. recent incident learnings.",                                                                      automationAvailable: true,  approvalRequired: false, detectedAt: "2026-05-20T20:11:00Z", status: "open" },
];

export const DEMO_LEARNING_EVENTS: readonly DemoLearningEvent[] = [
  { kind: "seed_demo", id: "learn-001", source: "approval_accepted",   agentModule: "improverProposalSynthesizer", subToolSlug: "observability",    confidence: 0.82, evidence: "Operator approved 7/7 noisy-alert reductions in 14d.",                          recommendation: "Auto-stage alert-threshold proposals when fire rate > 30/d and incident-creation = 0.", humanApproved: true,  applied: true,  occurredAt: "2026-05-20T11:21:00Z" },
  { kind: "seed_demo", id: "learn-002", source: "approval_rejected",   agentModule: "policyGateEvaluator",         subToolSlug: "security",         confidence: 0.71, evidence: "Operator rejected 2/3 IAM tightening proposals where 'service' tag included 'experimental'.", recommendation: "Skip auto-staging for roles tagged service=experimental — surface as suggestion only.", humanApproved: true,  applied: true,  occurredAt: "2026-05-19T08:00:00Z" },
  { kind: "seed_demo", id: "learn-003", source: "incident_resolved",   agentModule: "reasonerHypothesisWeaver",    subToolSlug: "cloud-ops",        confidence: 0.66, evidence: "Incident INC-509 root cause: missing RDS backup on prod-db-02. Same gap pattern detected 3x in 30d.", recommendation: "Promote 'missing_backup' detector to fire on every new RDS instance creation.",          humanApproved: true,  applied: false, occurredAt: "2026-05-20T08:45:00Z" },
  { kind: "seed_demo", id: "learn-004", source: "automation_failed",   agentModule: "axiomWorkflowExecutor",       subToolSlug: "devops",           confidence: 0.55, evidence: "pipeline_repair run-997 failed: Azure DevOps token scope missing 'build.read'.",                  recommendation: "Surface scope check in connector setup; refuse to run scripts until scope granted.",     humanApproved: false, applied: false, occurredAt: "2026-05-19T19:34:00Z" },
  { kind: "seed_demo", id: "learn-005", source: "user_correction",     agentModule: "axiomAssistantAgent",         subToolSlug: "customer-support", confidence: 0.62, evidence: "Operator edited 5/6 drafted replies to remove the phrase 'apologise for the inconvenience'.",     recommendation: "Avoid that phrase in customer-reply drafts; learned style preference.",                  humanApproved: true,  applied: true,  occurredAt: "2026-05-20T16:00:00Z" },
  { kind: "seed_demo", id: "learn-006", source: "agent_collaboration", agentModule: "council",                     subToolSlug: "security",         confidence: 0.78, evidence: "Detector + reasoner + policy_gate agreed (3/3) on IAM tightening for build-runner-write.",          recommendation: "When all three agree at confidence > 0.7, stage approval packet automatically.",         humanApproved: true,  applied: false, occurredAt: "2026-05-20T22:38:00Z" },
];
