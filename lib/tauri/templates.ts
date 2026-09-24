export type DeploymentTemplateId =
  | "rca_compliance" | "flashkey_release" | "oprs_dbployer"
  | "connector_config" | "dep_pipeline" | "cops_image_refresh"
  | "canvas_code_oprs" | "maltss_chase" | "airflow_s2p_recovery"
  | "btp_reset";

export interface DeploymentTemplate {
  id: DeploymentTemplateId;
  name: string;
  trigger: string;
  changeModel: "automatic" | "separate_compliance" | "manual" | "configurable";
  requiredCapabilities: string[];
  hardStops: string[];
  steps: string[];
  validations: string[];
  knownFailurePolicy: string[];
}

export const deploymentTemplates: readonly DeploymentTemplate[] = [
  {
    id: "rca_compliance",
    name: "RCA / Compliance Workflow",
    trigger: "manual_workflow_dispatch",
    changeModel: "separate_compliance",
    requiredCapabilities: ["view_repository", "run_workflow", "approve_change"],
    hardStops: ["repository workflow write access unknown", "milestone target date invalid", "approval time unavailable"],
    steps: ["verify release data", "dispatch compliance workflow", "wait for IT approval", "wait for business approval", "allow deployment inside window"],
    validations: ["change number recorded", "approval states recorded", "retry history retained"],
    knownFailurePolicy: ["general contributor access does not prove workflow permission"],
  },
  {
    id: "flashkey_release",
    name: "GitHub Release",
    trigger: "release_publication",
    changeModel: "separate_compliance",
    requiredCapabilities: ["approve_pr", "merge_pr", "create_release", "publish_release"],
    hardStops: ["peer approval missing", "Code Owner approval missing", "change approval incomplete"],
    steps: ["verify approvals", "merge PR", "draft release", "create tag", "publish release", "monitor deploy workflow"],
    validations: ["deployment workflow started", "required jobs passed", "application validation passed"],
    knownFailurePolicy: ["PR approval does not trigger deployment"],
  },
  {
    id: "oprs_dbployer",
    name: "OPRS DBployer",
    trigger: "manual_workflow_dispatch",
    changeModel: "automatic",
    requiredCapabilities: ["merge_pr", "run_workflow", "approve_environment", "access_oracle"],
    hardStops: ["backup unconfirmed", "table list unconfirmed", "authorized user unconfirmed", "change window closed", "rollback unconfirmed"],
    steps: ["merge to configured production branch", "validate workflow inputs", "create change", "generate SQL", "approve protected gates", "deploy database", "close change"],
    validations: ["objects valid", "expected columns present", "row counts expected", "no invalid objects"],
    knownFailurePolicy: ["Node deprecation alone is warning", "ServiceNow workgroup errors block"],
  },
  {
    id: "connector_config",
    name: "Connector Deploy Config",
    trigger: "manual_workflow_dispatch",
    changeModel: "configurable",
    requiredCapabilities: ["merge_pr", "run_workflow"],
    hardStops: ["stage validation missing", "repository-specific workflow permission missing"],
    steps: ["verify stage", "squash merge", "dispatch Deploy Config", "open configured production path"],
    validations: ["correct client", "correct path", "correct values", "workflow completed"],
    knownFailurePolicy: ["functional validation may be deferred with owner and monitoring"],
  },
  {
    id: "dep_pipeline",
    name: "DEP Pipeline",
    trigger: "composite",
    changeModel: "configurable",
    requiredCapabilities: ["merge_pr", "run_workflow", "access_azure"],
    hardStops: ["unknown job failure", "critical checkpoint failed"],
    steps: ["verify PR", "merge", "run actions", "inspect individual jobs", "validate Azure"],
    validations: ["critical jobs passed", "production configuration correct", "pipeline and notebooks present"],
    knownFailurePolicy: ["known compression failures require owner and expiration", "overall workflow color is insufficient"],
  },
  {
    id: "cops_image_refresh",
    name: "COPS Security Image Refresh",
    trigger: "composite",
    changeModel: "manual",
    requiredCapabilities: ["publish_release", "access_registry", "access_kubernetes", "access_helm", "access_vault"],
    hardStops: ["active critical batch", "backup missing", "unreviewed Helm drift", "credential owner unavailable"],
    steps: ["confirm production window", "clone and review change", "build and push", "non-production sanity", "deploy chart", "rotate secret reference", "restart approved services"],
    validations: ["image metadata valid", "pods healthy", "Airflow upgrade valid", "PG Bouncer reviewed"],
    knownFailurePolicy: ["force conflicts defaults off", "SonarQube severity is policy-driven"],
  },
  {
    id: "canvas_code_oprs",
    name: "Canvas + Code + OPRS",
    trigger: "manual_execution",
    changeModel: "configurable",
    requiredCapabilities: ["access_canvas", "merge_pr"],
    hardStops: ["manual owner missing", "before state missing", "exact path missing"],
    steps: ["apply Canvas configuration", "deploy code", "add ordered batch-driver step"],
    validations: ["after-state screenshot attached", "step order correct", "capitalization correct", "next batch monitored"],
    knownFailurePolicy: ["every manual stage requires separate evidence"],
  },
  {
    id: "maltss_chase",
    name: "MALTSS / Chase Checkpoints",
    trigger: "external_orchestrator",
    changeModel: "configurable",
    requiredCapabilities: ["review_pr", "access_azure", "validate_pagerduty"],
    hardStops: ["external merge owner unavailable", "checkpoint inventory incomplete"],
    steps: ["obtain external merge", "deploy checkpoints", "validate pipeline layout", "validate dashboard and alerts"],
    validations: ["checkpoint presence", "SLA values", "dashboard visibility", "future batch follow-up"],
    knownFailurePolicy: ["external team may retain merge ownership"],
  },
  {
    id: "airflow_s2p_recovery",
    name: "Airflow S2P Recovery",
    trigger: "approved_issue",
    changeModel: "configurable",
    requiredCapabilities: ["approve_change", "access_airflow", "access_oracle"],
    hardStops: ["approval missing", "count difference unexplained", "large rejection unresolved upstream"],
    steps: ["record batch and correlation IDs", "show expected loaded rejected and difference", "approve correction", "run controlled procedure", "resume batch"],
    validations: ["counts reconciled", "batch resumed", "audit retained"],
    knownFailurePolicy: ["correction cannot hide material data-quality failures"],
  },
  {
    id: "btp_reset",
    name: "BTP Reset Logic",
    trigger: "scheduled_workflow",
    changeModel: "configurable",
    requiredCapabilities: ["run_workflow", "access_oracle"],
    hardStops: ["reset is not idempotent", "fallback scenario untested"],
    steps: ["reset at batch initialization", "separate reset from rollover", "execute next eligible fallback"],
    validations: ["scheduled reset", "missed day", "multiple batches", "non-reset day", "failed first batch recovery"],
    knownFailurePolicy: ["scenario evidence is reusable but execution evidence remains deployment-specific"],
  },
];

export function getDeploymentTemplate(id: DeploymentTemplateId): DeploymentTemplate {
  const template = deploymentTemplates.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`Unknown deployment template: ${id}`);
  return template;
}
