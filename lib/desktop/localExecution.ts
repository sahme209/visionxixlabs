/**
 * Local execution abstractions for the desktop runtime.
 *
 * The desktop receives signed handoff bundles. Once opened, the user can:
 *  (1) review the bundle — Terraform plan, CLI commands, rollback steps,
 *      verification checklist
 *  (2) preview a local plan (e.g. `terraform plan -detailed-exitcode`)
 *  (3) — once the approval architecture lands — apply the plan locally
 *
 * This file defines the *typed contracts* every desktop runtime
 * implementation must honour. The web app and the desktop both import
 * from here so there's no taxonomy drift.
 *
 * Hard rule, encoded in `LocalExecutionGuard`: `apply` is blocked unless
 * the bundle carries a granted approval AND the tenant policy explicitly
 * allows desktop apply. The default policy is *deny* until approval-aware
 * local execution ships.
 */

import type { ExecutionPlanId, OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Result envelope
// ---------------------------------------------------------------------------

export type LocalExecutionMode = "review" | "preview" | "apply" | "verify";

export type LocalExecutionOutcome = "ok" | "denied" | "blocked_by_policy" | "would_change" | "no_op" | "failed";

export interface LocalExecutionResult {
  mode: LocalExecutionMode;
  outcome: LocalExecutionOutcome;
  /** User-facing summary line — always present, always safe to render. */
  summary: string;
  /** Diff summary for preview/apply — counts of resources added/changed/destroyed. */
  diff?: { add: number; change: number; destroy: number };
  /** Stderr / log excerpt — pre-redacted by the implementation. */
  logExcerpt?: string;
  /** Error code when outcome is "failed" or "denied". */
  errorCode?: string;
  /** Duration in milliseconds. */
  durationMs?: number;
  /** Honest safety guarantee — set true only when the operation produced no side effects. */
  noSideEffects: boolean;
}

// ---------------------------------------------------------------------------
// Local Terraform interface
// ---------------------------------------------------------------------------

export interface LocalTerraformPreviewInput {
  organizationId: OrganizationId;
  userId: UserId;
  executionPlanId: ExecutionPlanId;
  /** Working directory containing the .tf files from the bundle. */
  workingDir: string;
  /** Optional state backend override; defaults to local file. */
  backend?: { kind: "local"; pathInsideBundle: string } | { kind: "remote"; ref: string };
}

export interface LocalTerraform {
  /**
   * Run `terraform plan -detailed-exitcode` against the bundle. Never
   * applies. Returns a `LocalExecutionResult` with `mode="preview"`.
   */
  plan(input: LocalTerraformPreviewInput): Promise<LocalExecutionResult>;

  /**
   * Apply — gated. Implementations MUST consult `LocalExecutionGuard`
   * before invoking the CLI and refuse with `outcome="denied"` when the
   * guard returns `allow=false`.
   */
  apply(input: LocalTerraformPreviewInput): Promise<LocalExecutionResult>;

  /**
   * Validate the bundle's Terraform syntax + provider plugins. Never
   * mutates state.
   */
  validate(input: LocalTerraformPreviewInput): Promise<LocalExecutionResult>;
}

// ---------------------------------------------------------------------------
// Local CLI interface
// ---------------------------------------------------------------------------

export interface LocalCliCommand {
  /** Stable id matching the manifest entry. */
  id: string;
  /** Human-readable label rendered in the desktop UI. */
  label: string;
  /** Command line — already redacted. */
  command: string;
  /** Whether the command is destructive (e.g. a delete). */
  destructive: boolean;
}

export interface LocalCli {
  /** Render the CLI command as a preview — never executes. */
  preview(command: LocalCliCommand): Promise<LocalExecutionResult>;
  /** Validate that the command looks safe (syntax, no shell escapes, no destructive flags when policy forbids). */
  validate(command: LocalCliCommand): Promise<LocalExecutionResult>;
  /**
   * Execute a CLI command — gated. Same approval/policy guard as apply.
   * Implementations MUST refuse `destructive` commands when the guard says no.
   */
  execute(command: LocalCliCommand): Promise<LocalExecutionResult>;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export interface LocalVerificationCheck {
  id: string;
  label: string;
  /** Command-line invocation OR a typed health probe key. */
  invocation: { kind: "shell"; command: string } | { kind: "probe"; probe: string };
  /** Expected outcome that signals "verified". */
  expect: { exitCode?: number; matches?: string };
}

export interface LocalVerification {
  run(check: LocalVerificationCheck): Promise<LocalExecutionResult>;
}

// ---------------------------------------------------------------------------
// Environment introspection — used to surface "Terraform installed?" / "AWS CLI installed?"
// ---------------------------------------------------------------------------

export interface LocalEnvironmentReport {
  terraform: { installed: boolean; version?: string };
  awsCli:    { installed: boolean; version?: string };
  azCli:     { installed: boolean; version?: string };
  gcloud:    { installed: boolean; version?: string };
  /** Whether the OS keychain / keyring is reachable. */
  keychain: { available: boolean; backend?: "macos_keychain" | "windows_credential_manager" | "libsecret" | "none" };
  /** Whether the desktop is currently online. */
  online: boolean;
}

export interface LocalEnvironment {
  report(): Promise<LocalEnvironmentReport>;
}

// ---------------------------------------------------------------------------
// Execution guard
// ---------------------------------------------------------------------------

/**
 * The single point that allows / denies a destructive local operation. The
 * desktop runtime MUST call this before any apply/execute. Default behaviour
 * is *deny* — the guard explicitly opts in to safe operations.
 */
export interface LocalExecutionGuardInput {
  mode: LocalExecutionMode;
  organizationId: OrganizationId;
  userId: UserId;
  executionPlanId: ExecutionPlanId;
  /** Whether an approval grant is attached to the bundle. */
  approvalGranted: boolean;
  /** Whether tenant policy allows desktop apply. */
  desktopApplyAllowed: boolean;
  /** Whether a rollback plan accompanies the bundle. */
  rollbackPrepared: boolean;
  /** Whether the audit sink is reachable — execution without audit is denied. */
  auditSinkReachable: boolean;
}

export interface LocalExecutionGuardDecision {
  allow: boolean;
  /** Stable reason code — drives UI messaging + audit. */
  reason: string;
  /** Safe action surfaced to the user when denied. */
  safeNextAction?: { label: string; href: string };
}

/**
 * Pure decision. Encodes the platform's hard rule: destructive local
 * operations are denied unless approval + policy + rollback + audit all
 * succeed.
 */
export function decideLocalExecution(input: LocalExecutionGuardInput): LocalExecutionGuardDecision {
  // Review / preview never mutate — always allowed.
  if (input.mode === "review" || input.mode === "preview" || input.mode === "verify") {
    return { allow: true, reason: "Read-only mode does not require approval." };
  }
  // Apply — strictly gated.
  if (!input.approvalGranted) {
    return {
      allow: false,
      reason: "Approval has not been granted for this execution plan.",
      safeNextAction: { label: "Open approvals on the web", href: "/dashboard/approvals" },
    };
  }
  if (!input.desktopApplyAllowed) {
    return {
      allow: false,
      reason: "Tenant policy does not permit desktop apply for this plan class.",
      safeNextAction: { label: "Review governance", href: "/dashboard/governance" },
    };
  }
  if (!input.rollbackPrepared) {
    return {
      allow: false,
      reason: "No rollback plan is attached — desktop apply is blocked.",
      safeNextAction: { label: "Open execution plan", href: "/dashboard/command-center" },
    };
  }
  if (!input.auditSinkReachable) {
    return {
      allow: false,
      reason: "Audit sink is unreachable — local execution would not be auditable.",
      safeNextAction: { label: "Reliability center", href: "/dashboard/reliability" },
    };
  }
  return {
    allow: true,
    reason: "Approval + policy + rollback + audit gates satisfied.",
  };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export interface LocalExecutionDisplay {
  pill: string;
  semantic: "neutral" | "success" | "warning" | "error";
}

export function displayForOutcome(o: LocalExecutionOutcome): LocalExecutionDisplay {
  switch (o) {
    case "ok":                return { pill: "OK",          semantic: "success" };
    case "denied":            return { pill: "Denied",      semantic: "error"   };
    case "blocked_by_policy": return { pill: "Policy",      semantic: "warning" };
    case "would_change":      return { pill: "Diff",        semantic: "warning" };
    case "no_op":             return { pill: "No-op",       semantic: "neutral" };
    case "failed":            return { pill: "Failed",      semantic: "error"   };
  }
}
