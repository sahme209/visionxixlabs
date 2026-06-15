/**
 * intent_parser_engineer — real domain work · Phase 602.
 *
 * Operator-input archetype. Operator types a natural-language intent
 * (e.g. "find users inactive 30+ days, send re-engagement email").
 * Engineer parses it into a typed workflow plan: ordered steps each
 * tagged with kind (trigger | query | transform | action | guard),
 * required capabilities, and the ambiguities that need operator
 * clarification before the workflow can execute.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import { INJECTION_RESISTANCE_CLAUSE, buildUserInputSection } from "@/lib/workforce/domains/promptHardening";

export const INTENT_PARSER_TARGET_KIND = "engineer_intent_workflow";

export type WorkflowStepKind = "trigger" | "query" | "transform" | "action" | "guard";
export type IntentComplexity = "S" | "M" | "L";

export interface IntentInput {
  title: string;
  intentText: string;
  knownCapabilities?: string;
  hardConstraints?: string;
}

export interface WorkflowStep {
  index: number;
  kind: WorkflowStepKind;
  description: string;
  requiredCapabilities: ReadonlyArray<string>;
}

export interface IntentWorkflow {
  slug: string;
  title: string;
  executiveSummary: string;
  steps: ReadonlyArray<WorkflowStep>;
  ambiguities: ReadonlyArray<string>;
  estimatedComplexity: IntentComplexity;
  riskFactors: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  steps: Array<{ kind: WorkflowStepKind; description: string; requiredCapabilities: string[] }>;
  ambiguities: string[];
  estimatedComplexity: IntentComplexity;
  riskFactors: string[];
}

const MAX_TITLE = 200;
const MAX_BODY = 4000;

function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function buildSystemPrompt(): string {
  return [
    `You are the Intent Parser Engineer on the Axiom platform.`,
    `Your job: take an operator's natural-language intent and emit a typed workflow plan they (or downstream engineers) can execute or refuse with confidence.`,
    ``,
    INJECTION_RESISTANCE_CLAUSE,
    ``,
    `STEP KINDS:`,
    `  · trigger    — what kicks the workflow off (schedule, event, manual run)`,
    `  · query      — read from a data source (DB, audit log, external API)`,
    `  · transform  — shape, filter, enrich the queried data`,
    `  · action     — externally observable side-effect (email, write, notify)`,
    `  · guard      — pre/post-condition check that gates the next step`,
    ``,
    `RULES:`,
    `  · Honest scope. If the intent is too vague to plan safely, return ≤ 2 steps and surface the gaps in ambiguities.`,
    `  · Executive summary: 2-3 sentences naming the headline intent, the worst ambiguity, and the rough complexity.`,
    `  · steps: 2-8 ordered entries. Each entry has a kind, a single-line description ≤ 280 chars, and 0-4 requiredCapabilities (verb-noun strings like "db.read", "email.send", "audit.write").`,
    `  · ambiguities: 0-5 entries naming what's unclear in the input that the operator must confirm before execution.`,
    `  · estimatedComplexity: S (single-shot) | M (multi-step with clear contract) | L (cross-system orchestration or stateful).`,
    `  · riskFactors: 1-4 entries naming what could go wrong if the workflow runs without further refinement.`,
    `  · Never invent capabilities the input did not imply or that the operator hasn't listed in knownCapabilities.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "steps": [ { "kind": "<kind>", "description": "...", "requiredCapabilities": ["...", "..."] } ],`,
    `  "ambiguities": [...],`,
    `  "estimatedComplexity": "<S|M|L>",`,
    `  "riskFactors": [...]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: IntentInput): string {
  return buildUserInputSection([
    { label: "title", content: i.title },
    { label: "known_capabilities_available", content: i.knownCapabilities ?? "" },
    { label: "hard_constraints", content: i.hardConstraints ?? "" },
    { label: "operator_intent", content: i.intentText },
  ]);
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1200) : null;
    if (!exec) return null;
    const stepsRaw = Array.isArray(j.steps) ? (j.steps as unknown[]) : [];
    const steps: ParsedAi["steps"] = [];
    for (let i = 0; i < stepsRaw.length && steps.length < 8; i += 1) {
      const item = stepsRaw[i];
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const kind = obj.kind;
      const description = typeof obj.description === "string" ? obj.description.trim().slice(0, 400) : "";
      const caps = Array.isArray(obj.requiredCapabilities)
        ? (obj.requiredCapabilities as unknown[])
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim().slice(0, 60))
            .filter((s) => s.length > 0)
            .slice(0, 4)
        : [];
      if (
        description &&
        (kind === "trigger" || kind === "query" || kind === "transform" || kind === "action" || kind === "guard")
      ) {
        steps.push({ kind: kind as WorkflowStepKind, description, requiredCapabilities: caps });
      }
    }
    const strs = (v: unknown, max: number, charMax: number) =>
      Array.isArray(v)
        ? v
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim().slice(0, charMax))
            .filter((s) => s.length > 0)
            .slice(0, max)
        : [];
    const complexityRaw = j.estimatedComplexity;
    const estimatedComplexity: IntentComplexity =
      complexityRaw === "S" || complexityRaw === "M" || complexityRaw === "L"
        ? complexityRaw
        : "M";
    return {
      executiveSummary: exec,
      steps,
      ambiguities: strs(j.ambiguities, 5, 280),
      estimatedComplexity,
      riskFactors: strs(j.riskFactors, 4, 280),
    };
  } catch {
    return null;
  }
}

export async function runIntentParserEngineer(organizationId: string, raw: IntentInput): Promise<IntentWorkflow> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const intentText = raw.intentText.trim().slice(0, MAX_BODY);
  if (!title || !intentText) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + intent text are required.",
      steps: [],
      ambiguities: [],
      estimatedComplexity: "S",
      riskFactors: [],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `intent_${Date.now().toString(36)}`;
  const input: IntentInput = {
    title,
    intentText,
    knownCapabilities: raw.knownCapabilities?.trim().slice(0, 1000),
    hardConstraints: raw.hardConstraints?.trim().slice(0, 800),
  };

  let outcome: IntentWorkflow["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:intent_parser_engineer",
      organizationId,
      timeoutMs: 45_000,
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

  const steps: WorkflowStep[] = (parsed?.steps ?? []).map((s, i) => ({
    index: i + 1,
    kind: s.kind,
    description: s.description,
    requiredCapabilities: s.requiredCapabilities,
  }));

  return {
    slug,
    title,
    executiveSummary: parsed?.executiveSummary ?? `Stub workflow for "${title}". Re-run when the AI provider is healthy.`,
    steps,
    ambiguities: parsed?.ambiguities ?? [],
    estimatedComplexity: parsed?.estimatedComplexity ?? "M",
    riskFactors: parsed?.riskFactors ?? [],
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistIntentWorkflow(organizationId: string, w: IntentWorkflow): Promise<void> {
  if (!w.slug) return;
  const payload: string[] = [`title|${w.title}`, `complexity|${w.estimatedComplexity}`];
  for (const a of w.ambiguities) payload.push(`ambiguity|${a}`);
  for (const s of w.steps) {
    payload.push(`step|${s.index}|${s.kind}|${s.description}`);
    if (s.requiredCapabilities.length > 0) {
      payload.push(`capabilities|${s.index}|${s.requiredCapabilities.join(",")}`);
    }
  }
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: INTENT_PARSER_TARGET_KIND,
          targetId: w.slug,
        },
      },
      create: {
        organizationId,
        targetKind: INTENT_PARSER_TARGET_KIND,
        targetId: w.slug,
        narrative: w.executiveSummary,
        riskFactorsJson: w.riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: w.outcome,
        errorMessage: w.errorMessage,
        modelHint: w.modelHint,
        engineVersion: "intent-parser-engineer-v1",
      },
      update: {
        narrative: w.executiveSummary,
        riskFactorsJson: w.riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: w.outcome,
        errorMessage: w.errorMessage,
        modelHint: w.modelHint,
      },
    });
  } catch (err) {
    console.warn("[intentParserEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
