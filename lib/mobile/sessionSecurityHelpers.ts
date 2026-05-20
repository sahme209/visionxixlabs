/**
 * Pure mobile session-security helpers.
 *
 * Decisions:
 *   - shouldRefreshToken: when to refresh the access token
 *   - shouldRequireBiometric: when to require Face ID / Touch ID /
 *     fingerprint before an action proceeds
 *   - assessSession: the combined session-state verdict the mobile
 *     shell renders ("ok" / "warn" / "require_login")
 *
 * Pure / deterministic. Mobile shell calls these from a watchdog
 * timer and on every sensitive action.
 */

export interface SessionTokens {
  /** Unix seconds when access token expires. */
  accessExpiresAtSec: number;
  /** Unix seconds when refresh token expires. */
  refreshExpiresAtSec: number;
}

export interface BiometricPolicy {
  /** Re-prompt biometric after this many seconds since last unlock. */
  reauthEverySec: number;
  /** Always require biometric for these action kinds. */
  alwaysRequireKinds: readonly string[];
}

export interface RefreshDecision {
  shouldRefresh: boolean;
  reason: "access_expired" | "near_expiry" | "ok";
  /** Seconds remaining on the access token (capped at 0 when expired). */
  secondsRemaining: number;
}

const NEAR_EXPIRY_THRESHOLD_SEC = 60;

export function shouldRefreshToken(input: { tokens: SessionTokens; nowSec: number }): RefreshDecision {
  const remaining = Math.max(0, input.tokens.accessExpiresAtSec - input.nowSec);
  if (remaining === 0) return { shouldRefresh: true, reason: "access_expired", secondsRemaining: 0 };
  if (remaining <= NEAR_EXPIRY_THRESHOLD_SEC) return { shouldRefresh: true, reason: "near_expiry", secondsRemaining: remaining };
  return { shouldRefresh: false, reason: "ok", secondsRemaining: remaining };
}

export interface BiometricInput {
  policy: BiometricPolicy;
  /** When the last successful biometric unlock happened. */
  lastBiometricUnlockAtSec: number | null;
  /** Optional action kind (e.g. "approval_decide"). */
  actionKind?: string;
  nowSec: number;
}

export interface BiometricDecision {
  required: boolean;
  reason: "always_required_for_kind" | "interval_elapsed" | "never_unlocked" | "ok";
  /** Seconds until the next mandatory re-prompt (0 = right now). */
  secondsUntilNextPrompt: number;
}

export function shouldRequireBiometric(input: BiometricInput): BiometricDecision {
  if (input.actionKind && input.policy.alwaysRequireKinds.includes(input.actionKind)) {
    return { required: true, reason: "always_required_for_kind", secondsUntilNextPrompt: 0 };
  }
  if (input.lastBiometricUnlockAtSec === null) {
    return { required: true, reason: "never_unlocked", secondsUntilNextPrompt: 0 };
  }
  const sinceLast = input.nowSec - input.lastBiometricUnlockAtSec;
  if (sinceLast >= input.policy.reauthEverySec) {
    return { required: true, reason: "interval_elapsed", secondsUntilNextPrompt: 0 };
  }
  return {
    required: false,
    reason: "ok",
    secondsUntilNextPrompt: Math.max(0, input.policy.reauthEverySec - sinceLast),
  };
}

export interface SessionAssessment {
  verdict: "ok" | "warn" | "require_login";
  reasons: string[];
}

export function assessSession(input: {
  tokens: SessionTokens;
  nowSec: number;
  policy: BiometricPolicy;
  lastBiometricUnlockAtSec: number | null;
}): SessionAssessment {
  const reasons: string[] = [];
  let verdict: SessionAssessment["verdict"] = "ok";

  // Refresh token expired → can't recover without login.
  if (input.tokens.refreshExpiresAtSec <= input.nowSec) {
    return { verdict: "require_login", reasons: ["refresh token expired"] };
  }

  const refresh = shouldRefreshToken({ tokens: input.tokens, nowSec: input.nowSec });
  if (refresh.shouldRefresh) {
    verdict = "warn";
    reasons.push(refresh.reason === "access_expired" ? "access token expired" : "access token near expiry");
  }

  const bio = shouldRequireBiometric({
    policy: input.policy,
    lastBiometricUnlockAtSec: input.lastBiometricUnlockAtSec,
    nowSec: input.nowSec,
  });
  if (bio.required) {
    verdict = "warn";
    reasons.push(bio.reason === "never_unlocked" ? "biometric never unlocked" : "biometric re-auth interval elapsed");
  }

  return { verdict, reasons };
}
