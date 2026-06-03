/**
 * schema_engineer — real domain work · Phase 597.
 *
 * Operator-input archetype. Operator pastes a schema fragment + a
 * slow-query log; engineer proposes typed index changes + migration
 * steps + a verification SQL snippet.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const SCHEMA_TARGET_KIND = "engineer_schema_proposal";

export interface SchemaInput {
  title: string;
  schemaFragment: string;
  slowQueryLog: string;
  databaseEngine?: string;
  knownConstraints?: string;
}

export interface SchemaProposal {
  slug: string;
  title: string;
  executiveSummary: string;
  indexProposals: ReadonlyArray<string>;
  migrationSteps: ReadonlyArray<string>;
  riskFactors: ReadonlyArray<string>;
  verificationSql: string;
  alternativesConsidered: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  indexProposals: string[];
  migrationSteps: string[];
  riskFactors: string[];
  verificationSql: string;
  alternativesConsidered: string[];
}

const MAX_TITLE = 200;
const MAX_BODY = 8000;

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
    `You are the Schema Engineer on the Axiom platform.`,
    `Your job: given a schema fragment + a slow-query log, propose targeted index changes + safe migration steps that close the worst query gaps.`,
    ``,
    `RULES:`,
    `  · Honest scope. If the slow queries are pathological joins or N+1 patterns rather than index gaps, surface that in riskFactors instead of inventing indexes.`,
    `  · Executive summary: 3-4 sentences naming the worst query, the smallest index intervention, the worst migration risk, and rough effort (S/M/L).`,
    `  · indexProposals: 1-6 entries, each a single-line index DDL ("CREATE INDEX idx_user_email ON users(email)") or composite-index recommendation. No prose.`,
    `  · migrationSteps: 2-6 entries naming the safe ordering ("Add index CONCURRENTLY", "Backfill column", "Drop legacy index"). Honor zero-downtime conventions.`,
    `  · riskFactors: 2-5 entries naming specific behaviors that could break — write amplification, lock contention, statistics staleness, etc.`,
    `  · verificationSql: a single short SQL snippet (≤ 600 chars) that proves the index is used + the slow query improved (EXPLAIN or pg_stat_statements style).`,
    `  · alternativesConsidered: 1-3 entries naming approaches you weighed (query rewrite, materialized view, partitioning) and why you didn't pick them.`,
    `  · Never invent indexes against columns that aren't in the schema fragment.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{ "executiveSummary": "...", "indexProposals": [...], "migrationSteps": [...], "riskFactors": [...], "verificationSql": "...", "alternativesConsidered": [...] }`,
  ].join("\n");
}

function buildUserPrompt(i: SchemaInput): string {
  const lines: string[] = [];
  lines.push(`Title: ${i.title}`);
  if (i.databaseEngine) lines.push(`Database engine: ${i.databaseEngine}`);
  if (i.knownConstraints) lines.push(`Known constraints: ${i.knownConstraints}`);
  lines.push(``);
  lines.push(`Schema fragment:`);
  lines.push("```");
  lines.push(i.schemaFragment);
  lines.push("```");
  lines.push(``);
  lines.push(`Slow query log:`);
  lines.push("```");
  lines.push(i.slowQueryLog);
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
    const verification = typeof j.verificationSql === "string" ? j.verificationSql.trim().slice(0, 600) : "";
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
      indexProposals: strs(j.indexProposals, 6, 400),
      migrationSteps: strs(j.migrationSteps, 6, 320),
      riskFactors: strs(j.riskFactors, 5, 320),
      verificationSql: verification,
      alternativesConsidered: strs(j.alternativesConsidered, 3, 400),
    };
  } catch {
    return null;
  }
}

export async function runSchemaEngineer(organizationId: string, raw: SchemaInput): Promise<SchemaProposal> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const schemaFragment = raw.schemaFragment.trim().slice(0, MAX_BODY);
  const slowQueryLog = raw.slowQueryLog.trim().slice(0, MAX_BODY);
  if (!title || !schemaFragment || !slowQueryLog) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + schema fragment + slow-query log are required.",
      indexProposals: [],
      migrationSteps: [],
      riskFactors: [],
      verificationSql: "",
      alternativesConsidered: [],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `schema_${Date.now().toString(36)}`;
  const input: SchemaInput = {
    title,
    schemaFragment,
    slowQueryLog,
    databaseEngine: raw.databaseEngine?.trim().slice(0, 80),
    knownConstraints: raw.knownConstraints?.trim().slice(0, 800),
  };

  let outcome: SchemaProposal["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:schema_engineer",
      organizationId,
      timeoutMs: 45_000,
      maxTokens: 2000,
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
    executiveSummary:
      parsed?.executiveSummary ?? `Stub schema proposal for "${title}". Re-run when the AI provider is healthy.`,
    indexProposals: parsed?.indexProposals ?? [],
    migrationSteps: parsed?.migrationSteps ?? [],
    riskFactors: parsed?.riskFactors ?? [],
    verificationSql: parsed?.verificationSql ?? "",
    alternativesConsidered: parsed?.alternativesConsidered ?? [],
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistSchemaProposal(organizationId: string, p: SchemaProposal): Promise<void> {
  if (!p.slug) return;
  const payload: string[] = [`title|${p.title}`];
  if (p.verificationSql) payload.push(`verification_sql|${p.verificationSql}`);
  for (const idx of p.indexProposals) payload.push(`index|${idx}`);
  for (const step of p.migrationSteps) payload.push(`migration|${step}`);
  for (const alt of p.alternativesConsidered) payload.push(`alternative|${alt}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: SCHEMA_TARGET_KIND,
          targetId: p.slug,
        },
      },
      create: {
        organizationId,
        targetKind: SCHEMA_TARGET_KIND,
        targetId: p.slug,
        narrative: p.executiveSummary,
        riskFactorsJson: p.riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome,
        errorMessage: p.errorMessage,
        modelHint: p.modelHint,
        engineVersion: "schema-engineer-v1",
      },
      update: {
        narrative: p.executiveSummary,
        riskFactorsJson: p.riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: p.outcome,
        errorMessage: p.errorMessage,
        modelHint: p.modelHint,
      },
    });
  } catch (err) {
    console.warn("[schemaEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
