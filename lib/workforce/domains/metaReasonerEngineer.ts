/**
 * meta_reasoner_engineer — real domain work · Phase 599.
 *
 * Reads the latest rationale entry from each engineer-shaped
 * targetKind, then asks the AI to surface tension or convergence
 * points across engineers and propose a resolution. Closes the
 * "WHY did agents disagree" gap that single-engineer reports leave
 * open.
 *
 * No-input archetype.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const META_REASONER_TARGET_KIND = "engineer_meta_reasoner_resolution";

export type ObservationStance = "tension" | "convergence";

export interface EngineerSnapshot {
  targetKind: string;
  engineerLabel: string;
  outcome: string;
  modelHint: string | null;
  narrative: string;
  /** A short summary of riskFactorsJson (top entries only). */
  riskHighlights: ReadonlyArray<string>;
  updatedAt: Date;
}

export interface MetaObservation {
  observationId: string;
  stance: ObservationStance;
  involvedEngineers: ReadonlyArray<string>;
  observation: string;
  resolution: string;
}

export interface MetaReasonerReport {
  generatedAt: Date;
  windowDays: number;
  snapshotCount: number;
  snapshots: ReadonlyArray<EngineerSnapshot>;
  observations: ReadonlyArray<MetaObservation>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  observations: Array<{
    observationId: string;
    stance: ObservationStance;
    involvedEngineers: string[];
    observation: string;
    resolution: string;
  }>;
}

const MAX_SNAPSHOTS = 14;
const RISK_HIGHLIGHTS = 4;

function deriveEngineerLabel(targetKind: string): string {
  // engineer_* → human-readable label.
  if (!targetKind.startsWith("engineer_")) return targetKind;
  return targetKind
    .slice("engineer_".length)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSystemPrompt(): string {
  return [
    `You are the Meta-Reasoner Engineer on the Axiom platform.`,
    `Your job: read the latest rationale from each engineer in the workforce and surface the cross-engineer tension or convergence points that single-engineer reports miss.`,
    ``,
    `STANCE per observation:`,
    `  · tension      — engineers disagree, contradict, or point at incompatible next steps`,
    `  · convergence  — engineers independently arrive at the same recommendation, signaling high confidence`,
    ``,
    `RULES:`,
    `  · Only reference engineerLabel values present in the input.`,
    `  · Each observation must involve 2 or more engineers.`,
    `  · observation: 1-2 sentences ≤ 400 chars naming the concrete tension or convergence with the engineer narratives that produced it.`,
    `  · resolution: 1-2 sentences ≤ 400 chars proposing how the operator should reconcile — pick one engineer's recommendation, sequence them, request more data, etc.`,
    `  · Surface 2-6 observations. Quality over quantity.`,
    `  · Executive summary: 2-3 sentences naming the dominant stance and the riskiest unresolved tension.`,
    `  · Never invent engineer findings — only reason about narratives the input names.`,
    `  · Plain prose. No markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "observations": [`,
    `    { "observationId": "obs_1", "stance": "tension|convergence", "involvedEngineers": ["...", "..."], "observation": "...", "resolution": "..." }`,
    `  ]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(snapshots: ReadonlyArray<EngineerSnapshot>): string {
  if (snapshots.length === 0) {
    return `Workforce produced no recent engineer rationale entries. Affirm a quiescent state and return an empty observations array.`;
  }
  const lines: string[] = [];
  lines.push(`Latest rationale snapshots across the workforce:`);
  for (const s of snapshots) {
    lines.push(``);
    lines.push(`  ENGINEER: ${s.engineerLabel}`);
    lines.push(`    targetKind: ${s.targetKind}`);
    lines.push(`    outcome: ${s.outcome}`);
    if (s.modelHint) lines.push(`    model: ${s.modelHint}`);
    lines.push(`    updatedAt: ${s.updatedAt.toISOString()}`);
    lines.push(`    narrative: ${s.narrative.slice(0, 700)}`);
    if (s.riskHighlights.length > 0) {
      lines.push(`    top risk highlights:`);
      for (const r of s.riskHighlights) lines.push(`      · ${r}`);
    }
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
    const raw = j.observations;
    if (!Array.isArray(raw)) return { executiveSummary: exec, observations: [] };
    const observations: ParsedAi["observations"] = [];
    for (let i = 0; i < raw.length && observations.length < 6; i += 1) {
      const item = raw[i];
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const stance = obj.stance;
      const involved = Array.isArray(obj.involvedEngineers)
        ? (obj.involvedEngineers as unknown[]).filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 6)
        : [];
      const observation = typeof obj.observation === "string" ? obj.observation.trim().slice(0, 600) : "";
      const resolution = typeof obj.resolution === "string" ? obj.resolution.trim().slice(0, 600) : "";
      const observationId = typeof obj.observationId === "string" && obj.observationId.trim().length > 0
        ? obj.observationId.trim().slice(0, 60)
        : `obs_${i + 1}`;
      if (
        observation && resolution && involved.length >= 2 &&
        (stance === "tension" || stance === "convergence")
      ) {
        observations.push({
          observationId,
          stance: stance as ObservationStance,
          involvedEngineers: involved,
          observation,
          resolution,
        });
      }
    }
    return { executiveSummary: exec, observations };
  } catch {
    return null;
  }
}

export async function runMetaReasonerEngineer(organizationId: string): Promise<MetaReasonerReport> {
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  let rows: Array<{
    targetKind: string;
    targetId: string;
    narrative: string;
    riskFactorsJson: unknown;
    outcome: string;
    modelHint: string | null;
    updatedAt: Date;
  }> = [];
  try {
    rows = await prisma.aiRationaleEnrichment.findMany({
      where: {
        organizationId,
        updatedAt: { gte: since14d },
        targetKind: { startsWith: "engineer_", not: META_REASONER_TARGET_KIND },
      },
      select: {
        targetKind: true,
        targetId: true,
        narrative: true,
        riskFactorsJson: true,
        outcome: true,
        modelHint: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
  } catch {
    rows = [];
  }

  // Keep one snapshot per targetKind — the most recent. Resist
  // surfacing the same engineer's voice twice.
  const byKind = new Map<string, typeof rows[number]>();
  for (const row of rows) {
    if (!byKind.has(row.targetKind)) byKind.set(row.targetKind, row);
  }

  const snapshots: EngineerSnapshot[] = Array.from(byKind.values())
    .slice(0, MAX_SNAPSHOTS)
    .map((row) => {
      const risks: string[] = Array.isArray(row.riskFactorsJson)
        ? (row.riskFactorsJson as unknown[]).filter((x): x is string => typeof x === "string").slice(0, RISK_HIGHLIGHTS)
        : [];
      return {
        targetKind: row.targetKind,
        engineerLabel: deriveEngineerLabel(row.targetKind),
        outcome: row.outcome,
        modelHint: row.modelHint,
        narrative: row.narrative,
        riskHighlights: risks,
        updatedAt: row.updatedAt,
      };
    });

  let executiveSummary = snapshots.length < 2
    ? `Meta-reasoner needs at least 2 engineer rationales to compare; found ${snapshots.length} in the last 14 days. Re-run after additional engineers emit.`
    : `Meta-reasoner reviewed ${snapshots.length} engineer rationales from the last 14 days — see cross-engineer observations below.`;
  let observations: MetaObservation[] = [];
  let outcome: MetaReasonerReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  if (snapshots.length >= 2) {
    try {
      const fetcher = makeInstrumentedFetcher({
        engineName: "engineer_domain:meta_reasoner_engineer",
        organizationId,
        timeoutMs: 60_000,
        maxTokens: 3000,
      });
      const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(snapshots)}`;
      const result = await fetcher(prompt);
      const parsed = parseAi(result.text);
      if (parsed) {
        executiveSummary = parsed.executiveSummary;
        observations = parsed.observations.map((o) => ({
          observationId: o.observationId,
          stance: o.stance,
          involvedEngineers: o.involvedEngineers,
          observation: o.observation,
          resolution: o.resolution,
        }));
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
  }

  return {
    generatedAt: new Date(),
    windowDays: 14,
    snapshotCount: snapshots.length,
    snapshots,
    observations,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistMetaReasonerReport(organizationId: string, report: MetaReasonerReport): Promise<void> {
  const riskFactors = report.observations.map((o) => `${o.stance} · ${o.involvedEngineers.join(" ↔ ")}`);
  const payload: string[] = [];
  for (const o of report.observations) {
    payload.push(`observation|${o.observationId}|${o.stance}|${o.involvedEngineers.join(",")}|${o.observation}`);
    payload.push(`resolution|${o.observationId}|${o.resolution}`);
  }
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: META_REASONER_TARGET_KIND,
          targetId: "meta_reasoner_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: META_REASONER_TARGET_KIND,
        targetId: "meta_reasoner_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "meta-reasoner-engineer-v1",
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
    console.warn("[metaReasonerEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
