/**
 * Connector registry — single source of truth for every connector Axiom
 * supports today or plans to support. UI surfaces (Integrations Center,
 * onboarding wizard, command center, ReleaseOps, workflows) read from
 * this registry — connector status is never hardcoded inside components.
 */

// ---------------------------------------------------------------------------
// Taxonomy
// ---------------------------------------------------------------------------

export type ConnectorCategory =
  | "cloud"
  | "repository"
  | "ci_cd"
  | "iac"
  | "ticketing"
  | "incident"
  | "messaging"
  | "desktop"
  | "audit"
  | "identity"
  | "observability"   // Dynatrace, Grafana, Prometheus, Datadog, New Relic, Splunk
  | "logging"         // CloudWatch Logs, Azure Monitor Logs, GCP Logging, Splunk
  | "security_posture" // Wiz, Prisma Cloud, Snyk, CrowdStrike-style visibility
  | "database"        // PostgreSQL, MySQL, MongoDB, Redis, SQL Server
  | "container"       // Kubernetes, Docker
  | "edge";           // Cloudflare, CDN, DNS

export type ConnectorStatus = "live" | "preview" | "expanding" | "planned" | "unavailable";

export type AuthModel =
  | "iam_role"               // AWS IAM role + External ID
  | "service_principal"      // Azure SP
  | "service_account"        // GCP SA
  | "github_app"             // GitHub App installation
  | "oauth"                  // OAuth 2.0
  | "personal_token"         // PAT / API token
  | "service_connection"     // Azure DevOps service connection
  | "api_key"
  | "workload_identity"
  | "local_runtime"          // Desktop Tauri runtime
  | "webhook_signed";        // Inbound webhook with signed payload

// ---------------------------------------------------------------------------
// Connector record
// ---------------------------------------------------------------------------

export interface ConnectorRecord {
  id: string;
  name: string;
  description: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  /** ETA when status is "planned" or "expanding". */
  eta?: string;
  authModel: AuthModel;
  /** Minimum permissions required. */
  permissions: string[];
  /** What Axiom reads via this connector. */
  reads: string[];
  /** What Axiom does NOT read — honest negative space. */
  doesNotRead: string[];
  /** What Axiom can write via this connector (often empty for read-only). */
  writes: string[];
  /** Risk classification — informs UI emphasis. */
  riskLevel: "low" | "medium" | "high";
  /** Setup wizard route in the dashboard. */
  setupRoute?: string;
  /** Docs deep-link explaining setup. */
  docsRoute?: string;
  /** Dashboard surface showing live state (Command Center / ReleaseOps / etc.). */
  dashboardRoute?: string;
  /** Operational event kinds this connector emits. */
  supportedEvents: string[];
  /** Actions this connector can perform (often read-only). */
  supportedActions: string[];
  /** Current limitations honestly disclosed. */
  limitations: string[];
  /** Next planned milestones for the connector. */
  nextMilestones: string[];
  /** Trust + audit notes surfaced in setup UI. */
  enterpriseTrustNotes: string[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CONNECTOR_REGISTRY: ConnectorRecord[] = [
  // -------- CLOUD --------
  {
    id: "aws",
    name: "Amazon Web Services",
    description: "Cross-account IAM role assumption with External ID. Read-only by default; execution role opt-in per action class.",
    category: "cloud",
    status: "live",
    authModel: "iam_role",
    permissions: ["sts:AssumeRole", "ec2:Describe*", "s3:GetBucket*", "rds:Describe*", "iam:Get*/List*/Simulate*", "cloudwatch:Get*/List*", "ce:Get*", "tag:GetResources"],
    reads: ["EC2 inventory", "S3 configuration metadata", "RDS configuration", "IAM roles + policies", "CloudWatch metrics", "Cost Explorer signals", "VPC + network configuration"],
    doesNotRead: ["S3 object contents", "RDS row data", "Secrets Manager values", "KMS key material", "CloudTrail event history"],
    writes: ["Execution role only — opt-in per action class, approval-gated"],
    riskLevel: "low",
    setupRoute: "/operator/onboarding",
    docsRoute: "/docs/aws-setup",
    dashboardRoute: "/dashboard/command-center",
    supportedEvents: ["connector.connected", "connector.failed", "scan.completed", "scan.failed", "finding.created", "recommendation.created", "execution.applied", "rollback.executed"],
    supportedActions: ["scan", "snapshot", "execute_plan_with_approval", "rollback"],
    limitations: ["Initial scan can take 10-15 minutes on large accounts (1000+ resources)"],
    nextMilestones: ["Multi-account scan coordination", "Cost Explorer trend signals"],
    enterpriseTrustNotes: ["Read-only by default", "External ID prevents confused-deputy", "Credentials never stored — assume-role only", "Revocable by deleting the IAM role"],
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    description: "Service Principal connection. Scan + topology live; reasoning + execution rolling out Q2 2026.",
    category: "cloud",
    status: "expanding",
    eta: "Q2 2026 (reasoning + execution)",
    authModel: "service_principal",
    permissions: ["Reader (built-in)", "Custom role for Cost Management read", "Custom role for Activity Log read"],
    reads: ["VM inventory", "Storage account configuration", "VNet + NSG configuration", "IAM role assignments", "Activity Log metadata"],
    doesNotRead: ["Blob contents", "Key Vault secret values", "Application data", "User-level Azure AD data"],
    writes: ["Planned Q2 2026 — custom execution role per action class"],
    riskLevel: "low",
    setupRoute: "/operator/onboarding",
    docsRoute: "/docs/azure-setup",
    dashboardRoute: "/dashboard/topology",
    supportedEvents: ["connector.connected", "scan.completed", "drift.detected"],
    supportedActions: ["scan", "snapshot", "drift_detection"],
    limitations: ["Reasoning + execution not yet available — observation only"],
    nextMilestones: ["Q2 signal engine", "Q2 reasoning loop", "Q2 execution + approval", "Q2 rollback orchestration"],
    enterpriseTrustNotes: ["Federated identity preferred over client secret", "Subscription/resource-group scoped", "Revocable by removing role assignment"],
  },
  {
    id: "gcp",
    name: "Google Cloud Platform",
    description: "Service Account connection. Scan + topology live; reasoning + execution rolling out Q3 2026.",
    category: "cloud",
    status: "expanding",
    eta: "Q3 2026 (reasoning + execution)",
    authModel: "service_account",
    permissions: ["roles/viewer", "roles/iam.securityReviewer", "Custom Billing read", "Custom Audit Log read"],
    reads: ["Compute Engine inventory", "Cloud Storage configuration", "VPC + firewall rules", "IAM bindings", "Cloud Audit Log metadata"],
    doesNotRead: ["GCS object contents", "Secret Manager values", "BigQuery row data", "Workspace user data"],
    writes: ["Planned Q3 2026 — custom execution role per action class"],
    riskLevel: "low",
    setupRoute: "/operator/onboarding",
    docsRoute: "/docs/gcp-setup",
    dashboardRoute: "/dashboard/topology",
    supportedEvents: ["connector.connected", "scan.completed", "drift.detected"],
    supportedActions: ["scan", "snapshot", "drift_detection"],
    limitations: ["Reasoning + execution not yet available — observation only"],
    nextMilestones: ["Q3 signal engine", "Q3 reasoning loop", "Q3 execution + approval", "Q3 rollback orchestration"],
    enterpriseTrustNotes: ["Workload identity federation preferred over JSON keys", "Project/folder scoped", "Revocable by removing IAM binding"],
  },
  // -------- REPOSITORY + CI/CD --------
  {
    id: "github",
    name: "GitHub",
    description: "GitHub App installation. Repository discovery, workflow runs, branch protection, deployment events.",
    category: "repository",
    status: "preview",
    eta: "Q2 2026 (live)",
    authModel: "github_app",
    permissions: ["Read: actions, contents (metadata), deployments, metadata, pull_requests"],
    reads: ["Repository metadata", "Branch protection rules", "GitHub Actions workflow runs", "Pull request reviews", "Release/tag events", "Deployment events"],
    doesNotRead: ["Source code contents", "Issue contents", "GitHub Secrets values", "Personal user data"],
    writes: ["Planned — auto-create approval comments / Change Request linkage"],
    riskLevel: "low",
    setupRoute: "/operator/onboarding",
    docsRoute: "/docs/releaseops/connectors#github",
    dashboardRoute: "/dashboard/releaseops",
    supportedEvents: ["connector.connected", "github.repo_detected", "github.workflow_detected", "github.workflow_failed", "release.deployed", "release.blocked"],
    supportedActions: ["discover_repos", "discover_workflows", "ingest_runs", "compute_readiness"],
    limitations: ["Preview adapter today; live GitHub App publishing Q2 2026"],
    nextMilestones: ["GitHub App marketplace listing", "GitLab integration parity", "Org-level installation flow"],
    enterpriseTrustNotes: ["No source-code cloning", "Org-admin approval for App installation", "Per-installation External ID equivalent"],
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Project/group access token. Pipeline runs, merge requests, protected branches, deployment history.",
    category: "repository",
    status: "planned",
    eta: "Q3 2026",
    authModel: "personal_token",
    permissions: ["api scope", "read_repository scope"],
    reads: ["CI/CD pipelines + jobs", "Merge request reviews", "Protected branches", "Deployment history"],
    doesNotRead: ["File contents", "Issue contents", "CI/CD variable values"],
    writes: [],
    riskLevel: "low",
    docsRoute: "/docs/releaseops/connectors#gitlab",
    supportedEvents: ["connector.connected", "release.deployed"],
    supportedActions: ["discover_pipelines", "ingest_runs"],
    limitations: ["Not yet implemented"],
    nextMilestones: ["Self-hosted GitLab support", "GitLab CI YAML risk analysis"],
    enterpriseTrustNotes: ["Token expiration honored", "Self-hosted via custom base URL"],
  },
  {
    id: "azure_devops",
    name: "Azure DevOps",
    description: "Service connection with read-scoped PAT. Build/release pipelines, branch policies, deployment events.",
    category: "ci_cd",
    status: "planned",
    eta: "Q3 2026",
    authModel: "service_connection",
    permissions: ["Code Read", "Build Read", "Release Read"],
    reads: ["Pipeline runs", "Build artifacts metadata", "Branch policies", "Release events"],
    doesNotRead: ["Source code", "Pipeline secret variables", "Work item details"],
    writes: [],
    riskLevel: "low",
    docsRoute: "/docs/releaseops/connectors#azure-devops",
    supportedEvents: ["connector.connected"],
    supportedActions: ["discover_pipelines"],
    limitations: ["Not yet implemented"],
    nextMilestones: ["PAT rotation flow", "On-premises Azure DevOps Server support"],
    enterpriseTrustNotes: ["14-day pre-expiration warning", "Read-only scope"],
  },
  {
    id: "jenkins",
    name: "Jenkins",
    description: "API token + Crumb. Build history, pipeline definitions, job metadata.",
    category: "ci_cd",
    status: "planned",
    eta: "Q4 2026",
    authModel: "api_key",
    permissions: ["Job/Read", "Job/Build (optional)"],
    reads: ["Job/pipeline metadata", "Build history", "Jenkinsfile metadata"],
    doesNotRead: ["Build artifact contents", "Jenkins credentials store"],
    writes: [],
    riskLevel: "medium",
    docsRoute: "/docs/releaseops/connectors#jenkins",
    supportedEvents: ["connector.connected"],
    supportedActions: ["discover_jobs"],
    limitations: ["Not yet implemented"],
    nextMilestones: ["Self-hosted reachability via outbound webhook"],
    enterpriseTrustNotes: ["Network reachability required for polling", "Read-only API token"],
  },
  // -------- IAC --------
  {
    id: "terraform",
    name: "Terraform / OpenTofu",
    description: "Terraform plan ingestion + workspace state metadata. Local + Terraform Cloud paths.",
    category: "iac",
    status: "preview",
    eta: "Q2 2026 (live)",
    authModel: "api_key",
    permissions: ["Terraform Cloud team token (read)", "Local plan upload via signed handoff"],
    reads: ["Plan JSON metadata", "Workspace configuration", "State reference (not state contents)", "Module list"],
    doesNotRead: ["Terraform state contents", "Sensitive output values", "Provider credentials"],
    writes: ["Annotate plan with risk classification (when configured)"],
    riskLevel: "low",
    docsRoute: "/docs/terraform-export",
    dashboardRoute: "/dashboard/releaseops",
    supportedEvents: ["terraform.plan_detected", "terraform.drift_detected"],
    supportedActions: ["ingest_plan", "classify_risk", "drift_check"],
    limitations: ["State contents never read — only metadata + plan JSON"],
    nextMilestones: ["Terraform Cloud API integration", "OpenTofu plan format parity", "Spacelift support"],
    enterpriseTrustNotes: ["State contents never transmitted", "Plan signed by uploading desktop runtime"],
  },
  {
    id: "kubernetes",
    name: "Kubernetes / ArgoCD",
    description: "ArgoCD project token. Application sync state, deployment events.",
    category: "ci_cd",
    status: "planned",
    eta: "Q3 2026",
    authModel: "api_key",
    permissions: ["applications:get"],
    reads: ["Application sync state", "Deployment history", "Health status"],
    doesNotRead: ["Manifest contents beyond app metadata", "Cluster credentials"],
    writes: [],
    riskLevel: "low",
    docsRoute: "/docs/releaseops/connectors#argocd",
    supportedEvents: ["connector.connected", "release.deployed"],
    supportedActions: ["ingest_app_sync"],
    limitations: ["Not yet implemented"],
    nextMilestones: ["GitOps drift correlation"],
    enterpriseTrustNotes: ["Read-only scope", "Per-project token"],
  },
  // -------- TICKETING + CHANGE --------
  {
    id: "servicenow",
    name: "ServiceNow",
    description: "OAuth Change Request integration. Auto-create CRs, sync status, attach risk justification.",
    category: "ticketing",
    status: "planned",
    eta: "Q3 2026",
    authModel: "oauth",
    permissions: ["change_request:read", "change_request:write (opt-in)"],
    reads: ["Change Request status + approvals"],
    doesNotRead: ["Other ServiceNow modules (Incident, Problem, CMDB) — opt-in separately"],
    writes: ["Auto-create CRs with risk justification + rollback strategy (opt-in)"],
    riskLevel: "medium",
    docsRoute: "/docs/releaseops/connectors#servicenow",
    supportedEvents: ["change.cr_opened", "change.cr_approved", "change.cr_closed"],
    supportedActions: ["create_cr", "sync_cr_status"],
    limitations: ["Not yet implemented"],
    nextMilestones: ["Self-hosted ServiceNow support", "Incident module opt-in"],
    enterpriseTrustNotes: ["Opt-in per module", "Write scope explicit consent"],
  },
  {
    id: "jira",
    name: "Jira",
    description: "Issue/ticket linkage. Connect operational events to engineering tickets.",
    category: "ticketing",
    status: "planned",
    eta: "Q4 2026",
    authModel: "oauth",
    permissions: ["read:issue", "write:issue (opt-in)"],
    reads: ["Linked issues + comments metadata"],
    doesNotRead: ["Cross-project user data"],
    writes: ["Auto-link tickets to execution plans (opt-in)"],
    riskLevel: "low",
    docsRoute: "/docs/releaseops/connectors#jira",
    supportedEvents: ["ticket.linked"],
    supportedActions: ["link_ticket"],
    limitations: ["Not yet implemented"],
    nextMilestones: ["Linear integration parity"],
    enterpriseTrustNotes: ["Read-only by default", "Per-project authorization"],
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issue linkage for fast-moving engineering teams.",
    category: "ticketing",
    status: "planned",
    eta: "Q4 2026",
    authModel: "oauth",
    permissions: ["Read scope", "Issue read/comment (opt-in write)"],
    reads: ["Issue metadata + linked comments"],
    doesNotRead: ["Cross-org data"],
    writes: ["Auto-comment on linked issues (opt-in)"],
    riskLevel: "low",
    docsRoute: "/docs/releaseops/connectors#linear",
    supportedEvents: ["ticket.linked"],
    supportedActions: ["link_ticket"],
    limitations: ["Not yet implemented"],
    nextMilestones: ["GraphQL webhook delivery"],
    enterpriseTrustNotes: ["Read-only by default"],
  },
  // -------- MESSAGING --------
  {
    id: "slack",
    name: "Slack",
    description: "Outbound notifications: approvals, scan completions, deployment blockers, rollbacks, weekly executive summaries.",
    category: "messaging",
    status: "planned",
    eta: "Q2 2026",
    authModel: "webhook_signed",
    permissions: ["incoming-webhook scope", "channel write"],
    reads: [],
    doesNotRead: ["Channel history", "User messages"],
    writes: ["Approval prompts", "Scan completions", "Deploy blockers", "Rollback alerts", "Weekly summaries"],
    riskLevel: "low",
    docsRoute: "/docs/notifications#slack",
    supportedEvents: ["notification.sent"],
    supportedActions: ["send_notification"],
    limitations: ["Not yet implemented"],
    nextMilestones: ["Interactive approval buttons in Slack"],
    enterpriseTrustNotes: ["Outbound-only", "Signed webhook payloads"],
  },
  {
    id: "msteams",
    name: "Microsoft Teams",
    description: "Outbound notifications via Teams webhook.",
    category: "messaging",
    status: "planned",
    eta: "Q3 2026",
    authModel: "webhook_signed",
    permissions: ["incoming webhook"],
    reads: [],
    doesNotRead: ["Channel history"],
    writes: ["Same set as Slack"],
    riskLevel: "low",
    docsRoute: "/docs/notifications#teams",
    supportedEvents: ["notification.sent"],
    supportedActions: ["send_notification"],
    limitations: ["Not yet implemented"],
    nextMilestones: ["Adaptive card approval flow"],
    enterpriseTrustNotes: ["Outbound-only", "Signed webhook payloads"],
  },
  // -------- DESKTOP --------
  {
    id: "desktop",
    name: "Axiom Desktop Runtime",
    description: "Local Tauri shell. Local Terraform/CLI execution, OS keychain credentials, offline audit sync.",
    category: "desktop",
    status: "preview",
    eta: "macOS now · Windows Q2 2026 · Linux Q3 2026",
    authModel: "local_runtime",
    permissions: ["OS keychain (Axiom session token only)", "Local terraform/aws/az/gcloud/kubectl CLI invocation"],
    reads: ["Local CLI output", "OS keychain entries created by Axiom"],
    doesNotRead: ["Other OS keychain entries", "Other application data"],
    writes: ["Local Terraform applies (with approval)", "Local audit log", "Native notifications"],
    riskLevel: "medium",
    setupRoute: "/download",
    docsRoute: "/docs/desktop-install",
    dashboardRoute: "/download",
    supportedEvents: ["desktop.agent_connected", "desktop.handoff_delivered", "desktop.local_execution"],
    supportedActions: ["local_execute", "local_audit_export", "native_notify"],
    limitations: ["macOS preview only today"],
    nextMilestones: ["Windows MSIX build Q2", "Linux AppImage Q3", "Workstation mode for air-gapped envs"],
    enterpriseTrustNotes: ["Apple-notarized + code-signed", "AWS credentials never leave the machine", "Workstation mode disables all outbound network"],
  },
  // -------- AUDIT --------
  {
    id: "audit_export",
    name: "Audit Export",
    description: "CSV / JSON / SIEM webhook export of the immutable audit trail.",
    category: "audit",
    status: "live",
    authModel: "api_key",
    permissions: ["Tenant-scoped audit:read"],
    reads: ["AxiomAuditEvent rows scoped to the tenant"],
    doesNotRead: ["Cross-tenant audit events"],
    writes: ["Outbound SIEM webhook delivery (opt-in)"],
    riskLevel: "low",
    docsRoute: "/docs/audit-logs",
    dashboardRoute: "/dashboard/memory",
    supportedEvents: ["audit.exported"],
    supportedActions: ["export_csv", "export_json", "export_ndjson", "webhook_deliver"],
    limitations: ["PDF report export is on roadmap"],
    nextMilestones: ["PDF executive summary export", "SIEM-format presets (Splunk HEC, Datadog Logs)"],
    enterpriseTrustNotes: ["Tenant isolation enforced", "Append-only — exports never mutate audit fabric"],
  },

  // ============ OBSERVABILITY ============
  {
    id: "dynatrace",
    name: "Dynatrace",
    description: "Full-stack observability — APM, infrastructure, logs, real-user monitoring.",
    category: "observability",
    status: "planned",
    eta: "Q3 2026",
    authModel: "api_key",
    permissions: ["entities.read", "metrics.read", "problems.read", "events.read"],
    reads: ["Service health", "APM spans", "Infrastructure metrics", "Problem events", "Log streams"],
    doesNotRead: ["Customer PII inside spans (redacted before ingest)"],
    writes: ["Annotation events (opt-in)"],
    riskLevel: "low",
    docsRoute: "/docs/connectors/dynatrace",
    supportedEvents: ["dynatrace.problem_opened", "dynatrace.service_degraded"],
    supportedActions: ["read_problems", "read_metrics", "annotate_event"],
    limitations: ["Read-only initially. Annotation in second phase."],
    nextMilestones: ["Problem → incident auto-link", "AI rootcause overlay using Dynatrace evidence"],
    enterpriseTrustNotes: ["PII redaction applied before storage", "API token scoped per environment"],
  },
  {
    id: "grafana",
    name: "Grafana",
    description: "Dashboards + alerting. Read dashboards, mirror panels, ingest alert rules.",
    category: "observability",
    status: "planned",
    eta: "Q3 2026",
    authModel: "api_key",
    permissions: ["dashboards:read", "alerts:read"],
    reads: ["Dashboard JSON", "Panel queries", "Alert rules", "Alert events"],
    doesNotRead: ["Data source credentials"],
    writes: ["Annotation events (opt-in)"],
    riskLevel: "low",
    docsRoute: "/docs/connectors/grafana",
    supportedEvents: ["grafana.alert_firing", "grafana.dashboard_changed"],
    supportedActions: ["read_dashboards", "read_alerts", "post_annotation"],
    limitations: ["Cloud Grafana first; self-host in phase 2"],
    nextMilestones: ["Native dashboard import → VisionXIXLabs builder", "Alert-rule to native alert-rule sync"],
    enterpriseTrustNotes: ["Per-folder ACL respected", "No data-source secret exfiltration"],
  },
  {
    id: "prometheus",
    name: "Prometheus",
    description: "Scrape and query Prometheus metrics. Mirror recording rules + alerts.",
    category: "observability",
    status: "planned",
    eta: "Q4 2026",
    authModel: "api_key",
    permissions: ["query:read", "rules:read"],
    reads: ["Time-series metrics", "Recording rules", "Alert rules"],
    doesNotRead: ["Underlying target scrape credentials"],
    writes: [],
    riskLevel: "low",
    docsRoute: "/docs/connectors/prometheus",
    supportedEvents: ["prometheus.alert_firing"],
    supportedActions: ["query_instant", "query_range", "list_rules"],
    limitations: ["Federation-mode first; remote-write in phase 2"],
    nextMilestones: ["Native metric ingestion fallback for tenants without Prom"],
    enterpriseTrustNotes: ["Query-only by default", "PromQL templates audited"],
  },
  {
    id: "datadog",
    name: "Datadog",
    description: "APM + logs + metrics + RUM. Comprehensive SaaS observability.",
    category: "observability",
    status: "planned",
    eta: "Q3 2026",
    authModel: "api_key",
    permissions: ["events_read", "metrics_read", "logs_read", "monitors_read"],
    reads: ["Events", "Custom metrics", "Logs (with retention)", "Monitor states"],
    doesNotRead: ["Customer-config credentials"],
    writes: ["Event annotations (opt-in)"],
    riskLevel: "low",
    docsRoute: "/docs/connectors/datadog",
    supportedEvents: ["datadog.monitor_alert", "datadog.anomaly_detected"],
    supportedActions: ["read_monitors", "read_logs", "post_event"],
    limitations: ["Read-only initially. Sync to native dashboards in phase 2."],
    nextMilestones: ["Monitor → native alert-rule sync", "Logs → native log-event mirror"],
    enterpriseTrustNotes: ["Site-region honored (US1/EU/etc)", "API key scoped to read-only"],
  },
  {
    id: "new_relic",
    name: "New Relic",
    description: "APM + infrastructure + logs via NRQL. Read entities, alert policies, incidents.",
    category: "observability",
    status: "planned",
    eta: "Q4 2026",
    authModel: "api_key",
    permissions: ["entities:read", "alerts:read", "logs:read"],
    reads: ["Entity catalog", "NRQL query results", "Alert policies", "Incident records"],
    doesNotRead: ["Browser PII (redacted)"],
    writes: ["Annotation events (opt-in)"],
    riskLevel: "low",
    docsRoute: "/docs/connectors/new-relic",
    supportedEvents: ["new_relic.incident_opened"],
    supportedActions: ["query_nrql", "read_entities", "post_event"],
    limitations: ["Entity import in v1; full APM sync in v2"],
    nextMilestones: ["Entity → service-catalog automatic mapping"],
    enterpriseTrustNotes: ["User API key scoped per environment"],
  },

  // ============ LOGGING ============
  {
    id: "splunk",
    name: "Splunk",
    description: "Enterprise log + event analytics. SPL queries + alert subscriptions.",
    category: "logging",
    status: "planned",
    eta: "Q4 2026",
    authModel: "api_key",
    permissions: ["search", "list_saved_searches", "list_alerts"],
    reads: ["Search results (SPL)", "Saved searches", "Alert events"],
    doesNotRead: ["Raw index credentials"],
    writes: ["HEC event POST (opt-in)"],
    riskLevel: "medium",
    docsRoute: "/docs/connectors/splunk",
    supportedEvents: ["splunk.alert_fired"],
    supportedActions: ["run_spl", "list_alerts", "send_hec"],
    limitations: ["Per-host token + index ACL must match"],
    nextMilestones: ["Native log-event mirror with field-level redaction"],
    enterpriseTrustNotes: ["HEC token scoped per index", "PII redaction before persistence"],
  },

  // ============ SECURITY POSTURE ============
  {
    id: "wiz",
    name: "Wiz",
    description: "Cloud-native CSPM/CIEM. Read inventory, findings, attack paths.",
    category: "security_posture",
    status: "planned",
    eta: "Q4 2026",
    authModel: "service_account",
    permissions: ["read:assets", "read:issues", "read:vulnerabilities"],
    reads: ["Inventory", "Issues", "Vulnerabilities", "Attack paths", "Misconfigurations"],
    doesNotRead: ["Customer data in scanned resources"],
    writes: [],
    riskLevel: "low",
    docsRoute: "/docs/connectors/wiz",
    supportedEvents: ["wiz.new_critical_issue", "wiz.attack_path_detected"],
    supportedActions: ["read_inventory", "read_issues", "read_attack_paths"],
    limitations: ["Read-only mirror to native SecurityFinding"],
    nextMilestones: ["Attack-path → incident auto-create"],
    enterpriseTrustNotes: ["Service account scoped to Reader", "No customer data ingested — only metadata + findings"],
  },
  {
    id: "snyk",
    name: "Snyk",
    description: "Dependency + container + IaC scanning. Read vulnerabilities per project.",
    category: "security_posture",
    status: "planned",
    eta: "Q3 2026",
    authModel: "api_key",
    permissions: ["org:read", "projects:read", "issues:read"],
    reads: ["Projects", "Dependency vulnerabilities", "Container image vulnerabilities", "IaC misconfigurations"],
    doesNotRead: ["Private repo file contents (uses Snyk's existing access)"],
    writes: [],
    riskLevel: "low",
    docsRoute: "/docs/connectors/snyk",
    supportedEvents: ["snyk.new_critical_vuln"],
    supportedActions: ["read_projects", "read_issues"],
    limitations: ["Per-org token in v1; SCM-installation in v2"],
    nextMilestones: ["AI-prioritized fix queue from Snyk + native dep graph"],
    enterpriseTrustNotes: ["Token scoped per Snyk org"],
  },
  {
    id: "prisma_cloud",
    name: "Prisma Cloud",
    description: "Palo Alto CSPM/CWPP. Read cloud security findings + workload protection.",
    category: "security_posture",
    status: "planned",
    eta: "Q4 2026",
    authModel: "api_key",
    permissions: ["alert:read", "resource:read", "compliance:read"],
    reads: ["Cloud alerts", "Compliance posture", "Resource inventory"],
    doesNotRead: [],
    writes: [],
    riskLevel: "low",
    docsRoute: "/docs/connectors/prisma-cloud",
    supportedEvents: ["prisma.alert_opened"],
    supportedActions: ["read_alerts", "read_compliance"],
    limitations: ["Read-only mirror"],
    nextMilestones: ["Compliance posture mirror to native ComplianceCheck"],
    enterpriseTrustNotes: ["Per-tenant scoped"],
  },
  {
    id: "crowdstrike",
    name: "CrowdStrike Falcon",
    description: "Endpoint detection & response. Read detections, hosts, vulnerabilities.",
    category: "security_posture",
    status: "planned",
    eta: "2027",
    authModel: "oauth",
    permissions: ["detects:read", "hosts:read", "vulnerabilities:read"],
    reads: ["Endpoint detections", "Host inventory", "Vulnerabilities"],
    doesNotRead: ["Endpoint file contents"],
    writes: [],
    riskLevel: "low",
    docsRoute: "/docs/connectors/crowdstrike",
    supportedEvents: ["crowdstrike.detection_opened"],
    supportedActions: ["read_detections", "read_hosts"],
    limitations: ["Read-only initially"],
    nextMilestones: ["Endpoint posture → native SecurityFinding mirror"],
    enterpriseTrustNotes: ["OAuth scoped per Falcon CID"],
  },

  // ============ INCIDENT / ITSM (additional) ============
  {
    id: "pagerduty",
    name: "PagerDuty",
    description: "On-call paging + incident commander handoff.",
    category: "incident",
    status: "planned",
    eta: "Q3 2026",
    authModel: "api_key",
    permissions: ["incidents:read", "incidents:write (opt-in)", "services:read", "users:read"],
    reads: ["Active incidents", "On-call schedules", "Services + escalation policies"],
    doesNotRead: [],
    writes: ["Acknowledge / resolve (with approval)", "Trigger incident (opt-in)"],
    riskLevel: "medium",
    docsRoute: "/docs/connectors/pagerduty",
    supportedEvents: ["pagerduty.incident_triggered", "pagerduty.incident_acked"],
    supportedActions: ["trigger_incident", "ack_incident", "list_incidents"],
    limitations: ["Trigger requires approval-gated workflow"],
    nextMilestones: ["Bi-directional sync with native Incident model"],
    enterpriseTrustNotes: ["Write actions audit-logged + approval-gated"],
  },
  {
    id: "opsgenie",
    name: "Opsgenie",
    description: "Atlassian on-call + alerting. Mirror alerts, route to on-call.",
    category: "incident",
    status: "planned",
    eta: "Q3 2026",
    authModel: "api_key",
    permissions: ["alert:read", "alert:create (opt-in)"],
    reads: ["Alerts", "Schedules", "Teams"],
    doesNotRead: [],
    writes: ["Create alert (opt-in)", "Acknowledge (approval-gated)"],
    riskLevel: "medium",
    docsRoute: "/docs/connectors/opsgenie",
    supportedEvents: ["opsgenie.alert_created", "opsgenie.alert_acked"],
    supportedActions: ["create_alert", "ack_alert", "list_alerts"],
    limitations: ["Approval gate on writes"],
    nextMilestones: ["Native incident → Opsgenie alert auto-create"],
    enterpriseTrustNotes: ["EU and US regions honored"],
  },
];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function getConnector(id: string): ConnectorRecord | undefined {
  return CONNECTOR_REGISTRY.find((c) => c.id === id);
}

export function connectorsByCategory(category: ConnectorCategory): ConnectorRecord[] {
  return CONNECTOR_REGISTRY.filter((c) => c.category === category);
}

export function connectorsByStatus(status: ConnectorStatus): ConnectorRecord[] {
  return CONNECTOR_REGISTRY.filter((c) => c.status === status);
}

export function listLiveConnectors(): ConnectorRecord[] {
  return CONNECTOR_REGISTRY.filter((c) => c.status === "live" || c.status === "preview");
}

export function listPlannedConnectors(): ConnectorRecord[] {
  return CONNECTOR_REGISTRY.filter((c) => c.status === "planned" || c.status === "expanding");
}

export function categorySummary(): Record<ConnectorCategory, { total: number; live: number; preview: number; planned: number }> {
  const cats: ConnectorCategory[] = [
    "cloud", "repository", "ci_cd", "iac", "ticketing", "incident", "messaging", "desktop", "audit", "identity",
    "observability", "logging", "security_posture", "database", "container", "edge",
  ];
  const out: Record<ConnectorCategory, { total: number; live: number; preview: number; planned: number }> =
    Object.fromEntries(cats.map((c) => [c, { total: 0, live: 0, preview: 0, planned: 0 }])) as Record<ConnectorCategory, { total: number; live: number; preview: number; planned: number }>;
  for (const c of CONNECTOR_REGISTRY) {
    const bucket = out[c.category];
    bucket.total++;
    if (c.status === "live") bucket.live++;
    else if (c.status === "preview") bucket.preview++;
    else if (c.status === "planned" || c.status === "expanding") bucket.planned++;
  }
  return out;
}
