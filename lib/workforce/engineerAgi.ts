/**
 * Engineer AGI engine — Phase 557.
 *
 * Every canonical engineer can do real AGI work. This module:
 *
 *   1. Builds a role-aware system prompt from the engineer's registry
 *      profile (role, department, requiredConnectors, requiredTools,
 *      auditTopics, highestRiskAction). The AI is framed AS that
 *      engineer — not "the platform reasoning about it".
 *
 *   2. Loads workspace context the engineer needs to do its job:
 *      recent gated attempts, pending approvals, last decision, the
 *      blocked-reason mode if one's active. Honest empty when nothing
 *      yet — the engineer can still introduce itself.
 *
 *   3. Routes the Claude call through the canonical
 *      makeInstrumentedFetcher so circuit breaker + AiCallLog tracking
 *      stay consistent with the rest of the AGI fabric.
 *
 *   4. Parses the structured JSON return into the same shape as
 *      AiRationaleEnrichment: narrative, riskFactors, nextActions.
 *      Persists with targetKind="engineer_specialty" so the entry
 *      slots into the existing AGI memory permalink + feed surfaces
 *      without any UI changes.
 *
 * Output stays "best-effort": when Claude fails or the JSON is
 * malformed, we fall back to a deterministic rules-based summary
 * (outcome="fallback_rules") so the operator always sees something
 * honest, never a half-rendered card.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import type { AgentEngineer } from "./agentWorkforceRegistry";

export interface EngineerAgiResult {
  narrative: string;
  riskFactors: ReadonlyArray<string>;
  nextActions: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface WorkspaceContext {
  attempts30d: { allowed: number; requires_approval: number; blocked: number; total: number };
  pendingApprovalCount: number;
  recentBlock: { action: string; reason: string } | null;
  topActions: ReadonlyArray<{ action: string; total: number; blocked: number }>;
}

const ENGINE_NAME_PREFIX = "engineer_specialty";

async function loadWorkspaceContext(
  organizationId: string,
  engineerId: string,
): Promise<WorkspaceContext> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [attemptGroups, pending, recentBlock, actionGroups] = await Promise.all([
    prisma.agentEngineerActionAttempt.groupBy({
      by: ["runtimeDecision"],
      where: { organizationId, engineerId, createdAt: { gte: since30d } },
      _count: { _all: true },
    }).catch(() => [] as Array<{ runtimeDecision: string; _count: { _all: number } }>),
    prisma.engineerApprovalSnapshot.count({
      where: { organizationId, engineerId, status: "pending" },
    }).catch(() => 0),
    prisma.agentEngineerActionAttempt.findFirst({
      where: { organizationId, engineerId, runtimeDecision: "blocked" },
      orderBy: { createdAt: "desc" },
      select: { action: true, reason: true },
    }).catch(() => null),
    prisma.agentEngineerActionAttempt.groupBy({
      by: ["action", "runtimeDecision"],
      where: { organizationId, engineerId, createdAt: { gte: since30d } },
      _count: { _all: true },
    }).catch(() => [] as Array<{ action: string; runtimeDecision: string; _count: { _all: number } }>),
  ]);

  const attempts = { allowed: 0, requires_approval: 0, blocked: 0, total: 0 };
  for (const g of attemptGroups) {
    if (g.runtimeDecision === "allowed") attempts.allowed += g._count._all;
    else if (g.runtimeDecision === "requires_approval") attempts.requires_approval += g._count._all;
    else if (g.runtimeDecision === "blocked") attempts.blocked += g._count._all;
  }
  attempts.total = attempts.allowed + attempts.requires_approval + attempts.blocked;

  const actionMap = new Map<string, { action: string; total: number; blocked: number }>();
  for (const g of actionGroups) {
    const row = actionMap.get(g.action) ?? { action: g.action, total: 0, blocked: 0 };
    row.total += g._count._all;
    if (g.runtimeDecision === "blocked") row.blocked += g._count._all;
    actionMap.set(g.action, row);
  }
  const topActions = Array.from(actionMap.values()).sort((a, b) => b.total - a.total).slice(0, 3);

  return {
    attempts30d: attempts,
    pendingApprovalCount: pending,
    recentBlock,
    topActions,
  };
}

function buildSystemPrompt(engineer: AgentEngineer): string {
  return [
    `You ARE the ${engineer.displayName} on the Axiom platform.`,
    `Your role: ${engineer.role}`,
    `Your department: ${engineer.department}`,
    `Your declared highest-risk action: ${engineer.highestRiskAction}`,
    `Your approval rule: ${engineer.approvalRule}`,
    engineer.requiredConnectors.length > 0
      ? `Connectors you depend on: ${engineer.requiredConnectors.join(", ")}`
      : `You operate without external connectors.`,
    engineer.requiredTools.length > 0
      ? `Tools you exercise: ${engineer.requiredTools.join(", ")}`
      : ``,
    ``,
    `Speak in the first person as this engineer. Be specific, be honest`,
    `about what you can and cannot do, and refuse to invent data.`,
    ``,
    `RETURN STRICT JSON only — no prose around it — matching this shape:`,
    `{`,
    `  "narrative": "<1-3 paragraphs as the engineer>",`,
    `  "riskFactors": ["<short risk>", "..."],`,
    `  "nextActions": ["<concrete next action>", "..."]`,
    `}`,
    ``,
    `Cap arrays at 5 items each. Cap narrative at 800 characters.`,
  ].filter(Boolean).join("\n");
}

function buildUserPrompt(engineer: AgentEngineer, ctx: WorkspaceContext): string {
  const parts: string[] = [];
  parts.push(`Workspace status for ${engineer.id} (last 30 days):`);
  if (ctx.attempts30d.total === 0) {
    parts.push(`  · No gated attempts yet — fresh workspace.`);
  } else {
    parts.push(`  · ${ctx.attempts30d.total} gated attempts: ${ctx.attempts30d.allowed} allowed, ${ctx.attempts30d.requires_approval} need approval, ${ctx.attempts30d.blocked} blocked`);
  }
  parts.push(`  · ${ctx.pendingApprovalCount} approval${ctx.pendingApprovalCount === 1 ? "" : "s"} waiting on a workspace decision`);
  if (ctx.recentBlock) {
    parts.push(`  · Last block: action="${ctx.recentBlock.action}" reason="${ctx.recentBlock.reason}"`);
  }
  if (ctx.topActions.length > 0) {
    parts.push(`  · Top actions attempted:`);
    for (const a of ctx.topActions) {
      parts.push(`    - ${a.action} (${a.total} attempts, ${a.blocked} blocked)`);
    }
  }
  if (engineer.missingPieces.length > 0) {
    parts.push(``);
    parts.push(`Known missing setup pieces (from the canonical registry):`);
    for (const m of engineer.missingPieces.slice(0, 5)) {
      parts.push(`  · ${m}`);
    }
  }
  parts.push(``);
  parts.push(`Tell the operator — as this engineer — what you can offer right now, what's holding you back, and the specific next steps you recommend. Return the strict JSON shape only.`);
  return parts.join("\n");
}

function parseStructuredResponse(text: string): {
  narrative: string;
  riskFactors: string[];
  nextActions: string[];
} | null {
  // Try to extract a JSON object even if Claude wrapped it in prose.
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const json = JSON.parse(text.slice(first, last + 1)) as unknown;
    if (!json || typeof json !== "object") return null;
    const j = json as Record<string, unknown>;
    const narrative = typeof j.narrative === "string" ? j.narrative.slice(0, 1200) : "";
    const riskFactors = Array.isArray(j.riskFactors)
      ? j.riskFactors.filter((x): x is string => typeof x === "string").slice(0, 5)
      : [];
    const nextActions = Array.isArray(j.nextActions)
      ? j.nextActions.filter((x): x is string => typeof x === "string").slice(0, 5)
      : [];
    if (!narrative) return null;
    return { narrative, riskFactors, nextActions };
  } catch {
    return null;
  }
}

function fallback(engineer: AgentEngineer, ctx: WorkspaceContext): EngineerAgiResult {
  // Deterministic-rules fallback. No model needed — operators always
  // see something honest about the engineer's current posture.
  const pieces: string[] = [];
  pieces.push(`I'm the ${engineer.displayName}.`);
  pieces.push(engineer.role);
  if (ctx.attempts30d.total === 0) {
    pieces.push(`I haven't been exercised in this workspace in the last 30 days — nothing to learn from yet.`);
  } else {
    pieces.push(`In the last 30 days I've attempted ${ctx.attempts30d.total} gated actions (${ctx.attempts30d.allowed} allowed, ${ctx.attempts30d.requires_approval} approval-gated, ${ctx.attempts30d.blocked} blocked).`);
  }
  if (engineer.missingPieces.length > 0) {
    pieces.push(`My known setup gaps: ${engineer.missingPieces.slice(0, 3).join(", ")}.`);
  }
  return {
    narrative: pieces.join(" "),
    riskFactors: engineer.missingPieces.slice(0, 5) as unknown as string[],
    nextActions: engineer.requiredConnectors.map((c) => `Connect ${c} to unlock the full toolset.`).slice(0, 5),
    outcome: "fallback_rules",
    modelHint: null,
    errorMessage: null,
  };
}

/**
 * Run the engineer's AGI flow end-to-end. Always returns a result —
 * the caller can persist it via persistEngineerAgiResult().
 */
export async function runEngineerAgi(
  engineer: AgentEngineer,
  organizationId: string,
): Promise<EngineerAgiResult> {
  const ctx = await loadWorkspaceContext(organizationId, engineer.id);
  const system = buildSystemPrompt(engineer);
  const user = buildUserPrompt(engineer, ctx);

  const fetcher = makeInstrumentedFetcher({
    engineName: `${ENGINE_NAME_PREFIX}:${engineer.id}`,
    organizationId,
    timeoutMs: 30_000,
  });

  try {
    // The instrumented fetcher takes a single prompt string. We
    // concatenate system + user with a separator so the model sees
    // both clearly. The fetcher handles circuit breaking + logging
    // via the canonical AiCallLog path.
    const prompt = `${system}\n\n---\n\n${user}`;
    const result = await fetcher(prompt);
    const parsed = parseStructuredResponse(result.text);
    if (!parsed) {
      // JSON malformed — fall back deterministically, mark the
      // outcome accordingly. The AI call already logged ok at the
      // fetcher; outcome here only affects the rationale row.
      const fb = fallback(engineer, ctx);
      return { ...fb, outcome: "fallback_rules", errorMessage: "ai_response_unparseable" };
    }
    return {
      narrative: parsed.narrative,
      riskFactors: parsed.riskFactors,
      nextActions: parsed.nextActions,
      outcome: "ai_generated",
      modelHint: result.modelHint,
      errorMessage: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // Circuit open or provider error — degrade to deterministic
    // rules. Operator still gets a meaningful response, marked
    // honestly so they can see WHY the AGI didn't run.
    const fb = fallback(engineer, ctx);
    return { ...fb, outcome: msg.startsWith("circuit_open_") ? "fallback_rules" : "error", errorMessage: msg };
  }
}

/**
 * Persist the result into AiRationaleEnrichment. Keyed by the
 * compound unique (organizationId, targetKind, targetId) so repeated
 * runs upsert in place — operators always see the latest rationale.
 */
export async function persistEngineerAgiResult(
  engineer: AgentEngineer,
  organizationId: string,
  result: EngineerAgiResult,
): Promise<void> {
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: "engineer_specialty",
          targetId: engineer.id,
        },
      },
      create: {
        organizationId,
        targetKind: "engineer_specialty",
        targetId: engineer.id,
        narrative: result.narrative,
        riskFactorsJson: result.riskFactors as unknown as string[],
        nextActionsJson: result.nextActions as unknown as string[],
        outcome: result.outcome,
        errorMessage: result.errorMessage,
        modelHint: result.modelHint,
        engineVersion: "engineer-agi-v1",
      },
      update: {
        narrative: result.narrative,
        riskFactorsJson: result.riskFactors as unknown as string[],
        nextActionsJson: result.nextActions as unknown as string[],
        outcome: result.outcome,
        errorMessage: result.errorMessage,
        modelHint: result.modelHint,
        engineVersion: "engineer-agi-v1",
      },
    });
  } catch (err) {
    // Persist is best-effort — never block the user-facing response
    // on a write failure. The operator will still see the freshly
    // generated narrative in the redirect render.
    console.warn("[engineerAgi] persist failed:", err instanceof Error ? err.message : err);
  }
}
