/**
 * Demo scenarios registry — Phase 405.
 *
 * In-memory closed-union of the 13 mandated demo flows. Each scenario
 * is a sequence of typed steps that the /demo (sandbox landing) and
 * future visual-tour surfaces walk through.
 *
 * Why in-memory instead of a Prisma model:
 *   - Demo content is product copy, not user data. It belongs in source
 *     control + PR review + version history alongside the features it
 *     documents — not in a Postgres table where it can silently drift.
 *   - Hydrates instantly on any page; no DB roundtrip.
 *   - The closed-union DemoScenarioId guarantees every demo route
 *     references a real scenario at compile time.
 *
 * Phase 405 living-docs rule: every entry here MUST carry `lastReviewed`.
 * The weekly content review surface (admin doc) flags scenarios whose
 * lastReviewed is older than 60 days.
 *
 * Pure. No I/O.
 */

/** Closed-union — every scenario the portal can show. */
export type DemoScenarioId =
  | "first_time_workspace_setup"
  | "cloud_operations"
  | "devops_pipeline"
  | "security_finding"
  | "monitoring_alert"
  | "incident_response"
  | "database_health"
  | "desktop_app_pairing"
  | "developer_tools"
  | "automation_dry_run"
  | "ai_workforce_overview"
  | "pricing_and_usage"
  | "internal_growth_automation";

/** Audience visibility — controls which surfaces can show each scenario. */
export type DemoAudience = "public" | "client" | "internal_only";

/** Approval semantics shown beside each step. */
export type DemoStepApproval = "none" | "self_approve" | "two_person";

/** One actionable step in a demo flow. */
export interface DemoStep {
  /** Stable id, unique within the scenario. */
  id: string;
  /** Plain-English step title (one short sentence). */
  title: string;
  /** Operator-readable description of what's happening. */
  description: string;
  /** Where on the platform this step happens (route, optional). */
  route?: string;
  /** Visual asset path (screenshot, animation) — TBD per scenario. */
  visualAsset?: string;
  /** What the user sees AFTER this step succeeds. */
  expectedResult: string;
  /** Approval gate at this step. */
  approval: DemoStepApproval;
  /** Related connector (if any). */
  relatedConnector?: string;
  /** AI engineer that performs this step. */
  relatedAgent?: string;
}

export interface DemoScenario {
  id: DemoScenarioId;
  /** Plain-English scenario title. */
  title: string;
  /** One-sentence pitch — what the demo proves. */
  pitch: string;
  /** Long-form description shown above the steps list. */
  description: string;
  /** Total step count + estimated minutes — surfaced on the card. */
  estimatedMinutes: number;
  /** Closed-union audience visibility. */
  audience: DemoAudience;
  /** Ordered steps in this scenario. */
  steps: ReadonlyArray<DemoStep>;
  /** ISO date — Phase 405 living-docs rule. */
  lastReviewed: string;
  /** Phase + commit SHA where this scenario was last touched (audit). */
  sourceFeatureVersion?: string;
}

// ============================ the 13 scenarios ============================

// Living-docs rule (CLAUDE.md): every scenario carries a lastReviewed
// date. Bumped to mark the Phase 406-desktop expansion (new desktop
// views: Approvals, Workflows, Audit, Billing, Trust, Docs, StartHere)
// — scenarios that previously only deep-linked to /dashboard/* on web
// now also describe the matching desktop view.
const REVIEWED = "2026-05-23"; // Phase 406-desktop content sweep.

export const DEMO_SCENARIOS: Readonly<Record<DemoScenarioId, DemoScenario>> = {
  first_time_workspace_setup: {
    id: "first_time_workspace_setup",
    title: "First-Time Workspace Setup",
    pitch: "From zero account to first connected provider in ~10 minutes.",
    description: "Walks a new operator through workspace creation, team invites, the first cloud connector, and the first read-only scan.",
    estimatedMinutes: 12,
    audience: "public",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Create the workspace",       description: "Pick a workspace name + region. Determines data residency.", route: "/dashboard/onboarding", approval: "none", expectedResult: "Workspace dashboard appears in preview mode." },
      { id: "2", title: "Invite teammates",           description: "Add 1-3 teammates with view-only or operator role.", route: "/dashboard/settings/workspace", approval: "none", expectedResult: "Invitees receive email; roles visible in Users & roles." },
      { id: "3", title: "Connect first cloud",        description: "Pick AWS, Azure, or GCP. Cross-account IAM role / service principal.", route: "/dashboard/connectors", approval: "none", relatedConnector: "AWS|Azure|GCP", expectedResult: "Connector status flips from 'preview' to 'connected'." },
      { id: "4", title: "Run first read-only scan",   description: "Inventory + risk scan. Read-only — no changes to your cloud.", route: "/dashboard/security", approval: "none", relatedAgent: "Security Engineer", expectedResult: "Resource inventory + risk summary populated." },
      { id: "5", title: "Configure approval rules",   description: "Set who approves remediation actions (default: two-person).", route: "/dashboard/policies", approval: "self_approve", expectedResult: "Approval policy active for future automations." },
      { id: "6", title: "Enable first AI engineer",   description: "Pick the engineer that matches your workload (cloud, security, devops, etc.).", route: "/dashboard/workforce", approval: "none", relatedAgent: "All", expectedResult: "Engineer transitions to 'active' status." },
      { id: "7", title: "Generate first report",      description: "Executive summary of posture + top risks.", route: "/dashboard/executive-summary", approval: "none", expectedResult: "PDF/Markdown report ready to share." },
    ],
  },
  cloud_operations: {
    id: "cloud_operations",
    title: "Cloud Operations Demo",
    pitch: "Connect AWS → detect risk → recommend fix → human approves.",
    description: "Shows the end-to-end loop from connector to safe remediation via human approval.",
    estimatedMinutes: 8,
    audience: "public",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "AWS connector live",         description: "Cross-account IAM role assumed.", route: "/dashboard/aws", approval: "none", relatedConnector: "AWS", expectedResult: "Read-only access confirmed." },
      { id: "2", title: "Read-only scan",             description: "Inventory + IAM exposure check + S3 public-bucket scan.", route: "/dashboard/cloud-security", approval: "none", relatedAgent: "Cloud Engineer", expectedResult: "12 resources scanned; 3 risks surfaced." },
      { id: "3", title: "Risk detected",              description: "One IAM role with AdministratorAccess + recent login from unusual IP.", approval: "none", expectedResult: "Risk card shows severity = high." },
      { id: "4", title: "Recommendation generated",   description: "Cloud Engineer proposes scoping the role to a minimal policy.", approval: "none", relatedAgent: "Cloud Engineer", expectedResult: "Terraform / CLI patch + rollback plan ready." },
      { id: "5", title: "Approval requested",         description: "Two-person human approval required before any change.", route: "/dashboard/approvals", approval: "two_person", expectedResult: "Approval packet awaiting reviewers." },
    ],
  },
  devops_pipeline: {
    id: "devops_pipeline",
    title: "DevOps Pipeline Demo",
    pitch: "Connect GitHub → DevOps Engineer reads pipeline → explains failure → suggests fix.",
    description: "DevOps Engineer reads-only at first. Modifying the pipeline requires approval.",
    estimatedMinutes: 6,
    audience: "public",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Connect GitHub",             description: "OAuth or PAT.", route: "/dashboard/integrations/github", approval: "none", relatedConnector: "GitHub", expectedResult: "Repos visible in DevOps overview." },
      { id: "2", title: "Read pipeline status",       description: "Last 20 workflow runs surfaced.", route: "/dashboard/cicd", approval: "none", relatedAgent: "DevOps Engineer", expectedResult: "Per-repo green/red badges." },
      { id: "3", title: "Detect failed build",        description: "DevOps Engineer parses the failure log.", approval: "none", relatedAgent: "DevOps Engineer", expectedResult: "Root cause hypothesis with line refs." },
      { id: "4", title: "Suggest fix",                description: "Specific diff + rationale generated.", approval: "none", relatedAgent: "DevOps Engineer", expectedResult: "Proposed PR diff ready for review." },
      { id: "5", title: "Approval required to apply", description: "Modifying CI requires explicit human approval.", route: "/dashboard/approvals", approval: "two_person", expectedResult: "PR opens only after approval." },
    ],
  },
  security_finding: {
    id: "security_finding",
    title: "Security Finding Demo",
    pitch: "Detect IAM/public resource risk → explain impact → human approves remediation.",
    description: "Security Engineer reads → analyzes → recommends. Remediation requires approval.",
    estimatedMinutes: 6,
    audience: "public",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Public bucket detected",     description: "S3 bucket with public-read ACL surfaces in the scan.", approval: "none", relatedAgent: "Security Engineer", expectedResult: "Risk card with severity + evidence." },
      { id: "2", title: "Impact explained",           description: "Security Engineer details data classification + blast radius.", approval: "none", relatedAgent: "Security Engineer", expectedResult: "Operator sees who owns the bucket + how it became public." },
      { id: "3", title: "Remediation plan",           description: "Terraform diff + rollback steps.", approval: "none", expectedResult: "Plan card with risk-tier + confidence." },
      { id: "4", title: "Human approves or rejects",  description: "Approval packet sent to security owners.", route: "/dashboard/approvals", approval: "two_person", expectedResult: "Plan executes only when both approve." },
    ],
  },
  monitoring_alert: {
    id: "monitoring_alert",
    title: "Monitoring Alert Demo",
    pitch: "Alert fires → Monitoring Engineer explains → incident created automatically.",
    description: "Connect CloudWatch / Grafana / Dynatrace → alert ingestion → AI-explained → incident creation.",
    estimatedMinutes: 5,
    audience: "client",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Service health dashboard",   description: "Per-service health computed across metrics + logs.", route: "/dashboard/observability", approval: "none", expectedResult: "5xx-rate, latency, saturation per service." },
      { id: "2", title: "Alert appears",              description: "Upstream alert (CloudWatch/Grafana) ingested.", approval: "none", relatedConnector: "CloudWatch|Grafana|Dynatrace", expectedResult: "Alert card with origin + raw fields." },
      { id: "3", title: "AI explains",                description: "Monitoring Engineer correlates with recent deploys + recent traces.", approval: "none", relatedAgent: "Monitoring Engineer", expectedResult: "One-paragraph explainer + root-cause hypothesis." },
      { id: "4", title: "Incident created",           description: "Alert promotes to incident with timeline.", route: "/dashboard/incidents", approval: "none", expectedResult: "Incident detail page; postmortem skeleton ready." },
    ],
  },
  incident_response: {
    id: "incident_response",
    title: "Incident Response Demo",
    pitch: "Alert → incident → timeline → root cause → postmortem.",
    description: "Full incident lifecycle with AI-assisted root cause and postmortem generation.",
    estimatedMinutes: 8,
    audience: "client",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Alert becomes incident",     description: "Auto-promotion when severity + duration thresholds cross.", route: "/dashboard/incidents", approval: "none", expectedResult: "Incident page opens with metadata." },
      { id: "2", title: "Timeline built",             description: "Events stitched from alerts, deploys, configs, logs.", approval: "none", relatedAgent: "Incident Engineer", expectedResult: "Sorted timeline with provenance." },
      { id: "3", title: "Root-cause hypothesis",      description: "AI proposes the most likely cause with evidence.", approval: "none", relatedAgent: "Incident Engineer", expectedResult: "Hypothesis + confidence score." },
      { id: "4", title: "Mitigation approval",        description: "If mitigation requires change, approval packet created.", route: "/dashboard/approvals", approval: "two_person", expectedResult: "Reviewers notified; on approval, mitigation runs." },
      { id: "5", title: "Postmortem generated",       description: "Auto-drafted from the timeline + actions.", approval: "self_approve", expectedResult: "Editable postmortem doc shared with team." },
    ],
  },
  database_health: {
    id: "database_health",
    title: "Database Health Demo",
    pitch: "Connect DB → detect slow query / backup gap → suggest fix.",
    description: "Database Engineer reads → recommends → approval required for any DDL/migration.",
    estimatedMinutes: 5,
    audience: "client",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Connect database",           description: "Read-only role; no direct app-level access.", approval: "none", relatedConnector: "Postgres|MySQL|MongoDB", expectedResult: "Schema introspected; metric stream started." },
      { id: "2", title: "Slow query detected",        description: "Sequence scan over a 10M-row table.", approval: "none", relatedAgent: "Database Engineer", expectedResult: "Per-query latency chart + plan." },
      { id: "3", title: "Backup gap detected",        description: "No backup completed in 36 hours.", approval: "none", relatedAgent: "Database Engineer", expectedResult: "Risk card with retention SLA breach." },
      { id: "4", title: "Recommend fix",              description: "Composite index proposal + sample DDL.", approval: "none", expectedResult: "DDL preview + rollback plan." },
      { id: "5", title: "Approval gates DDL",         description: "Any schema change requires two-person human approval.", route: "/dashboard/approvals", approval: "two_person", expectedResult: "DDL queued; runs only after approval." },
    ],
  },
  desktop_app_pairing: {
    id: "desktop_app_pairing",
    title: "Desktop pairing and integration concept (not available)",
    pitch: "Internal product flow for browser pairing and governed release-tool connections.",
    description: "Internal-only record retained for product planning. It documents the secure browser handoff and the Integration Center without representing an unsupported customer workflow as available.",
    estimatedMinutes: 6,
    audience: "internal_only",
    lastReviewed: "2026-10-01",
    steps: [
      { id: "1", title: "Verify desktop distribution", description: "Confirm that every enabled platform points to a verified release asset and unavailable platforms remain disabled.", route: "/download", approval: "none", expectedResult: "Customer receives the verified desktop build or an accurate unavailable state." },
      { id: "2", title: "Pair workspace",             description: "Paste a vxlk_live_* API key minted in /admin/api-keys.", approval: "none", expectedResult: "Test connection shows ✓ + workspace + plan tier." },
      { id: "3", title: "Authorize local capability", description: "Operator approves the local filesystem scope.", approval: "self_approve", expectedResult: "Capability badge shows 'local: read'." },
      { id: "4", title: "Analyze local repo",         description: "Desktop scans a repo + sends summary to platform.", approval: "none", relatedAgent: "Engineer Workspace", expectedResult: "Repo summary appears in web view." },
      { id: "5", title: "Sync results to web",        description: "Findings stream back to the workspace dashboard.", route: "/dashboard/desktop", approval: "none", expectedResult: "Desktop runtime status shows last sync." },
      { id: "6", title: "Review Integration Center",  description: "Operator sees source control, work-management, communication, cloud, and observability connections with conservative availability states.", approval: "none", expectedResult: "Only service-verified connections can appear connected; unavailable providers remain clearly labeled." },
      { id: "7", title: "Review AI Provider Center",  description: "Operator sees workspace-managed OpenAI, Anthropic, and Google provider families without entering credentials into the desktop app.", approval: "none", expectedResult: "Only providers supported and enabled by the workspace are presented as available; provider routing and credentials remain server governed." },
      { id: "8", title: "Review the release workspace", description: "Operator sees the governed request as one concise context: scope, readiness, approval evidence, recovery, and the latest playbook.", approval: "none", expectedResult: "The desktop summarizes tenant-scoped release signals without exposing source URLs, contacts, workflow inputs, or evidence identifiers." },
      { id: "9", title: "Evaluate approval readiness", description: "The workspace checks only recorded governed signals and identifies what still needs attention before a human approval decision.", approval: "two_person", expectedResult: "A release can be marked ready for human approval only when its recorded readiness, PR, validation, and rollback signals are complete; this check never deploys." },
      { id: "10", title: "Read verified cloud connection state", description: "The desktop reads only the tenant-scoped cloud setup state from the service; all consent and provider management remain in the browser.", approval: "none", expectedResult: "AWS, Azure, and Google Cloud appear connected only after a service-validated setup session; credentials, account identifiers, and permission details are never returned to the desktop." },
      { id: "11", title: "Return from secure browser consent", description: "When the operator returns to the desktop after browser-based setup, it refreshes the verified connection state automatically and also offers a manual refresh.", approval: "none", expectedResult: "The desktop reflects only the latest service-confirmed state; a browser return or a manual refresh never grants new permissions or starts a deployment." },
      { id: "12", title: "Read approved AI availability", description: "The desktop reads a service-approved provider summary without receiving provider keys, account details, usage, routing rules, or a local model-selection control.", approval: "none", expectedResult: "Only non-simulated providers configured by the service appear enabled. Requested models remain unavailable until an approved service route exists." },
      { id: "13", title: "Connect GitHub through the browser", description: "The desktop opens the authenticated GitHub App consent flow directly. GitHub organization administration remains in GitHub, never in the desktop app.", approval: "self_approve", relatedConnector: "GitHub", expectedResult: "The operator can choose a repository scope in GitHub. The desktop refreshes only after the service records a validated connection state." },
      { id: "14", title: "Verify GitHub connection state", description: "After browser consent, the desktop reads only the tenant-scoped GitHub App state and repository-selection scope from the service.", approval: "none", relatedConnector: "GitHub", expectedResult: "The Integration Center shows an active, suspended, revoked, or not-connected state without returning GitHub credentials, account identifiers, or repository names to the desktop." },
      { id: "15", title: "Review connected-system health", description: "The Integration Center reads a tenant-scoped summary of connected-system health foundations without exposing raw provider errors, credentials, or claiming release telemetry.", approval: "none", expectedResult: "Operators see a clear health rollup while the desktop distinguishes integration health from unavailable post-deploy production observation." },
      { id: "16", title: "Revise a governed request", description: "An operator reopens a request in the same guided intake flow. Saving requires the version currently shown by the service and records an immutable successor snapshot.", approval: "none", expectedResult: "A stale desktop cannot overwrite another operator's newer request; a revision records previous and new context in the tenant audit trail and never dispatches a deployment." },
      { id: "17", title: "Review a persisted playbook", description: "The operator can reopen the latest stored playbook after refresh without generating a duplicate. A request revision supersedes prior playbooks, which remain historical only.", approval: "none", expectedResult: "Current playbook steps, roles, activation conditions, and evidence requirements are reviewable; superseded instructions are visibly distinguished and cannot be mistaken for the current release plan." },
      { id: "18", title: "Record external outcome", description: "After an external release or validation finishes, the operator records its evidence reference and summary before closing the governed request.", approval: "self_approve", expectedResult: "Closure is append-only and tenant-scoped. It records the reported external outcome but cannot merge, dispatch, approve, or mutate any external system." },
      { id: "19", title: "Review governed revision history", description: "The operator reviews the request's immutable snapshots and the safe categories that changed between them.", approval: "none", expectedResult: "The desktop shows version, time, privacy-safe author label, and controlled field categories only. Contacts, URLs, workflow inputs, evidence references, and full identifiers are never returned." },
    ],
  },
  developer_tools: {
    id: "developer_tools",
    title: "Developer Tools Demo",
    pitch: "Connect VS Code → link local repo → ask the DevOps Agent.",
    description: "How an engineer uses the platform without leaving their IDE.",
    estimatedMinutes: 5,
    audience: "client",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Install VS Code extension",  description: "Authenticates via the same API key.", approval: "none", relatedConnector: "VS Code", expectedResult: "Sidebar shows workspace state." },
      { id: "2", title: "Link local repo",            description: "Maps the editor's open repo to a tracked repo on the platform.", approval: "none", expectedResult: "Repo card linked." },
      { id: "3", title: "Ask DevOps Agent",           description: "Chat panel in the IDE — explains pipeline failures + recent deploys.", approval: "none", relatedAgent: "DevOps Engineer", expectedResult: "Answer with cite-back to log lines." },
      { id: "4", title: "Run safe scan",              description: "Read-only scan from the IDE.", approval: "none", relatedAgent: "Security Engineer", expectedResult: "Findings panel populated." },
    ],
  },
  automation_dry_run: {
    id: "automation_dry_run",
    title: "Automation (Dry Run) Demo",
    pitch: "Pick a Python script → dry-run → approval → execute → audit.",
    description: "The safety wall around any automation: dry-run first, then human approval, then audited execution.",
    estimatedMinutes: 7,
    audience: "client",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Pick automation",            description: "Library of curated Python scripts + workflows.", route: "/dashboard/automation", approval: "none", expectedResult: "Script card with description + last reviewed." },
      { id: "2", title: "Dry-run",                    description: "Runs without touching any real resource. Outputs the planned actions.", approval: "none", expectedResult: "Plan output + risk classification." },
      { id: "3", title: "Review",                     description: "Operator inspects the plan; can edit metadata.", approval: "none", expectedResult: "Operator approves or rejects." },
      { id: "4", title: "Approval packet",            description: "Two-person approval for any change-class action.", route: "/dashboard/approvals", approval: "two_person", expectedResult: "Both reviewers sign off." },
      { id: "5", title: "Execute",                    description: "Approved automation runs; outputs streamed to the page.", approval: "none", expectedResult: "Execution log + new state visible." },
      { id: "6", title: "Audit log",                  description: "Every action recorded with closed-union AuditAction.", route: "/dashboard/audit", approval: "none", expectedResult: "Audit row with actor, action, outcome, correlation id." },
    ],
  },
  ai_workforce_overview: {
    id: "ai_workforce_overview",
    title: "AI Workforce Overview",
    pitch: "See engineers · tool access · approval rules · activity · audit.",
    description: "What every engineer is allowed to do + what they've actually done.",
    estimatedMinutes: 5,
    audience: "client",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Engineer registry",          description: "List of all available engineers (Cloud, DevOps, Security, Monitoring, Incident, Database, etc.).", route: "/dashboard/workforce", approval: "none", expectedResult: "Per-engineer status + scope." },
      { id: "2", title: "Tool access",                description: "Which tools each engineer can call.", route: "/dashboard/agent-tools", approval: "none", expectedResult: "Per-engineer scope list." },
      { id: "3", title: "Approval rules",             description: "Closed-union policies that gate each action class.", route: "/dashboard/policies", approval: "none", expectedResult: "Per-action approval tier visible." },
      { id: "4", title: "Activity",                   description: "Recent action attempts (approved, denied, executed).", route: "/dashboard/agent-activity", approval: "none", expectedResult: "Timeline of attempts with outcome." },
      { id: "5", title: "Audit trail",                description: "Every action's full audit row.", route: "/dashboard/audit", approval: "none", expectedResult: "Audit log per actor / per organization." },
    ],
  },
  pricing_and_usage: {
    id: "pricing_and_usage",
    title: "Pricing & Usage Demo",
    pitch: "See plan limits · AI usage · token consumption · overage alerts.",
    description: "How operators stay inside their plan + when to upgrade.",
    estimatedMinutes: 4,
    audience: "client",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Plan tier",                  description: "Current tier + entitlements.", route: "/dashboard/billing", approval: "none", expectedResult: "Tier card + month-to-date usage." },
      { id: "2", title: "AI credit usage",            description: "Cents spent month-to-date vs included pool.", route: "/dashboard/ai-usage", approval: "none", expectedResult: "Spend chart + projection." },
      { id: "3", title: "v1 API quota",               description: "Monthly v1 API call count vs the plan cap.", approval: "none", expectedResult: "Quota gauge + nearLimit warning at 90%." },
      { id: "4", title: "Overage alert",              description: "Email + in-app alert at 70/90/100% of any dimension.", approval: "none", expectedResult: "Alert visible in notifications." },
      { id: "5", title: "Upgrade flow",               description: "Request enterprise quote OR self-serve upgrade.", approval: "none", expectedResult: "Upgrade request created or new tier active." },
    ],
  },
  internal_growth_automation: {
    id: "internal_growth_automation",
    title: "Internal Growth Automation",
    pitch: "INTERNAL-ONLY: LinkedIn/X drafts + campaign planning + website suggestions.",
    description: "Admin-only. NEVER surfaced to client workspaces. Drafts always require human approval before posting.",
    estimatedMinutes: 6,
    audience: "internal_only",
    lastReviewed: REVIEWED,
    steps: [
      { id: "1", title: "Generate drafts",            description: "AI generates 3-5 post drafts from recent platform activity.", approval: "self_approve", expectedResult: "Drafts queued in admin inbox." },
      { id: "2", title: "Human approval",             description: "Operator edits + approves a draft.", approval: "self_approve", expectedResult: "Approved draft moves to scheduled." },
      { id: "3", title: "Campaign planning",          description: "Group drafts into a multi-post campaign.", approval: "none", expectedResult: "Campaign visible in admin view." },
      { id: "4", title: "Website content suggestions",description: "AI suggests landing-page copy improvements based on funnel data.", approval: "self_approve", expectedResult: "Suggestions appear in admin doc surface." },
    ],
  },
};

/** Returns every scenario allowed for a given audience. */
export function listScenarios(audience: DemoAudience): ReadonlyArray<DemoScenario> {
  const allowed: ReadonlyArray<DemoAudience> = audience === "internal_only"
    ? ["public", "client", "internal_only"]
    : audience === "client"
    ? ["public", "client"]
    : ["public"];
  return Object.values(DEMO_SCENARIOS).filter((s) => allowed.includes(s.audience));
}

export function getScenario(id: DemoScenarioId): DemoScenario {
  return DEMO_SCENARIOS[id];
}

export function isDemoScenarioId(s: string): s is DemoScenarioId {
  return s in DEMO_SCENARIOS;
}
