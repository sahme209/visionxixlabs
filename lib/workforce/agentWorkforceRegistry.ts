/**
 * AI Workforce Registry — canonical source of truth for every agent
 * "engineer" the platform ships.
 *
 * Each entry binds a kernel module to a role, department, product layer,
 * and the dependencies that make it work (connectors, tools, desktop
 * runtime, IDE/CLI, backend services, approval rules, missing pieces).
 *
 * Why this matters:
 *   - The platform now has ~30 kernels with overlapping purposes; this
 *     registry is where we name a single canonical engineer per role
 *     and mark duplicates.
 *   - The /dashboard/workforce client page renders ONLY engineers tagged
 *     productLayer === "client".
 *   - The /admin/workforce-audit page renders the internal-only agents
 *     (marketing, sales, lead research) — never leaks into client UI.
 *
 * Pure types + a static catalog — no persistence today.
 */

import "server-only";

// ---------------------------------------------------------------------------
// Closed-union taxonomy
// ---------------------------------------------------------------------------

export type WorkforceDepartment =
  | "perception"
  | "reasoning"
  | "planning"
  | "safety"
  | "verification"
  | "memory"
  | "workflow"
  | "devops"
  | "database"
  | "security"
  | "finops"
  | "observability"
  | "incident_response"
  | "marketing"      // internal layer only
  | "sales";         // internal layer only

export type AgentProductLayer = "client" | "internal_admin";

export type ToolDependency =
  | "workspace_observability"
  | "service_catalog"
  | "audit_fabric"
  | "approval_engine"
  | "telemetry_ingest"
  | "ai_provider_chain"
  | "agent_bus"
  | "memory_store"
  | "trace_store"
  | "alert_engine"
  | "incident_store"
  | "security_findings"
  | "compliance_catalog"
  | "social_drafts_store"
  | "outreach_drafts_store"
  | "lead_research_store";

export type ConnectorDependency =
  | "aws" | "azure" | "gcp"
  | "github" | "gitlab" | "azure_devops"
  | "slack" | "msteams" | "outlook"
  | "kubernetes" | "docker" | "terraform"
  | "dynatrace" | "grafana" | "prometheus" | "datadog" | "new_relic" | "splunk"
  | "wiz" | "snyk" | "prisma_cloud" | "crowdstrike"
  | "pagerduty" | "opsgenie" | "servicenow"
  | "linkedin_api" | "x_api"
  | "linear" | "jira"
  | "stripe"
  | "postgres" | "mysql" | "mongodb" | "redis"
  | "desktop_runtime";

export type ApprovalRule =
  | "no_approval_needed"
  | "single_approver"
  | "two_step_approval"
  | "incident_commander_only"
  | "blocked_always";

// ---------------------------------------------------------------------------
// Engineer record
// ---------------------------------------------------------------------------

export interface AgentEngineer {
  /** Stable id used in UI keys and audit logs. */
  id: string;
  /** Engineer-style display name. */
  displayName: string;
  /** One-line description of what this engineer does. */
  role: string;
  department: WorkforceDepartment;
  productLayer: AgentProductLayer;
  /** Kernel modules in lib/agents/ that implement this engineer. */
  kernelModules: readonly string[];
  /** Sub-tools / modules this engineer plugs into. */
  requiredTools: readonly ToolDependency[];
  /** External connectors the engineer needs to do its job. */
  requiredConnectors: readonly ConnectorDependency[];
  /** Workspace permissions the engineer needs granted. */
  requiredPermissions: readonly string[];
  /** Whether this engineer requires the paired desktop app for local execution. */
  requiresDesktopApp: boolean;
  /** Whether this engineer is surfaced through the CLI. */
  cliExposed: boolean;
  /** Whether this engineer is surfaced through the IDE extension. */
  ideExposed: boolean;
  /** Backend services that must be running for this engineer to function. */
  requiredBackendServices: readonly string[];
  /** Named automation workflows that drive this engineer. */
  automationWorkflows: readonly string[];
  /** Highest-risk action this engineer can stage — drives approval rule. */
  highestRiskAction: string;
  approvalRule: ApprovalRule;
  /** Audit log topics this engineer writes to. */
  auditTopics: readonly string[];
  /** Implementation gaps — what's missing today. Honest. */
  missingPieces: readonly string[];
  /**
   * Canonical id this engineer supersedes / duplicates. When set, the
   * UI shows a "consolidated into" banner on the duplicate so we don't
   * keep building both forever.
   */
  supersedes?: readonly string[];
}

// ---------------------------------------------------------------------------
// Registry — single source of truth
// ---------------------------------------------------------------------------

export const AGENT_WORKFORCE_REGISTRY: readonly AgentEngineer[] = [
  // ---------- PERCEPTION ----------
  {
    id: "detector_engineer",
    displayName: "Detector Engineer",
    role: "Watches every connected telemetry source and emits typed signals onto the bus.",
    department: "perception",
    productLayer: "client",
    kernelModules: ["detectorSignalEmitter", "agentActivityAggregator"],
    requiredTools: ["telemetry_ingest", "agent_bus", "audit_fabric"],
    requiredConnectors: ["aws", "azure", "gcp"],
    requiredPermissions: ["telemetry:read", "bus:publish"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["telemetry_ingest_worker", "agent_bus"],
    automationWorkflows: ["continuous_signal_emission"],
    highestRiskAction: "Emit derived signal to bus (read-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["signal.emitted"],
    missingPieces: ["Cross-connector signal correlation kernel not yet shipped"],
  },

  // ---------- REASONING ----------
  {
    id: "reasoner_engineer",
    displayName: "Reasoner Engineer",
    role: "Weaves multiple signals into a typed hypothesis with confidence and expected next agents.",
    department: "reasoning",
    productLayer: "client",
    kernelModules: ["reasonerHypothesisWeaver"],
    requiredTools: ["agent_bus", "ai_provider_chain", "memory_store"],
    requiredConnectors: [],
    requiredPermissions: ["bus:subscribe", "ai:invoke"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: ["reasoner_worker", "agent_bus"],
    automationWorkflows: ["signal_to_hypothesis_loop"],
    highestRiskAction: "Publish hypothesis (read-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["hypothesis.published"],
    missingPieces: ["Confidence calibration history not yet persisted"],
  },
  {
    id: "simulator_engineer",
    displayName: "Simulator Engineer",
    role: "Runs the proposed action in a sandbox and returns a verdict before any approval packet is built.",
    department: "reasoning",
    productLayer: "client",
    kernelModules: ["simulatorSandboxSpec"],
    requiredTools: ["agent_bus", "trace_store"],
    requiredConnectors: ["aws", "azure", "gcp", "terraform"],
    requiredPermissions: ["sandbox:run", "trace:write"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: ["simulator_worker"],
    automationWorkflows: ["pre_approval_simulation"],
    highestRiskAction: "Simulate action in sandbox (no real mutation)",
    approvalRule: "no_approval_needed",
    auditTopics: ["simulation.completed"],
    missingPieces: ["Kubernetes manifest dry-run simulator missing", "Database migration shadow-replay missing"],
  },
  {
    id: "council_engineer",
    displayName: "Council Engineer",
    role: "Weighted-vote consensus across the planning and safety agents (⅔ default).",
    department: "reasoning",
    productLayer: "client",
    kernelModules: ["council", "multiAgentDebate"],
    requiredTools: ["agent_bus", "audit_fabric"],
    requiredConnectors: [],
    requiredPermissions: ["bus:subscribe", "vote:cast"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["council_worker"],
    automationWorkflows: ["consensus_vote"],
    highestRiskAction: "Cast weighted vote (read-only verdict)",
    approvalRule: "no_approval_needed",
    auditTopics: ["council.voted"],
    missingPieces: [],
  },
  {
    id: "meta_reasoner_engineer",
    displayName: "Meta-Reasoner Engineer",
    role: "Reasons about WHY agents disagreed and suggests a resolution.",
    department: "reasoning",
    productLayer: "client",
    kernelModules: ["metaReasonerKernel"],
    requiredTools: ["agent_bus", "ai_provider_chain", "memory_store"],
    requiredConnectors: [],
    requiredPermissions: ["bus:subscribe"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["meta_reasoner_worker"],
    automationWorkflows: ["dispute_resolution"],
    highestRiskAction: "Surface dispute summary (read-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["meta.dispute_resolved"],
    missingPieces: [],
  },

  // ---------- PLANNING ----------
  {
    id: "spec_writer_engineer",
    displayName: "Spec Writer Engineer",
    role: "Drafts typed engineering specs (goals, non-goals, risks, verification, rollback) from problem statements.",
    department: "planning",
    productLayer: "client",
    kernelModules: ["specWriter"],
    requiredTools: ["ai_provider_chain"],
    requiredConnectors: ["github"],
    requiredPermissions: ["repo:read (per-folder)", "ai:invoke"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: [],
    automationWorkflows: ["draft_spec_from_intent"],
    highestRiskAction: "Produce spec document (read-only artifact)",
    approvalRule: "no_approval_needed",
    auditTopics: ["spec.drafted"],
    missingPieces: ["Spec → PR description auto-link not yet wired"],
  },
  {
    id: "test_coverage_engineer",
    displayName: "Test Coverage Engineer",
    role: "Reads diffs and proposes must-have / should-have / nice-to-have tests.",
    department: "planning",
    productLayer: "client",
    kernelModules: ["testCoverageProposer"],
    requiredTools: ["ai_provider_chain"],
    requiredConnectors: ["github"],
    requiredPermissions: ["repo:read (PR diffs)"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: [],
    automationWorkflows: ["pr_test_coverage_review"],
    highestRiskAction: "Suggest test cases (read-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["coverage.proposed"],
    missingPieces: ["Code-coverage-aware ranking missing"],
  },
  {
    id: "refactor_engineer",
    displayName: "Refactor Engineer",
    role: "Topo-sorts a refactor with per-step safety verdict and rollback per step.",
    department: "planning",
    productLayer: "client",
    kernelModules: ["refactorSequencer"],
    requiredTools: ["ai_provider_chain", "agent_bus"],
    requiredConnectors: ["github"],
    requiredPermissions: ["repo:read"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: [],
    automationWorkflows: ["plan_refactor"],
    highestRiskAction: "Propose multi-step refactor (no writes)",
    approvalRule: "single_approver",
    auditTopics: ["refactor.proposed"],
    missingPieces: [],
  },
  {
    id: "migration_engineer",
    displayName: "Migration Engineer",
    role: "Builds multi-stage migration runbooks with backwards-compat windows and gate checks.",
    department: "planning",
    productLayer: "client",
    kernelModules: ["migrationCoordinator"],
    requiredTools: ["ai_provider_chain", "approval_engine"],
    requiredConnectors: ["github", "postgres", "mysql"],
    requiredPermissions: ["db:schema:read", "repo:read"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: [],
    automationWorkflows: ["plan_db_migration"],
    highestRiskAction: "Apply migration (approval-gated)",
    approvalRule: "two_step_approval",
    auditTopics: ["migration.proposed", "migration.applied"],
    missingPieces: ["Shadow-replay sandbox missing", "Postgres + MySQL connectors not yet shipped"],
  },
  {
    id: "improvement_engineer",
    displayName: "Improvement Engineer",
    role: "Reads recent audit + outcome rows and proposes method improvements.",
    department: "planning",
    productLayer: "client",
    kernelModules: ["improverProposalSynthesizer", "proposalVetter", "proposalImpactTracker", "methodProposalStore", "methodProposalModel"],
    requiredTools: ["agent_bus", "audit_fabric", "memory_store"],
    requiredConnectors: [],
    requiredPermissions: ["audit:read", "memory:write"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["improvement_worker"],
    automationWorkflows: ["weekly_improvement_cycle"],
    highestRiskAction: "Propose method change (review-only)",
    approvalRule: "single_approver",
    auditTopics: ["improvement.proposed", "improvement.accepted"],
    missingPieces: [],
  },
  {
    id: "intent_parser_engineer",
    displayName: "Intent Parser",
    role: "Parses operator natural-language intent into typed workflow steps.",
    department: "planning",
    productLayer: "client",
    kernelModules: ["intentParser", "aiWorkflowTranslator"],
    requiredTools: ["ai_provider_chain"],
    requiredConnectors: [],
    requiredPermissions: ["ai:invoke"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: [],
    automationWorkflows: ["intent_translation"],
    highestRiskAction: "Produce typed workflow step list",
    approvalRule: "no_approval_needed",
    auditTopics: ["intent.parsed"],
    missingPieces: ["Disambiguation prompt loop missing for low-confidence parses"],
    supersedes: ["aiWorkflowTranslator (consolidated into intent_parser_engineer)"],
  },

  // ---------- SAFETY ----------
  {
    id: "policy_gate_engineer",
    displayName: "Policy Gate Engineer",
    role: "Applies the tenant charter to every proposal — refuses anything outside operator-signed scope.",
    department: "safety",
    productLayer: "client",
    kernelModules: ["policyGateEvaluator"],
    requiredTools: ["agent_bus", "audit_fabric"],
    requiredConnectors: [],
    requiredPermissions: ["charter:read", "policy:evaluate"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["policy_gate_worker"],
    automationWorkflows: ["pre_action_policy_check"],
    highestRiskAction: "Refuse action (always allowed)",
    approvalRule: "blocked_always",
    auditTopics: ["policy.refused", "policy.allowed"],
    missingPieces: [],
  },
  {
    id: "boundary_gate_engineer",
    displayName: "Boundary Gate Engineer",
    role: "Classifies blast radius into closed-union severity tiers.",
    department: "safety",
    productLayer: "client",
    kernelModules: ["boundaryGateCatalog", "changeRiskAssessor"],
    requiredTools: ["service_catalog", "audit_fabric"],
    requiredConnectors: [],
    requiredPermissions: ["catalog:read"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["boundary_worker"],
    automationWorkflows: ["pre_action_blast_radius"],
    highestRiskAction: "Assign severity tier (read-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["boundary.classified"],
    missingPieces: [],
    supersedes: ["changeRiskAssessor (consolidated into boundary_gate_engineer)"],
  },
  {
    id: "approver_engineer",
    displayName: "Approver Engineer",
    role: "Assembles the approval packet the operator sees — the only gate that lets autonomy act.",
    department: "safety",
    productLayer: "client",
    kernelModules: ["approverPacketAssembler"],
    requiredTools: ["approval_engine", "audit_fabric"],
    requiredConnectors: [],
    requiredPermissions: ["approval:create"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: false,
    requiredBackendServices: ["approval_engine"],
    automationWorkflows: ["assemble_approval_packet"],
    highestRiskAction: "Stage action for approval (requires human sign-off)",
    approvalRule: "single_approver",
    auditTopics: ["approval.requested", "approval.granted", "approval.denied"],
    missingPieces: [],
  },
  {
    id: "secrets_hygiene_engineer",
    displayName: "Secrets Hygiene Scanner",
    role: "Scans repos + connectors for accidentally committed secrets and exposed keys.",
    department: "security",
    productLayer: "client",
    kernelModules: ["secretsHygieneScanner"],
    requiredTools: ["security_findings", "audit_fabric"],
    requiredConnectors: ["github", "gitlab", "aws", "azure", "gcp"],
    requiredPermissions: ["repo:read", "secrets:scan"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: ["security_scanner_worker"],
    automationWorkflows: ["nightly_secrets_scan"],
    highestRiskAction: "Open critical SecurityFinding (read-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["secrets.scanned", "secrets.finding_opened"],
    missingPieces: ["Live secret-revocation auto-action (currently surface-only)"],
  },
  {
    id: "compliance_engineer",
    displayName: "Compliance Engineer",
    role: "Maps observable platform state to SOC2 / ISO27001 / HIPAA / GDPR control evidence.",
    department: "security",
    productLayer: "client",
    kernelModules: ["complianceControlMapper"],
    requiredTools: ["compliance_catalog", "audit_fabric"],
    requiredConnectors: [],
    requiredPermissions: ["compliance:read", "audit:read"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["compliance_worker"],
    automationWorkflows: ["nightly_control_mapping"],
    highestRiskAction: "Write ComplianceCheck verdict (read-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["compliance.evaluated"],
    missingPieces: ["Evidence-pack export to PDF missing"],
  },

  // ---------- VERIFICATION ----------
  {
    id: "verifier_engineer",
    displayName: "Verifier Engineer",
    role: "Post-execution check — confirms the action achieved the expected outcome.",
    department: "verification",
    productLayer: "client",
    kernelModules: ["verifierPostExecChecker"],
    requiredTools: ["trace_store", "audit_fabric"],
    requiredConnectors: ["aws", "azure", "gcp"],
    requiredPermissions: ["trace:read"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["verifier_worker"],
    automationWorkflows: ["post_action_verification"],
    highestRiskAction: "Write verification verdict (read-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["verification.completed"],
    missingPieces: [],
  },
  {
    id: "auditor_engineer",
    displayName: "Auditor Engineer",
    role: "Writes the durable sha-256 rationale row that makes the action replayable.",
    department: "verification",
    productLayer: "client",
    kernelModules: ["auditorRationaleWriter"],
    requiredTools: ["audit_fabric"],
    requiredConnectors: [],
    requiredPermissions: ["audit:write"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["audit_writer"],
    automationWorkflows: ["post_action_audit"],
    highestRiskAction: "Write rationale row (append-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["audit.rationale_written"],
    missingPieces: [],
  },

  // ---------- MEMORY ----------
  {
    id: "memory_consolidator_engineer",
    displayName: "Memory Consolidator",
    role: "Persists agent learning + proposal calibration over time so improvements compound.",
    department: "memory",
    productLayer: "client",
    kernelModules: ["agentMemoryConsolidator", "proposalCalibration", "confidenceCalibrator"],
    requiredTools: ["memory_store", "audit_fabric"],
    requiredConnectors: [],
    requiredPermissions: ["memory:read", "memory:write"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["memory_worker"],
    automationWorkflows: ["nightly_memory_consolidation"],
    highestRiskAction: "Write consolidated memory record",
    approvalRule: "no_approval_needed",
    auditTopics: ["memory.consolidated"],
    missingPieces: [],
    supersedes: ["proposalCalibration + confidenceCalibrator (consolidated into memory_consolidator_engineer)"],
  },

  // ---------- WORKFLOW ----------
  {
    id: "workflow_orchestrator_engineer",
    displayName: "Workflow Orchestrator",
    role: "Orchestrates multi-step agent flows end-to-end.",
    department: "workflow",
    productLayer: "client",
    kernelModules: ["axiomWorkflowExecutor", "agentWorkflowOrchestrator"],
    requiredTools: ["agent_bus", "audit_fabric", "approval_engine"],
    requiredConnectors: [],
    requiredPermissions: ["bus:publish", "workflow:execute"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: false,
    requiredBackendServices: ["workflow_engine"],
    automationWorkflows: ["multi_step_flow_execution"],
    highestRiskAction: "Execute approved workflow step",
    approvalRule: "single_approver",
    auditTopics: ["workflow.started", "workflow.completed", "workflow.step_executed"],
    missingPieces: [],
    supersedes: ["agentWorkflowOrchestrator (consolidated into axiomWorkflowExecutor → workflow_orchestrator_engineer)"],
  },
  {
    id: "operator_assistant_engineer",
    displayName: "Operator Assistant (Copilot)",
    role: "The operator-facing chat agent — answers questions and stages proposals.",
    department: "workflow",
    productLayer: "client",
    kernelModules: ["axiomAssistantAgent"],
    requiredTools: ["ai_provider_chain", "agent_bus", "memory_store"],
    requiredConnectors: ["aws", "azure", "gcp", "github"],
    requiredPermissions: ["ai:invoke", "bus:subscribe"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: ["copilot_worker"],
    automationWorkflows: ["operator_chat_loop"],
    highestRiskAction: "Stage proposal for approval (no direct writes)",
    approvalRule: "single_approver",
    auditTopics: ["copilot.queried", "copilot.proposed"],
    missingPieces: [],
  },

  // ---------- DEVOPS ----------
  {
    id: "pipeline_repair_engineer",
    displayName: "Pipeline Repair Engineer",
    role: "Reads failed GitHub Actions builds, explains the failure, drafts the fix.",
    department: "devops",
    productLayer: "client",
    kernelModules: ["githubPipelineRepairer"],
    requiredTools: ["ai_provider_chain", "approval_engine"],
    requiredConnectors: ["github", "azure_devops"],
    requiredPermissions: ["github:actions:read", "ci:logs:read"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: ["pipeline_worker"],
    automationWorkflows: ["failed_build_diagnosis"],
    highestRiskAction: "Apply pipeline fix (approval-gated)",
    approvalRule: "two_step_approval",
    auditTopics: ["pipeline.diagnosed", "pipeline.fix_applied"],
    missingPieces: ["GitLab + Jenkins parity missing"],
  },
  {
    id: "release_notes_engineer",
    displayName: "Release Notes Engineer",
    role: "Drafts release notes from merged commits and PR titles between two refs.",
    department: "devops",
    productLayer: "client",
    kernelModules: ["githubReleaseNotesDrafter"],
    requiredTools: ["ai_provider_chain"],
    requiredConnectors: ["github"],
    requiredPermissions: ["github:repo:read"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: [],
    automationWorkflows: ["release_tag_to_notes"],
    highestRiskAction: "Draft release notes (review-only)",
    approvalRule: "single_approver",
    auditTopics: ["release_notes.drafted"],
    missingPieces: [],
  },

  // ---------- DATABASE ----------
  {
    id: "schema_engineer",
    displayName: "Database Schema Engineer",
    role: "Reads schemas + recent slow queries, proposes index changes + migrations.",
    department: "database",
    productLayer: "client",
    kernelModules: ["databaseSchemaReviewer", "slowQueryProposer"],
    requiredTools: ["ai_provider_chain", "approval_engine"],
    requiredConnectors: ["postgres", "mysql"],
    requiredPermissions: ["db:schema:read", "db:slow_query:read"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: true,
    requiredBackendServices: ["db_advisor_worker"],
    automationWorkflows: ["weekly_schema_review"],
    highestRiskAction: "Apply index / schema migration (approval-gated)",
    approvalRule: "two_step_approval",
    auditTopics: ["schema.reviewed", "schema.change_applied"],
    missingPieces: ["MongoDB + Redis advisors missing", "Connectors not yet shipped"],
  },

  // ---------- FINOPS ----------
  {
    id: "finops_engineer",
    displayName: "FinOps Engineer",
    role: "Detects idle cloud resources + over-provisioned compute, drafts savings actions.",
    department: "finops",
    productLayer: "client",
    kernelModules: ["idleCloudResourceDetector"],
    requiredTools: ["service_catalog", "approval_engine"],
    requiredConnectors: ["aws", "azure", "gcp"],
    requiredPermissions: ["cloud:inventory:read", "billing:read"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["finops_worker"],
    automationWorkflows: ["nightly_idle_scan"],
    highestRiskAction: "Apply rightsize action (approval-gated)",
    approvalRule: "two_step_approval",
    auditTopics: ["finops.idle_detected", "finops.action_applied"],
    missingPieces: ["GCP + Azure parity behind AWS"],
  },

  // ---------- OBSERVABILITY ----------
  {
    id: "anomaly_engineer",
    displayName: "Anomaly Detection Engineer",
    role: "Detects anomalies in metrics + log volume against per-service baselines.",
    department: "observability",
    productLayer: "client",
    kernelModules: ["anomalyDetector"],
    requiredTools: ["telemetry_ingest", "alert_engine"],
    requiredConnectors: ["dynatrace", "grafana", "prometheus", "datadog"],
    requiredPermissions: ["telemetry:read", "alert:create"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["anomaly_worker"],
    automationWorkflows: ["continuous_anomaly_scan"],
    highestRiskAction: "Open AlertEvent (no mutation)",
    approvalRule: "no_approval_needed",
    auditTopics: ["anomaly.detected"],
    missingPieces: ["Observability connectors planned, not live"],
  },
  {
    id: "alert_noise_engineer",
    displayName: "Alert Noise Reducer",
    role: "Deduplicates + clusters incoming alerts; suppresses noise after confirming root cause overlap.",
    department: "observability",
    productLayer: "client",
    kernelModules: ["alertNoiseReducer"],
    requiredTools: ["alert_engine", "memory_store"],
    requiredConnectors: ["pagerduty", "opsgenie"],
    requiredPermissions: ["alert:read", "alert:suppress"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["alert_noise_worker"],
    automationWorkflows: ["alert_intake_dedup"],
    highestRiskAction: "Suppress incoming alert (revocable)",
    approvalRule: "single_approver",
    auditTopics: ["alert.suppressed", "alert.cluster_created"],
    missingPieces: ["PagerDuty + Opsgenie connectors not yet live"],
  },

  // ---------- INCIDENT RESPONSE ----------
  {
    id: "incident_engineer",
    displayName: "Incident Response Engineer",
    role: "Builds incident timelines from alerts + deploys + logs and drafts postmortems.",
    department: "incident_response",
    productLayer: "client",
    kernelModules: ["incidentTimelineWeaver", "postmortemDrafter"],
    requiredTools: ["incident_store", "trace_store", "ai_provider_chain"],
    requiredConnectors: ["pagerduty", "opsgenie", "servicenow", "slack", "msteams"],
    requiredPermissions: ["incident:read", "incident:write", "ai:invoke"],
    requiresDesktopApp: false,
    cliExposed: true,
    ideExposed: false,
    requiredBackendServices: ["incident_worker"],
    automationWorkflows: ["incident_open_to_postmortem"],
    highestRiskAction: "Publish postmortem (single-approver)",
    approvalRule: "single_approver",
    auditTopics: ["incident.timeline_built", "postmortem.drafted"],
    missingPieces: [],
  },

  // ============ INTERNAL VISIONXIXLABS-ONLY ============
  // None of the entries below are surfaced inside /dashboard/*.
  {
    id: "internal_marketing_content_engineer",
    displayName: "Marketing Content Engineer",
    role: "Drafts LinkedIn + X posts + blog outlines from VisionXIXLabs product changes.",
    department: "marketing",
    productLayer: "internal_admin",
    kernelModules: ["marketingContentDrafter"],
    requiredTools: ["ai_provider_chain", "social_drafts_store", "approval_engine"],
    requiredConnectors: ["linkedin_api", "x_api"],
    requiredPermissions: ["growth:write", "ai:invoke"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["growth_worker"],
    automationWorkflows: ["daily_content_workflow"],
    highestRiskAction: "Stage draft for approval (never auto-posts)",
    approvalRule: "two_step_approval",
    auditTopics: ["growth.draft_created"],
    missingPieces: ["LinkedIn + X OAuth not yet wired", "Per-post performance loop not yet wired"],
  },
  {
    id: "internal_social_scheduler_engineer",
    displayName: "Social Scheduler Engineer",
    role: "Schedules approved social drafts to LinkedIn + X within posting windows.",
    department: "marketing",
    productLayer: "internal_admin",
    kernelModules: ["socialPostScheduler"],
    requiredTools: ["social_drafts_store", "approval_engine"],
    requiredConnectors: ["linkedin_api", "x_api"],
    requiredPermissions: ["growth:publish"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["growth_worker", "scheduler_cron"],
    automationWorkflows: ["scheduled_publish"],
    highestRiskAction: "Publish to external social channel (post-approval only)",
    approvalRule: "two_step_approval",
    auditTopics: ["growth.scheduled", "growth.published"],
    missingPieces: ["OAuth + posting integration not yet live"],
  },
  {
    id: "internal_lead_research_engineer",
    displayName: "Lead Research Engineer",
    role: "Identifies target verticals, buyer personas, pain points, and outreach angles.",
    department: "sales",
    productLayer: "internal_admin",
    kernelModules: ["salesLeadEnricher", "contactResolutionAgent"],
    requiredTools: ["ai_provider_chain", "lead_research_store"],
    requiredConnectors: [],
    requiredPermissions: ["leads:read", "ai:invoke"],
    requiresDesktopApp: false,
    cliExposed: false,
    ideExposed: false,
    requiredBackendServices: ["lead_research_worker"],
    automationWorkflows: ["weekly_lead_research"],
    highestRiskAction: "Produce lead research records (review-only)",
    approvalRule: "no_approval_needed",
    auditTopics: ["lead_research.generated"],
    missingPieces: ["Auto-enrichment from public LinkedIn / website data missing (no scraping)"],
  },
];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function listClientEngineers(): readonly AgentEngineer[] {
  return AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client");
}

export function listInternalEngineers(): readonly AgentEngineer[] {
  return AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "internal_admin");
}

export function engineersByDepartment(layer: AgentProductLayer): readonly { dept: WorkforceDepartment; engineers: readonly AgentEngineer[] }[] {
  const list = AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === layer);
  const dept = new Map<WorkforceDepartment, AgentEngineer[]>();
  for (const e of list) {
    const arr = dept.get(e.department) ?? [];
    arr.push(e);
    dept.set(e.department, arr);
  }
  return Array.from(dept.entries()).map(([d, engineers]) => ({ dept: d, engineers }));
}

export function workforceSummary(): {
  total: number;
  clientLayer: number;
  internalLayer: number;
  withDuplicates: number;
  totalMissingPieces: number;
} {
  let withDuplicates = 0;
  let totalMissing = 0;
  for (const e of AGENT_WORKFORCE_REGISTRY) {
    if (e.supersedes && e.supersedes.length > 0) withDuplicates++;
    totalMissing += e.missingPieces.length;
  }
  return {
    total: AGENT_WORKFORCE_REGISTRY.length,
    clientLayer: AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "client").length,
    internalLayer: AGENT_WORKFORCE_REGISTRY.filter((e) => e.productLayer === "internal_admin").length,
    withDuplicates,
    totalMissingPieces: totalMissing,
  };
}
