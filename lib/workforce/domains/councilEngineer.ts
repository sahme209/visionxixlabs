/**
 * council_engineer — real domain work · Phase 600.
 *
 * Reads the most recent meta-reasoner resolution + the rationale
 * entries the meta-reasoner referenced, then casts a binding verdict
 * on each tension. Closes the loop opened by meta_reasoner: tension
 * identified → council verdict cast → operator has a recommended
 * direction.
 *
 * No-input archetype. Engineer-to-engineer composition: this
 * engineer's input is another engineer's output.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import { META_REASONER_TARGET_KIND } from "@/lib/workforce/domains/metaReasonerEngineer";

export const COUNCIL_TARGET_KIND = "engineer_council_verdicts";

export type CouncilVerdict =
  | "accept_first"
  | "accept_second"
  | "sequence"
  | "request_more_data"
  | "defer";

export interface CouncilDecision {
  observationId: string;
  stance: string;
  involvedEngineers: ReadonlyArray<string>;
  verdict: CouncilVerdict;
  /** AI-enriched rationale. Rules fallback when AI absent. */
  rationale: string;
  /** Concrete operator-actionable next step. */
  nextStep: string;
}

export interface CouncilReport {
  generatedAt: Date;
  metaSourceUpdatedAt: Date | null;
  decisions: ReadonlyArray<CouncilDecision>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface SourceObservation {
  observationId: string;
  stance: string;
  involvedEngineers: string[];
  observation: string;
  resolution: string;
}

interface ParsedAi {
  executiveSummary: string;
  byObservationId: Record<string, { verdict: CouncilVerdict; rationale: string; nextStep: string }>;
}

function parseMetaPayload(payload: unknown): SourceObservation[] {
  if (!Array.isArray(payload)) return [];
  const byId = new Map<string, SourceObservation>();
  for (const raw of payload as unknown[]) {
    if (typeof raw !== "string") continue;
    // Lines look like "observation|<id>|<stance>|<engA,engB>|<text>"
    //                "resolution|<id>|<text>"
    const parts = raw.split("|");
    if (parts.length < 3) continue;
    const head = parts[0];
    const id = parts[1];
    if (!id) continue;
    if (head === "observation" && parts.length >= 5) {
      const stance = parts[2] ?? "";
      const involvedRaw = parts[3] ?? "";
      const observation = parts.slice(4).join("|");
      const existing = byId.get(id) ?? {
        observationId: id, stance: "", involvedEngineers: [], observation: "", resolution: "",
      };
      existing.stance = stance;
      existing.involvedEngineers = involvedRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
      existing.observation = observation;
      byId.set(id, existing);
    } else if (head === "resolution") {
      const resolution = parts.slice(2).join("|");
      const existing = byId.get(id) ?? {
        observationId: id, stance: "", involvedEngineers: [], observation: "", resolution: "",
      };
      existing.resolution = resolution;
      byId.set(id, existing);
    }
  }
  return Array.from(byId.values()).filter((o) => o.observation.length > 0);
}

function fallbackVerdict(o: SourceObservation): { verdict: CouncilVerdict; rationale: string; nextStep: string } {
  if (o.stance === "convergence") {
    return {
      verdict: "accept_first",
      rationale: `Meta-reasoner flagged this as convergence — engineers agree, no real disagreement to resolve.`,
      nextStep: `Adopt the shared recommendation from ${o.involvedEngineers.join(" + ") || "the engineers"} and move on.`,
    };
  }
  if (o.involvedEngineers.length >= 3) {
    return {
      verdict: "request_more_data",
      rationale: `${o.involvedEngineers.length} engineers involved — disagreement is wide, council can't rule cleanly without sharper signal.`,
      nextStep: `Gather one more cycle of evidence before voting; re-run meta_reasoner after the next sweep.`,
    };
  }
  if (o.involvedEngineers.length === 2) {
    return {
      verdict: "sequence",
      rationale: `Two engineers disagree — likely both are partially right, sequence the recommendations.`,
      nextStep: `Apply ${o.involvedEngineers[0]}'s recommendation first, observe outcome, then layer ${o.involvedEngineers[1]}'s if needed.`,
    };
  }
  return {
    verdict: "defer",
    rationale: `Insufficient engineer-pairing data to cast a binding verdict.`,
    nextStep: `Defer the decision to the operator; council will re-evaluate next sweep.`,
  };
}

function buildSystemPrompt(): string {
  return [
    `You are the Council Engineer on the Axiom platform.`,
    `Your job: read the meta-reasoner's cross-engineer observations and cast a binding verdict on each.`,
    ``,
    `VERDICTS:`,
    `  · accept_first        — go with the first engineer's recommendation`,
    `  · accept_second       — go with the second engineer's recommendation`,
    `  · sequence            — apply both, ordered (first then second)`,
    `  · request_more_data   — disagreement too wide to rule; defer pending more signal`,
    `  · defer               — escalate to operator judgment`,
    ``,
    `RULES:`,
    `  · Only emit observationId keys present in the input.`,
    `  · rationale: 1-2 sentences ≤ 320 chars naming WHY this verdict, citing the observation's concrete signals.`,
    `  · nextStep: 1 sentence ≤ 280 chars naming the concrete operator action.`,
    `  · For convergence observations, the verdict should be accept_first (engineers agreed; pick the shared recommendation).`,
    `  · Executive summary: 2-3 sentences naming the dominant verdict and the riskiest unresolved tension.`,
    `  · Plain prose, no markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "byObservationId": { "<id>": { "verdict": "<verdict>", "rationale": "...", "nextStep": "..." } }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(observations: ReadonlyArray<SourceObservation>): string {
  if (observations.length === 0) {
    return `Meta-reasoner produced no observations to vote on. Affirm a quiescent council state and return empty byObservationId.`;
  }
  const lines: string[] = [];
  lines.push(`Meta-reasoner observations (each is a candidate vote):`);
  for (const o of observations) {
    lines.push(``);
    lines.push(`  [${o.observationId}] stance=${o.stance} involves=${o.involvedEngineers.join(", ") || "(unspecified)"}`);
    lines.push(`    observation: ${o.observation}`);
    if (o.resolution) lines.push(`    meta-reasoner proposed resolution: ${o.resolution}`);
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
    const raw = j.byObservationId;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, byObservationId: {} };
    const map: ParsedAi["byObservationId"] = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const obj = v as Record<string, unknown>;
      const verdict = obj.verdict;
      const rationale = typeof obj.rationale === "string" ? obj.rationale.trim().slice(0, 480) : "";
      const nextStep = typeof obj.nextStep === "string" ? obj.nextStep.trim().slice(0, 400) : "";
      if (
        rationale && nextStep &&
        (verdict === "accept_first" || verdict === "accept_second" || verdict === "sequence" ||
         verdict === "request_more_data" || verdict === "defer")
      ) {
        map[k] = { verdict: verdict as CouncilVerdict, rationale, nextStep };
      }
    }
    return { executiveSummary: exec, byObservationId: map };
  } catch {
    return null;
  }
}

export async function runCouncilEngineer(organizationId: string): Promise<CouncilReport> {
  let metaRow: { nextActionsJson: unknown; updatedAt: Date } | null = null;
  try {
    metaRow = await prisma.aiRationaleEnrichment.findUnique({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: META_REASONER_TARGET_KIND,
          targetId: "meta_reasoner_engineer",
        },
      },
      select: { nextActionsJson: true, updatedAt: true },
    });
  } catch {
    metaRow = null;
  }

  const sourceObservations = metaRow ? parseMetaPayload(metaRow.nextActionsJson) : [];

  let executiveSummary = sourceObservations.length === 0
    ? `Council found no meta-reasoner observations to vote on. Run meta_reasoner_engineer first.`
    : `Council reviewed ${sourceObservations.length} meta-reasoner observation${sourceObservations.length === 1 ? "" : "s"} — verdicts below.`;
  let byObservationId: ParsedAi["byObservationId"] = {};
  let outcome: CouncilReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  if (sourceObservations.length > 0) {
    try {
      const fetcher = makeInstrumentedFetcher({
        engineName: "engineer_domain:council_engineer",
        organizationId,
        timeoutMs: 45_000,
        maxTokens: 2500,
      });
      const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(sourceObservations)}`;
      const result = await fetcher(prompt);
      const parsed = parseAi(result.text);
      if (parsed) {
        executiveSummary = parsed.executiveSummary;
        byObservationId = parsed.byObservationId;
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

  const decisions: CouncilDecision[] = sourceObservations.map((o) => {
    const ai = byObservationId[o.observationId];
    const fb = fallbackVerdict(o);
    return {
      observationId: o.observationId,
      stance: o.stance,
      involvedEngineers: o.involvedEngineers,
      verdict: ai?.verdict ?? fb.verdict,
      rationale: ai?.rationale ?? fb.rationale,
      nextStep: ai?.nextStep ?? fb.nextStep,
    };
  });

  return {
    generatedAt: new Date(),
    metaSourceUpdatedAt: metaRow?.updatedAt ?? null,
    decisions,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistCouncilReport(organizationId: string, report: CouncilReport): Promise<void> {
  const riskFactors = report.decisions.map((d) => `${d.verdict} · ${d.involvedEngineers.join(" ↔ ") || "(unspecified)"}`);
  const payload: string[] = [];
  for (const d of report.decisions) {
    payload.push(`verdict|${d.observationId}|${d.verdict}|${d.involvedEngineers.join(",")}|${d.rationale}`);
    payload.push(`next_step|${d.observationId}|${d.nextStep}`);
  }
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: COUNCIL_TARGET_KIND,
          targetId: "council_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: COUNCIL_TARGET_KIND,
        targetId: "council_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "council-engineer-v1",
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
    console.warn("[councilEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
