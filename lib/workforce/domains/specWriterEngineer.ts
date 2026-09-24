/**
 * spec_writer_engineer — real domain work · Phase 584.
 *
 * First developer-style engineer to ship. Different shape from
 * compliance + detector: those engineers walk workspace state and
 * emit reports on their own. This engineer needs an INPUT — the
 * operator submits a feature request, the engineer writes a real
 * technical specification.
 *
 * The blueprint:
 *   1. Operator submits { title, problem, audience, constraints }
 *      through a form.
 *   2. The engineer asks Claude to produce a typed spec —
 *      executive summary, user stories, acceptance criteria,
 *      out-of-scope items, open questions.
 *   3. Result persists as one row per spec, keyed by a stable
 *      slug so subsequent edits upsert in place.
 *
 * Routes through the canonical instrumented fetcher — the
 * AI call counts toward the workspace's Phase 581 cost rollup
 * and bills the customer correctly.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import { INJECTION_RESISTANCE_CLAUSE, buildUserInputSection } from "@/lib/workforce/domains/promptHardening";

export const SPEC_WRITER_TARGET_KIND = "engineer_spec_writer_spec";

export interface SpecWriterInput {
  title: string;
  problem: string;
  audience?: string;
  constraints?: string;
}

export interface SpecSection {
  heading: string;
  body: string;
}

export interface WrittenSpec {
  slug: string;
  title: string;
  executiveSummary: string;
  userStories: ReadonlyArray<string>;
  acceptanceCriteria: ReadonlyArray<string>;
  outOfScope: ReadonlyArray<string>;
  openQuestions: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAiSpec {
  executiveSummary: string;
  userStories: string[];
  acceptanceCriteria: string[];
  outOfScope: string[];
  openQuestions: string[];
}

const MAX_TITLE_LEN = 200;
const MAX_FREEFORM_LEN = 2000;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function buildSystemPrompt(): string {
  return [
    `You are the Spec Writer Engineer on the Axiom platform.`,
    `An operator just submitted a feature request. Your job: produce a CONCISE technical specification an engineering team could use to start implementation tomorrow.`,
    ``,
    INJECTION_RESISTANCE_CLAUSE,
    ``,
    `RULES:`,
    `  · Honest scope. If the request is ambiguous, surface that in the openQuestions array rather than inventing requirements.`,
    `  · Executive summary: 3-4 sentences naming the problem, the proposed solution, the most material risk, and the rough effort size (S/M/L).`,
    `  · User stories: 3-6 entries, each one a single line in the "As a <role>, I want <capability> so that <outcome>" shape.`,
    `  · Acceptance criteria: 4-8 entries, each one a falsifiable single-line claim ("The X endpoint returns 200 when Y").`,
    `  · Out of scope: 2-5 entries naming things the operator might assume are included but aren't.`,
    `  · Open questions: 1-5 entries naming the things you'd need answered before implementation.`,
    `  · Plain prose. No markdown headers. No JSON inside fields.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<3-4 sentences>",`,
    `  "userStories": ["<line>", "..."],`,
    `  "acceptanceCriteria": ["<line>", "..."],`,
    `  "outOfScope": ["<line>", "..."],`,
    `  "openQuestions": ["<line>", "..."]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(input: SpecWriterInput): string {
  return buildUserInputSection([
    { label: "title", content: input.title },
    { label: "problem_statement", content: input.problem },
    { label: "target_audience", content: input.audience ?? "" },
    { label: "known_constraints", content: input.constraints ?? "" },
  ]);
}

function parseAiResponse(text: string): ParsedAiSpec | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const json = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof json.executiveSummary === "string" ? json.executiveSummary.trim().slice(0, 1500) : null;
    if (!exec) return null;
    function strArray(v: unknown, max: number): string[] {
      if (!Array.isArray(v)) return [];
      return v
        .filter((x): x is string => typeof x === "string")
        .map((s) => s.trim().slice(0, 400))
        .filter((s) => s.length > 0)
        .slice(0, max);
    }
    return {
      executiveSummary: exec,
      userStories: strArray(json.userStories, 6),
      acceptanceCriteria: strArray(json.acceptanceCriteria, 8),
      outOfScope: strArray(json.outOfScope, 5),
      openQuestions: strArray(json.openQuestions, 5),
    };
  } catch {
    return null;
  }
}

export async function runSpecWriter(organizationId: string, rawInput: SpecWriterInput): Promise<WrittenSpec> {
  const title = rawInput.title.trim().slice(0, MAX_TITLE_LEN);
  const problem = rawInput.problem.trim().slice(0, MAX_FREEFORM_LEN);
  if (!title || !problem) {
    return {
      slug: "",
      title,
      executiveSummary: "Spec input is incomplete. Title + problem statement are required.",
      userStories: [],
      acceptanceCriteria: [],
      outOfScope: [],
      openQuestions: ["What feature should this spec cover?"],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_title_or_problem",
    };
  }
  const slug = slugify(title) || `spec_${Date.now().toString(36)}`;

  const input: SpecWriterInput = {
    title,
    problem,
    audience: rawInput.audience?.trim().slice(0, 400),
    constraints: rawInput.constraints?.trim().slice(0, MAX_FREEFORM_LEN),
  };

  // AI call.
  let outcome: WrittenSpec["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let executiveSummary = `Stub spec for "${title}". The AI provider couldn't generate the full spec; operator should re-run.`;
  let userStories: string[] = [];
  let acceptanceCriteria: string[] = [];
  let outOfScope: string[] = [];
  let openQuestions: string[] = [`The Spec Writer Engineer wasn't able to produce a draft for "${title}" — re-run when the AI provider is healthy.`];

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:spec_writer_engineer",
      organizationId,
      timeoutMs: 45_000,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(input)}`;
    const result = await fetcher(prompt);
    const parsed = parseAiResponse(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      userStories = parsed.userStories;
      acceptanceCriteria = parsed.acceptanceCriteria;
      outOfScope = parsed.outOfScope;
      openQuestions = parsed.openQuestions;
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
    executiveSummary,
    userStories,
    acceptanceCriteria,
    outOfScope,
    openQuestions,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistWrittenSpec(organizationId: string, spec: WrittenSpec): Promise<void> {
  if (!spec.slug) return;
  // riskFactorsJson holds the open questions (so existing AGI memory
  // surfaces render them as "risk factors"). nextActionsJson holds
  // the per-section payload (acceptance criteria + user stories +
  // out-of-scope) the surface decodes into structured rendering.
  const payload: string[] = [];
  for (const s of spec.userStories)        payload.push(`user_story|${s}`);
  for (const a of spec.acceptanceCriteria) payload.push(`acceptance|${a}`);
  for (const o of spec.outOfScope)         payload.push(`out_of_scope|${o}`);
  payload.unshift(`title|${spec.title}`);

  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: SPEC_WRITER_TARGET_KIND,
          targetId: spec.slug,
        },
      },
      create: {
        organizationId,
        targetKind: SPEC_WRITER_TARGET_KIND,
        targetId: spec.slug,
        narrative: spec.executiveSummary,
        riskFactorsJson: spec.openQuestions as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: spec.outcome,
        errorMessage: spec.errorMessage,
        modelHint: spec.modelHint,
        engineVersion: "spec-writer-engineer-v1",
      },
      update: {
        narrative: spec.executiveSummary,
        riskFactorsJson: spec.openQuestions as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: spec.outcome,
        errorMessage: spec.errorMessage,
        modelHint: spec.modelHint,
      },
    });
  } catch (err) {
    console.warn("[specWriterEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
