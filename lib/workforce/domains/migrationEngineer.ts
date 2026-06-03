/**
 * migration_engineer — real domain work · Phase 601.
 *
 * Operator-input archetype. Operator pastes a "from state → to
 * state" description (DB schema, API contract, deployment topology,
 * etc.) and engineer builds a multi-stage migration runbook with
 * backwards-compat windows, per-stage gate checks, and a rollback
 * decision tree.
 *
 * Distinct from schema_engineer: schema_engineer is about adding
 * indexes / closing query gaps. migration_engineer is about moving
 * the workspace from old state to new state SAFELY, in stages.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const MIGRATION_TARGET_KIND = "engineer_migration_runbook";

export interface MigrationInput {
  title: string;
  fromState: string;
  toState: string;
  constraints?: string;
  rollbackBoundaries?: string;
}

export interface MigrationStage {
  index: number;
  label: string;
  description: string;
  backwardsCompatWindow: string;
  gateCheck: string;
}

export interface MigrationRunbook {
  slug: string;
  title: string;
  executiveSummary: string;
  stages: ReadonlyArray<MigrationStage>;
  rollbackDecisionTree: ReadonlyArray<string>;
  riskFactors: ReadonlyArray<string>;
  prerequisites: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  stages: Array<{
    label: string;
    description: string;
    backwardsCompatWindow: string;
    gateCheck: string;
  }>;
  rollbackDecisionTree: string[];
  riskFactors: string[];
  prerequisites: string[];
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
    `You are the Migration Engineer on the Axiom platform.`,
    `Your job: given a "from state → to state" description, build a multi-stage migration runbook a workspace operator can execute safely with backwards-compat windows + per-stage gate checks.`,
    ``,
    `RULES:`,
    `  · Honest scope. If the migration requires brief downtime or a feature freeze, surface it in riskFactors — don't pretend it's seamless.`,
    `  · Executive summary: 3-4 sentences naming the headline transformation, the worst risk, the rough effort (S/M/L), and the minimum backwards-compat window.`,
    `  · stages: 3-8 ordered entries. Each stage has a label (≤ 60 chars), description (≤ 280 chars), backwardsCompatWindow (≤ 160 chars naming what old-state callers expect during this stage), and a gateCheck (≤ 200 chars naming the observable signal that proves the stage is safe to advance from).`,
    `  · rollbackDecisionTree: 2-5 entries each describing a rollback trigger + the safe state to roll back to.`,
    `  · riskFactors: 2-5 entries naming specific behaviors that could break.`,
    `  · prerequisites: 1-4 entries naming what must be in place before stage 1 begins (e.g., backups verified, feature flag wired, staging dry-run completed).`,
    `  · Never invent components that aren't in the input. If the operator described a DB migration, don't add API stages.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "stages": [ { "label": "...", "description": "...", "backwardsCompatWindow": "...", "gateCheck": "..." } ],`,
    `  "rollbackDecisionTree": [...],`,
    `  "riskFactors": [...],`,
    `  "prerequisites": [...]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: MigrationInput): string {
  const lines: string[] = [];
  lines.push(`Title: ${i.title}`);
  if (i.constraints) lines.push(`Constraints: ${i.constraints}`);
  if (i.rollbackBoundaries) lines.push(`Rollback boundaries: ${i.rollbackBoundaries}`);
  lines.push(``);
  lines.push(`From state:`);
  lines.push("```");
  lines.push(i.fromState);
  lines.push("```");
  lines.push(``);
  lines.push(`To state:`);
  lines.push("```");
  lines.push(i.toState);
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
    const stagesRaw = Array.isArray(j.stages) ? (j.stages as unknown[]) : [];
    const stages: ParsedAi["stages"] = [];
    for (let i = 0; i < stagesRaw.length && stages.length < 8; i += 1) {
      const item = stagesRaw[i];
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const label = typeof obj.label === "string" ? obj.label.trim().slice(0, 80) : "";
      const description = typeof obj.description === "string" ? obj.description.trim().slice(0, 400) : "";
      const backwardsCompatWindow = typeof obj.backwardsCompatWindow === "string" ? obj.backwardsCompatWindow.trim().slice(0, 240) : "";
      const gateCheck = typeof obj.gateCheck === "string" ? obj.gateCheck.trim().slice(0, 280) : "";
      if (label && description) {
        stages.push({ label, description, backwardsCompatWindow, gateCheck });
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
    return {
      executiveSummary: exec,
      stages,
      rollbackDecisionTree: strs(j.rollbackDecisionTree, 5, 400),
      riskFactors: strs(j.riskFactors, 5, 320),
      prerequisites: strs(j.prerequisites, 4, 280),
    };
  } catch {
    return null;
  }
}

export async function runMigrationEngineer(organizationId: string, raw: MigrationInput): Promise<MigrationRunbook> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const fromState = raw.fromState.trim().slice(0, MAX_BODY);
  const toState = raw.toState.trim().slice(0, MAX_BODY);
  if (!title || !fromState || !toState) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + from-state + to-state are required.",
      stages: [],
      rollbackDecisionTree: [],
      riskFactors: [],
      prerequisites: [],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `migration_${Date.now().toString(36)}`;
  const input: MigrationInput = {
    title,
    fromState,
    toState,
    constraints: raw.constraints?.trim().slice(0, 800),
    rollbackBoundaries: raw.rollbackBoundaries?.trim().slice(0, 800),
  };

  let outcome: MigrationRunbook["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:migration_engineer",
      organizationId,
      timeoutMs: 60_000,
      maxTokens: 3500,
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

  const stages: MigrationStage[] = (parsed?.stages ?? []).map((s, i) => ({
    index: i + 1,
    label: s.label,
    description: s.description,
    backwardsCompatWindow: s.backwardsCompatWindow,
    gateCheck: s.gateCheck,
  }));

  return {
    slug,
    title,
    executiveSummary: parsed?.executiveSummary ?? `Stub migration runbook for "${title}". Re-run when the AI provider is healthy.`,
    stages,
    rollbackDecisionTree: parsed?.rollbackDecisionTree ?? [],
    riskFactors: parsed?.riskFactors ?? [],
    prerequisites: parsed?.prerequisites ?? [],
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistMigrationRunbook(organizationId: string, r: MigrationRunbook): Promise<void> {
  if (!r.slug) return;
  const payload: string[] = [`title|${r.title}`];
  for (const p of r.prerequisites) payload.push(`prerequisite|${p}`);
  for (const s of r.stages) {
    payload.push(`stage|${s.index}|${s.label}|${s.description}`);
    if (s.backwardsCompatWindow) payload.push(`compat|${s.index}|${s.backwardsCompatWindow}`);
    if (s.gateCheck) payload.push(`gate|${s.index}|${s.gateCheck}`);
  }
  for (const t of r.rollbackDecisionTree) payload.push(`rollback|${t}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: MIGRATION_TARGET_KIND,
          targetId: r.slug,
        },
      },
      create: {
        organizationId,
        targetKind: MIGRATION_TARGET_KIND,
        targetId: r.slug,
        narrative: r.executiveSummary,
        riskFactorsJson: r.riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: r.outcome,
        errorMessage: r.errorMessage,
        modelHint: r.modelHint,
        engineVersion: "migration-engineer-v1",
      },
      update: {
        narrative: r.executiveSummary,
        riskFactorsJson: r.riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: r.outcome,
        errorMessage: r.errorMessage,
        modelHint: r.modelHint,
      },
    });
  } catch (err) {
    console.warn("[migrationEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
