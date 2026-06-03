/**
 * reasoner_engineer — real domain work · Phase 604.
 *
 * Operator-input archetype. Operator pastes a set of observations,
 * symptoms, or signals; engineer weaves them into a typed hypothesis
 * with a confidence score, the signals that support it, the signals
 * that contradict it, the next agents to involve, and the next
 * investigation steps.
 *
 * Distinct from meta_reasoner (which reconciles cross-engineer
 * tensions): reasoner_engineer reasons FROM raw signals UP to a
 * hypothesis. It's the detective.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const REASONER_TARGET_KIND = "engineer_reasoner_hypothesis";

export interface ReasonerInput {
  title: string;
  observations: string;
  domainContext?: string;
  alreadyRuledOut?: string;
}

export interface ReasonerHypothesis {
  slug: string;
  title: string;
  executiveSummary: string;
  hypothesis: string;
  /** 0-100 inclusive. */
  confidence: number;
  supportingSignals: ReadonlyArray<string>;
  contradictingSignals: ReadonlyArray<string>;
  nextAgents: ReadonlyArray<string>;
  nextInvestigationSteps: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  hypothesis: string;
  confidence: number;
  supportingSignals: string[];
  contradictingSignals: string[];
  nextAgents: string[];
  nextInvestigationSteps: string[];
}

const MAX_TITLE = 200;
const MAX_BODY = 6000;

function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function clampConfidence(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 50;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function buildSystemPrompt(): string {
  return [
    `You are the Reasoner Engineer on the Axiom platform.`,
    `Your job: weave raw observations into a single typed hypothesis with explicit confidence + the next agents to involve.`,
    ``,
    `RULES:`,
    `  · Honest scope. If the observations don't converge, set confidence ≤ 35 and surface the gap in contradictingSignals.`,
    `  · Executive summary: 2-3 sentences naming the headline hypothesis + the most material supporting signal + the confidence rating.`,
    `  · hypothesis: 1-3 sentences ≤ 600 chars naming the single best-fit explanation of the observations.`,
    `  · confidence: integer 0-100. Use 30 for "weakly supported", 60 for "consistent with the signals", 85+ for "well-supported with little contradiction". Never default to 50 without justification.`,
    `  · supportingSignals: 2-6 entries quoting / paraphrasing observations that uphold the hypothesis.`,
    `  · contradictingSignals: 0-4 entries naming observations the hypothesis doesn't explain.`,
    `  · nextAgents: 1-4 engineer ids you'd want to involve next (e.g., verifier_engineer, simulator_engineer, anomaly_engineer, finops_engineer).`,
    `  · nextInvestigationSteps: 2-4 entries naming concrete next data to gather or experiments to run.`,
    `  · Never invent signals not present in the input. Quote them faithfully.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "hypothesis": "...",`,
    `  "confidence": <0-100>,`,
    `  "supportingSignals": [...],`,
    `  "contradictingSignals": [...],`,
    `  "nextAgents": [...],`,
    `  "nextInvestigationSteps": [...]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: ReasonerInput): string {
  const lines: string[] = [];
  lines.push(`Title: ${i.title}`);
  if (i.domainContext) lines.push(`Domain context: ${i.domainContext}`);
  if (i.alreadyRuledOut) lines.push(`Already ruled out: ${i.alreadyRuledOut}`);
  lines.push(``);
  lines.push(`Observations:`);
  lines.push("```");
  lines.push(i.observations);
  lines.push("```");
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
    const hypothesis = typeof j.hypothesis === "string" ? j.hypothesis.trim().slice(0, 800) : "";
    if (!hypothesis) return null;
    const strs = (v: unknown, max: number, charMax: number) =>
      Array.isArray(v)
        ? v
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim().slice(0, charMax))
            .filter((s) => s.length > 0)
            .slice(0, max)
        : [];
    return {
      executiveSummary: exec,
      hypothesis,
      confidence: clampConfidence(j.confidence),
      supportingSignals: strs(j.supportingSignals, 6, 360),
      contradictingSignals: strs(j.contradictingSignals, 4, 360),
      nextAgents: strs(j.nextAgents, 4, 80),
      nextInvestigationSteps: strs(j.nextInvestigationSteps, 4, 320),
    };
  } catch {
    return null;
  }
}

export async function runReasonerEngineer(organizationId: string, raw: ReasonerInput): Promise<ReasonerHypothesis> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const observations = raw.observations.trim().slice(0, MAX_BODY);
  if (!title || !observations) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + observations are required.",
      hypothesis: "",
      confidence: 0,
      supportingSignals: [],
      contradictingSignals: [],
      nextAgents: [],
      nextInvestigationSteps: [],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `reasoner_${Date.now().toString(36)}`;
  const input: ReasonerInput = {
    title,
    observations,
    domainContext: raw.domainContext?.trim().slice(0, 1000),
    alreadyRuledOut: raw.alreadyRuledOut?.trim().slice(0, 1000),
  };

  let outcome: ReasonerHypothesis["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:reasoner_engineer",
      organizationId,
      timeoutMs: 60_000,
      maxTokens: 2500,
    });
    const result = await fetcher(`${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(input)}`);
    parsed = parseAi(result.text);
    if (parsed) {
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

  return {
    slug,
    title,
    executiveSummary: parsed?.executiveSummary ?? `Stub hypothesis for "${title}". Re-run when the AI provider is healthy.`,
    hypothesis: parsed?.hypothesis ?? "",
    confidence: parsed?.confidence ?? 0,
    supportingSignals: parsed?.supportingSignals ?? [],
    contradictingSignals: parsed?.contradictingSignals ?? [],
    nextAgents: parsed?.nextAgents ?? [],
    nextInvestigationSteps: parsed?.nextInvestigationSteps ?? [],
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistReasonerHypothesis(organizationId: string, r: ReasonerHypothesis): Promise<void> {
  if (!r.slug) return;
  const payload: string[] = [
    `title|${r.title}`,
    `hypothesis|${r.hypothesis}`,
    `confidence|${r.confidence}`,
  ];
  for (const s of r.supportingSignals) payload.push(`supports|${s}`);
  for (const s of r.contradictingSignals) payload.push(`contradicts|${s}`);
  for (const a of r.nextAgents) payload.push(`next_agent|${a}`);
  for (const s of r.nextInvestigationSteps) payload.push(`investigation|${s}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: REASONER_TARGET_KIND,
          targetId: r.slug,
        },
      },
      create: {
        organizationId,
        targetKind: REASONER_TARGET_KIND,
        targetId: r.slug,
        narrative: r.executiveSummary,
        riskFactorsJson: r.contradictingSignals as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: r.outcome,
        errorMessage: r.errorMessage,
        modelHint: r.modelHint,
        engineVersion: "reasoner-engineer-v1",
      },
      update: {
        narrative: r.executiveSummary,
        riskFactorsJson: r.contradictingSignals as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: r.outcome,
        errorMessage: r.errorMessage,
        modelHint: r.modelHint,
      },
    });
  } catch (err) {
    console.warn("[reasonerEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
