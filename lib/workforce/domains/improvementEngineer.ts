/**
 * improvement_engineer — real domain work · Phase 603.
 *
 * Reads recent SecureAuditRecord outcomes + AiCallLog outcomes,
 * surfaces process / observability / tooling / governance signals,
 * and proposes platform-wide method improvements. Distinct from
 * verifier_engineer (which classifies AI call failures) and
 * memory_consolidator_engineer (which synthesizes engineer learning):
 * improvement_engineer reasons about the platform itself, not the
 * engineers.
 *
 * No-input archetype.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const IMPROVEMENT_TARGET_KIND = "engineer_improvement_proposals";

export type ImprovementArea = "process" | "observability" | "tooling" | "governance";

export interface ImprovementProposal {
  proposalId: string;
  area: ImprovementArea;
  /** AI-enriched observation. Falls back to rules-derived. */
  observation: string;
  proposal: string;
  expectedImpact: string;
}

export interface ImprovementReport {
  generatedAt: Date;
  windowDays: number;
  auditTotals: { success: number; failure: number; blocked: number };
  aiCallTotals: { ok: number; error: number; timeout: number; shortCircuit: number };
  proposals: ReadonlyArray<ImprovementProposal>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface Candidate {
  proposalId: string;
  area: ImprovementArea;
  signal: string;
  fallbackObservation: string;
  fallbackProposal: string;
  fallbackImpact: string;
}

interface ParsedAi {
  executiveSummary: string;
  byProposalId: Record<
    string,
    { observation: string; proposal: string; expectedImpact: string }
  >;
}

function buildSystemPrompt(): string {
  return [
    `You are the Improvement Engineer on the Axiom platform.`,
    `Your job: read recent platform telemetry (audit-trail outcome counts + AI call outcome counts) and propose method improvements across four areas.`,
    ``,
    `AREAS:`,
    `  · process       — how operators / engineers do their work`,
    `  · observability — what signals exist to detect issues`,
    `  · tooling       — what tools / surfaces would close a gap`,
    `  · governance    — what policies / approvals / scoping changes`,
    ``,
    `RULES:`,
    `  · Only emit proposalId keys present in the input.`,
    `  · observation: 1-2 sentences ≤ 320 chars naming the concrete signal that surfaced the gap.`,
    `  · proposal: 1-2 sentences ≤ 320 chars naming the concrete change to make.`,
    `  · expectedImpact: 1 sentence ≤ 240 chars naming the observable downstream effect.`,
    `  · Executive summary: 2-3 sentences naming the dominant area and the highest-leverage proposal.`,
    `  · Never invent telemetry — only reason about counts the input states.`,
    `  · Plain prose, no markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "byProposalId": { "<id>": { "observation": "...", "proposal": "...", "expectedImpact": "..." } }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(
  auditTotals: ImprovementReport["auditTotals"],
  aiCallTotals: ImprovementReport["aiCallTotals"],
  candidates: ReadonlyArray<Candidate>,
): string {
  const lines: string[] = [];
  lines.push(`Platform telemetry (last 14 days):`);
  lines.push(`  audit outcomes: success=${auditTotals.success} failure=${auditTotals.failure} blocked=${auditTotals.blocked}`);
  lines.push(`  AI call outcomes: ok=${aiCallTotals.ok} error=${aiCallTotals.error} timeout=${aiCallTotals.timeout} short_circuit=${aiCallTotals.shortCircuit}`);
  if (candidates.length === 0) {
    lines.push(``);
    lines.push(`No specific candidate proposals surface from the telemetry. Return a steady-state summary and an empty byProposalId.`);
    return lines.join("\n");
  }
  lines.push(``);
  lines.push(`Candidate proposals (rephrase only — never add or drop):`);
  for (const c of candidates) {
    lines.push(``);
    lines.push(`  [${c.proposalId}] area=${c.area}`);
    lines.push(`    signal: ${c.signal}`);
    lines.push(`    rules observation: ${c.fallbackObservation}`);
    lines.push(`    rules proposal: ${c.fallbackProposal}`);
    lines.push(`    rules expected impact: ${c.fallbackImpact}`);
  }
  return lines.join("\n");
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1500) : null;
    if (!exec) return null;
    const raw = j.byProposalId;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, byProposalId: {} };
    const map: ParsedAi["byProposalId"] = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const obj = v as Record<string, unknown>;
      const observation = typeof obj.observation === "string" ? obj.observation.trim().slice(0, 480) : "";
      const proposal = typeof obj.proposal === "string" ? obj.proposal.trim().slice(0, 480) : "";
      const expectedImpact = typeof obj.expectedImpact === "string" ? obj.expectedImpact.trim().slice(0, 320) : "";
      if (observation && proposal && expectedImpact) {
        map[k] = { observation, proposal, expectedImpact };
      }
    }
    return { executiveSummary: exec, byProposalId: map };
  } catch {
    return null;
  }
}

export async function runImprovementEngineer(organizationId: string): Promise<ImprovementReport> {
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  let auditOutcomes: Array<{ outcome: string; _count: { _all: number } }> = [];
  let aiCallOutcomes: Array<{ outcome: string; _count: { _all: number } }> = [];
  try {
    const [auditRows, aiRows] = await Promise.all([
      prisma.secureAuditRecord.groupBy({
        by: ["outcome"],
        where: { organizationId, occurredAt: { gte: since14d } },
        _count: { _all: true },
      }),
      prisma.aiCallLog.groupBy({
        by: ["outcome"],
        where: { organizationId, startedAt: { gte: since14d } },
        _count: { _all: true },
      }),
    ]);
    auditOutcomes = auditRows as unknown as typeof auditOutcomes;
    aiCallOutcomes = aiRows as unknown as typeof aiCallOutcomes;
  } catch {
    auditOutcomes = [];
    aiCallOutcomes = [];
  }

  const auditTotals = { success: 0, failure: 0, blocked: 0 };
  for (const r of auditOutcomes) {
    if (r.outcome in auditTotals) auditTotals[r.outcome as keyof typeof auditTotals] = r._count._all;
  }
  const aiCallTotals = { ok: 0, error: 0, timeout: 0, shortCircuit: 0 };
  for (const r of aiCallOutcomes) {
    if (r.outcome === "ok") aiCallTotals.ok = r._count._all;
    else if (r.outcome === "error") aiCallTotals.error = r._count._all;
    else if (r.outcome === "timeout") aiCallTotals.timeout = r._count._all;
    else if (r.outcome === "short_circuit") aiCallTotals.shortCircuit = r._count._all;
  }

  const candidates: Candidate[] = [];
  const totalAi = aiCallTotals.ok + aiCallTotals.error + aiCallTotals.timeout + aiCallTotals.shortCircuit;
  const totalAudit = auditTotals.success + auditTotals.failure + auditTotals.blocked;

  if (auditTotals.failure > 0 && totalAudit > 0 && auditTotals.failure / totalAudit > 0.1) {
    candidates.push({
      proposalId: "audit_failure_rate",
      area: "process",
      signal: `audit failure share = ${Math.round((auditTotals.failure / totalAudit) * 100)}%`,
      fallbackObservation: `Failure outcomes make up over 10% of recorded audit events (${auditTotals.failure}/${totalAudit}).`,
      fallbackProposal: `Add a per-action triage review covering the top 3 failing actions before next sweep.`,
      fallbackImpact: `Failure share trending down by the next 14-day window.`,
    });
  }
  if (auditTotals.blocked > 0) {
    candidates.push({
      proposalId: "blocked_action_visibility",
      area: "observability",
      signal: `blocked count = ${auditTotals.blocked}`,
      fallbackObservation: `${auditTotals.blocked} blocked outcome${auditTotals.blocked === 1 ? "" : "s"} recorded — policy gate is firing.`,
      fallbackProposal: `Surface a blocked-action dashboard tile so operators see the gate activity without digging into the audit table.`,
      fallbackImpact: `Operator awareness of policy enforcement increases without raising alert volume.`,
    });
  }
  if (aiCallTotals.timeout > 0 || aiCallTotals.shortCircuit > 0) {
    const stalls = aiCallTotals.timeout + aiCallTotals.shortCircuit;
    candidates.push({
      proposalId: "ai_provider_resilience",
      area: "tooling",
      signal: `provider stalls (timeout+short_circuit) = ${stalls}`,
      fallbackObservation: `${stalls} AI provider stall${stalls === 1 ? "" : "s"} (timeouts + circuit short-circuits) in the window — instrumented fetcher is degrading honestly but operators feel the latency.`,
      fallbackProposal: `Add a fallback model route per engine so latency-sensitive surfaces stay responsive when the primary provider stalls.`,
      fallbackImpact: `Provider-stall-driven user-visible latency drops without removing the circuit safety net.`,
    });
  }
  if (aiCallTotals.error > 0 && totalAi > 0 && aiCallTotals.error / totalAi > 0.1) {
    candidates.push({
      proposalId: "ai_error_governance",
      area: "governance",
      signal: `AI error share = ${Math.round((aiCallTotals.error / totalAi) * 100)}%`,
      fallbackObservation: `AI call errors exceed 10% (${aiCallTotals.error}/${totalAi}) — provider, key, or prompt shape is misaligned.`,
      fallbackProposal: `Require a model + prompt review for any engine logging > 10% error rate in a rolling 14d window before next deploy.`,
      fallbackImpact: `Provider-driven errors become a deployment-blocking signal instead of a silent tax.`,
    });
  }
  if (candidates.length === 0) {
    candidates.push({
      proposalId: "steady_state_review",
      area: "process",
      signal: "no anomaly thresholds tripped",
      fallbackObservation: `No anomaly thresholds tripped in the audit + AI call telemetry over the last 14 days.`,
      fallbackProposal: `Use the calm window to backfill engineer notes / runbooks before the next active sweep.`,
      fallbackImpact: `Documentation debt drops without requiring new code.`,
    });
  }

  let executiveSummary = `Improvement engineer reviewed ${totalAudit} audit + ${totalAi} AI call records over the last 14 days and surfaced ${candidates.length} proposal${candidates.length === 1 ? "" : "s"} below.`;
  let byProposalId: ParsedAi["byProposalId"] = {};
  let outcome: ImprovementReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:improvement_engineer",
      organizationId,
      timeoutMs: 30_000,
      maxTokens: 2000,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(auditTotals, aiCallTotals, candidates)}`;
    const result = await fetcher(prompt);
    const parsed = parseAi(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      byProposalId = parsed.byProposalId;
      outcome = "ai_generated";
      modelHint = result.modelHint;
    } else {
      errorMessage = "ai_response_unparseable";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    errorMessage = msg;
    outcome = msg.startsWith("circuit_open_") ? "fallback_rules" : "error";
  }

  const proposals: ImprovementProposal[] = candidates.map((c) => {
    const ai = byProposalId[c.proposalId];
    return {
      proposalId: c.proposalId,
      area: c.area,
      observation: ai?.observation ?? c.fallbackObservation,
      proposal: ai?.proposal ?? c.fallbackProposal,
      expectedImpact: ai?.expectedImpact ?? c.fallbackImpact,
    };
  });

  return {
    generatedAt: new Date(),
    windowDays: 14,
    auditTotals,
    aiCallTotals,
    proposals,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistImprovementReport(organizationId: string, report: ImprovementReport): Promise<void> {
  const riskFactors = report.proposals.map((p) => `${p.area} · ${p.proposalId}`);
  const payload: string[] = [];
  for (const p of report.proposals) {
    payload.push(`observation|${p.proposalId}|${p.area}|${p.observation}`);
    payload.push(`proposal|${p.proposalId}|${p.proposal}`);
    payload.push(`expected_impact|${p.proposalId}|${p.expectedImpact}`);
  }
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: IMPROVEMENT_TARGET_KIND,
          targetId: "improvement_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: IMPROVEMENT_TARGET_KIND,
        targetId: "improvement_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "improvement-engineer-v1",
      },
      update: {
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
      },
    });
  } catch (err) {
    console.warn("[improvementEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
