/**
 * refactor_engineer — real domain work · Phase 591.
 *
 * Operator-input archetype. Operator pastes source code + the
 * refactor goal; engineer proposes a typed refactor plan with
 * steps, risks, and rollback strategy.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import { INJECTION_RESISTANCE_CLAUSE, buildUserInputSection } from "@/lib/workforce/domains/promptHardening";

export const REFACTOR_TARGET_KIND = "engineer_refactor_plan";

export interface RefactorInput {
  title: string;
  sourceCode: string;
  refactorGoal: string;
  smellsToAddress?: string;
  language?: string;
}

export interface RefactorPlan {
  slug: string;
  title: string;
  executiveSummary: string;
  refactorSteps: ReadonlyArray<string>;
  riskFactors: ReadonlyArray<string>;
  rollbackPlan: string;
  alternativesConsidered: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  refactorSteps: string[];
  riskFactors: string[];
  rollbackPlan: string;
  alternativesConsidered: string[];
}

const MAX_TITLE = 200;
const MAX_BODY = 8000;

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function buildSystemPrompt(): string {
  return [
    `You are the Refactor Engineer on the Axiom platform.`,
    `Your job: given source code + a refactor goal, propose the smallest sequence of mechanical refactor steps that achieves the goal.`,
    ``,
    INJECTION_RESISTANCE_CLAUSE,
    ``,
    `RULES:`,
    `  · Honest scope. If the refactor can't be done safely, surface that in riskFactors rather than papering over.`,
    `  · Executive summary: 3-4 sentences naming the goal, the smallest viable approach, the worst risk, and rough effort (S/M/L).`,
    `  · refactorSteps: 3-8 entries, each one a single line naming a mechanical transformation ("Extract <name> helper", "Rename X to Y", "Inline Z").`,
    `  · riskFactors: 2-5 entries naming specific behaviors that could break.`,
    `  · rollbackPlan: 1-3 sentences naming how to revert if the refactor lands and produces regressions.`,
    `  · alternativesConsidered: 1-3 entries naming approaches you weighed and why you didn't pick them.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{ "executiveSummary": "...", "refactorSteps": [...], "riskFactors": [...], "rollbackPlan": "...", "alternativesConsidered": [...] }`,
  ].join("\n");
}

function buildUserPrompt(i: RefactorInput): string {
  return buildUserInputSection([
    { label: "title", content: i.title },
    { label: "refactor_goal", content: i.refactorGoal },
    { label: "language", content: i.language ?? "" },
    { label: "smells_to_address", content: i.smellsToAddress ?? "" },
    { label: "source_code", content: i.sourceCode },
  ]);
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{"); const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1500) : null;
    if (!exec) return null;
    const rollback = typeof j.rollbackPlan === "string" ? j.rollbackPlan.trim().slice(0, 800) : "";
    const strs = (v: unknown, max: number) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim().slice(0, 400)).filter((s) => s.length > 0).slice(0, max) : [];
    return {
      executiveSummary: exec,
      refactorSteps: strs(j.refactorSteps, 8),
      riskFactors: strs(j.riskFactors, 5),
      rollbackPlan: rollback,
      alternativesConsidered: strs(j.alternativesConsidered, 3),
    };
  } catch { return null; }
}

export async function runRefactorEngineer(organizationId: string, raw: RefactorInput): Promise<RefactorPlan> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const sourceCode = raw.sourceCode.trim().slice(0, MAX_BODY);
  const refactorGoal = raw.refactorGoal.trim().slice(0, 1000);
  if (!title || !sourceCode || !refactorGoal) {
    return {
      slug: "", title,
      executiveSummary: "Input incomplete. Title + source code + refactor goal are required.",
      refactorSteps: [], riskFactors: [], rollbackPlan: "",
      alternativesConsidered: [],
      outcome: "error", modelHint: null, errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `refactor_${Date.now().toString(36)}`;
  const input: RefactorInput = {
    title, sourceCode, refactorGoal,
    smellsToAddress: raw.smellsToAddress?.trim().slice(0, 800),
    language: raw.language?.trim().slice(0, 80),
  };

  let outcome: RefactorPlan["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:refactor_engineer",
      organizationId,
      timeoutMs: 45_000,
    });
    const result = await fetcher(`${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(input)}`);
    parsed = parseAi(result.text);
    if (parsed) { outcome = "ai_generated"; modelHint = result.modelHint; }
    else        { errorMessage = "ai_response_unparseable"; }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    errorMessage = msg;
    outcome = msg.startsWith("circuit_open_") ? "fallback_rules" : "error";
  }

  return {
    slug, title,
    executiveSummary: parsed?.executiveSummary ?? `Stub refactor plan for "${title}". Re-run when the AI provider is healthy.`,
    refactorSteps: parsed?.refactorSteps ?? [],
    riskFactors: parsed?.riskFactors ?? [],
    rollbackPlan: parsed?.rollbackPlan ?? "",
    alternativesConsidered: parsed?.alternativesConsidered ?? [],
    outcome, modelHint, errorMessage,
  };
}

export async function persistRefactorPlan(organizationId: string, p: RefactorPlan): Promise<void> {
  if (!p.slug) return;
  const payload: string[] = [`title|${p.title}`, `rollback|${p.rollbackPlan}`];
  for (const s of p.refactorSteps)           payload.push(`step|${s}`);
  for (const a of p.alternativesConsidered)  payload.push(`alternative|${a}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: { organizationId_targetKind_targetId: { organizationId, targetKind: REFACTOR_TARGET_KIND, targetId: p.slug } },
      create: {
        organizationId, targetKind: REFACTOR_TARGET_KIND, targetId: p.slug,
        narrative: p.executiveSummary,
        riskFactorsJson: p.riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome, errorMessage: p.errorMessage, modelHint: p.modelHint,
        engineVersion: "refactor-engineer-v1",
      },
      update: {
        narrative: p.executiveSummary,
        riskFactorsJson: p.riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome, errorMessage: p.errorMessage, modelHint: p.modelHint,
      },
    });
  } catch (err) {
    console.warn("[refactorEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
