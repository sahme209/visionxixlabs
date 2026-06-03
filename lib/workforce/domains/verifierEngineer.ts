/**
 * verifier_engineer — real domain work · Phase 595.
 *
 * Reads recent AiCallLog rows with non-OK outcomes and classifies
 * each (engineName × outcome × errorMessage) failure group into one
 * of four verification verdicts. Operators get a single page that
 * answers "are my engineers actually working?" without scrolling the
 * raw log.
 *
 * Routes to OpenAI when available: this is pure bulk classification —
 * exactly where gpt-4o-mini beats Claude on cost/quality.
 *
 * No-input archetype.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const VERIFIER_TARGET_KIND = "engineer_verifier_verdicts";

export type VerifierVerdict =
  | "transient"
  | "systemic"
  | "provider_degradation"
  | "misconfig";

export interface VerifierFinding {
  groupId: string;
  engineName: string;
  outcome: string;
  errorPattern: string;
  count: number;
  latestAt: Date;
  verdict: VerifierVerdict;
  /** AI-enriched verdict reason (≤ 200 chars). Rules fallback when AI absent. */
  reason: string;
}

export interface VerifierReport {
  generatedAt: Date;
  windowHours: number;
  totalCalls: number;
  failureCalls: number;
  findings: ReadonlyArray<VerifierFinding>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface Candidate {
  groupId: string;
  engineName: string;
  outcome: string;
  errorPattern: string;
  count: number;
  latestAt: Date;
  fallbackVerdict: VerifierVerdict;
  fallbackReason: string;
}

interface ParsedAi {
  executiveSummary: string;
  byGroup: Record<string, { verdict: VerifierVerdict; reason: string }>;
}

const MAX_GROUPS = 12;
const ERROR_PATTERN_MAX = 80;

function normalizeError(raw: string | null): string {
  if (!raw) return "no_message";
  // Drop volatile substrings (ids, hex, timestamps) so the same root
  // cause groups together cleanly.
  const stripped = raw
    .replace(/[a-f0-9]{8,}/gi, "<id>")
    .replace(/\d{4,}/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, ERROR_PATTERN_MAX);
}

function fallbackVerdict(c: { outcome: string; errorPattern: string; count: number }): { verdict: VerifierVerdict; reason: string } {
  const err = c.errorPattern.toLowerCase();
  if (c.outcome === "short_circuit" || err.includes("circuit_open")) {
    return { verdict: "provider_degradation", reason: `Circuit-breaker tripped ${c.count}× — upstream provider was unhealthy in the window.` };
  }
  if (c.outcome === "timeout" || err.includes("timeout") || err.includes("ai_timeout")) {
    return { verdict: "provider_degradation", reason: `${c.count} timeouts — provider latency exceeded the engineer's ceiling.` };
  }
  if (err.includes("api_key") || err.includes("unauthor") || err.includes("invalid_request") || err.includes("403") || err.includes("401")) {
    return { verdict: "misconfig", reason: `${c.count} auth/permission failures — provider credentials or scoping likely off.` };
  }
  if (c.count >= 10) {
    return { verdict: "systemic", reason: `${c.count} failures with the same signature — root cause is recurring, not noise.` };
  }
  return { verdict: "transient", reason: `Only ${c.count} occurrence${c.count === 1 ? "" : "s"} — likely a one-off blip safe to ignore.` };
}

function buildSystemPrompt(): string {
  return [
    `You are the Verifier Engineer on the Axiom platform.`,
    `Your job: confirm each engineer's AI calls actually achieve their expected outcome, and classify any failing groups so operators know what to chase.`,
    ``,
    `VERDICTS:`,
    `  · transient            — small count, isolated, safe to ignore`,
    `  · systemic             — repeated failures with the same signature, fix the cause`,
    `  · provider_degradation — upstream AI provider sick (timeout, 5xx, circuit-open)`,
    `  · misconfig            — credentials / scoping / quota issue inside the workspace`,
    ``,
    `RULES:`,
    `  · Only emit groupId keys present in the input.`,
    `  · One sentence reason per group, ≤ 200 characters, naming the concrete signal.`,
    `  · Executive summary: 2-3 sentences naming the dominant verdict and the engineer most affected.`,
    `  · Plain prose, no markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "byGroup": { "<groupId>": { "verdict": "<verdict>", "reason": "<sentence>" } }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(
  totalCalls: number,
  failureCalls: number,
  candidates: ReadonlyArray<Candidate>,
): string {
  if (candidates.length === 0) {
    return [
      `Workspace had ${totalCalls} AI calls in the last 24 hours, ${failureCalls} of them non-OK.`,
      `No failure groups exceed the surfacing threshold. Affirm a healthy verification state and return empty byGroup.`,
    ].join("\n");
  }
  const lines: string[] = [];
  lines.push(`Workspace AI call health (last 24 hours):`);
  lines.push(`  total calls: ${totalCalls}`);
  lines.push(`  failure calls: ${failureCalls}`);
  lines.push(``);
  lines.push(`Failure groups (ranked by count):`);
  for (const c of candidates) {
    lines.push(``);
    lines.push(`  [${c.groupId}] count=${c.count} latestAt=${c.latestAt.toISOString()}`);
    lines.push(`    engine: ${c.engineName}`);
    lines.push(`    outcome: ${c.outcome}`);
    lines.push(`    error pattern: ${c.errorPattern}`);
    lines.push(`    rules verdict: ${c.fallbackVerdict}`);
    lines.push(`    rules reason: ${c.fallbackReason}`);
  }
  return lines.join("\n");
}

function parseAi(text: string): ParsedAi | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const j = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof j.executiveSummary === "string" ? j.executiveSummary.trim().slice(0, 1200) : null;
    if (!exec) return null;
    const raw = j.byGroup;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, byGroup: {} };
    const map: Record<string, { verdict: VerifierVerdict; reason: string }> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const obj = v as Record<string, unknown>;
      const verdict = obj.verdict;
      const reason = typeof obj.reason === "string" ? obj.reason.trim().slice(0, 320) : "";
      if (
        reason &&
        (verdict === "transient" || verdict === "systemic" ||
         verdict === "provider_degradation" || verdict === "misconfig")
      ) {
        map[k] = { verdict: verdict as VerifierVerdict, reason };
      }
    }
    return { executiveSummary: exec, byGroup: map };
  } catch {
    return null;
  }
}

export async function runVerifierEngineer(organizationId: string): Promise<VerifierReport> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let totalCalls = 0;
  let failureRows: Array<{
    engineName: string;
    outcome: string;
    errorMessage: string | null;
    startedAt: Date;
  }> = [];
  try {
    totalCalls = await prisma.aiCallLog.count({
      where: { organizationId, startedAt: { gte: since24h } },
    });
    failureRows = await prisma.aiCallLog.findMany({
      where: {
        organizationId,
        startedAt: { gte: since24h },
        outcome: { in: ["error", "timeout", "short_circuit"] },
      },
      select: { engineName: true, outcome: true, errorMessage: true, startedAt: true },
      orderBy: { startedAt: "desc" },
      take: 1000,
    });
  } catch {
    failureRows = [];
  }

  const grouped = new Map<string, Candidate>();
  for (const row of failureRows) {
    const pattern = normalizeError(row.errorMessage);
    const groupId = `${row.engineName}::${row.outcome}::${pattern}`;
    const existing = grouped.get(groupId);
    if (existing) {
      existing.count += 1;
      if (row.startedAt > existing.latestAt) existing.latestAt = row.startedAt;
    } else {
      const fb = fallbackVerdict({ outcome: row.outcome, errorPattern: pattern, count: 1 });
      grouped.set(groupId, {
        groupId,
        engineName: row.engineName,
        outcome: row.outcome,
        errorPattern: pattern,
        count: 1,
        latestAt: row.startedAt,
        fallbackVerdict: fb.verdict,
        fallbackReason: fb.reason,
      });
    }
  }
  // Re-score fallback after counts settle so the "≥10 systemic" rule sees the full tally.
  for (const c of grouped.values()) {
    const fb = fallbackVerdict({ outcome: c.outcome, errorPattern: c.errorPattern, count: c.count });
    c.fallbackVerdict = fb.verdict;
    c.fallbackReason = fb.reason;
  }

  const candidates: Candidate[] = Array.from(grouped.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_GROUPS);
  const failureCalls = failureRows.length;

  let executiveSummary = candidates.length === 0
    ? `Verifier swept ${totalCalls} AI calls in the last 24 hours — no failure groups crossed the surfacing threshold. Engineers are running cleanly.`
    : `${failureCalls} non-OK AI calls across ${candidates.length} failure group${candidates.length === 1 ? "" : "s"} in the last 24 hours — review verdicts below.`;
  let byGroup: Record<string, { verdict: VerifierVerdict; reason: string }> = {};
  let outcome: VerifierReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:verifier_engineer",
      organizationId,
      timeoutMs: 30_000,
      // Phase 593: bulk-classification workload — route to OpenAI's
      // cheaper model when available.
      preferredProvider: process.env.OPENAI_API_KEY ? "openai" : "anthropic",
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(totalCalls, failureCalls, candidates)}`;
    const result = await fetcher(prompt);
    const parsed = parseAi(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      byGroup = parsed.byGroup;
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

  const findings: VerifierFinding[] = candidates.map((c) => {
    const ai = byGroup[c.groupId];
    return {
      groupId: c.groupId,
      engineName: c.engineName,
      outcome: c.outcome,
      errorPattern: c.errorPattern,
      count: c.count,
      latestAt: c.latestAt,
      verdict: ai?.verdict ?? c.fallbackVerdict,
      reason: ai?.reason ?? c.fallbackReason,
    };
  });

  return {
    generatedAt: new Date(),
    windowHours: 24,
    totalCalls,
    failureCalls,
    findings,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistVerifierReport(organizationId: string, report: VerifierReport): Promise<void> {
  const riskFactors = report.findings.map((f) => `${f.verdict} · ${f.count}× · ${f.engineName}`);
  const payload = report.findings.map((f) =>
    `${f.engineName}|${f.outcome}|${f.verdict}|${f.count}|${f.errorPattern}|${f.reason}`,
  );
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: VERIFIER_TARGET_KIND,
          targetId: "verifier_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: VERIFIER_TARGET_KIND,
        targetId: "verifier_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "verifier-engineer-v1",
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
    console.warn("[verifierEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
