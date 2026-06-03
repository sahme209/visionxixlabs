/**
 * test_coverage_engineer — real domain work · Phase 590.
 *
 * Operator-input archetype. Operator pastes source code; engineer
 * proposes a typed test plan (specific test cases, edge cases,
 * gaps to monitor). Routes through canonical instrumented fetcher
 * so the Claude call meters into AiCallLog → cost passthrough.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const TEST_COVERAGE_TARGET_KIND = "engineer_test_coverage_proposal";

export interface TestCoverageInput {
  title: string;
  sourceCode: string;
  language?: string;
  framework?: string;
  focus?: string;
}

export interface TestProposal {
  slug: string;
  title: string;
  executiveSummary: string;
  testCases: ReadonlyArray<string>;
  edgeCases: ReadonlyArray<string>;
  coverageGapsToWatch: ReadonlyArray<string>;
  openQuestions: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  testCases: string[];
  edgeCases: string[];
  coverageGapsToWatch: string[];
  openQuestions: string[];
}

const MAX_TITLE = 200;
const MAX_BODY = 8000;

function slugify(t: string): string {
  return t.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function buildSystemPrompt(): string {
  return [
    `You are the Test Coverage Engineer on the Axiom platform.`,
    `Your job: given source code, propose a tight test plan a developer can implement directly.`,
    ``,
    `RULES:`,
    `  · Never invent code constructs that aren't visible in the input.`,
    `  · Executive summary: 3-4 sentences naming the public surface area, the most material edge case, and rough effort to land 80%+ branch coverage.`,
    `  · testCases: 4-8 entries, each one a single line in the form "[describe] [it] — [specific assertion]".`,
    `  · edgeCases: 3-6 entries naming concrete inputs/states (e.g. "empty array", "negative index").`,
    `  · coverageGapsToWatch: 2-4 entries naming branches the test plan can't easily cover (e.g. external HTTP failures).`,
    `  · openQuestions: 1-4 entries naming what you'd need clarified before writing tests.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{ "executiveSummary": "...", "testCases": [...], "edgeCases": [...], "coverageGapsToWatch": [...], "openQuestions": [...] }`,
  ].join("\n");
}

function buildUserPrompt(i: TestCoverageInput): string {
  const lines: string[] = [];
  lines.push(`Title: ${i.title}`);
  if (i.language)  lines.push(`Language: ${i.language}`);
  if (i.framework) lines.push(`Test framework: ${i.framework}`);
  if (i.focus)     lines.push(`Operator focus: ${i.focus}`);
  lines.push(``);
  lines.push(`Source code:`);
  lines.push("```");
  lines.push(i.sourceCode);
  lines.push("```");
  return lines.join("\n");
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{"); const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1500) : null;
    if (!exec) return null;
    const strs = (v: unknown, max: number) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim().slice(0, 400)).filter((s) => s.length > 0).slice(0, max) : [];
    return {
      executiveSummary: exec,
      testCases: strs(j.testCases, 8),
      edgeCases: strs(j.edgeCases, 6),
      coverageGapsToWatch: strs(j.coverageGapsToWatch, 4),
      openQuestions: strs(j.openQuestions, 4),
    };
  } catch { return null; }
}

export async function runTestCoverageEngineer(organizationId: string, rawInput: TestCoverageInput): Promise<TestProposal> {
  const title = rawInput.title.trim().slice(0, MAX_TITLE);
  const sourceCode = rawInput.sourceCode.trim().slice(0, MAX_BODY);
  if (!title || !sourceCode) {
    return {
      slug: "", title,
      executiveSummary: "Input incomplete. Title + source code are required.",
      testCases: [], edgeCases: [], coverageGapsToWatch: [],
      openQuestions: ["Provide the source code to analyze."],
      outcome: "error", modelHint: null, errorMessage: "missing_title_or_source",
    };
  }
  const slug = slugify(title) || `test_${Date.now().toString(36)}`;

  const input: TestCoverageInput = {
    title, sourceCode,
    language: rawInput.language?.trim().slice(0, 80),
    framework: rawInput.framework?.trim().slice(0, 80),
    focus: rawInput.focus?.trim().slice(0, 400),
  };

  let outcome: TestProposal["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:test_coverage_engineer",
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
    executiveSummary: parsed?.executiveSummary ?? `Stub test plan for "${title}". AI provider couldn't generate the full plan; operator should re-run.`,
    testCases: parsed?.testCases ?? [],
    edgeCases: parsed?.edgeCases ?? [],
    coverageGapsToWatch: parsed?.coverageGapsToWatch ?? [],
    openQuestions: parsed?.openQuestions ?? [`Re-run when the AI provider is healthy.`],
    outcome, modelHint, errorMessage,
  };
}

export async function persistTestProposal(organizationId: string, p: TestProposal): Promise<void> {
  if (!p.slug) return;
  const payload: string[] = [`title|${p.title}`];
  for (const t of p.testCases)           payload.push(`test_case|${t}`);
  for (const e of p.edgeCases)           payload.push(`edge_case|${e}`);
  for (const g of p.coverageGapsToWatch) payload.push(`coverage_gap|${g}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: { organizationId_targetKind_targetId: { organizationId, targetKind: TEST_COVERAGE_TARGET_KIND, targetId: p.slug } },
      create: {
        organizationId, targetKind: TEST_COVERAGE_TARGET_KIND, targetId: p.slug,
        narrative: p.executiveSummary,
        riskFactorsJson: p.openQuestions as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome, errorMessage: p.errorMessage, modelHint: p.modelHint,
        engineVersion: "test-coverage-engineer-v1",
      },
      update: {
        narrative: p.executiveSummary,
        riskFactorsJson: p.openQuestions as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome, errorMessage: p.errorMessage, modelHint: p.modelHint,
      },
    });
  } catch (err) {
    console.warn("[testCoverageEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
