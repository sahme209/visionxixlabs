/**
 * Reliability-intent answers for the copilot.
 *
 * The base copilot (`operationsCopilot.ts`) handles 8 broad intents. This
 * module is a focused extension that answers reliability-oriented questions
 * with evidence pulled directly from the typed reliability primitives:
 *
 *   - Why is this workflow stuck?           ← WorkflowDiagnosis
 *   - Can this be retried safely?           ← evaluateRetry + circuit state
 *   - What failed?                          ← ClassifiedFailure
 *   - Is AWS / GitHub rate-limiting us?     ← BackoffOutcome + circuit
 *   - Why did this scan partially complete? ← ScanOutcome phases
 *   - What needs human input?               ← lifecycle gates
 *   - What is blocked by policy?            ← classification
 *   - What is waiting on approval?          ← classification
 *
 * Pure function — no IO. The base copilot delegates to this module when
 * the intent classifier returns one of the reliability classes.
 */

import type { CopilotEvidence, CopilotResponse } from "./operationsCopilot";
import type { WorkflowDiagnosis } from "@/lib/reliability/workflowRecovery";
import type { ClassifiedFailure } from "@/lib/reliability/failureClassifier";
import type { CircuitSnapshot } from "@/lib/reliability/circuitBreaker";
import type { DeadLetterRecord } from "@/lib/reliability/deadLetter";

// ---------------------------------------------------------------------------
// Intent narrowing
// ---------------------------------------------------------------------------

export type ReliabilityIntent =
  | "workflow_stuck"
  | "can_i_retry"
  | "what_failed"
  | "provider_rate_limit"
  | "scan_partial"
  | "needs_human_input"
  | "blocked_by_policy"
  | "waiting_on_approval";

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface ReliabilityIntentInputs {
  /** Latest diagnosis for the entity the user is asking about, if any. */
  workflowDiagnosis?: WorkflowDiagnosis;
  /** Latest classified failure for the entity. */
  classifiedFailure?: ClassifiedFailure;
  /** Circuit snapshots impacting the entity, newest first. */
  circuits?: CircuitSnapshot[];
  /** Dead-letter records relevant to the entity. */
  deadLetters?: DeadLetterRecord[];
  /** Optional plan-text the user pasted (used when no entity is bound). */
  userText?: string;
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

export function composeReliabilityAnswer(intent: ReliabilityIntent, input: ReliabilityIntentInputs): CopilotResponse {
  switch (intent) {
    case "workflow_stuck":       return workflowStuck(input);
    case "can_i_retry":          return canIRetry(input);
    case "what_failed":          return whatFailed(input);
    case "provider_rate_limit":  return providerRateLimit(input);
    case "scan_partial":         return scanPartial(input);
    case "needs_human_input":    return needsHumanInput(input);
    case "blocked_by_policy":    return blockedByPolicy(input);
    case "waiting_on_approval":  return waitingOnApproval(input);
  }
}

// ---------------------------------------------------------------------------
// Per-intent composers
// ---------------------------------------------------------------------------

function workflowStuck(input: ReliabilityIntentInputs): CopilotResponse {
  const d = input.workflowDiagnosis;
  if (!d) return fallback("I don't have a current workflow diagnosis for this entity.", "Open the Reliability Center to inspect workflow health.", "/dashboard/reliability");
  const evidence: CopilotEvidence[] = [
    { source: "workflow.runId",   detail: d.runId },
    { source: "workflow.health",  detail: d.health },
    { source: "workflow.reason",  detail: d.reason },
    ...(d.action.targetStepIndex !== undefined ? [{ source: "workflow.suggested_step", detail: `step ${d.action.targetStepIndex}` }] : []),
  ];
  return {
    summary: `Workflow is ${d.health}: ${d.reason}`,
    evidence,
    recommendedActions: [
      { label: d.action.label, href: "/dashboard/reliability" },
      ...(d.alternateActions ?? []).slice(0, 2).map((a) => ({ label: a.label, href: "/dashboard/reliability" })),
    ],
    risk: d.health === "failed" ? "high" : d.health === "stuck" ? "medium" : "low",
    safety: d.action.autoSafe ? undefined : ["Suggested action is not auto-safe — requires human review before execution."],
    confidence: 0.85,
    source: "typed_state",
  };
}

function canIRetry(input: ReliabilityIntentInputs): CopilotResponse {
  const cf = input.classifiedFailure;
  if (!cf) return fallback("I need the failure context to decide if retry is safe.", "Open the failing run to see classification.", "/dashboard/jobs");
  const evidence: CopilotEvidence[] = [
    { source: "failure.category",   detail: cf.category },
    { source: "failure.severity",   detail: cf.severity },
    { source: "failure.retryable",  detail: String(cf.retryable) },
    { source: "failure.code",       detail: cf.jobFailureKind },
  ];
  return {
    summary: cf.retryable
      ? `Yes — this failure (${cf.category}) is structurally safe to retry. ${cf.userMessage}`
      : `No — this failure (${cf.category}) is not safe to auto-retry. ${cf.userMessage}`,
    evidence,
    recommendedActions: [cf.safeNextAction ?? { label: "Open Reliability Center", href: "/dashboard/reliability" }],
    risk: cf.severity === "critical" || cf.severity === "error" ? "high" : cf.severity === "warning" ? "medium" : "low",
    safety: cf.retryable
      ? ["Axiom will retry automatically with provider-aware backoff."]
      : ["Retry blocked. Resolve the root cause before re-running."],
    relatedDocs: cf.docsLink ? [{ label: "Troubleshooting", href: cf.docsLink }] : undefined,
    confidence: 0.9,
    source: "typed_state",
  };
}

function whatFailed(input: ReliabilityIntentInputs): CopilotResponse {
  const cf = input.classifiedFailure;
  const dlqs = input.deadLetters ?? [];
  if (!cf && dlqs.length === 0) return fallback("No failure context is available for this entity.", "Open Jobs to see recent errors.", "/dashboard/jobs");
  const evidence: CopilotEvidence[] = [];
  if (cf) {
    evidence.push({ source: "failure.category", detail: cf.category });
    evidence.push({ source: "failure.user",     detail: cf.userMessage });
    if (cf.operatorDetail) evidence.push({ source: "failure.detail", detail: cf.operatorDetail });
  }
  for (const d of dlqs.slice(0, 3)) {
    evidence.push({ source: "deadletter", detail: `${d.category} · ${d.reason}` });
  }
  return {
    summary: cf?.userMessage ?? `Operation failed and was dead-lettered: ${dlqs[0]?.reason}`,
    evidence,
    recommendedActions: [cf?.safeNextAction ?? { label: "Open dead-letter queue", href: "/dashboard/reliability" }],
    risk: cf?.severity === "critical" ? "high" : "medium",
    confidence: cf ? 0.9 : 0.7,
    source: "typed_state",
  };
}

function providerRateLimit(input: ReliabilityIntentInputs): CopilotResponse {
  const circuits = (input.circuits ?? []).filter((c) => c.state !== "closed");
  if (circuits.length === 0) {
    return fallback("No circuit breaker is open right now — provider integrations look healthy.", "Open Reliability Center to confirm.", "/dashboard/reliability");
  }
  const evidence: CopilotEvidence[] = circuits.slice(0, 4).map((c) => ({
    source: `circuit.${c.target}`,
    detail: `${c.state} · last failure: ${c.lastFailureReason ?? "n/a"}`,
  }));
  const target = circuits[0].target;
  return {
    summary: `Yes — the ${target} circuit is currently ${circuits[0].state}. Axiom is throttling cooperatively and probing on a schedule.`,
    evidence,
    recommendedActions: [{ label: "Open Reliability Center", href: "/dashboard/reliability" }],
    risk: circuits.length > 2 ? "high" : "medium",
    safety: ["No action required — the breaker will close once probes succeed."],
    confidence: 0.9,
    source: "typed_state",
  };
}

function scanPartial(input: ReliabilityIntentInputs): CopilotResponse {
  const d = input.workflowDiagnosis;
  if (!d) return fallback("No partial-scan diagnosis is available.", "Open the Reliability Center to inspect runs.", "/dashboard/reliability");
  return {
    summary: `Scan is in a "${d.health}" state. ${d.reason}`,
    evidence: [
      { source: "scan.health", detail: d.health },
      { source: "scan.reason", detail: d.reason },
    ],
    recommendedActions: [{ label: d.action.label, href: "/dashboard/reliability" }],
    risk: d.health === "failed" ? "high" : "medium",
    safety: d.action.autoSafe ? undefined : ["Recovery action is not auto-safe — needs human approval."],
    confidence: 0.8,
    source: "typed_state",
  };
}

function needsHumanInput(input: ReliabilityIntentInputs): CopilotResponse {
  const cf = input.classifiedFailure;
  const needsInput = cf?.jobFailureKind === "user_input_required";
  if (cf && needsInput) {
    return {
      summary: `Yes — ${cf.userMessage}`,
      evidence: [{ source: "failure.category", detail: cf.category }],
      recommendedActions: [cf.safeNextAction ?? { label: "Open Jobs", href: "/dashboard/jobs" }],
      risk: "medium",
      safety: ["Operation is paused until the user supplies the missing input."],
      confidence: 0.85,
      source: "typed_state",
    };
  }
  return fallback("This entity isn't waiting on user input right now.", "Check Jobs for any input-required states.", "/dashboard/jobs");
}

function blockedByPolicy(input: ReliabilityIntentInputs): CopilotResponse {
  const cf = input.classifiedFailure;
  if (cf?.category === "policy_block") {
    return {
      summary: cf.userMessage,
      evidence: [{ source: "failure.category", detail: "policy_block" }],
      recommendedActions: [cf.safeNextAction ?? { label: "Open governance", href: "/dashboard/governance" }],
      risk: "medium",
      safety: ["Resolve the policy condition or request an exemption — Axiom will not bypass governance."],
      relatedDocs: cf.docsLink ? [{ label: "Approval workflow", href: cf.docsLink }] : undefined,
      confidence: 0.95,
      source: "typed_state",
    };
  }
  return fallback("This entity isn't blocked by policy.", "Open governance to inspect active policy rules.", "/dashboard/governance");
}

function waitingOnApproval(input: ReliabilityIntentInputs): CopilotResponse {
  const cf = input.classifiedFailure;
  if (cf?.category === "approval_required") {
    return {
      summary: cf.userMessage,
      evidence: [{ source: "failure.category", detail: "approval_required" }],
      recommendedActions: [cf.safeNextAction ?? { label: "Open approvals", href: "/dashboard/approvals" }],
      risk: "low",
      safety: ["Operation will resume automatically once approval is granted."],
      confidence: 0.95,
      source: "typed_state",
    };
  }
  return fallback("This entity isn't waiting on approval right now.", "Open approvals to inspect pending decisions.", "/dashboard/approvals");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fallback(summary: string, ctaLabel: string, ctaHref: string): CopilotResponse {
  return {
    summary,
    evidence: [],
    recommendedActions: [{ label: ctaLabel, href: ctaHref }],
    confidence: 0.5,
    source: "fallback",
  };
}

// ---------------------------------------------------------------------------
// Intent classifier — pattern-match a free-text question to a ReliabilityIntent.
// ---------------------------------------------------------------------------

const PATTERNS: { intent: ReliabilityIntent; patterns: RegExp[] }[] = [
  { intent: "workflow_stuck",      patterns: [/\bstuck\b/i, /\bnot progressing\b/i, /\bhanging\b/i, /\bstalled\b/i] },
  { intent: "can_i_retry",         patterns: [/\bretry\b/i, /\bsafe to (re)?run\b/i, /\btry again\b/i] },
  { intent: "what_failed",         patterns: [/\bwhat failed\b/i, /\berror\b/i, /\bbroken\b/i, /\bcrashed\b/i] },
  { intent: "provider_rate_limit", patterns: [/\brate[- ]?limit/i, /\bthrottl/i, /\bbackoff\b/i] },
  { intent: "scan_partial",        patterns: [/\bpartial(?:ly)?\b/i, /\bincomplete\b/i] },
  { intent: "needs_human_input",   patterns: [/\bneed input\b/i, /\bwaiting for\b.*input/i] },
  { intent: "blocked_by_policy",   patterns: [/\bblocked by policy\b/i, /\bpolicy block\b/i, /\bpolicy denied\b/i] },
  { intent: "waiting_on_approval", patterns: [/\bawaiting approval\b/i, /\bwaiting on approver\b/i, /\bneed approval\b/i] },
];

export function classifyReliabilityIntent(text: string): ReliabilityIntent | null {
  if (!text) return null;
  for (const { intent, patterns } of PATTERNS) {
    if (patterns.some((p) => p.test(text))) return intent;
  }
  return null;
}
