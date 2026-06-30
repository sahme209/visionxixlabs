/**
 * AI Operations Copilot — state-aware operational assistant.
 *
 * Composes context from typed platform sources (provider registry, connector
 * registry, operational memory, policy results, governance autonomy, ReleaseOps
 * signals, desktop runtime status) and produces enterprise-safe answers with
 * evidence, recommended actions, safety annotations, and doc links.
 *
 * Pure function over typed inputs. No LLM calls happen here — this module
 * builds the context + scaffolds the response. An optional LLM enrichment
 * layer can wrap this in the API route.
 */

import type { TenantAutonomy } from "@/lib/governance/autonomyLevels";
import type { PolicyEvaluationResult } from "@/lib/governance/policyEngine";
import { explain } from "@/lib/governance/policyExplanation";
import { type Diagnosis, diagnose } from "@/lib/agent/troubleshootingAdvisor";
import { type OperationalTask } from "@/lib/agent/taskOrchestrator";
import { classifyReliabilityIntent, composeReliabilityAnswer } from "@/lib/agent/copilotReliabilityIntent";
import type { ClassifiedFailure } from "@/lib/reliability/failureClassifier";
import { computeHonestyCounts as computeActionRegistryCounts } from "@/lib/actions/actionRegistry";
import type { CircuitSnapshot } from "@/lib/reliability/circuitBreaker";
import type { DeadLetterRecord } from "@/lib/reliability/deadLetter";
import type { WorkflowDiagnosis } from "@/lib/reliability/workflowRecovery";

// ---------------------------------------------------------------------------
// Context inputs
// ---------------------------------------------------------------------------

export type CopilotQueryIntent =
  | "next_best_action"
  | "explain_state"
  | "diagnose_error"
  | "explain_plan"
  | "explain_release"
  | "explain_policy"
  | "explain_desktop"
  | "general_help";

export interface CopilotContext {
  organizationId: string;
  userId: string;
  autonomy?: TenantAutonomy;
  /** Recent operational state — used for answer composition. */
  state: {
    connectedClouds: number;
    pendingApprovals: number;
    openTasks: number;
    failedScans24h: number;
    rollbacksPending: number;
    releasesBlocked: number;
    desktopAvailable: boolean;
    auditExportsLast7d: number;
  };
  /** Latest tasks the user could take action on. */
  recentTasks?: OperationalTask[];
  /** Latest reasoning summaries, redacted. */
  recentReasoningSummaries?: { title: string; summary: string; confidence: number }[];
  /** Latest policy result, if a specific action is in context. */
  activePolicyResult?: PolicyEvaluationResult;
  /** Error text if the user is asking about a failure. */
  errorContext?: string;
  /** Optional reliability-intent inputs — when provided, the base composer
   *  delegates reliability-class questions to the typed reliability composer. */
  reliability?: {
    workflowDiagnosis?: WorkflowDiagnosis;
    classifiedFailure?: ClassifiedFailure;
    circuits?: CircuitSnapshot[];
    deadLetters?: DeadLetterRecord[];
  };
}

export interface CopilotQuery {
  intent: CopilotQueryIntent;
  /** Free-form question text. */
  question: string;
  /** Optional ID context — plan, scan, release, etc. */
  entityId?: string;
}

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface CopilotEvidence {
  source: string;
  detail: string;
}

export interface CopilotResponse {
  /** Headline answer — kept short, no hidden reasoning. */
  summary: string;
  /** Bulleted evidence — structured signals that drove the answer. */
  evidence: CopilotEvidence[];
  /** Concrete suggested next action(s). */
  recommendedActions: { label: string; href: string }[];
  /** Risk level surfaced when relevant. */
  risk?: "low" | "medium" | "high";
  /** Safety note — approval / rollback / autonomy caveats. */
  safety?: string[];
  /** Related doc links. */
  relatedDocs?: { label: string; href: string }[];
  /** Confidence in the answer in [0, 1]. */
  confidence: number;
  /** Honest provenance — was this answer composed from typed state or from a fallback. */
  source: "typed_state" | "diagnose" | "fallback";
  /** Optional diagnosis attached when intent === "diagnose_error". */
  diagnosis?: Diagnosis;
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

/**
 * Compose a copilot response from typed platform state. Pure function.
 *
 * Reliability-class questions are *first-class*: when the question text
 * matches a reliability intent (stuck workflow, retry safety, provider
 * rate limit, etc.), we delegate to `composeReliabilityAnswer()` which
 * reads from the typed reliability primitives instead of the generic
 * composers. This keeps "is this safe to retry?" answers grounded in
 * the actual ClassifiedFailure / CircuitSnapshot / DeadLetterRecord
 * state rather than the broad "explain_state" path.
 */
export function composeCopilotResponse(query: CopilotQuery, ctx: CopilotContext): CopilotResponse {
  // Reliability-class delegation — only when the question text matches.
  const reliabilityIntent = classifyReliabilityIntent(query.question);
  if (reliabilityIntent && ctx.reliability) {
    return composeReliabilityAnswer(reliabilityIntent, {
      workflowDiagnosis: ctx.reliability.workflowDiagnosis,
      classifiedFailure: ctx.reliability.classifiedFailure,
      circuits: ctx.reliability.circuits,
      deadLetters: ctx.reliability.deadLetters,
      userText: query.question,
    });
  }

  switch (query.intent) {
    case "diagnose_error":   return composeDiagnosis(query, ctx);
    case "next_best_action": return composeNextBestAction(query, ctx);
    case "explain_state":    return composeExplainState(query, ctx);
    case "explain_plan":     return composeExplainPlan(query, ctx);
    case "explain_policy":   return composeExplainPolicy(query, ctx);
    case "explain_release":  return composeExplainRelease(query, ctx);
    case "explain_desktop":  return composeExplainDesktop(query, ctx);
    case "general_help":     return composeGeneralHelp(query, ctx);
  }
}

// ---------------------------------------------------------------------------
// Per-intent composers
// ---------------------------------------------------------------------------

function composeDiagnosis(query: CopilotQuery, ctx: CopilotContext): CopilotResponse {
  const text = ctx.errorContext ?? query.question;
  const d = diagnose(text);
  return {
    summary: `${d.likelyCause} (confidence ${Math.round(d.confidence * 100)}%).`,
    evidence: d.evidence.map((e) => ({ source: e.name, detail: e.value })),
    recommendedActions: [d.safeNextAction, ...(d.escalation ? [d.escalation] : [])],
    safety: d.confidence < 0.5 ? ["Diagnosis confidence is low — see troubleshooting guide for additional context."] : undefined,
    relatedDocs: [{ label: "Troubleshooting guide", href: d.docsHref }],
    confidence: d.confidence,
    source: "diagnose",
    diagnosis: d,
  };
}

function composeNextBestAction(_query: CopilotQuery, ctx: CopilotContext): CopilotResponse {
  const evidence: CopilotEvidence[] = [];
  const recommendedActions: { label: string; href: string }[] = [];

  // Cloud not connected → onboard
  if (ctx.state.connectedClouds === 0) {
    return {
      summary: "Start with AWS to unlock the rest of the platform — read-only IAM role, under 5 minutes.",
      evidence: [{ source: "connected_clouds", detail: "0" }],
      recommendedActions: [{ label: "Start with AWS", href: "/operator/onboarding" }],
      relatedDocs: [{ label: "AWS setup guide", href: "/docs/aws-setup" }],
      confidence: 0.95,
      source: "typed_state",
    };
  }

  // Failed scans recently
  if (ctx.state.failedScans24h > 0) {
    return {
      summary: `${ctx.state.failedScans24h} scan${ctx.state.failedScans24h !== 1 ? "s" : ""} failed in the last 24 hours. Investigate before approving new plans.`,
      evidence: [{ source: "failed_scans_24h", detail: String(ctx.state.failedScans24h) }],
      recommendedActions: [
        { label: "Open Command Center", href: "/dashboard/command-center" },
        { label: "Read troubleshooting", href: "/docs/troubleshooting#scanning" },
      ],
      risk: "high",
      confidence: 0.9,
      source: "typed_state",
    };
  }

  // Pending approvals
  if (ctx.state.pendingApprovals > 0) {
    return {
      summary: `${ctx.state.pendingApprovals} approval${ctx.state.pendingApprovals !== 1 ? "s require" : " requires"} your review before applying.`,
      evidence: [{ source: "pending_approvals", detail: String(ctx.state.pendingApprovals) }],
      recommendedActions: [{ label: "Open Approval Center", href: "/dashboard/approvals" }],
      risk: "medium",
      confidence: 0.95,
      source: "typed_state",
    };
  }

  // Releases blocked
  if (ctx.state.releasesBlocked > 0) {
    return {
      summary: `${ctx.state.releasesBlocked} release${ctx.state.releasesBlocked !== 1 ? "s are" : " is"} blocked at the governance gate. Review readiness dimensions to unblock.`,
      evidence: [{ source: "releases_blocked", detail: String(ctx.state.releasesBlocked) }],
      recommendedActions: [{ label: "Open ReleaseOps", href: "/dashboard/releaseops" }],
      risk: "medium",
      relatedDocs: [{ label: "Readiness scoring", href: "/docs/releaseops/readiness" }],
      confidence: 0.9,
      source: "typed_state",
    };
  }

  // Desktop not installed yet
  if (!ctx.state.desktopAvailable) {
    return {
      summary: "Install the desktop agent for local Terraform execution + native notifications + workstation mode.",
      evidence: [{ source: "desktop_available", detail: "false" }],
      recommendedActions: [{ label: "Open download", href: "/download" }],
      relatedDocs: [{ label: "Desktop install guide", href: "/docs/desktop-install" }],
      confidence: 0.8,
      source: "typed_state",
    };
  }

  // Default — everything is healthy. Pull live action-registry
  // counts so the operator sees how much surface they have access
  // to right now (Phase 657).
  const counts = computeActionRegistryCounts();
  return {
    summary: `Everything is operational — ${counts.live} live actions ready, ${counts.governed} approval-gated, ${counts.unsafe} unsafe blocked by design. Continue current cadence or audit the full action surface.`,
    evidence: [
      { source: "connected_clouds", detail: String(ctx.state.connectedClouds) },
      { source: "pending_approvals", detail: "0" },
      { source: "failed_scans_24h", detail: "0" },
      { source: "registry_live", detail: String(counts.live) },
      { source: "registry_governed", detail: String(counts.governed) },
    ],
    recommendedActions: [
      { label: "Open Command Center", href: "/dashboard/command-center" },
      { label: "Audit Axiom's action surface", href: "/dashboard/capabilities" },
      { label: "Open Topology", href: "/dashboard/topology" },
    ],
    confidence: 0.85,
    source: "typed_state",
  };
  void evidence; void recommendedActions;
}

function composeExplainState(_query: CopilotQuery, ctx: CopilotContext): CopilotResponse {
  const counts = computeActionRegistryCounts();
  return {
    summary: `${ctx.state.connectedClouds} cloud${ctx.state.connectedClouds !== 1 ? "s" : ""} connected, ${ctx.state.pendingApprovals} pending approval${ctx.state.pendingApprovals !== 1 ? "s" : ""}, ${ctx.state.openTasks} open task${ctx.state.openTasks !== 1 ? "s" : ""}. Axiom catalogs ${counts.total} typed actions — ${counts.live} live, ${counts.preview} preview, ${counts.unsafe} unsafe blocked by design.`,
    evidence: [
      { source: "connected_clouds", detail: String(ctx.state.connectedClouds) },
      { source: "pending_approvals", detail: String(ctx.state.pendingApprovals) },
      { source: "open_tasks", detail: String(ctx.state.openTasks) },
      { source: "failed_scans_24h", detail: String(ctx.state.failedScans24h) },
      { source: "rollbacks_pending", detail: String(ctx.state.rollbacksPending) },
      { source: "releases_blocked", detail: String(ctx.state.releasesBlocked) },
      { source: "registry_live", detail: String(counts.live) },
      { source: "registry_total", detail: String(counts.total) },
    ],
    recommendedActions: [
      { label: "Open Command Center", href: "/dashboard/command-center" },
      { label: "Audit Axiom's action surface", href: "/dashboard/capabilities" },
    ],
    confidence: 0.95,
    source: "typed_state",
  };
}

function composeExplainPlan(query: CopilotQuery, ctx: CopilotContext): CopilotResponse {
  const reasoning = ctx.recentReasoningSummaries?.[0];
  if (!reasoning) {
    return {
      summary: "No recent reasoning trace available for that plan. Open the Command Center to find the plan and its reasoning.",
      evidence: [],
      recommendedActions: [{ label: "Open Command Center", href: "/dashboard/command-center" }],
      confidence: 0.5,
      source: "fallback",
    };
  }
  return {
    summary: `${reasoning.title}. ${reasoning.summary}`,
    evidence: [{ source: "confidence", detail: `${Math.round(reasoning.confidence * 100)}%` }],
    recommendedActions: [{ label: "Open Approval Center", href: "/dashboard/approvals" }],
    relatedDocs: [{ label: "Execution plans", href: "/docs/execution-plans" }],
    confidence: reasoning.confidence,
    source: "typed_state",
  };
  void query;
}

function composeExplainPolicy(_query: CopilotQuery, ctx: CopilotContext): CopilotResponse {
  if (!ctx.activePolicyResult || !ctx.autonomy) {
    return {
      summary: "No active policy evaluation in context. Open the Governance Control Center to see active rules.",
      evidence: [],
      recommendedActions: [{ label: "Open Governance", href: "/dashboard/governance" }],
      confidence: 0.5,
      source: "fallback",
    };
  }
  const e = explain(ctx.activePolicyResult, ctx.autonomy);
  return {
    summary: `${e.headline}. ${e.detail}`,
    evidence: e.appliedRules.map((r) => ({ source: r.id, detail: `${r.decision} · ${r.severity}` })),
    recommendedActions: [{ label: "Open Approval Center", href: "/dashboard/approvals" }],
    safety: [e.nextStep],
    relatedDocs: [{ label: "Approval workflow", href: "/docs/approval-workflow" }, { label: "Permissions model", href: "/docs/permissions-model" }],
    confidence: 0.95,
    source: "typed_state",
    risk: e.severity === "critical" ? "high" : e.severity === "warning" ? "medium" : "low",
  };
}

function composeExplainRelease(_query: CopilotQuery, ctx: CopilotContext): CopilotResponse {
  if (ctx.state.releasesBlocked === 0) {
    return {
      summary: "No releases blocked. Open the ReleaseOps Command Center for live deployment state.",
      evidence: [{ source: "releases_blocked", detail: "0" }],
      recommendedActions: [{ label: "Open ReleaseOps", href: "/dashboard/releaseops" }],
      confidence: 0.9,
      source: "typed_state",
    };
  }
  return {
    summary: `${ctx.state.releasesBlocked} release${ctx.state.releasesBlocked !== 1 ? "s" : ""} blocked. Common causes: low readiness score, missing branch protection, unverified rollback path.`,
    evidence: [{ source: "releases_blocked", detail: String(ctx.state.releasesBlocked) }],
    recommendedActions: [{ label: "Open ReleaseOps", href: "/dashboard/releaseops" }],
    relatedDocs: [
      { label: "ReleaseOps overview", href: "/docs/releaseops" },
      { label: "Readiness scoring", href: "/docs/releaseops/readiness" },
    ],
    risk: "medium",
    confidence: 0.85,
    source: "typed_state",
  };
}

function composeExplainDesktop(_query: CopilotQuery, ctx: CopilotContext): CopilotResponse {
  if (ctx.state.desktopAvailable) {
    return {
      summary: "Desktop runtime is installed locally. Local Terraform / CLI execution is available subject to autonomy + policy.",
      evidence: [{ source: "desktop_available", detail: "true" }],
      recommendedActions: [{ label: "Open Approval Center", href: "/dashboard/approvals" }],
      relatedDocs: [{ label: "Desktop install", href: "/docs/desktop-install" }],
      confidence: 0.9,
      source: "typed_state",
    };
  }
  return {
    summary: "Desktop runtime is not installed. macOS preview is available now; Windows ships Q2 2026, Linux ships Q3 2026.",
    evidence: [{ source: "desktop_available", detail: "false" }],
    recommendedActions: [{ label: "Open /download", href: "/download" }],
    relatedDocs: [
      { label: "Desktop install", href: "/docs/desktop-install" },
      { label: "Desktop architecture", href: "/docs/desktop-architecture" },
    ],
    confidence: 0.95,
    source: "typed_state",
  };
}

function composeGeneralHelp(query: CopilotQuery, _ctx: CopilotContext): CopilotResponse {
  const lower = query.question.toLowerCase();
  if (/iam|role|external/.test(lower)) {
    return {
      summary: "AWS connection uses an IAM role with an External ID — read-only by default. Full setup in /docs/aws-setup.",
      evidence: [{ source: "topic", detail: "aws_iam" }],
      recommendedActions: [{ label: "Open AWS setup", href: "/docs/aws-setup" }],
      confidence: 0.9,
      source: "typed_state",
    };
  }
  if (/rollback/.test(lower)) {
    return {
      summary: "Every execution plan ships with a pre-verified rollback path with measured RTO. See /docs/rollback for the full strategy.",
      evidence: [{ source: "topic", detail: "rollback" }],
      recommendedActions: [{ label: "Open rollback strategy", href: "/docs/rollback" }],
      confidence: 0.9,
      source: "typed_state",
    };
  }
  if (/approval|approve/.test(lower)) {
    return {
      summary: "Every change requires explicit approval. The Approval Center shows pending plans with full context. /docs/approval-workflow has the model.",
      evidence: [{ source: "topic", detail: "approval" }],
      recommendedActions: [{ label: "Open Approval Center", href: "/dashboard/approvals" }],
      confidence: 0.9,
      source: "typed_state",
    };
  }
  return {
    summary: "Open the documentation overview for a topic-organized index, or open the Command Center for live operational state.",
    evidence: [{ source: "topic", detail: "general" }],
    recommendedActions: [
      { label: "Open documentation", href: "/docs" },
      { label: "Open Command Center", href: "/dashboard/command-center" },
    ],
    confidence: 0.7,
    source: "fallback",
  };
}

// ---------------------------------------------------------------------------
// Suggested questions — used by the UI to seed the conversation
// ---------------------------------------------------------------------------

export function suggestedQuestions(ctx: CopilotContext): { intent: CopilotQueryIntent; label: string }[] {
  const out: { intent: CopilotQueryIntent; label: string }[] = [];
  out.push({ intent: "next_best_action", label: "What should I do next?" });
  if (ctx.state.pendingApprovals > 0) out.push({ intent: "explain_policy", label: "Why is approval required?" });
  if (ctx.state.failedScans24h > 0) out.push({ intent: "diagnose_error", label: "Why did this scan fail?" });
  if (ctx.state.releasesBlocked > 0) out.push({ intent: "explain_release", label: "What's blocking my releases?" });
  if (!ctx.state.desktopAvailable) out.push({ intent: "explain_desktop", label: "What can the desktop agent do?" });
  out.push({ intent: "explain_state", label: "What's the current platform state?" });
  out.push({ intent: "general_help", label: "How do I connect AWS securely?" });
  return out;
}
