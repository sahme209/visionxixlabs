/**
 * Tenant onboarding state machine.
 *
 * Every new tenant follows a typed journey from sign-up to first useful
 * outcome. This module owns:
 *  - the discrete `OnboardingStage` ladder
 *  - the typed `OnboardingProgress` snapshot
 *  - the pure `assessOnboarding()` function that computes the current stage
 *    from observable platform state (connected clouds, scans, plans,
 *    approvals, executions, audit exports)
 *  - the recommended next step the Onboarding wizard + Command Center +
 *    nextAction engine all surface to the user
 *
 * The state machine is *observation-driven* — we never assert progress
 * from a flag the user could flip. The platform state is the truth.
 */

// ---------------------------------------------------------------------------
// Stage ladder
// ---------------------------------------------------------------------------

export type OnboardingStage =
  | "account_created"           // Just signed up — no actions taken yet
  | "provider_selected"         // User picked AWS / Azure / GCP
  | "credentials_submitted"     // Role ARN + External ID submitted
  | "credentials_validated"     // STS AssumeRole + GetCallerIdentity succeeded
  | "first_scan_started"        // Initial scan kicked off
  | "first_snapshot_ready"      // Resources enumerated + snapshot persisted
  | "first_recommendation_seen" // User has read at least one recommendation
  | "first_plan_built"          // Execution plan candidate generated
  | "first_approval_granted"    // First approval granted on a plan
  | "first_execution_complete"  // First plan executed end-to-end (or exported)
  | "first_audit_export"        // First audit bundle exported
  | "operating";                // Steady-state — tenant is producing value

const STAGE_ORDER: OnboardingStage[] = [
  "account_created",
  "provider_selected",
  "credentials_submitted",
  "credentials_validated",
  "first_scan_started",
  "first_snapshot_ready",
  "first_recommendation_seen",
  "first_plan_built",
  "first_approval_granted",
  "first_execution_complete",
  "first_audit_export",
  "operating",
];

export const ONBOARDING_STAGE_RANK: Record<OnboardingStage, number> = STAGE_ORDER.reduce(
  (acc, stage, idx) => { acc[stage] = idx; return acc; },
  {} as Record<OnboardingStage, number>
);

// ---------------------------------------------------------------------------
// Observation inputs — every field is something the platform already tracks.
// ---------------------------------------------------------------------------

export interface OnboardingObservations {
  /** True after the user signed up — always true for a tenant context. */
  hasAccount: boolean;
  /** User has selected at least one provider in the onboarding wizard. */
  providerSelected: boolean;
  /** Credentials submitted for the primary provider. */
  credentialsSubmitted: boolean;
  /** Validation succeeded for at least one provider. */
  credentialsValidated: boolean;
  /** A scan has been started (count > 0). */
  scansStarted: number;
  /** A snapshot has been persisted (count > 0). */
  snapshotsPersisted: number;
  /** Recommendations the user has acknowledged (viewed). */
  recommendationsViewed: number;
  /** Execution plan candidates that have been built. */
  plansBuilt: number;
  /** Approvals granted on plans. */
  approvalsGranted: number;
  /** Plans that have executed (or been exported for desktop apply). */
  plansExecutedOrExported: number;
  /** Audit bundles exported. */
  auditBundlesExported: number;
}

// ---------------------------------------------------------------------------
// Progress snapshot
// ---------------------------------------------------------------------------

export interface OnboardingMilestone {
  stage: OnboardingStage;
  label: string;
  done: boolean;
  detail: string;
}

export interface OnboardingProgress {
  /** Highest stage the tenant has reached. */
  stage: OnboardingStage;
  /** Numeric rank for sorting / progress bars. */
  rank: number;
  /** Percent of the journey completed [0..1]. */
  ratio: number;
  /** Whether the tenant is in steady-state. */
  operating: boolean;
  /** Per-milestone status — rendered as the wizard checklist. */
  milestones: OnboardingMilestone[];
  /** What the tenant should do next, with a CTA. */
  nextStep: { stage: OnboardingStage; label: string; detail: string; href: string } | null;
}

// ---------------------------------------------------------------------------
// Assessor — pure function over observations
// ---------------------------------------------------------------------------

export function assessOnboarding(obs: OnboardingObservations): OnboardingProgress {
  // Compute which stages are satisfied
  const done = (stage: OnboardingStage): boolean => {
    switch (stage) {
      case "account_created":           return obs.hasAccount;
      case "provider_selected":         return obs.providerSelected;
      case "credentials_submitted":     return obs.credentialsSubmitted;
      case "credentials_validated":     return obs.credentialsValidated;
      case "first_scan_started":        return obs.scansStarted > 0;
      case "first_snapshot_ready":      return obs.snapshotsPersisted > 0;
      case "first_recommendation_seen": return obs.recommendationsViewed > 0;
      case "first_plan_built":          return obs.plansBuilt > 0;
      case "first_approval_granted":    return obs.approvalsGranted > 0;
      case "first_execution_complete":  return obs.plansExecutedOrExported > 0;
      case "first_audit_export":        return obs.auditBundlesExported > 0;
      case "operating":                 return obs.plansExecutedOrExported >= 3 && obs.scansStarted >= 5;
    }
  };

  // Find highest stage reached
  let highest: OnboardingStage = "account_created";
  for (const stage of STAGE_ORDER) {
    if (done(stage)) highest = stage;
  }

  const milestones: OnboardingMilestone[] = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABEL[stage],
    done: done(stage),
    detail: STAGE_DETAIL[stage],
  }));

  // Recommend the next not-done milestone
  const next = milestones.find((m) => !m.done);
  const nextStep = next
    ? {
        stage: next.stage,
        label: STAGE_NEXT_LABEL[next.stage],
        detail: next.detail,
        href: STAGE_HREF[next.stage],
      }
    : null;

  const rank = ONBOARDING_STAGE_RANK[highest];
  const ratio = rank / (STAGE_ORDER.length - 1);
  return {
    stage: highest,
    rank,
    ratio,
    operating: highest === "operating",
    milestones,
    nextStep,
  };
}

// ---------------------------------------------------------------------------
// Display tables — kept here so the wizard, command center, and copilot
// share one source of truth on labels + CTAs.
// ---------------------------------------------------------------------------

export const STAGE_LABEL: Record<OnboardingStage, string> = {
  account_created:           "Workspace created",
  provider_selected:         "Cloud provider selected",
  credentials_submitted:     "Credentials submitted",
  credentials_validated:     "Credentials validated",
  first_scan_started:        "First scan running",
  first_snapshot_ready:      "Snapshot ready",
  first_recommendation_seen: "Recommendation reviewed",
  first_plan_built:          "Execution plan built",
  first_approval_granted:    "First approval granted",
  first_execution_complete:  "First execution complete",
  first_audit_export:        "First audit bundle exported",
  operating:                 "Operating in steady state",
};

const STAGE_DETAIL: Record<OnboardingStage, string> = {
  account_created:           "Your workspace is provisioned and ready.",
  provider_selected:         "Pick a cloud provider — AWS gets you to value fastest.",
  credentials_submitted:     "Add your IAM Role ARN and External ID so Axiom can assume it.",
  credentials_validated:     "Axiom calls STS to confirm the role is assumable and the trust policy is safe.",
  first_scan_started:        "Run the first scan against the validated provider.",
  first_snapshot_ready:      "Scan enumerates resources and persists a normalised snapshot.",
  first_recommendation_seen: "Open the recommendations the reasoner produced.",
  first_plan_built:          "Convert a recommendation into an approval-ready execution plan.",
  first_approval_granted:    "Grant an approval on the plan (you stay in control of every change).",
  first_execution_complete:  "Execute or export the plan — first real change applied.",
  first_audit_export:        "Export an audit bundle to share with your security team.",
  operating:                 "You are operating in steady state — Axiom is doing real work.",
};

const STAGE_NEXT_LABEL: Record<OnboardingStage, string> = {
  account_created:           "Start with AWS",
  provider_selected:         "Submit credentials",
  credentials_submitted:     "Wait for validation",
  credentials_validated:     "Run first scan",
  first_scan_started:        "Watch scan progress",
  first_snapshot_ready:      "Review recommendations",
  first_recommendation_seen: "Build execution plan",
  first_plan_built:          "Grant approval",
  first_approval_granted:    "Execute plan",
  first_execution_complete:  "Export audit bundle",
  first_audit_export:        "Operate",
  operating:                 "Open Command Center",
};

const STAGE_HREF: Record<OnboardingStage, string> = {
  account_created:           "/operator/onboarding",
  provider_selected:         "/operator/onboarding",
  credentials_submitted:     "/operator/onboarding",
  credentials_validated:     "/dashboard/command-center",
  first_scan_started:        "/dashboard/command-center",
  first_snapshot_ready:      "/dashboard/command-center",
  first_recommendation_seen: "/dashboard/command-center",
  first_plan_built:          "/dashboard/approvals",
  first_approval_granted:    "/dashboard/command-center",
  first_execution_complete:  "/dashboard/audit",
  first_audit_export:        "/dashboard/command-center",
  operating:                 "/dashboard/command-center",
};

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** Tenant has not yet validated any credentials — show the wizard prominently. */
export function isFreshTenant(progress: OnboardingProgress): boolean {
  return progress.rank < ONBOARDING_STAGE_RANK["credentials_validated"];
}

/** Tenant has done at least the validation step and can use the command center. */
export function hasValidatedConnection(progress: OnboardingProgress): boolean {
  return progress.rank >= ONBOARDING_STAGE_RANK["credentials_validated"];
}

/** Percentage label for progress bars. */
export function progressPercent(progress: OnboardingProgress): number {
  return Math.round(progress.ratio * 100);
}
