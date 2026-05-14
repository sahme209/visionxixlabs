/**
 * Failure classifier — every operational failure goes through this so the
 * UI, the copilot, the dead-letter store, and the retry engine all read from
 * one canonical taxonomy.
 *
 * The existing `lib/agent/workflows/retryPolicy.ts` defines a narrower
 * `FailureKind` aimed at job retry decisions. This module is the broader
 * platform taxonomy — it *extends* the job-level kinds and provides the
 * user-facing translation (what happened, is it safe, what to do next).
 *
 * Classifier rules are intentionally explicit. Pattern matching on error
 * messages is brittle but unavoidable at the SDK boundary — every match here
 * is referenced from a known upstream error message.
 */

import type { FailureKind as JobFailureKind } from "@/lib/agent/workflows/retryPolicy";

// ---------------------------------------------------------------------------
// Broader failure category
// ---------------------------------------------------------------------------

export type FailureCategory =
  | "auth_failure"
  | "permission_failure"
  | "validation_failure"
  | "provider_rate_limit"
  | "provider_unavailable"
  | "network_timeout"
  | "transient_network"
  | "invalid_input"
  | "policy_block"
  | "approval_required"
  | "dependency_failure"
  | "workflow_deadlock"
  | "partial_success"
  | "rollback_required"
  | "desktop_unavailable"
  | "github_api_failure"
  | "terraform_generation_failure"
  | "idempotency_conflict"
  | "circuit_open"
  | "unknown";

export type FailureSeverity = "info" | "warning" | "error" | "critical";

export interface ClassifiedFailure {
  category: FailureCategory;
  severity: FailureSeverity;
  /** Whether retry is structurally safe — engine still has the final say. */
  retryable: boolean;
  /** User-facing explanation — never raw SDK output. */
  userMessage: string;
  /** Operator/debug detail — appears in audit + logs. */
  operatorDetail?: string;
  /** Where the user should go next. */
  safeNextAction?: { label: string; href: string };
  /** Help link if Axiom has documented this case. */
  docsLink?: string;
  /** Whether this must be written to audit. */
  requiresAudit: boolean;
  /** Whether this should be memorialised in operational memory. */
  requiresMemory: boolean;
  /** Mapping back to the narrower job FailureKind for the retry engine. */
  jobFailureKind: JobFailureKind;
}

// ---------------------------------------------------------------------------
// Classifier rules
// ---------------------------------------------------------------------------

interface ClassifierInput {
  /** Optional SDK / API error code (AWS "Throttling", GitHub 403, etc.). */
  errorCode?: string;
  /** HTTP status from the upstream provider if available. */
  status?: number;
  /** Free-form message from the upstream. May contain provider hints. */
  message?: string;
  /** Provider tag — narrows GitHub-specific vs AWS-specific cases. */
  provider?: string;
  /** True when our governance engine returned `block`. */
  policyBlocked?: boolean;
  /** True when the action requires approval that hasn't been granted. */
  approvalRequired?: boolean;
  /** True when an idempotency conflict was detected. */
  idempotencyConflict?: boolean;
  /** True when an open circuit refused the call. */
  circuitOpen?: boolean;
}

/**
 * Classify a failure. Pure function — returns the same output for the same
 * input. Order of checks matters: explicit signals (policyBlocked, circuit)
 * outrank pattern guesses on the message.
 */
export function classifyFailure(input: ClassifierInput): ClassifiedFailure {
  // 1. Explicit signals first
  if (input.policyBlocked) return policyBlock();
  if (input.approvalRequired) return approvalRequired();
  if (input.idempotencyConflict) return idempotencyConflict();
  if (input.circuitOpen) return circuitOpen();

  const code = (input.errorCode ?? "").toLowerCase();
  const msg = (input.message ?? "").toLowerCase();
  const status = input.status ?? 0;

  // 2. Auth / permission
  if (status === 401 || code.includes("expiredtoken") || code.includes("invalidclienttokenid") || msg.includes("unauthorized")) {
    return authFailure(input);
  }
  if (status === 403 || code.includes("accessdenied") || code.includes("unauthorizedoperation") || msg.includes("forbidden")) {
    return permissionFailure(input);
  }

  // 3. Rate limit (AWS Throttling, GitHub 403 with rate-limit header, Azure 429, GCP 429)
  if (code === "throttling" || code === "throttlingexception" || code === "ratelimit" || code === "rate_limited" || status === 429) {
    return providerRateLimit(input);
  }
  // GitHub returns 403 with rate-limit body — heuristic
  if (input.provider === "github" && status === 403 && msg.includes("rate limit")) {
    return providerRateLimit(input);
  }

  // 4. Network / timeout
  if (code.includes("timeout") || code === "etimedout" || msg.includes("timeout")) {
    return networkTimeout(input);
  }
  if (code === "econnreset" || code === "enotfound" || code === "econnrefused" || msg.includes("network")) {
    return transientNetwork(input);
  }

  // 5. Provider unavailability
  if (status === 502 || status === 503 || status === 504 || msg.includes("service unavailable")) {
    return providerUnavailable(input);
  }

  // 6. Validation / input
  if (status === 400 || code === "validationerror" || code === "invalidparametervalue" || msg.includes("invalid")) {
    return validationFailure(input);
  }

  // 7. GitHub-specific
  if (input.provider === "github" && status >= 500) return githubApiFailure(input);
  if (input.provider === "github" && msg.includes("repository not found")) return githubApiFailure(input);

  // 8. Terraform generation
  if (msg.includes("terraform") && (msg.includes("could not") || msg.includes("failed to generate"))) {
    return terraformGenerationFailure(input);
  }

  // 9. Desktop unavailable
  if (msg.includes("desktop") && (msg.includes("offline") || msg.includes("unreachable") || msg.includes("not paired"))) {
    return desktopUnavailable(input);
  }

  // 10. Default
  return unknownFailure(input);
}

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

function authFailure(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "auth_failure",
    severity: "error",
    retryable: false,
    userMessage: "We couldn't authenticate against your provider — credentials look invalid or expired.",
    operatorDetail: input.message,
    safeNextAction: { label: "Reconnect provider", href: "/operator/onboarding" },
    docsLink: "/docs/aws-setup",
    requiresAudit: true,
    requiresMemory: true,
    jobFailureKind: "credentials_invalid",
  };
}

function permissionFailure(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "permission_failure",
    severity: "error",
    retryable: false,
    userMessage: "Your provider role doesn't have the permission Axiom needs for this operation.",
    operatorDetail: input.message,
    safeNextAction: { label: "Review setup", href: "/docs/aws-setup" },
    docsLink: "/docs/aws-setup",
    requiresAudit: true,
    requiresMemory: true,
    jobFailureKind: "permission_denied",
  };
}

function providerRateLimit(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "provider_rate_limit",
    severity: "warning",
    retryable: true,
    userMessage: "Your provider is rate-limiting us. Axiom is backing off and will retry automatically.",
    operatorDetail: input.message,
    requiresAudit: false,
    requiresMemory: true,
    jobFailureKind: "rate_limited",
  };
}

function providerUnavailable(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "provider_unavailable",
    severity: "warning",
    retryable: true,
    userMessage: "The provider's API is returning 5xx errors. Axiom is pausing until it stabilises.",
    operatorDetail: input.message,
    safeNextAction: { label: "View reliability center", href: "/dashboard/reliability" },
    requiresAudit: false,
    requiresMemory: true,
    jobFailureKind: "external_api_error",
  };
}

function networkTimeout(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "network_timeout",
    severity: "warning",
    retryable: true,
    userMessage: "The request timed out. Axiom will retry with a longer window.",
    operatorDetail: input.message,
    requiresAudit: false,
    requiresMemory: false,
    jobFailureKind: "timeout",
  };
}

function transientNetwork(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "transient_network",
    severity: "info",
    retryable: true,
    userMessage: "Transient network glitch — retrying.",
    operatorDetail: input.message,
    requiresAudit: false,
    requiresMemory: false,
    jobFailureKind: "transient_network",
  };
}

function validationFailure(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "validation_failure",
    severity: "error",
    retryable: false,
    userMessage: "We got a 400 from the provider — the input we sent wasn't accepted.",
    operatorDetail: input.message,
    safeNextAction: { label: "Open troubleshooting", href: "/docs/troubleshooting" },
    requiresAudit: true,
    requiresMemory: false,
    jobFailureKind: "validation_failed",
  };
}

function policyBlock(): ClassifiedFailure {
  return {
    category: "policy_block",
    severity: "warning",
    retryable: false,
    userMessage: "Governance policy blocked this action.",
    safeNextAction: { label: "Open governance", href: "/dashboard/governance" },
    docsLink: "/docs/approval-workflow",
    requiresAudit: true,
    requiresMemory: true,
    jobFailureKind: "policy_blocked",
  };
}

function approvalRequired(): ClassifiedFailure {
  return {
    category: "approval_required",
    severity: "info",
    retryable: false,
    userMessage: "This action needs human approval before it can proceed.",
    safeNextAction: { label: "Open approvals", href: "/dashboard/approvals" },
    docsLink: "/docs/approval-workflow",
    requiresAudit: true,
    requiresMemory: false,
    jobFailureKind: "user_input_required",
  };
}

function idempotencyConflict(): ClassifiedFailure {
  return {
    category: "idempotency_conflict",
    severity: "warning",
    retryable: false,
    userMessage: "An identical request is already being processed.",
    safeNextAction: { label: "Open jobs", href: "/dashboard/jobs" },
    requiresAudit: true,
    requiresMemory: false,
    jobFailureKind: "validation_failed",
  };
}

function circuitOpen(): ClassifiedFailure {
  return {
    category: "circuit_open",
    severity: "warning",
    retryable: true,
    userMessage: "Provider integration is temporarily paused due to repeated failures. Axiom will probe automatically.",
    safeNextAction: { label: "View reliability center", href: "/dashboard/reliability" },
    requiresAudit: false,
    requiresMemory: true,
    jobFailureKind: "external_api_error",
  };
}

function githubApiFailure(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "github_api_failure",
    severity: "warning",
    retryable: true,
    userMessage: "GitHub returned an error. Axiom is pausing the affected workflows.",
    operatorDetail: input.message,
    safeNextAction: { label: "View ReleaseOps", href: "/dashboard/releaseops" },
    requiresAudit: false,
    requiresMemory: true,
    jobFailureKind: "external_api_error",
  };
}

function terraformGenerationFailure(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "terraform_generation_failure",
    severity: "error",
    retryable: false,
    userMessage: "We couldn't render the Terraform plan from the recommendation set.",
    operatorDetail: input.message,
    safeNextAction: { label: "Open execution plan", href: "/dashboard/command-center" },
    requiresAudit: true,
    requiresMemory: true,
    jobFailureKind: "unknown",
  };
}

function desktopUnavailable(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "desktop_unavailable",
    severity: "warning",
    retryable: false,
    userMessage: "No paired Axiom desktop is reachable. You can still review the plan in the web app.",
    operatorDetail: input.message,
    safeNextAction: { label: "Download desktop", href: "/download" },
    requiresAudit: false,
    requiresMemory: true,
    jobFailureKind: "unknown",
  };
}

function unknownFailure(input: ClassifierInput): ClassifiedFailure {
  return {
    category: "unknown",
    severity: "error",
    retryable: false,
    userMessage: "Something failed unexpectedly. Axiom is recording the details and will pause this workflow.",
    operatorDetail: input.message,
    safeNextAction: { label: "Open reliability center", href: "/dashboard/reliability" },
    requiresAudit: true,
    requiresMemory: true,
    jobFailureKind: "unknown",
  };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export const CATEGORY_LABEL: Record<FailureCategory, string> = {
  auth_failure:                "Auth failure",
  permission_failure:          "Permission failure",
  validation_failure:          "Validation failure",
  provider_rate_limit:         "Provider rate limit",
  provider_unavailable:        "Provider unavailable",
  network_timeout:             "Network timeout",
  transient_network:           "Transient network",
  invalid_input:               "Invalid input",
  policy_block:                "Policy block",
  approval_required:           "Approval required",
  dependency_failure:          "Dependency failure",
  workflow_deadlock:           "Workflow deadlock",
  partial_success:             "Partial success",
  rollback_required:           "Rollback required",
  desktop_unavailable:         "Desktop unavailable",
  github_api_failure:          "GitHub API failure",
  terraform_generation_failure: "Terraform generation failure",
  idempotency_conflict:        "Idempotency conflict",
  circuit_open:                "Circuit open",
  unknown:                     "Unknown",
};
