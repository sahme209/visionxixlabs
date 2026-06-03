/**
 * finops_engineer — real domain work · Phase 587.
 *
 * Reads cloud accounts + AxiomRecommendation rows tagged with
 * non-zero monthly cost impact, ranks by potential savings, and
 * emits typed rightsizing/decommission recommendations.
 *
 * No-input archetype.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const FINOPS_ENGINEER_TARGET_KIND = "engineer_finops_recommendations";

export interface FinopsCandidate {
  recommendationId: string;
  title: string;
  provider: string;
  monthlyLowUsd: number;
  monthlyHighUsd: number;
  yearlyHighUsd: number;
  disposition: string;
  /** AI-enriched plain-language pitch. Falls back to rules. */
  pitch: string;
}

export interface FinopsEngineerReport {
  generatedAt: Date;
  windowDays: number;
  totals: {
    candidateCount: number;
    monthlyHighUsd: number;
    yearlyHighUsd: number;
  };
  topCandidates: ReadonlyArray<FinopsCandidate>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAiOutput {
  executiveSummary: string;
  pitchByRecommendationId: Record<string, string>;
}

function buildSystemPrompt(): string {
  return [
    `You are the FinOps Engineer on the Axiom platform.`,
    `Your job: phrase rightsizing/decommission candidates in the language a CFO + an SRE both understand.`,
    ``,
    `RULES:`,
    `  · Never invent candidates. pitchByRecommendationId only references ids from the input.`,
    `  · One sentence per candidate, ≤ 220 characters, naming the action + the monthly savings figure + the rollback path.`,
    `  · Executive summary: 2-3 sentences naming total monthly savings opportunity, biggest single win, and recommended sequencing.`,
    `  · Plain prose. Quote dollar amounts as integers with a $ prefix.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "pitchByRecommendationId": { "<id>": "<sentence>", "...": "..." }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(candidates: ReadonlyArray<FinopsCandidate>, totals: FinopsEngineerReport["totals"]): string {
  const lines: string[] = [];
  lines.push(`Workspace FinOps inputs (current month):`);
  lines.push(`  candidates: ${totals.candidateCount}`);
  lines.push(`  combined monthly_high: $${totals.monthlyHighUsd}`);
  lines.push(`  combined yearly_high:  $${totals.yearlyHighUsd}`);
  lines.push(``);
  if (candidates.length === 0) {
    lines.push(`No cost-bearing recommendations in window. Affirm calm state and return empty pitchByRecommendationId.`);
  } else {
    lines.push(`Top candidates (rephrase only — never add or drop):`);
    for (const c of candidates) {
      lines.push(``);
      lines.push(`  [${c.recommendationId}] provider=${c.provider} disposition=${c.disposition}`);
      lines.push(`    title: ${c.title}`);
      lines.push(`    monthly_low=$${c.monthlyLowUsd} monthly_high=$${c.monthlyHighUsd} yearly_high=$${c.yearlyHighUsd}`);
    }
  }
  return lines.join("\n");
}

function parseAiResponse(text: string): ParsedAiOutput | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const json = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof json.executiveSummary === "string" ? json.executiveSummary.trim().slice(0, 1200) : null;
    if (!exec) return null;
    const raw = json.pitchByRecommendationId;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, pitchByRecommendationId: {} };
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string") map[k] = v.trim().slice(0, 400);
    }
    return { executiveSummary: exec, pitchByRecommendationId: map };
  } catch {
    return null;
  }
}

function fallbackPitch(c: FinopsCandidate): string {
  return `Apply ${c.title} — projected $${c.monthlyHighUsd}/mo savings if executed cleanly; disposition is ${c.disposition.replace(/_/g, " ")}.`;
}

export async function runFinopsEngineer(organizationId: string): Promise<FinopsEngineerReport> {
  let recs: Array<{ id: string; title: string; disposition: string; monthlyLow: number; monthlyHigh: number; yearlyHigh: number; run: { cloudAccount: { provider: string } } }> = [];
  try {
    recs = await prisma.axiomRecommendation.findMany({
      where: {
        run: { organizationId },
        monthlyHigh: { gt: 0 },
      },
      orderBy: { monthlyHigh: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        disposition: true,
        monthlyLow: true,
        monthlyHigh: true,
        yearlyHigh: true,
        run: { select: { cloudAccount: { select: { provider: true } } } },
      },
    }) as typeof recs;
  } catch {
    recs = [];
  }

  const totalsMonthly = recs.reduce((acc, r) => acc + Math.round(r.monthlyHigh), 0);
  const totalsYearly = recs.reduce((acc, r) => acc + Math.round(r.yearlyHigh), 0);
  const totals: FinopsEngineerReport["totals"] = {
    candidateCount: recs.length,
    monthlyHighUsd: totalsMonthly,
    yearlyHighUsd: totalsYearly,
  };

  const candidates: FinopsCandidate[] = recs.slice(0, 10).map((r) => ({
    recommendationId: r.id,
    title: r.title,
    provider: r.run.cloudAccount.provider,
    monthlyLowUsd: Math.round(r.monthlyLow),
    monthlyHighUsd: Math.round(r.monthlyHigh),
    yearlyHighUsd: Math.round(r.yearlyHigh),
    disposition: r.disposition,
    pitch: "",
  }));

  let executiveSummary = candidates.length === 0
    ? "No cost-bearing recommendations on file. Run a fresh scan or check that the FinOps scanner is enabled."
    : `${recs.length} cost-bearing recommendation${recs.length === 1 ? "" : "s"} totalling $${totalsMonthly}/mo ($${totalsYearly}/yr) at the high end. Sequence highest-impact items first.`;
  let pitchByRecommendationId: Record<string, string> = {};
  let outcome: FinopsEngineerReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:finops_engineer",
      organizationId,
      timeoutMs: 30_000,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(candidates, totals)}`;
    const result = await fetcher(prompt);
    const parsed = parseAiResponse(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      pitchByRecommendationId = parsed.pitchByRecommendationId;
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

  const topCandidates = candidates.map((c) => ({
    ...c,
    pitch: pitchByRecommendationId[c.recommendationId]?.trim() || fallbackPitch(c),
  }));

  return {
    generatedAt: new Date(),
    windowDays: 30,
    totals,
    topCandidates,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistFinopsReport(organizationId: string, report: FinopsEngineerReport): Promise<void> {
  const riskFactors = report.topCandidates.map((c) => `$${c.monthlyHighUsd}/mo · ${c.provider} · ${c.title}`);
  const payload = report.topCandidates.map((c) => `${c.recommendationId}|${c.provider}|${c.monthlyHighUsd}|${c.yearlyHighUsd}|${c.pitch}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: FINOPS_ENGINEER_TARGET_KIND,
          targetId: "finops_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: FINOPS_ENGINEER_TARGET_KIND,
        targetId: "finops_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "finops-engineer-v1",
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
    console.warn("[finopsEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
