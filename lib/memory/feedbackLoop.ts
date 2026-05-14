/**
 * Memory Feedback Loop.
 *
 * Captures outcome signals (accepted / rejected / failed / verified) and
 * folds them into a typed memory layer the brain reads from. Reranks
 * recommendations, biases troubleshooting suggestions, primes copilot
 * explanations — without becoming unsafe.
 *
 * Hard rules:
 *  - No secrets stored.
 *  - No policy bypass.
 *  - No silent autonomy escalation.
 *  - No approval-requirement override.
 *  - No assumption of live state when preview signals are involved.
 *
 * Storage: in-memory by default (suitable for read-only and the planning
 * loop). A Prisma-backed implementation can replace `loadStore` /
 * `persistStore` later without changing the API.
 */

import "server-only";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeedbackKind =
  | "recommendation_accepted"
  | "recommendation_rejected"
  | "remediation_failed"
  | "remediation_succeeded"
  | "security_issue_repeated"
  | "provider_error_repeated"
  | "release_blocker_repeated"
  | "approval_delayed"
  | "preferred_terraform"
  | "preferred_cli"
  | "preferred_desktop_review"
  | "general";

export interface FeedbackEvent {
  id: string;
  kind: FeedbackKind;
  /** Stable target ref — recommendation id, finding id, blocker id, etc. */
  targetRef: string;
  /** Free-form short label for UI. */
  label: string;
  /** Optional context — provider, repo, etc. */
  context?: Record<string, string>;
  /** Wall-clock event time. */
  observedAt: string;
  /** Source-mode tag — never silently upgrade. */
  sourceMode: "live" | "preview" | "demo";
}

export interface MemoryWeights {
  /** Multiplier applied to recommendation ranking — caps in [0.5, 1.5]. */
  recommendationBoost: Record<string, number>;
  /** Free-text patterns that should bias troubleshooting suggestions up. */
  troubleshootingBias: { tokenPattern: string; weight: number }[];
  /** Preferred fix-output style — operator preference, not policy. */
  preferredFixStyle: "terraform" | "cli" | "none";
  /** Preferred review surface. */
  preferredReviewSurface: "server" | "desktop" | "none";
  /** Counts of repeated failures by kind. */
  repeatedFailureCount: Record<string, number>;
  /** Counts of approval delays. */
  approvalDelayCount: number;
}

export interface FeedbackSummary {
  events: FeedbackEvent[];
  weights: MemoryWeights;
  /** Honest description for the UI. */
  narrative: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const EVENTS: FeedbackEvent[] = [];

function nowIso(): string { return new Date().toISOString(); }

export interface RecordFeedbackInput {
  kind: FeedbackKind;
  targetRef: string;
  label: string;
  context?: Record<string, string>;
  sourceMode: "live" | "preview" | "demo";
}

const FORBIDDEN_KEYS = new Set([
  "password", "secret", "token", "client_secret", "client-secret",
  "external_id", "external-id", "api_key", "apikey", "authorization",
]);

function redactContext(ctx: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!ctx) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ctx)) {
    const key = k.toLowerCase();
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (typeof v !== "string") continue;
    // Truncate long values; never persist > 256 chars.
    out[k] = v.length > 256 ? `${v.slice(0, 253)}...` : v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function recordFeedback(input: RecordFeedbackInput): FeedbackEvent {
  const event: FeedbackEvent = {
    id: `fb.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`,
    kind: input.kind,
    targetRef: input.targetRef,
    label: input.label,
    context: redactContext(input.context),
    observedAt: nowIso(),
    sourceMode: input.sourceMode,
  };
  EVENTS.push(event);
  return event;
}

// ---------------------------------------------------------------------------
// Weighter
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeWeights(events: FeedbackEvent[] = EVENTS): MemoryWeights {
  const recBoost: Record<string, number> = {};
  const failureCount: Record<string, number> = {};
  const tsBias: { tokenPattern: string; weight: number }[] = [];
  let approvalDelayCount = 0;
  let terraformPref = 0;
  let cliPref = 0;
  let desktopPref = 0;

  for (const ev of events) {
    switch (ev.kind) {
      case "recommendation_accepted":
        recBoost[ev.targetRef] = clamp((recBoost[ev.targetRef] ?? 1.0) + 0.1, 0.5, 1.5);
        break;
      case "recommendation_rejected":
        recBoost[ev.targetRef] = clamp((recBoost[ev.targetRef] ?? 1.0) - 0.15, 0.5, 1.5);
        break;
      case "remediation_failed":
        failureCount[ev.targetRef] = (failureCount[ev.targetRef] ?? 0) + 1;
        tsBias.push({ tokenPattern: ev.targetRef, weight: 1.0 });
        break;
      case "remediation_succeeded":
        recBoost[ev.targetRef] = clamp((recBoost[ev.targetRef] ?? 1.0) + 0.05, 0.5, 1.5);
        break;
      case "security_issue_repeated":
      case "provider_error_repeated":
      case "release_blocker_repeated":
        failureCount[ev.targetRef] = (failureCount[ev.targetRef] ?? 0) + 1;
        tsBias.push({ tokenPattern: ev.targetRef, weight: 0.5 });
        break;
      case "approval_delayed":
        approvalDelayCount += 1;
        break;
      case "preferred_terraform":     terraformPref += 1; break;
      case "preferred_cli":            cliPref += 1; break;
      case "preferred_desktop_review": desktopPref += 1; break;
      case "general":                  break;
    }
  }

  const preferredFixStyle: MemoryWeights["preferredFixStyle"] =
    terraformPref === 0 && cliPref === 0
      ? "none"
      : terraformPref >= cliPref ? "terraform" : "cli";

  const preferredReviewSurface: MemoryWeights["preferredReviewSurface"] =
    desktopPref > 0 ? "desktop" : "server";

  return {
    recommendationBoost: recBoost,
    troubleshootingBias: tsBias,
    preferredFixStyle,
    preferredReviewSurface,
    repeatedFailureCount: failureCount,
    approvalDelayCount,
  };
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export function summarizeFeedback(): FeedbackSummary {
  const weights = computeWeights();
  const totalEvents = EVENTS.length;
  const narrative = totalEvents === 0
    ? "No feedback observed yet. Recommendations rank by default heuristics."
    : `${totalEvents} event(s) folded into memory. Preferred fix style: ${weights.preferredFixStyle}. Preferred review surface: ${weights.preferredReviewSurface}. Approval delays: ${weights.approvalDelayCount}.`;
  return { events: [...EVENTS], weights, narrative };
}

/**
 * Re-rank a list of `{id, score}` items using current memory boosts. Pure
 * function — caller passes in their list, gets a new sorted list back.
 */
export interface RankedItem { id: string; score: number; }
export function rankByMemory(items: RankedItem[]): RankedItem[] {
  const weights = computeWeights();
  return [...items]
    .map((item) => ({ ...item, score: item.score * (weights.recommendationBoost[item.id] ?? 1.0) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Suggest troubleshooting ids to boost based on repeated failures. Returns
 * ids in descending order of weight.
 */
export function biasedTroubleshootingTokens(): { token: string; weight: number }[] {
  const weights = computeWeights();
  const grouped = new Map<string, number>();
  for (const b of weights.troubleshootingBias) {
    grouped.set(b.tokenPattern, (grouped.get(b.tokenPattern) ?? 0) + b.weight);
  }
  return [...grouped.entries()]
    .map(([token, weight]) => ({ token, weight }))
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Clear all in-memory events. Used by tests + admin tools. Never exposed
 * over the public API surface.
 */
export function _resetForTests(): void {
  EVENTS.length = 0;
}
