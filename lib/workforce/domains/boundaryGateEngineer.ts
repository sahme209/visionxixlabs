/**
 * boundary_gate_engineer — real domain work · Phase 609.
 *
 * Operator-input archetype. Operator pastes a proposed action;
 * engineer classifies the blast radius into a closed-union severity
 * tier and names the boundary that holds (or doesn't).
 *
 * Distinct from approver_engineer (which assembles the packet a
 * decision-maker signs): boundary_gate reasons about WHERE the
 * action lands if it misbehaves. Same input shape, different lens.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const BOUNDARY_GATE_TARGET_KIND = "engineer_boundary_classification";

export type BlastTier =
  | "contained"
  | "limited"
  | "broad"
  | "platform"
  | "catastrophic";

export interface BoundaryInput {
  title: string;
  actionDescription: string;
  systemTopology?: string;
  existingContainment?: string;
}

export interface BoundaryClassification {
  slug: string;
  title: string;
  executiveSummary: string;
  tier: BlastTier;
  justification: string;
  containmentBoundary: string;
  affectedActors: ReadonlyArray<string>;
  detectionLeadTime: string;
  containmentActions: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  tier: BlastTier;
  justification: string;
  containmentBoundary: string;
  affectedActors: string[];
  detectionLeadTime: string;
  containmentActions: string[];
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
    `You are the Boundary Gate Engineer on the Axiom platform.`,
    `Your job: classify the blast radius of the proposed action into a closed-union severity tier and name the boundary that holds it (or doesn't).`,
    ``,
    `BLAST TIERS:`,
    `  · contained     — single workspace, recoverable in minutes, no external visibility`,
    `  · limited       — single tenant, recoverable in an hour, internal-only visibility`,
    `  · broad         — multiple tenants, recoverable in a day, may surface to customers`,
    `  · platform      — cross-cutting infrastructure, recoverable but felt platform-wide`,
    `  · catastrophic  — irrecoverable in normal time horizons, external trust at stake`,
    ``,
    `RULES:`,
    `  · Pick the SMALLEST tier the action honestly fits. Don't catastrophize.`,
    `  · If the boundary doesn't actually hold (e.g. proposed action touches shared infra), pick the larger tier and surface that in justification.`,
    `  · Executive summary: 2-3 sentences naming the tier, the boundary, and the leading containment action.`,
    `  · justification: 1-3 sentences ≤ 500 chars naming why this tier and not a smaller one.`,
    `  · containmentBoundary: 1 sentence ≤ 320 chars naming WHERE the blast stops (e.g. "workspace ${"{id}"} — no shared cloud-account write paths involved").`,
    `  · affectedActors: 1-5 entries naming who feels the blast (operators, customers, downstream services, external partners).`,
    `  · detectionLeadTime: 1 short phrase naming how quickly the workspace would notice ("seconds", "1-5 minutes", "hours", "days").`,
    `  · containmentActions: 2-5 entries naming what to do IF the boundary breaches.`,
    `  · Never invent topology the operator didn't describe.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "tier": "<tier>",`,
    `  "justification": "...",`,
    `  "containmentBoundary": "...",`,
    `  "affectedActors": [...],`,
    `  "detectionLeadTime": "...",`,
    `  "containmentActions": [...]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: BoundaryInput): string {
  const lines: string[] = [];
  lines.push(`Title: ${i.title}`);
  if (i.systemTopology) lines.push(`System topology hint: ${i.systemTopology}`);
  if (i.existingContainment) lines.push(`Existing containment: ${i.existingContainment}`);
  lines.push(``);
  lines.push(`Action description:`);
  lines.push("```");
  lines.push(i.actionDescription);
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
    const t = j.tier;
    const tier: BlastTier =
      t === "contained" || t === "limited" || t === "broad" ||
      t === "platform" || t === "catastrophic"
        ? t
        : "limited";
    const justification = typeof j.justification === "string" ? j.justification.trim().slice(0, 600) : "";
    const containmentBoundary = typeof j.containmentBoundary === "string" ? j.containmentBoundary.trim().slice(0, 400) : "";
    const detectionLeadTime = typeof j.detectionLeadTime === "string" ? j.detectionLeadTime.trim().slice(0, 80) : "";
    if (!justification || !containmentBoundary) return null;
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
      tier,
      justification,
      containmentBoundary,
      affectedActors: strs(j.affectedActors, 5, 200),
      detectionLeadTime,
      containmentActions: strs(j.containmentActions, 5, 320),
    };
  } catch {
    return null;
  }
}

export async function runBoundaryGateEngineer(organizationId: string, raw: BoundaryInput): Promise<BoundaryClassification> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const actionDescription = raw.actionDescription.trim().slice(0, MAX_BODY);
  if (!title || !actionDescription) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + action description are required.",
      tier: "limited",
      justification: "",
      containmentBoundary: "",
      affectedActors: [],
      detectionLeadTime: "",
      containmentActions: [],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `boundary_${Date.now().toString(36)}`;
  const input: BoundaryInput = {
    title,
    actionDescription,
    systemTopology: raw.systemTopology?.trim().slice(0, 1200),
    existingContainment: raw.existingContainment?.trim().slice(0, 1000),
  };

  let outcome: BoundaryClassification["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:boundary_gate_engineer",
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
    executiveSummary: parsed?.executiveSummary ?? `Stub boundary classification for "${title}". Re-run when the AI provider is healthy.`,
    tier: parsed?.tier ?? "limited",
    justification: parsed?.justification ?? "",
    containmentBoundary: parsed?.containmentBoundary ?? "",
    affectedActors: parsed?.affectedActors ?? [],
    detectionLeadTime: parsed?.detectionLeadTime ?? "",
    containmentActions: parsed?.containmentActions ?? [],
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistBoundaryClassification(organizationId: string, b: BoundaryClassification): Promise<void> {
  if (!b.slug) return;
  const payload: string[] = [
    `title|${b.title}`,
    `tier|${b.tier}`,
    `justification|${b.justification}`,
    `boundary|${b.containmentBoundary}`,
    `lead_time|${b.detectionLeadTime}`,
  ];
  for (const a of b.affectedActors) payload.push(`actor|${a}`);
  for (const c of b.containmentActions) payload.push(`containment|${c}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: BOUNDARY_GATE_TARGET_KIND,
          targetId: b.slug,
        },
      },
      create: {
        organizationId,
        targetKind: BOUNDARY_GATE_TARGET_KIND,
        targetId: b.slug,
        narrative: b.executiveSummary,
        riskFactorsJson: b.affectedActors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: b.outcome,
        errorMessage: b.errorMessage,
        modelHint: b.modelHint,
        engineVersion: "boundary-gate-engineer-v1",
      },
      update: {
        narrative: b.executiveSummary,
        riskFactorsJson: b.affectedActors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: b.outcome,
        errorMessage: b.errorMessage,
        modelHint: b.modelHint,
      },
    });
  } catch (err) {
    console.warn("[boundaryGateEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
