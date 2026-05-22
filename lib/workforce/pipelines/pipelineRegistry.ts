/**
 * Pipeline registry — Phase 377.
 *
 * Catalog of multi-stage workflows operators can fire from the
 * /dashboard/workforce/pipelines surface. Each PipelineDefinition is
 * a closed list of PipelineStage entries with a stable ordering.
 * The runtime keeps Pipeline*Run rows that reflect a specific run's
 * lifecycle; the registry is the spec.
 *
 * Stage kinds are a closed union — new shapes break the build. The
 * stage executor registry (registry-keyed by stageKind) decides what
 * each stage actually does at execute time; the default is a dry-run
 * executor that records what would have happened.
 */

export type PipelineStageKind =
  | "build"
  | "unit_test"
  | "integration_test"
  | "security_scan"
  | "lint"
  | "schema_plan"
  | "schema_apply"
  | "schema_verify"
  | "deploy"
  | "smoke_test"
  | "rollback"
  | "approval_gate"
  | "notify"
  // AI coding loop — Phase 379.
  | "code_read"
  | "code_propose"
  | "code_lint"
  | "code_test"
  | "code_pr_open";

export interface PipelineStage {
  id: string;
  kind: PipelineStageKind;
  name: string;
  description: string;
  /** When true the stage transitions to awaiting_approval and pauses for human sign-off. */
  requiresApproval: boolean;
  /** Approximate runtime in seconds for the dry-run path. Drives UI projections. */
  expectedDurationSeconds: number;
}

export type PipelineCategory = "ci_cd" | "database" | "security" | "observability" | "coding";

export interface PipelineDefinition {
  id: string;
  name: string;
  category: PipelineCategory;
  description: string;
  /** Operator-facing tagline ("Why use this pipeline?"). */
  tagline: string;
  stages: readonly PipelineStage[];
}

const BACKEND_DEPLOY: PipelineDefinition = {
  id: "backend_deploy",
  name: "Backend deploy",
  category: "ci_cd",
  description: "Standard backend deploy: build, test, security scan, two-step approval, deploy, smoke.",
  tagline: "One-click ship to production with the safety rails on.",
  stages: [
    { id: "build",            kind: "build",            name: "Build artefact",       description: "Compile, bundle, hash, and stage the deploy artefact in the registry.",            requiresApproval: false, expectedDurationSeconds: 60  },
    { id: "unit_test",        kind: "unit_test",        name: "Unit tests",           description: "Run the full vitest suite — currently 1630+ tests across 188 files.",              requiresApproval: false, expectedDurationSeconds: 30  },
    { id: "integration_test", kind: "integration_test", name: "Integration tests",    description: "End-to-end Playwright + DB-backed integration suite.",                              requiresApproval: false, expectedDurationSeconds: 120 },
    { id: "security_scan",    kind: "security_scan",    name: "Security scan",        description: "Secrets detection + SCA + container vulnerability scan.",                           requiresApproval: false, expectedDurationSeconds: 45  },
    { id: "deploy_gate",      kind: "approval_gate",    name: "Production approval",  description: "Two-step approval gate before the production deploy fires.",                       requiresApproval: true,  expectedDurationSeconds: 0   },
    { id: "deploy",           kind: "deploy",           name: "Deploy to production", description: "Rolling deploy with health-check rollback on failure.",                             requiresApproval: false, expectedDurationSeconds: 90  },
    { id: "smoke_test",       kind: "smoke_test",       name: "Smoke tests",          description: "Post-deploy smoke against /healthz, /readyz, and a small set of critical APIs.",   requiresApproval: false, expectedDurationSeconds: 30  },
    { id: "notify",           kind: "notify",           name: "Notify channel",       description: "Post the run summary to the on-call slack + audit fabric.",                         requiresApproval: false, expectedDurationSeconds: 5   },
  ],
};

const DB_MIGRATE: PipelineDefinition = {
  id: "db_migrate",
  name: "Database migration",
  category: "database",
  description: "Migration plan + lint + two-step approval + apply + verify + notify.",
  tagline: "Schema changes that won't burn a Friday afternoon.",
  stages: [
    { id: "schema_lint",   kind: "lint",            name: "Schema lint",          description: "Naming drift, column type sanity, FK convention checks.",                  requiresApproval: false, expectedDurationSeconds: 10 },
    { id: "schema_plan",   kind: "schema_plan",     name: "Build migration plan", description: "Pure planner runs against the staged descriptor; emits preflight runbook.", requiresApproval: false, expectedDurationSeconds: 5  },
    { id: "migrate_gate",  kind: "approval_gate",   name: "Migration approval",   description: "Two-step approval gate before any apply touches the live schema.",         requiresApproval: true,  expectedDurationSeconds: 0  },
    { id: "schema_apply",  kind: "schema_apply",    name: "Apply migration",      description: "Apply the migration inside a transaction; auto-rollback on first error.",   requiresApproval: false, expectedDurationSeconds: 60 },
    { id: "schema_verify", kind: "schema_verify",   name: "Verify schema",        description: "Post-apply schema review to confirm the change landed as planned.",          requiresApproval: false, expectedDurationSeconds: 15 },
    { id: "notify",        kind: "notify",          name: "Notify channel",       description: "Post the migration result to the DBA + on-call channels.",                   requiresApproval: false, expectedDurationSeconds: 5  },
  ],
};

const SECURITY_SWEEP: PipelineDefinition = {
  id: "security_sweep",
  name: "Security sweep",
  category: "security",
  description: "Scheduled security posture sweep: secrets, vulnerabilities, configuration drift.",
  tagline: "Find the leaks before the auditors do.",
  stages: [
    { id: "secrets_scan",     kind: "security_scan",   name: "Secrets scan",         description: "Repository-wide scan for committed credentials and tokens.",       requiresApproval: false, expectedDurationSeconds: 60 },
    { id: "sca_scan",         kind: "security_scan",   name: "Dependency scan (SCA)", description: "Open CVEs across direct + transitive dependencies.",              requiresApproval: false, expectedDurationSeconds: 90 },
    { id: "config_drift",     kind: "lint",            name: "Config drift",          description: "Live cloud config vs declared baseline for IAM, S3, KMS.",        requiresApproval: false, expectedDurationSeconds: 45 },
    { id: "notify",           kind: "notify",          name: "Notify findings",       description: "Open a ticket per critical finding; route highs to slack.",       requiresApproval: false, expectedDurationSeconds: 5  },
  ],
};

const AI_CODING: PipelineDefinition = {
  id: "ai_coding",
  name: "AI coding loop",
  category: "coding",
  description: "Operator instruction → repo scan → patch proposal → lint → tests → two-step approval → PR open.",
  tagline: "Describe the change. We propose, gate, and ship the PR.",
  stages: [
    { id: "code_read",     kind: "code_read",     name: "Read repo",            description: "Scan the target branch, build the working context (file tree, recent commits, related symbols).", requiresApproval: false, expectedDurationSeconds: 30 },
    { id: "code_propose",  kind: "code_propose",  name: "Propose patch",        description: "AI engineer drafts a minimal patch that satisfies the operator instruction.",                       requiresApproval: false, expectedDurationSeconds: 60 },
    { id: "code_lint",     kind: "code_lint",     name: "Lint the patch",       description: "Run eslint + tsc --noEmit + prettier on the proposed patch.",                                       requiresApproval: false, expectedDurationSeconds: 20 },
    { id: "code_test",     kind: "code_test",     name: "Run tests",            description: "Run the vitest suite against the patched tree.",                                                     requiresApproval: false, expectedDurationSeconds: 60 },
    { id: "code_gate",     kind: "approval_gate", name: "PR approval",          description: "Two-step human review before any code leaves the platform's working branch.",                       requiresApproval: true,  expectedDurationSeconds: 0  },
    { id: "code_pr_open",  kind: "code_pr_open",  name: "Open PR",              description: "Push the branch and open the pull request with the patch + audit correlation in the description.", requiresApproval: false, expectedDurationSeconds: 10 },
    { id: "notify",        kind: "notify",        name: "Notify channel",       description: "Post the PR link + summary to the operator's channel.",                                              requiresApproval: false, expectedDurationSeconds: 5  },
  ],
};

export const PIPELINE_REGISTRY: ReadonlyArray<PipelineDefinition> = [
  BACKEND_DEPLOY,
  DB_MIGRATE,
  SECURITY_SWEEP,
  AI_CODING,
];

export function findPipelineDefinition(id: string): PipelineDefinition | null {
  return PIPELINE_REGISTRY.find((p) => p.id === id) ?? null;
}
