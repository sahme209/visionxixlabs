/**
 * alert_noise_engineer — real domain work · Phase 594.
 *
 * Reads recent SecureAuditRecord rows with alert-shaped action codes
 * and classifies them by noise category (genuine, recurring, stale,
 * absorbable). Emits a typed deduplication plan + a noise-floor
 * recommendation.
 *
 * Routes to OpenAI when available: this engineer's job is bulk
 * classification + short labels — exactly the workload where
 * gpt-4o-mini's cost/quality curve beats Claude.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const ALERT_NOISE_TARGET_KIND = "engineer_alert_noise_classification";

export type NoiseCategory = "genuine" | "recurring" | "stale" | "absorbable";

export interface AlertClassification {
  alertActionLabel: string;
  count: number;
  category: NoiseCategory;
  /** AI-enriched reason (≤ 120 chars). Rules fallback when AI absent. */
  reason: string;
}

export interface AlertNoiseReport {
  generatedAt: Date;
  windowDays: number;
  totalAlerts: number;
  classifications: ReadonlyArray<AlertClassification>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface Candidate {
  alertActionLabel: string;
  count: number;
  fallbackCategory: NoiseCategory;
  fallbackReason: string;
}

interface ParsedAi {
  executiveSummary: string;
  byAction: Record<string, { category: NoiseCategory; reason: string }>;
}

const ALERT_ACTIONS = [
  "billing.alert_fired",
  "engineer.action_blocked",
  "engineer.action_requires_approval",
  "billing.entitlement_blocked",
  "billing.credit_pool_exhausted",
];

function buildSystemPrompt(): string {
  return [
    `You are the Alert Noise Engineer on the Axiom platform.`,
    `Your job: classify each repeated audit-action into one of four noise categories so on-call doesn't drown.`,
    ``,
    `CATEGORIES:`,
    `  · genuine    — worth paging on, single instance matters`,
    `  · recurring  — same root cause, fire once + suppress for window`,
    `  · stale      — old, should clear when the upstream fix lands`,
    `  · absorbable — automation can dedupe / auto-acknowledge`,
    ``,
    `RULES:`,
    `  · Only emit byAction keys present in the input.`,
    `  · One sentence reason per action, ≤ 120 characters.`,
    `  · Executive summary: 2-3 sentences naming the dominant category and the most material noise source.`,
    `  · Plain prose, no markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "byAction": { "<actionLabel>": { "category": "<noise category>", "reason": "<sentence>" } }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(candidates: ReadonlyArray<Candidate>): string {
  if (candidates.length === 0) {
    return `No qualifying alerts in the window. Affirm calm state and return empty byAction.`;
  }
  const lines: string[] = [];
  lines.push(`Aggregated alerts (last 7 days, candidates ranked by count):`);
  for (const c of candidates) {
    lines.push(``);
    lines.push(`  [${c.alertActionLabel}] count=${c.count}`);
    lines.push(`    rules category: ${c.fallbackCategory}`);
    lines.push(`    rules reason: ${c.fallbackReason}`);
  }
  return lines.join("\n");
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{"); const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1200) : null;
    if (!exec) return null;
    const raw = j.byAction;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, byAction: {} };
    const map: Record<string, { category: NoiseCategory; reason: string }> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const obj = v as Record<string, unknown>;
      const cat = obj.category;
      const reason = typeof obj.reason === "string" ? obj.reason.trim().slice(0, 200) : "";
      if (
        reason &&
        (cat === "genuine" || cat === "recurring" || cat === "stale" || cat === "absorbable")
      ) {
        map[k] = { category: cat as NoiseCategory, reason };
      }
    }
    return { executiveSummary: exec, byAction: map };
  } catch { return null; }
}

function fallbackCategorize(count: number): { category: NoiseCategory; reason: string } {
  if (count >= 50) return { category: "absorbable", reason: `Firing ${count} times — automation should dedupe before paging.` };
  if (count >= 15) return { category: "recurring", reason: `Repeated ${count} times — likely single root cause, suppress for the window.` };
  if (count >= 5)  return { category: "genuine",   reason: `Fired ${count} times — investigate each occurrence individually.` };
  return { category: "stale", reason: `Only ${count} occurrence${count === 1 ? "" : "s"} — likely cleared by the upstream fix.` };
}

export async function runAlertNoiseEngineer(organizationId: string): Promise<AlertNoiseReport> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let rows: Array<{ action: string; _count: { _all: number } }> = [];
  try {
    const grouped = await prisma.secureAuditRecord.groupBy({
      by: ["action"],
      where: {
        organizationId,
        occurredAt: { gte: since7d },
        action: { in: ALERT_ACTIONS },
      },
      _count: { _all: true },
    });
    rows = grouped as unknown as typeof rows;
  } catch { rows = []; }

  const totalAlerts = rows.reduce((acc, r) => acc + r._count._all, 0);
  const candidates: Candidate[] = rows
    .sort((a, b) => b._count._all - a._count._all)
    .map((r) => {
      const fb = fallbackCategorize(r._count._all);
      return {
        alertActionLabel: r.action,
        count: r._count._all,
        fallbackCategory: fb.category,
        fallbackReason: fb.reason,
      };
    });

  let executiveSummary = candidates.length === 0
    ? "No qualifying alert-shaped audit events in the last 7 days. Noise floor is clear."
    : `${totalAlerts} alert-shaped audit events across ${candidates.length} action${candidates.length === 1 ? "" : "s"} in the last 7 days — review the noise plan below.`;
  let byAction: Record<string, { category: NoiseCategory; reason: string }> = {};
  let outcome: AlertNoiseReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:alert_noise_engineer",
      organizationId,
      timeoutMs: 30_000,
      // Phase 593: bulk-classification workload — route to OpenAI's
      // cheaper model when available.
      preferredProvider: process.env.OPENAI_API_KEY ? "openai" : "anthropic",
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(candidates)}`;
    const result = await fetcher(prompt);
    const parsed = parseAi(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      byAction = parsed.byAction;
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

  const classifications: AlertClassification[] = candidates.map((c) => {
    const ai = byAction[c.alertActionLabel];
    return {
      alertActionLabel: c.alertActionLabel,
      count: c.count,
      category: ai?.category ?? c.fallbackCategory,
      reason: ai?.reason ?? c.fallbackReason,
    };
  });

  return {
    generatedAt: new Date(),
    windowDays: 7,
    totalAlerts,
    classifications,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistAlertNoiseReport(organizationId: string, report: AlertNoiseReport): Promise<void> {
  const riskFactors = report.classifications.map((c) => `${c.category} · ${c.count}× · ${c.alertActionLabel}`);
  const payload = report.classifications.map((c) => `${c.alertActionLabel}|${c.category}|${c.count}|${c.reason}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: ALERT_NOISE_TARGET_KIND,
          targetId: "alert_noise_engineer",
        },
      },
      create: {
        organizationId, targetKind: ALERT_NOISE_TARGET_KIND, targetId: "alert_noise_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome, errorMessage: report.errorMessage, modelHint: report.modelHint,
        engineVersion: "alert-noise-engineer-v1",
      },
      update: {
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome, errorMessage: report.errorMessage, modelHint: report.modelHint,
      },
    });
  } catch (err) {
    console.warn("[alertNoiseEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
