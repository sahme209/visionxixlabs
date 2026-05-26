/**
 * Phase 446 — SOP generator.
 *
 * Pure function: given a deployment type (closed union of 10 per spec
 * §3) and optional context, produces a fully-formed Standard Operating
 * Procedure document with 15+ sections. Output is canonical and
 * exportable as Markdown / PDF / DOCX / JSON in later phases.
 *
 * No I/O. The dashboard / docs / evidence-pack composers read the
 * shape returned here and render it in their own surface.
 */

/* ──────────────────────────────────────────────────────────────────
   Closed union of supported deployment types.
   ────────────────────────────────────────────────────────────── */

export type DeploymentType =
  | "application"
  | "kubernetes_helm"
  | "data_pipeline"
  | "connector"
  | "database_liquibase"
  | "airflow_dag"
  | "terraform_iac"
  | "emergency_fix"
  | "rollback_recovery"
  | "manual_reconciliation";

export const ALL_DEPLOYMENT_TYPES: ReadonlyArray<DeploymentType> = [
  "application", "kubernetes_helm", "data_pipeline", "connector",
  "database_liquibase", "airflow_dag", "terraform_iac",
  "emergency_fix", "rollback_recovery", "manual_reconciliation",
];

export function deploymentTypeLabel(t: DeploymentType): string {
  switch (t) {
    case "application":           return "Application deployment";
    case "kubernetes_helm":       return "Kubernetes / Helm deployment";
    case "data_pipeline":         return "Data pipeline deployment";
    case "connector":             return "Connector / integration deployment";
    case "database_liquibase":    return "Database / Liquibase deployment";
    case "airflow_dag":           return "Airflow / DAG deployment";
    case "terraform_iac":         return "Infrastructure / Terraform deployment";
    case "emergency_fix":         return "Emergency production fix";
    case "rollback_recovery":     return "Rollback / recovery";
    case "manual_reconciliation": return "Manual configuration reconciliation";
  }
}

/* ──────────────────────────────────────────────────────────────────
   Output shape.
   ────────────────────────────────────────────────────────────── */

export interface SopSection {
  /** Stable section id; used by Markdown anchors + JSON consumers. */
  id: SopSectionId;
  title: string;
  /** Each bullet is a plain string. The renderer wraps in list markup. */
  bullets: ReadonlyArray<string>;
}

export type SopSectionId =
  | "purpose"
  | "scope"
  | "roles_and_responsibilities"
  | "pre_deployment_readiness_checklist"
  | "branch_validation_checklist"
  | "change_ticket_checklist"
  | "release_evidence_checklist"
  | "deployment_execution_steps"
  | "post_deployment_validation_steps"
  | "rollback_steps"
  | "communication_templates"
  | "go_no_go_rules"
  | "audit_and_evidence_requirements"
  | "exception_handling_process"
  | "emergency_change_process"
  | "post_incident_follow_up";

export interface SopDocument {
  deploymentType: DeploymentType;
  title: string;
  /** Generated-at ISO — supplied by caller for determinism in tests. */
  generatedAt: string;
  /** Optional operator override of the engine's purpose copy. */
  purposeOverride?: string;
  sections: ReadonlyArray<SopSection>;
}

export interface GenerateSopOptions {
  /** Override generatedAt. Defaults to new Date().toISOString(). */
  now?: Date;
  /** Optional one-line purpose override for org-specific phrasing. */
  purpose?: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export function generateSop(
  deploymentType: DeploymentType,
  opts: GenerateSopOptions = {},
): SopDocument {
  const now = (opts.now ?? new Date()).toISOString();
  const purpose = opts.purpose ?? PURPOSE[deploymentType];

  const sections: SopSection[] = [
    { id: "purpose",                          title: "Purpose",                         bullets: [purpose] },
    { id: "scope",                            title: "Scope",                           bullets: SCOPE[deploymentType] },
    { id: "roles_and_responsibilities",       title: "Roles and responsibilities",      bullets: ROLES_AND_RESPONSIBILITIES },
    { id: "pre_deployment_readiness_checklist", title: "Pre-deployment readiness checklist", bullets: PRE_DEPLOYMENT[deploymentType] },
    { id: "branch_validation_checklist",      title: "Branch validation checklist",     bullets: BRANCH_VALIDATION },
    { id: "change_ticket_checklist",          title: "Change ticket checklist",         bullets: CHANGE_TICKET },
    { id: "release_evidence_checklist",       title: "Release evidence checklist",      bullets: RELEASE_EVIDENCE[deploymentType] },
    { id: "deployment_execution_steps",       title: "Deployment execution steps",      bullets: DEPLOYMENT_EXECUTION[deploymentType] },
    { id: "post_deployment_validation_steps", title: "Post-deployment validation steps", bullets: POST_DEPLOYMENT_VALIDATION[deploymentType] },
    { id: "rollback_steps",                   title: "Rollback steps",                  bullets: ROLLBACK[deploymentType] },
    { id: "communication_templates",          title: "Communication templates",         bullets: COMMUNICATION_TEMPLATES },
    { id: "go_no_go_rules",                   title: "Go / no-go rules",                bullets: GO_NO_GO[deploymentType] },
    { id: "audit_and_evidence_requirements",  title: "Audit and evidence requirements", bullets: AUDIT_REQUIREMENTS },
    { id: "exception_handling_process",       title: "Exception handling process",      bullets: EXCEPTION_HANDLING },
    { id: "emergency_change_process",         title: "Emergency change process",        bullets: EMERGENCY_CHANGE },
    { id: "post_incident_follow_up",          title: "Post-incident follow-up process", bullets: POST_INCIDENT_FOLLOW_UP },
  ];

  return {
    deploymentType,
    title: deploymentTypeLabel(deploymentType),
    generatedAt: now,
    purposeOverride: opts.purpose,
    sections,
  };
}

/* ──────────────────────────────────────────────────────────────────
   Per-deployment-type content tables.
   ────────────────────────────────────────────────────────────── */

const PURPOSE: Record<DeploymentType, string> = {
  application:           "Standardize the steps to deploy an application service to a target environment safely, with audited evidence and rollback ready.",
  kubernetes_helm:       "Standardize Helm-based deployments to a Kubernetes cluster with correct chart, image, namespace, and recoverable revision.",
  data_pipeline:         "Standardize the deployment of an ingestion, transformation, or batch pipeline with file-pattern, sidecar, and idempotency safeguards.",
  connector:             "Standardize the deployment of a connector or integration configuration with branch, evidence, and downstream coordination.",
  database_liquibase:    "Standardize Liquibase or Flyway-driven schema and configuration changes with rollback or documented recovery.",
  airflow_dag:           "Standardize Airflow DAG deployments with schedule, retry, and dependency documentation.",
  terraform_iac:         "Standardize Terraform-driven infrastructure changes with plan review, approval, and state-lock safety.",
  emergency_fix:         "Standardize the emergency response path: minimal change, manual recovery allowed, reconciliation task required.",
  rollback_recovery:     "Standardize the rollback path: revert to last verified good state, validate, then plan forward fix.",
  manual_reconciliation: "Standardize the closing of a manual production change loop by recording the fix in the source of truth.",
};

const SCOPE: Record<DeploymentType, ReadonlyArray<string>> = {
  application: [
    "Applies to any application service tracked under an Application + Component entry.",
    "Applies to dev / test / qa / uat / stage / preprod / prod environments.",
  ],
  kubernetes_helm: [
    "Applies to any service whose deploy uses a Helm chart against a Kubernetes namespace.",
    "Excludes raw kubectl apply — those must convert to a chart before this SOP applies.",
  ],
  data_pipeline: [
    "Applies to ADF, Databricks, Airflow-orchestrated, or file-ingestion pipelines.",
    "Applies to both initial deploy and update of existing pipelines.",
  ],
  connector: [
    "Applies to any connector / integration component that brokers data between systems.",
    "Includes inbound, outbound, and listener-style connectors.",
  ],
  database_liquibase: [
    "Applies to schema, view, index, stored-procedure, grant, and configuration-table changes managed via Liquibase or Flyway.",
    "Includes both DDL and runtime-configuration DML changesets.",
  ],
  airflow_dag: [
    "Applies to new DAGs, modified DAGs, and DAG-config changes deployed to a managed Airflow environment.",
  ],
  terraform_iac: [
    "Applies to any infrastructure change executed via Terraform / Pulumi / Bicep with managed state.",
  ],
  emergency_fix: [
    "Applies ONLY when a production incident requires a non-standard fix outside the change window.",
    "Every emergency fix must create a reconciliation task for the source of truth.",
  ],
  rollback_recovery: [
    "Applies when a recently-deployed release must be reverted to the previously-verified release tag or Helm revision.",
  ],
  manual_reconciliation: [
    "Applies to any manual production change that was made outside Git / Helm / Vault / Liquibase / IaC.",
    "Closing the loop here is required before the parent incident can be closed.",
  ],
};

const ROLES_AND_RESPONSIBILITIES: ReadonlyArray<string> = [
  "Developer — implements the code/config change, raises PR, links story/defect, provides test evidence, confirms rollback consideration.",
  "DevOps — validates branch/tag, evidence, change ticket, approvals; executes or governs the deployment; sends communication; captures audit evidence.",
  "Manager / App Owner — approves production scope, exceptions, emergency changes; validates business readiness.",
  "Support / L1-L2 — monitors runtime, triages incidents, follows documented reprocessing/recovery SOP; never makes undocumented manual fixes; creates reconciliation tasks.",
];

const PRE_DEPLOYMENT: Record<DeploymentType, ReadonlyArray<string>> = {
  application: [
    "PR linked to user story / defect and approved by required reviewers.",
    "CI/CD checks green on the release commit.",
    "Release tag created and points to the approved commit SHA.",
    "Rollback reference release identified.",
    "Target environment and change window confirmed.",
  ],
  kubernetes_helm: [
    "Chart version + image tag align with the release tag.",
    "Values files reviewed and per-environment overrides captured.",
    "Previous Helm revision recorded for rollback.",
    "Kubernetes namespace and target cluster confirmed.",
  ],
  data_pipeline: [
    "File-pattern wildcard reviewed against duplicate-file risk.",
    "Sidecar / control-file behaviour verified.",
    "Idempotency / batch-ID strategy documented.",
    "Downstream connectors and notification path confirmed.",
  ],
  connector: [
    "Connector branch matches branch-to-environment policy.",
    "Source/destination credentials present in secret store with metadata.",
    "Downstream consumer impact reviewed.",
    "Validation plan covers retry + error file handling.",
  ],
  database_liquibase: [
    "Every changeset has a unique ID and checksum verified.",
    "Rollback statement OR documented manual recovery present for each changeset.",
    "Lower environments already validated with the same changesets.",
    "Deployment order coordinated with application/connector deployments.",
  ],
  airflow_dag: [
    "DAG file deployed from approved branch / tag.",
    "Schedule, retry policy, and SLA documented.",
    "Handshake / sensor dependencies enumerated.",
    "Failure handling and backfill / replay procedure documented.",
  ],
  terraform_iac: [
    "Terraform plan generated against the target state.",
    "Plan reviewed and approved by required approvers.",
    "State backend lock confirmed and idle.",
    "Drift findings reviewed prior to apply.",
  ],
  emergency_fix: [
    "Incident ticket open with severity recorded.",
    "Manager / on-call approver named.",
    "Minimal-scope intent documented (what changes, what does not).",
    "Reconciliation task pre-created for source-of-truth follow-up.",
  ],
  rollback_recovery: [
    "Previous verified release tag or Helm revision identified.",
    "Database-change reversibility confirmed (or manual recovery accepted).",
    "Stakeholder notification prepared.",
    "Validation plan against the rolled-back state ready.",
  ],
  manual_reconciliation: [
    "Manual change record loaded (what / who / when / why).",
    "Target source-of-truth identified (Git / Helm / Vault / Liquibase / IaC / change ticket).",
    "Reconciliation owner assigned with due date.",
  ],
};

const BRANCH_VALIDATION: ReadonlyArray<string> = [
  "Source branch or tag identified.",
  "Target environment confirmed.",
  "Branch / tag follows the configured branch-to-environment policy.",
  "Direct push blocked on protected branches.",
  "Change merged through a pull request.",
  "Required reviewers present.",
  "CODEOWNERS approvals present where applicable.",
  "Required CI/CD checks passed.",
  "PR linked to user story / defect.",
  "PR linked to production change ticket.",
  "Changed files within approved scope.",
  "No unrelated commits included.",
  "Branch up to date with target.",
  "Release tag created (for production).",
  "Release tag based on approved branch.",
  "Release tag points to approved commit SHA.",
  "Release diff matches approved PR list.",
  "Rollback reference identified.",
];

const CHANGE_TICKET: ReadonlyArray<string> = [
  "Change ticket number attached.",
  "Deployment summary present.",
  "Business reason documented.",
  "User stories / defects linked.",
  "Repositories involved listed.",
  "Branch or release tag named.",
  "Commit SHA recorded.",
  "Workflow run link captured.",
  "Artifact / image tag recorded.",
  "Components impacted enumerated.",
  "Planned change window matches actual deployment time.",
  "Risk assessment present.",
  "Rollback plan attached.",
  "Validation plan attached.",
  "Approvers named.",
  "Stakeholder communication evidence linked.",
];

const RELEASE_EVIDENCE: Record<DeploymentType, ReadonlyArray<string>> = {
  application: [
    "Build workflow run + artifact tag captured.",
    "Deploy workflow run + status captured.",
    "Post-deploy validation results captured.",
  ],
  kubernetes_helm: [
    "Helm release name, chart version, app version, image tag, namespace recorded.",
    "Helm revision + previous revision captured for rollback.",
    "Non-sensitive values-source summary attached.",
    "Pod health and probe results captured.",
  ],
  data_pipeline: [
    "Sample run + count validation attached.",
    "Sidecar / control file behaviour proven.",
    "Downstream notification log captured.",
  ],
  connector: [
    "Connector smoke-test result captured.",
    "Downstream connector mapping documented.",
    "Error-file path and notification path verified.",
  ],
  database_liquibase: [
    "DATABASECHANGELOG (or equivalent) snapshot captured.",
    "Checksums verified post-deploy.",
    "Drift comparison against expected state attached.",
  ],
  airflow_dag: [
    "DAG file version / commit captured.",
    "Last successful run captured.",
    "Dependency map snapshot attached.",
  ],
  terraform_iac: [
    "Terraform plan output and apply output captured.",
    "State-backend digest captured pre and post.",
  ],
  emergency_fix: [
    "Incident ticket with timeline captured.",
    "Minimal-scope diff attached.",
    "Reconciliation task ID captured.",
  ],
  rollback_recovery: [
    "Previous release tag / Helm revision captured.",
    "Post-rollback validation results captured.",
  ],
  manual_reconciliation: [
    "Original manual change record attached.",
    "Reconciliation PR / commit / Vault path captured.",
    "Source-of-truth-now-matches assertion captured.",
  ],
};

const DEPLOYMENT_EXECUTION: Record<DeploymentType, ReadonlyArray<string>> = {
  application: [
    "Trigger deploy workflow from the approved release tag.",
    "Monitor workflow output for failures.",
    "Confirm artifact published to the expected registry.",
  ],
  kubernetes_helm: [
    "Run `helm upgrade --install <release> <chart> --version <chartVersion> -f values.yaml -f <env-overrides>`.",
    "Watch pod rollout: `kubectl rollout status deploy/<name> -n <namespace>`.",
    "Tail logs for the new revision pods.",
  ],
  data_pipeline: [
    "Deploy pipeline definition from approved branch / tag.",
    "Trigger sample run with a known-safe input file.",
    "Verify downstream signal / handshake table updated.",
  ],
  connector: [
    "Deploy connector configuration from the approved branch.",
    "Run smoke test on a known endpoint.",
    "Confirm error file path and notification channel reachable.",
  ],
  database_liquibase: [
    "Run `liquibase update` (or `flyway migrate`) against the target schema.",
    "Capture DATABASECHANGELOG diff.",
    "Verify checksums match expected.",
  ],
  airflow_dag: [
    "Deploy DAG file from approved branch.",
    "Pause / unpause DAG as required.",
    "Trigger manual run if first deployment; otherwise let scheduler pick up.",
  ],
  terraform_iac: [
    "Run `terraform plan` and attach output to change ticket.",
    "Get approver review on the plan.",
    "Run `terraform apply` with the same plan.",
  ],
  emergency_fix: [
    "Apply the minimal scope change in production.",
    "Restore service.",
    "Log the manual change in the platform.",
  ],
  rollback_recovery: [
    "Revert to the previous release tag or Helm revision.",
    "Apply database / config rollbacks if required.",
    "Validate restored state.",
  ],
  manual_reconciliation: [
    "Open PR / commit / Vault edit against the source of truth.",
    "Get approval per branch protection.",
    "Merge and confirm next planned deploy will reproduce the manual fix.",
  ],
};

const POST_DEPLOYMENT_VALIDATION: Record<DeploymentType, ReadonlyArray<string>> = {
  application: [
    "Run synthetic smoke test against the deployed service.",
    "Verify monitoring / alerting baseline.",
    "Confirm change ticket actual-deploy-time matches planned window.",
  ],
  kubernetes_helm: [
    "All replicas Ready according to deployment spec.",
    "Readiness / liveness probes passing.",
    "Service reachable from expected ingress.",
    "Logs clean for at least N minutes.",
  ],
  data_pipeline: [
    "Sample-run row counts match expected.",
    "No duplicate batch IDs.",
    "Error file directory empty or has only expected failures.",
  ],
  connector: [
    "Inbound / outbound traffic verified.",
    "Retry policy exercised at least once.",
    "Downstream system acknowledges payload.",
  ],
  database_liquibase: [
    "Object-level diff matches expectation.",
    "No drift against source-controlled state.",
    "Configuration tables match Git-defined seed (where applicable).",
  ],
  airflow_dag: [
    "First scheduled / triggered run succeeds.",
    "Sensors fire as expected.",
    "Downstream DAG signals fire.",
  ],
  terraform_iac: [
    "Resource diff matches plan output.",
    "No drift detected immediately post-apply.",
  ],
  emergency_fix: [
    "Service restored to baseline.",
    "Manual change logged.",
    "Reconciliation task assigned with due date.",
  ],
  rollback_recovery: [
    "Service back to last-verified state.",
    "Forward-fix plan drafted.",
  ],
  manual_reconciliation: [
    "Source of truth now reflects the manual change.",
    "Reconciliation task closed with link to the PR / commit.",
  ],
};

const ROLLBACK: Record<DeploymentType, ReadonlyArray<string>> = {
  application: [
    "Re-trigger deploy workflow with the previous release tag.",
    "Validate restored state via smoke test.",
  ],
  kubernetes_helm: [
    "Run `helm rollback <release> <previous-revision>`.",
    "Watch pod rollout to the previous image tag.",
    "Validate restored state.",
  ],
  data_pipeline: [
    "Stop the new pipeline if running.",
    "Re-deploy the previous pipeline definition.",
    "Validate downstream signal restored.",
  ],
  connector: [
    "Re-deploy previous connector configuration.",
    "Validate inbound + outbound flows.",
  ],
  database_liquibase: [
    "Run rollback for the deployed changeset(s).",
    "Verify checksum and schema state.",
  ],
  airflow_dag: [
    "Re-deploy previous DAG file from the prior commit.",
    "Unpause and validate the next scheduled / triggered run.",
  ],
  terraform_iac: [
    "Run `terraform apply` with the previously approved plan version.",
    "Verify state matches previous baseline.",
  ],
  emergency_fix: [
    "Revert the manual production change.",
    "Log the rollback as a separate manual change record.",
  ],
  rollback_recovery: [
    "If forward-deploy was applied during recovery, rollback again to last known good.",
    "Escalate to manager if rollback fails.",
  ],
  manual_reconciliation: [
    "If the reconciliation PR caused a regression, revert it.",
    "Re-open the parent manual change record.",
  ],
};

const COMMUNICATION_TEMPLATES: ReadonlyArray<string> = [
  "Pre-deployment notice — change ticket, release tag, components, window, owner, expected impact.",
  "Deployment started — change ticket, release tag, deploy workflow link.",
  "Deployment completed — change ticket, release tag, status, evidence link.",
  "Deployment failed — change ticket, release tag, error summary, rollback plan in progress.",
  "Rollback started / completed — change ticket, previous release tag, status.",
  "Post-deployment monitoring update — change ticket, observed metrics, follow-up items.",
  "Change window moved — original / new window, change ticket update.",
  "Emergency deployment notice — incident ticket, scope, manager approval, ETA.",
  "Manual production fix follow-up — manual change ID, reconciliation task, due date.",
];

const GO_NO_GO: Record<DeploymentType, ReadonlyArray<string>> = {
  application: [
    "GO requires branch validation passing OR exception approved.",
    "GO requires change ticket in approved state.",
    "GO requires rollback reference identified.",
  ],
  kubernetes_helm: [
    "GO requires previous Helm revision available.",
    "GO requires chart/image/namespace alignment with the release tag.",
  ],
  data_pipeline: [
    "GO requires sample-run validation passed in non-prod.",
    "GO requires downstream owner sign-off.",
  ],
  connector: [
    "GO requires connector smoke test passed.",
    "GO requires downstream consumer notified.",
  ],
  database_liquibase: [
    "GO requires rollback or documented manual recovery for every changeset.",
    "GO requires lower environments validated.",
  ],
  airflow_dag: [
    "GO requires schedule + retry + SLA documented.",
  ],
  terraform_iac: [
    "GO requires reviewed and approved plan.",
    "GO requires no unresolved drift findings.",
  ],
  emergency_fix: [
    "GO requires manager named and on-record.",
    "GO requires reconciliation task pre-created.",
  ],
  rollback_recovery: [
    "GO requires previous-verified release tag or revision identified.",
  ],
  manual_reconciliation: [
    "GO requires source-of-truth location named and owner assigned.",
  ],
};

const AUDIT_REQUIREMENTS: ReadonlyArray<string> = [
  "Every action recorded in the immutable audit log with actor + timestamp.",
  "Release evidence pack generated and attached to the change ticket.",
  "Approvers and approval decisions captured.",
  "Communication messages captured with timestamp + channel.",
  "Manual production changes recorded with reconciliation task ID.",
  "Exception approvals captured with approver + rationale + evidence.",
];

const EXCEPTION_HANDLING: ReadonlyArray<string> = [
  "Operator requests an exception from the platform's branch-validation card with a written rationale.",
  "Approver reviews and either grants or denies — both outcomes are audited.",
  "Granted exceptions allow the release to proceed; denied exceptions block the release.",
  "Recurring exceptions on the same rule must be reviewed in the quarterly governance meeting.",
];

const EMERGENCY_CHANGE: ReadonlyArray<string> = [
  "On-call engineer raises an emergency change ticket with severity recorded.",
  "Manager / approver of record acknowledges out-of-band (Slack / phone) — captured to the ticket.",
  "Minimal-scope change applied; manual change record created in the platform.",
  "Reconciliation task pre-created before service is declared restored.",
  "Post-incident review scheduled within 5 business days.",
];

const POST_INCIDENT_FOLLOW_UP: ReadonlyArray<string> = [
  "Incident retro held with all roles represented.",
  "Reconciliation task closed with link to the PR / commit / Vault path.",
  "Manual change record closed with the source-of-truth-now-matches assertion.",
  "If the emergency revealed a missing policy or SOP gap, propose the fix in the next governance meeting.",
];
