/**
 * Integration registry — Phase 412.
 *
 * Single source of truth for every cloud + third-party connector the
 * platform supports, and HOW the customer activates it. Closed-union
 * `IntegrationActivationKind` makes the activation UX consistent: each
 * integration declares one of:
 *
 *   - "cloud_formation_quickcreate"  · AWS one-click
 *   - "azure_arm_deploy"              · Azure "Deploy to Azure" button
 *   - "gcp_cloud_shell"               · GCP Cloud Shell tutorial walkthrough
 *   - "oauth"                         · GitHub / GitLab / Slack / Linear
 *   - "webhook_inbound"               · CloudWatch / Grafana / Dynatrace
 *   - "ide_extension"                 · VS Code / JetBrains
 *   - "manual_paste"                  · only for things genuinely unautomatable
 *
 * Pure data — no I/O. The /dashboard/integrations catalog renders this
 * directly and so does the public marketing page.
 */

export type IntegrationActivationKind =
  | "cloud_formation_quickcreate"
  | "azure_arm_deploy"
  | "gcp_cloud_shell"
  | "oauth"
  | "webhook_inbound"
  | "ide_extension"
  | "manual_paste";

export type IntegrationCategory =
  | "cloud"
  | "vcs"
  | "monitoring"
  | "incidents"
  | "communications"
  | "orchestration"
  | "ide"
  | "db";

export type IntegrationStatus = "live" | "beta" | "planned";

export interface Integration {
  id: string;
  name: string;
  blurb: string;
  category: IntegrationCategory;
  activation: IntegrationActivationKind;
  status: IntegrationStatus;
  /** "Click → connect" hint for the catalog card. */
  cta: string;
  /** The actual one-click destination, or a route to start an OAuth dance. */
  startHref?: string;
  /** Closed-union of scopes / permissions the integration grants the platform. */
  permissionsSummary: string;
  /** Whether the platform can write back, or read-only. */
  writeAccess: "none" | "approval_gated" | "auto";
}

export const INTEGRATIONS: ReadonlyArray<Integration> = [
  // ─── Cloud providers ────────────────────────────────────────────────
  {
    id: "aws",
    name: "AWS",
    blurb: "Read-only cross-account IAM role provisioned via CloudFormation.",
    category: "cloud",
    activation: "cloud_formation_quickcreate",
    status: "live",
    cta: "Connect with CloudFormation (1 click)",
    startHref: "/operator/onboarding?provider=aws",
    permissionsSummary: "ec2:Describe* · rds:* · s3:Get*/List* · iam read · cloudwatch metrics · cost explorer",
    writeAccess: "approval_gated",
  },
  {
    id: "azure",
    name: "Azure",
    blurb: "Reader-tier service principal provisioned via ARM template.",
    category: "cloud",
    activation: "azure_arm_deploy",
    status: "live",
    cta: "Deploy to Azure (1 click)",
    startHref: "/operator/onboarding?provider=azure",
    permissionsSummary: "Reader role on selected subscription · Microsoft.Resources/* · Microsoft.Compute read",
    writeAccess: "approval_gated",
  },
  {
    id: "gcp",
    name: "GCP",
    blurb: "Service account with roles/iam.securityReviewer provisioned via Cloud Shell.",
    category: "cloud",
    activation: "gcp_cloud_shell",
    status: "live",
    cta: "Open in Cloud Shell (1 click)",
    startHref: "/operator/onboarding?provider=gcp",
    permissionsSummary: "roles/iam.securityReviewer · roles/viewer · scoped to selected project",
    writeAccess: "approval_gated",
  },
  // ─── VCS ────────────────────────────────────────────────────────────
  {
    id: "github",
    name: "GitHub",
    blurb: "OAuth app · reads workflow runs, repos, and commit metadata.",
    category: "vcs",
    activation: "oauth",
    status: "live",
    cta: "Connect with GitHub (OAuth)",
    startHref: "/api/auth/signin/github",
    permissionsSummary: "repo + workflow scopes (read-only) · PR open is opt-in",
    writeAccess: "approval_gated",
  },
  {
    id: "gitlab",
    name: "GitLab",
    blurb: "Planned read-only repository and CI evidence.",
    category: "vcs",
    activation: "oauth",
    status: "planned",
    cta: "Setup planned",
    permissionsSummary: "Workspace consent and read scope pending",
    writeAccess: "none",
  },
  // ─── Monitoring ─────────────────────────────────────────────────────
  {
    id: "cloudwatch",
    name: "AWS CloudWatch",
    blurb: "Inbound alerts via HMAC-signed webhooks.",
    category: "monitoring",
    activation: "webhook_inbound",
    status: "live",
    cta: "Generate webhook URL + secret",
    permissionsSummary: "Inbound only — platform never writes back.",
    writeAccess: "none",
  },
  {
    id: "grafana",
    name: "Grafana",
    blurb: "Inbound alerts via HMAC-signed webhooks.",
    category: "monitoring",
    activation: "webhook_inbound",
    status: "live",
    cta: "Generate webhook URL + secret",
    permissionsSummary: "Inbound only.",
    writeAccess: "none",
  },
  {
    id: "dynatrace",
    name: "Dynatrace",
    blurb: "Inbound alerts via HMAC-signed webhooks.",
    category: "monitoring",
    activation: "webhook_inbound",
    status: "beta",
    cta: "Generate webhook URL + secret",
    permissionsSummary: "Inbound only.",
    writeAccess: "none",
  },
  // ─── Communications ─────────────────────────────────────────────────
  {
    id: "slack",
    name: "Slack",
    blurb: "OAuth app · posts approval requests, incident alerts to a channel.",
    category: "communications",
    activation: "oauth",
    status: "live",
    cta: "Connect with Slack (OAuth)",
    permissionsSummary: "channels:read · chat:write · incoming-webhook",
    writeAccess: "auto",
  },
  {
    id: "linear",
    name: "Linear",
    blurb: "OAuth app · creates issues from incidents + findings.",
    category: "incidents",
    activation: "oauth",
    status: "beta",
    cta: "Connect with Linear (OAuth)",
    permissionsSummary: "issues:write · projects:read",
    writeAccess: "approval_gated",
  },
  {
    id: "airflow",
    name: "Apache Airflow",
    blurb: "Validated DAG discovery, run monitoring, schedules, and governed automation.",
    category: "orchestration",
    activation: "manual_paste",
    status: "live",
    cta: "Configure Airflow",
    permissionsSummary: "DAG and run read · trigger requires explicit deploy:execute authority",
    writeAccess: "approval_gated",
  },
  {
    id: "prefect",
    name: "Prefect",
    blurb: "Read-only flow, run and task-run inspection for the Agent.",
    category: "orchestration",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "Flows, flow runs and task runs read only · no create, retry or cancel",
    writeAccess: "none",
  },
  {
    id: "dagster",
    name: "Dagster",
    blurb: "Read-only job and run inspection through fixed GraphQL queries.",
    category: "orchestration",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "Jobs and runs read only · no launch, re-execute or terminate",
    writeAccess: "none",
  },
  {
    id: "argo_workflows",
    name: "Argo Workflows",
    blurb: "Read-only template and workflow inspection in one namespace.",
    category: "orchestration",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "One namespace · templates and workflows read only · no submit, retry or stop",
    writeAccess: "none",
  },
  {
    id: "argo_cd",
    name: "Argo CD",
    blurb: "Read-only GitOps observation: which commit each application in one project has applied.",
    category: "orchestration",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "One project · applications read only · no sync, rollback or refresh",
    writeAccess: "none",
  },
  {
    id: "flux",
    name: "Flux",
    blurb: "Read-only GitOps observation of Kustomizations in one namespace through the Kubernetes API.",
    category: "orchestration",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "One namespace · Kustomizations read only · no reconcile, suspend or patch",
    writeAccess: "none",
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    blurb: "Read-only open incidents, shown as context when a deployment goes out during an incident.",
    category: "incidents",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "Incidents read only · no trigger, acknowledge or resolve",
    writeAccess: "none",
  },
  {
    id: "sentry",
    name: "Sentry",
    blurb: "Read-only new errors by release, to verify a deployment did not introduce regressions.",
    category: "monitoring",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "One project · issues read only · no resolve, assign or mute",
    writeAccess: "none",
  },
  {
    id: "datadog",
    name: "Datadog",
    blurb: "Read-only monitor states for a service, shown beside its releases.",
    category: "monitoring",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "Monitors read only (monitors_read) · no mute, edit or resolve",
    writeAccess: "none",
  },
  {
    id: "jenkins",
    name: "Jenkins",
    blurb: "Read-only jobs and last build results for teams that run CI on Jenkins.",
    category: "vcs",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "Overall/Read and Job/Read · no builds, aborts or configuration",
    writeAccess: "none",
  },
  {
    id: "unleash",
    name: "Unleash",
    blurb: "Read-only flag state for one environment through the client API.",
    category: "orchestration",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "Client token · flag configuration read only · no toggles or strategy changes",
    writeAccess: "none",
  },
  {
    id: "opsgenie",
    name: "Opsgenie",
    blurb: "Read-only open alerts, shown as context beside deployments.",
    category: "incidents",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "Alerts read only · no create, acknowledge or close",
    writeAccess: "none",
  },
  {
    id: "launchdarkly",
    name: "LaunchDarkly",
    blurb: "Read-only flag state in one project and environment, beside each release.",
    category: "orchestration",
    activation: "manual_paste",
    status: "beta",
    cta: "Connect read-only",
    permissionsSummary: "One project and environment · flags read only · no toggles or targeting changes",
    writeAccess: "none",
  },

  // ─── IDE ────────────────────────────────────────────────────────────
  {
    id: "vscode",
    name: "VS Code",
    blurb: "Extension authenticates with the same vxlk_* API key as desktop.",
    category: "ide",
    activation: "ide_extension",
    status: "beta",
    cta: "Install the extension",
    startHref: "https://marketplace.visualstudio.com/items?itemName=visionxixlabs.axiom-agent",
    permissionsSummary: "Whatever scopes the API key carries.",
    writeAccess: "approval_gated",
  },
  // ─── DBs (read-only telemetry only) ─────────────────────────────────
  {
    id: "postgres",
    name: "Postgres",
    blurb: "Read-only DB user · pg_monitor + pg_read_server_files.",
    category: "db",
    activation: "manual_paste",
    status: "live",
    cta: "Generate read-only DDL",
    permissionsSummary: "SELECT on information_schema · pg_monitor · pg_read_server_files",
    writeAccess: "none",
  },
  {
    id: "mysql",
    name: "MySQL",
    blurb: "Read-only DB user · SELECT on information_schema.*.",
    category: "db",
    activation: "manual_paste",
    status: "live",
    cta: "Generate read-only DDL",
    permissionsSummary: "SELECT on information_schema",
    writeAccess: "none",
  },
];

export function listIntegrationsByCategory(category: IntegrationCategory): ReadonlyArray<Integration> {
  return INTEGRATIONS.filter((i) => i.category === category);
}

export function listAllCategories(): ReadonlyArray<{ id: IntegrationCategory; label: string }> {
  return [
    { id: "cloud",          label: "Cloud providers"          },
    { id: "vcs",            label: "Source control"           },
    { id: "monitoring",     label: "Monitoring + observability" },
    { id: "incidents",      label: "Incidents + paging"       },
    { id: "communications", label: "Communications"           },
    { id: "orchestration",  label: "Workflow orchestration"   },
    { id: "ide",            label: "IDE + editor"             },
    { id: "db",             label: "Databases"                },
  ];
}
