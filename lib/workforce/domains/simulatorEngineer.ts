/**
 * simulator_engineer — real domain work · Phase 605.
 *
 * Operator-input archetype. Operator pastes a proposed action +
 * current state; engineer simulates the outcome in dry-run and emits
 * a typed verdict (safe | caution | unsafe), predicted outcomes,
 * detected side effects, and the pre-approval requirements that must
 * be verified before an approval packet is built.
 *
 * Pairs naturally with reasoner_engineer: reasoner forms a
 * hypothesis → simulator dry-runs the proposed remediation against
 * it → council_engineer casts a verdict on the simulation.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import { INJECTION_RESISTANCE_CLAUSE, buildUserInputSection } from "@/lib/workforce/domains/promptHardening";

export const SIMULATOR_TARGET_KIND = "engineer_simulator_verdict";

export type SimulationVerdict = "safe" | "caution" | "unsafe";

export interface SimulatorInput {
  title: string;
  proposedAction: string;
  currentState: string;
  knownConstraints?: string;
  blastRadius?: string;
}

export interface SimulatorReport {
  slug: string;
  title: string;
  executiveSummary: string;
  verdict: SimulationVerdict;
  predictedOutcomes: ReadonlyArray<string>;
  detectedSideEffects: ReadonlyArray<string>;
  preApprovalRequirements: ReadonlyArray<string>;
  rollbackCheckpoint: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  verdict: SimulationVerdict;
  predictedOutcomes: string[];
  detectedSideEffects: string[];
  preApprovalRequirements: string[];
  rollbackCheckpoint: string;
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

function buildSystemPrompt(): string {
  return [
    `You are the Simulator Engineer on the Axiom platform.`,
    `Your job: dry-run the operator's proposed action against the stated current state and emit a typed verdict before any approval packet is built.`,
    ``,
    INJECTION_RESISTANCE_CLAUSE,
    ``,
    `VERDICTS:`,
    `  · safe     — predicted outcomes match intent, side effects are bounded, no pre-approval requirements blocked`,
    `  · caution  — outcome plausible but at least one side effect or pre-approval requirement needs verification`,
    `  · unsafe   — predicted outcomes diverge from intent, side effects are unbounded, or invariants would be violated`,
    ``,
    `RULES:`,
    `  · Honest scope. If the proposed action is under-specified (missing target, scope, or trigger), set verdict=caution and surface the gap in preApprovalRequirements.`,
    `  · Executive summary: 2-3 sentences naming the headline outcome, the riskiest side effect, and the verdict.`,
    `  · predictedOutcomes: 2-6 entries naming what would change in the current state if the action ran now.`,
    `  · detectedSideEffects: 0-5 entries naming outcomes the operator may not have intended.`,
    `  · preApprovalRequirements: 1-5 entries naming what must be verified before granting approval (e.g., "backup verified", "feature flag scoped", "rate limit checked").`,
    `  · rollbackCheckpoint: 1 sentence ≤ 280 chars naming the state to roll back to if the action lands and misbehaves.`,
    `  · Never invent state the operator did not describe.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "verdict": "<safe|caution|unsafe>",`,
    `  "predictedOutcomes": [...],`,
    `  "detectedSideEffects": [...],`,
    `  "preApprovalRequirements": [...],`,
    `  "rollbackCheckpoint": "..."`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: SimulatorInput): string {
  return buildUserInputSection([
    { label: "title", content: i.title },
    { label: "known_constraints", content: i.knownConstraints ?? "" },
    { label: "blast_radius_hint", content: i.blastRadius ?? "" },
    { label: "proposed_action", content: i.proposedAction },
    { label: "current_state", content: i.currentState },
  ]);
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1500) : null;
    if (!exec) return null;
    const v = j.verdict;
    const verdict: SimulationVerdict =
      v === "safe" || v === "caution" || v === "unsafe" ? v : "caution";
    const rollbackCheckpoint = typeof j.rollbackCheckpoint === "string" ? j.rollbackCheckpoint.trim().slice(0, 400) : "";
    const strs = (val: unknown, max: number, charMax: number) =>
      Array.isArray(val)
        ? val
            .filter((x): x is string => typeof x === "string")
            .map((s) => s.trim().slice(0, charMax))
            .filter((s) => s.length > 0)
            .slice(0, max)
        : [];
    return {
      executiveSummary: exec,
      verdict,
      predictedOutcomes: strs(j.predictedOutcomes, 6, 320),
      detectedSideEffects: strs(j.detectedSideEffects, 5, 320),
      preApprovalRequirements: strs(j.preApprovalRequirements, 5, 280),
      rollbackCheckpoint,
    };
  } catch {
    return null;
  }
}

export async function runSimulatorEngineer(organizationId: string, raw: SimulatorInput): Promise<SimulatorReport> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const proposedAction = raw.proposedAction.trim().slice(0, MAX_BODY);
  const currentState = raw.currentState.trim().slice(0, MAX_BODY);
  if (!title || !proposedAction || !currentState) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + proposed action + current state are required.",
      verdict: "caution",
      predictedOutcomes: [],
      detectedSideEffects: [],
      preApprovalRequirements: [],
      rollbackCheckpoint: "",
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `sim_${Date.now().toString(36)}`;
  const input: SimulatorInput = {
    title,
    proposedAction,
    currentState,
    knownConstraints: raw.knownConstraints?.trim().slice(0, 1000),
    blastRadius: raw.blastRadius?.trim().slice(0, 600),
  };

  let outcome: SimulatorReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:simulator_engineer",
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
    executiveSummary: parsed?.executiveSummary ?? `Stub simulation for "${title}". Re-run when the AI provider is healthy.`,
    verdict: parsed?.verdict ?? "caution",
    predictedOutcomes: parsed?.predictedOutcomes ?? [],
    detectedSideEffects: parsed?.detectedSideEffects ?? [],
    preApprovalRequirements: parsed?.preApprovalRequirements ?? [],
    rollbackCheckpoint: parsed?.rollbackCheckpoint ?? "",
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistSimulatorReport(organizationId: string, r: SimulatorReport): Promise<void> {
  if (!r.slug) return;
  const payload: string[] = [`title|${r.title}`, `verdict|${r.verdict}`];
  if (r.rollbackCheckpoint) payload.push(`rollback_checkpoint|${r.rollbackCheckpoint}`);
  for (const o of r.predictedOutcomes) payload.push(`outcome|${o}`);
  for (const s of r.detectedSideEffects) payload.push(`side_effect|${s}`);
  for (const req of r.preApprovalRequirements) payload.push(`requirement|${req}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: SIMULATOR_TARGET_KIND,
          targetId: r.slug,
        },
      },
      create: {
        organizationId,
        targetKind: SIMULATOR_TARGET_KIND,
        targetId: r.slug,
        narrative: r.executiveSummary,
        riskFactorsJson: r.detectedSideEffects as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: r.outcome,
        errorMessage: r.errorMessage,
        modelHint: r.modelHint,
        engineVersion: "simulator-engineer-v1",
      },
      update: {
        narrative: r.executiveSummary,
        riskFactorsJson: r.detectedSideEffects as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: r.outcome,
        errorMessage: r.errorMessage,
        modelHint: r.modelHint,
      },
    });
  } catch (err) {
    console.warn("[simulatorEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
