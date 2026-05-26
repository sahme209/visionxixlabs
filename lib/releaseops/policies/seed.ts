/**
 * Phase 443 — seed policy rules.
 *
 * 15 production-grade release policies. Each row is fully self-describing:
 * stable key, operator-readable label, closed-union severity, blocking
 * boolean, exception model, optional auto-remediation key, and the
 * `evaluate()` pure function that the engine calls.
 *
 * The seed file is the source of truth at bootstrap. Operators can
 * override per-org (disable a rule, change blocking) via the registry
 * UI; the override lives on the PolicyRule row, NOT on this seed.
 *
 * No I/O, no Prisma. The evaluator passes a release context shaped
 * from runtime data; this module never touches the DB.
 */

import type { ReleaseRow } from "../releaseRepo";

/* ──────────────────────────────────────────────────────────────────
   Closed-union types — match the schema string columns.
   ────────────────────────────────────────────────────────────── */

export type PolicySeverity = "low" | "medium" | "high" | "critical";

export type PolicyApproverRole =
  | "manager"
  | "release_captain"
  | "emergency_change";

/**
 * The context the evaluator passes to every rule. Composed from the
 * Release row + any joined data the caller wants the rule to see. Each
 * rule reads only the fields it needs.
 *
 * Optional fields are explicitly nullable so a rule can detect
 * "missing" without ambiguity vs "empty string".
 */
export interface PolicyEvaluationContext {
  release: Pick<
    ReleaseRow,
    | "id" | "organizationId" | "applicationId"
    | "status" | "releaseTag" | "commitSha"
    | "scopeFinalizedAt" | "rollbackReferenceReleaseId"
    | "plannedWindowStart" | "plannedWindowEnd"
    | "actualDeployStart" | "actualDeployEnd"
  >;
  /** Target env tier — "prod" gates the production-only rules. */
  environmentTier: "dev" | "test" | "qa" | "uat" | "stage" | "preprod" | "prod";
  /** Change ticket linked to the release, if any. */
  changeTicket?: {
    id: string;
    state: string;
    hasCommitSha: boolean;
    hasArtifactTag: boolean;
    hasRollbackPlan: boolean;
    plannedStartAt?: Date | null;
    plannedEndAt?: Date | null;
  } | null;
  /** Branch validation summary — derived from BranchValidationSession in Phase 445+. */
  branchValidation?: {
    status: "passing" | "failing" | "not_run" | "exception_granted";
    failingChecks: number;
  } | null;
  /** Helm deployment summary, when applicable. */
  helmDeployment?: { hasPreviousRevision: boolean } | null;
  /** Liquibase / DB change summary, when applicable. */
  databaseChange?: { hasRollbackOrDocumentedRecovery: boolean } | null;
  /** New secrets introduced by this release. */
  newSecrets?: Array<{ key: string; hasOwner: boolean; hasRegenInstructions: boolean }>;
  /** Manual production fixes the platform recorded since the previous release. */
  manualFixes?: Array<{ id: string; hasReconciliationTask: boolean }>;
  /** Cherry-pick exception — set when the release scope is non-linear. */
  cherryPick?: { hasFinalCommitValidation: boolean } | null;
  /** Whether the release scope was finalized before the day-of deployment cutoff. */
  lastMinutePr?: { wasMergedAfterReadinessApproval: boolean; hasExceptionApproval: boolean } | null;
  /** Release-comms snapshot — last sent message + whether it includes ticket+tag. */
  comms?: { lastSentIncludesTicketAndTag: boolean } | null;
  /** True iff any runtime config is sourced from outside Git (DB tables, GUI). */
  runtimeConfigOutsideGitDetected?: boolean;
  /** When the rule needs "now" — supplied for determinism in tests. */
  now: Date;
}

/* ──────────────────────────────────────────────────────────────────
   Single rule contract.
   ────────────────────────────────────────────────────────────── */

export type PolicyEvalResult =
  | { violation: false }
  | { violation: true; message: string; remediation?: string };

export interface PolicyRuleSeed {
  key: string;
  label: string;
  severity: PolicySeverity;
  blocking: boolean;
  exceptionAllowed: boolean;
  approverRole: PolicyApproverRole | null;
  evidenceRequired: boolean;
  autoRemediationKey: string | null;
  description: string;
  evaluate: (ctx: PolicyEvaluationContext) => PolicyEvalResult;
}

/* ──────────────────────────────────────────────────────────────────
   Helpers — kept private to the seed module.
   ────────────────────────────────────────────────────────────── */

const isProd = (ctx: PolicyEvaluationContext) => ctx.environmentTier === "prod";

const noViolation: PolicyEvalResult = { violation: false };

/* ──────────────────────────────────────────────────────────────────
   The seed catalog — order is the recommended evaluation order.
   ────────────────────────────────────────────────────────────── */

export const SEED_POLICIES: ReadonlyArray<PolicyRuleSeed> = [
  {
    key: "prod_requires_release_tag",
    label: "Production deployment requires release tag",
    severity: "critical",
    blocking: true,
    exceptionAllowed: true,
    approverRole: "manager",
    evidenceRequired: true,
    autoRemediationKey: "create_release_tag",
    description: "Production deployments must come from a tagged release, not a feature branch.",
    evaluate: (ctx) => {
      if (!isProd(ctx)) return noViolation;
      if (!ctx.release.releaseTag) {
        return {
          violation: true,
          message: "Production release has no releaseTag attached.",
          remediation: "Tag the approved commit (e.g. v2.7.0) before promoting to production.",
        };
      }
      return noViolation;
    },
  },
  {
    key: "prod_requires_change_ticket",
    label: "Production deployment requires approved change ticket",
    severity: "critical",
    blocking: true,
    exceptionAllowed: true,
    approverRole: "emergency_change",
    evidenceRequired: true,
    autoRemediationKey: "attach_change_ticket",
    description: "Every production deployment must be linked to a change ticket in approved state.",
    evaluate: (ctx) => {
      if (!isProd(ctx)) return noViolation;
      if (!ctx.changeTicket) {
        return {
          violation: true,
          message: "Production release has no change ticket linked.",
          remediation: "Attach a ServiceNow / Jira SM change ticket and refresh the readiness check.",
        };
      }
      if (ctx.changeTicket.state !== "approved" && ctx.changeTicket.state !== "scheduled") {
        return {
          violation: true,
          message: `Change ticket ${ctx.changeTicket.id} is in state '${ctx.changeTicket.state}', not approved or scheduled.`,
        };
      }
      return noViolation;
    },
  },
  {
    key: "prod_requires_rollback_plan",
    label: "Production deployment requires rollback plan",
    severity: "high",
    blocking: true,
    exceptionAllowed: true,
    approverRole: "manager",
    evidenceRequired: true,
    autoRemediationKey: "attach_rollback_reference",
    description: "A previous release tag must be identified as the rollback target.",
    evaluate: (ctx) => {
      if (!isProd(ctx)) return noViolation;
      if (!ctx.release.rollbackReferenceReleaseId) {
        return {
          violation: true,
          message: "No rollback reference release attached.",
          remediation: "Pick the most recent successfully-deployed release as the rollback target.",
        };
      }
      return noViolation;
    },
  },
  {
    key: "prod_requires_branch_validation_pass",
    label: "Production deployment requires branch validation pass",
    severity: "critical",
    blocking: true,
    exceptionAllowed: false,
    approverRole: null,
    evidenceRequired: false,
    autoRemediationKey: "run_branch_validation",
    description: "Branch validation must be in passing state — exceptions are individually granted on the branch checks themselves, not on this rule.",
    evaluate: (ctx) => {
      if (!isProd(ctx)) return noViolation;
      if (!ctx.branchValidation || ctx.branchValidation.status === "not_run") {
        return { violation: true, message: "Branch validation has not been run." };
      }
      if (ctx.branchValidation.status === "failing") {
        return {
          violation: true,
          message: `Branch validation is failing (${ctx.branchValidation.failingChecks} check(s) failed).`,
        };
      }
      return noViolation;
    },
  },
  {
    key: "ticket_must_include_commit_sha",
    label: "Change ticket must include commit SHA",
    severity: "medium",
    blocking: false,
    exceptionAllowed: false,
    approverRole: null,
    evidenceRequired: false,
    autoRemediationKey: "ticket_attach_commit_sha",
    description: "Change ticket text must include the deployed commit SHA for audit.",
    evaluate: (ctx) => {
      if (!ctx.changeTicket) return noViolation; // covered by prod_requires_change_ticket
      if (!ctx.changeTicket.hasCommitSha) {
        return { violation: true, message: "Change ticket is missing a commit SHA reference." };
      }
      return noViolation;
    },
  },
  {
    key: "ticket_must_include_artifact_tag",
    label: "Change ticket must include artifact / image tag",
    severity: "medium",
    blocking: false,
    exceptionAllowed: false,
    approverRole: null,
    evidenceRequired: false,
    autoRemediationKey: "ticket_attach_artifact_tag",
    description: "Change ticket text must include the deployed artifact/image tag for audit.",
    evaluate: (ctx) => {
      if (!ctx.changeTicket) return noViolation;
      if (!ctx.changeTicket.hasArtifactTag) {
        return { violation: true, message: "Change ticket is missing the artifact/image tag." };
      }
      return noViolation;
    },
  },
  {
    key: "new_secret_requires_owner_and_regen",
    label: "New secret requires owner and regeneration instructions",
    severity: "high",
    blocking: true,
    exceptionAllowed: false,
    approverRole: null,
    evidenceRequired: false,
    autoRemediationKey: "secret_metadata_form",
    description: "Every new secret introduced by a release must have a documented owner and regen procedure.",
    evaluate: (ctx) => {
      const missing = (ctx.newSecrets ?? []).filter((s) => !s.hasOwner || !s.hasRegenInstructions);
      if (missing.length > 0) {
        return {
          violation: true,
          message: `${missing.length} new secret(s) missing owner or regeneration instructions: ${missing.map((s) => s.key).join(", ")}`,
          remediation: "Fill out the secret-metadata form for each new secret before the deploy.",
        };
      }
      return noViolation;
    },
  },
  {
    key: "manual_fix_requires_reconciliation",
    label: "Manual production fix requires reconciliation task",
    severity: "high",
    blocking: true,
    exceptionAllowed: false,
    approverRole: null,
    evidenceRequired: false,
    autoRemediationKey: "create_reconciliation_task",
    description: "Every manual production change since the previous release must have a follow-up reconciliation task in source-of-truth.",
    evaluate: (ctx) => {
      const unreconciled = (ctx.manualFixes ?? []).filter((m) => !m.hasReconciliationTask);
      if (unreconciled.length > 0) {
        return {
          violation: true,
          message: `${unreconciled.length} manual fix(es) without reconciliation task — future deploy may overwrite them.`,
          remediation: "Create a reconciliation task for each manual fix.",
        };
      }
      return noViolation;
    },
  },
  {
    key: "helm_requires_previous_revision",
    label: "Helm deployment requires previous revision available for rollback",
    severity: "high",
    blocking: true,
    exceptionAllowed: true,
    approverRole: "manager",
    evidenceRequired: true,
    autoRemediationKey: "verify_helm_history",
    description: "The Helm release must have a previous revision recorded to enable a one-command rollback.",
    evaluate: (ctx) => {
      if (!ctx.helmDeployment) return noViolation; // not a Helm release
      if (!ctx.helmDeployment.hasPreviousRevision) {
        return { violation: true, message: "Helm release has no previous revision recorded." };
      }
      return noViolation;
    },
  },
  {
    key: "liquibase_requires_rollback_or_recovery",
    label: "Liquibase change requires rollback or documented manual recovery",
    severity: "high",
    blocking: true,
    exceptionAllowed: true,
    approverRole: "manager",
    evidenceRequired: true,
    autoRemediationKey: "add_liquibase_rollback",
    description: "Every Liquibase changeset must have a rollback statement OR documented manual-recovery steps.",
    evaluate: (ctx) => {
      if (!ctx.databaseChange) return noViolation;
      if (!ctx.databaseChange.hasRollbackOrDocumentedRecovery) {
        return { violation: true, message: "Database change has no rollback statement or documented manual recovery." };
      }
      return noViolation;
    },
  },
  {
    key: "comms_must_include_ticket_and_tag",
    label: "Deployment communication must include change ticket and release tag",
    severity: "medium",
    blocking: false,
    exceptionAllowed: false,
    approverRole: null,
    evidenceRequired: false,
    autoRemediationKey: "regenerate_comms",
    description: "Pre-deployment Slack / Teams message must reference the change ticket AND the release tag.",
    evaluate: (ctx) => {
      if (!ctx.comms) return noViolation;
      if (!ctx.comms.lastSentIncludesTicketAndTag) {
        return { violation: true, message: "Latest deployment notice is missing the change ticket or release tag." };
      }
      return noViolation;
    },
  },
  {
    key: "last_minute_pr_requires_exception_approval",
    label: "Last-minute PR requires exception approval",
    severity: "high",
    blocking: true,
    exceptionAllowed: true,
    approverRole: "release_captain",
    evidenceRequired: true,
    autoRemediationKey: "request_release_captain_exception",
    description: "A PR merged after readiness approval needs explicit exception approval from the release captain.",
    evaluate: (ctx) => {
      if (!ctx.lastMinutePr) return noViolation;
      if (ctx.lastMinutePr.wasMergedAfterReadinessApproval && !ctx.lastMinutePr.hasExceptionApproval) {
        return { violation: true, message: "PR merged after readiness approval without exception approval." };
      }
      return noViolation;
    },
  },
  {
    key: "cherry_pick_requires_final_commit_validation",
    label: "Cherry-pick release requires final commit validation",
    severity: "critical",
    blocking: true,
    exceptionAllowed: false,
    approverRole: null,
    evidenceRequired: false,
    autoRemediationKey: "validate_cherry_pick",
    description: "Non-linear release scope must validate that the final release tag includes ONLY approved commits.",
    evaluate: (ctx) => {
      if (!ctx.cherryPick) return noViolation;
      if (!ctx.cherryPick.hasFinalCommitValidation) {
        return { violation: true, message: "Cherry-pick scope has not been validated against the final release tag." };
      }
      return noViolation;
    },
  },
  {
    key: "runtime_config_outside_git_is_drift_risk",
    label: "Runtime configuration outside Git is a drift risk",
    severity: "medium",
    blocking: false,
    exceptionAllowed: true,
    approverRole: "manager",
    evidenceRequired: false,
    autoRemediationKey: "convert_to_config_as_code",
    description: "If runtime configuration is sourced from DB tables / GUIs / hand-edits, surface a drift advisory.",
    evaluate: (ctx) => {
      if (ctx.runtimeConfigOutsideGitDetected) {
        return {
          violation: true,
          message: "Runtime configuration detected outside Git — future deploys may not capture the current state.",
          remediation: "Move critical runtime config to configuration-as-code.",
        };
      }
      return noViolation;
    },
  },
  {
    key: "actual_deploy_within_approved_window",
    label: "Actual deployment must occur within approved change window",
    severity: "critical",
    blocking: true,
    exceptionAllowed: true,
    approverRole: "emergency_change",
    evidenceRequired: true,
    autoRemediationKey: "request_window_extension",
    description: "actualDeployStart / End must fall inside plannedWindowStart / End.",
    evaluate: (ctx) => {
      const { actualDeployStart, plannedWindowStart, plannedWindowEnd } = ctx.release;
      if (!actualDeployStart || !plannedWindowStart || !plannedWindowEnd) return noViolation;
      if (actualDeployStart < plannedWindowStart || actualDeployStart > plannedWindowEnd) {
        return {
          violation: true,
          message: "Actual deployment start is outside the approved change window.",
          remediation: "Either reschedule, or request an emergency-change exception with justification.",
        };
      }
      return noViolation;
    },
  },
];

/* ──────────────────────────────────────────────────────────────────
   Convenience lookup for the engine.
   ────────────────────────────────────────────────────────────── */

export const SEED_POLICY_BY_KEY: ReadonlyMap<string, PolicyRuleSeed> = new Map(
  SEED_POLICIES.map((p) => [p.key, p]),
);
