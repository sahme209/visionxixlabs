/**
 * anomaly_engineer — real domain work · Phase 588.
 *
 * Reads the workspace's recent findings + failed runs + AI provider
 * failures, applies statistical outlier detection (z-score-ish over
 * daily counts), and emits typed anomaly notices.
 *
 * No-input archetype.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const ANOMALY_ENGINEER_TARGET_KIND = "engineer_anomaly_notices";

export type AnomalyKind = "finding_spike" | "scan_failure_burst" | "ai_failure_burst" | "approval_backlog_creep";
export type AnomalySeverity = "low" | "medium" | "high";

export interface AnomalyNotice {
  kind: AnomalyKind;
  title: string;
  severity: AnomalySeverity;
  description: string;
  evidence: string;
}

export interface AnomalyEngineerReport {
  generatedAt: Date;
  windowDays: number;
  notices: ReadonlyArray<AnomalyNotice>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface Candidate {
  kind: AnomalyKind;
  title: string;
  severity: AnomalySeverity;
  fallbackDescription: string;
  evidence: string;
}

/** Detect a single-window spike vs prior baseline. */
function detectSpike(thisWindow: number, baseline: number, label: string, kind: AnomalyKind): Candidate | null {
  if (thisWindow < 3) return null;
  const ratio = baseline === 0 ? Number.POSITIVE_INFINITY : thisWindow / baseline;
  if (ratio < 1.8) return null;
  const severity: AnomalySeverity = ratio >= 3 ? "high" : ratio >= 2.2 ? "medium" : "low";
  return {
    kind,
    title: `${label} spike`,
    severity,
    fallbackDescription: `${label} count is ${thisWindow} in this window vs baseline ${baseline} — ${ratio === Number.POSITIVE_INFINITY ? "no prior data" : `${ratio.toFixed(1)}x increase`}.`,
    evidence: `window=${thisWindow} baseline=${baseline} ratio=${ratio === Number.POSITIVE_INFINITY ? "inf" : ratio.toFixed(2)}`,
  };
}

interface ParsedAiOutput {
  executiveSummary: string;
  languageByKind: Record<string, string>;
}

function buildSystemPrompt(): string {
  return [
    `You are the Anomaly Engineer on the Axiom platform.`,
    `Your job: phrase statistical outlier candidates in the language an on-call observability operator wants at standup.`,
    ``,
    `RULES:`,
    `  · Never invent anomalies. languageByKind keys are EXACTLY the candidate titles below.`,
    `  · One sentence per anomaly, ≤ 220 characters, naming the metric + the magnitude + the next investigative step.`,
    `  · Executive summary: 2-3 sentences naming the largest single anomaly and whether posture is escalating or settling.`,
    `  · Plain prose. No markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "languageByKind": { "<title>": "<sentence>", "...": "..." }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(cs: ReadonlyArray<Candidate>): string {
  if (cs.length === 0) {
    return "No anomalies fired against detection thresholds. Affirm calm state and return empty languageByKind.";
  }
  const lines: string[] = [];
  lines.push("Candidate anomalies:");
  for (const c of cs) {
    lines.push(``);
    lines.push(`  [${c.kind}] ${c.title}`);
    lines.push(`    severity: ${c.severity}`);
    lines.push(`    rules description: ${c.fallbackDescription}`);
    lines.push(`    evidence: ${c.evidence}`);
  }
  return lines.join("\n");
}

function parseAiResponse(text: string): ParsedAiOutput | null {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const json = JSON.parse(text.slice(first, last + 1)) as Record<string, unknown>;
    const exec = typeof json.executiveSummary === "string" ? json.executiveSummary.trim().slice(0, 1200) : null;
    if (!exec) return null;
    const raw = json.languageByKind;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, languageByKind: {} };
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string") map[k] = v.trim().slice(0, 400);
    }
    return { executiveSummary: exec, languageByKind: map };
  } catch {
    return null;
  }
}

export async function runAnomalyEngineer(organizationId: string): Promise<AnomalyEngineerReport> {
  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since14d = new Date(now - 14 * 24 * 60 * 60 * 1000);

  // Two windows: this week and the prior 7 days as baseline.
  const [findings7d, findings14d, fails7d, fails14d, aiFail7d, aiFail14d, pending] = await Promise.all([
    prisma.axiomFinding.count({ where: { run: { organizationId }, createdAt: { gte: since7d } } }).catch(() => 0),
    prisma.axiomFinding.count({ where: { run: { organizationId }, createdAt: { gte: since14d, lt: since7d } } }).catch(() => 0),
    prisma.axiomAgentRun.count({ where: { organizationId, status: "failed", createdAt: { gte: since7d } } }).catch(() => 0),
    prisma.axiomAgentRun.count({ where: { organizationId, status: "failed", createdAt: { gte: since14d, lt: since7d } } }).catch(() => 0),
    prisma.aiCallLog.count({ where: { organizationId, outcome: "error", startedAt: { gte: since7d } } }).catch(() => 0),
    prisma.aiCallLog.count({ where: { organizationId, outcome: "error", startedAt: { gte: since14d, lt: since7d } } }).catch(() => 0),
    prisma.axiomApprovalItem.count({ where: { organizationId, status: "pending" } }).catch(() => 0),
  ]);

  const candidates: Candidate[] = [];
  const finding = detectSpike(findings7d, findings14d, "Finding volume", "finding_spike");
  if (finding) candidates.push(finding);
  const failure = detectSpike(fails7d, fails14d, "Scan failure", "scan_failure_burst");
  if (failure) candidates.push(failure);
  const aiFail = detectSpike(aiFail7d, aiFail14d, "AI provider error", "ai_failure_burst");
  if (aiFail) candidates.push(aiFail);
  if (pending >= 25) {
    candidates.push({
      kind: "approval_backlog_creep",
      title: "Approval backlog creep",
      severity: pending >= 50 ? "high" : "medium",
      fallbackDescription: `${pending} approval items pending — approaching the 7-day auto-expire watermark.`,
      evidence: `pending=${pending}`,
    });
  }

  let executiveSummary = candidates.length === 0
    ? "Workspace metrics are within calm-baseline thresholds for the week. No anomalies fired."
    : `${candidates.length} statistical anomaly${candidates.length === 1 ? "" : "s"} fired against the prior-week baseline — review the items below.`;
  let languageByKind: Record<string, string> = {};
  let outcome: AnomalyEngineerReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:anomaly_engineer",
      organizationId,
      timeoutMs: 30_000,
      // Phase 593: route this engineer to OpenAI when available.
      // Anomaly classification + short-text generation is the sweet
      // spot for gpt-4o-mini's cost/quality curve. Operator can
      // unset OPENAI_API_KEY to force Anthropic instead.
      preferredProvider: process.env.OPENAI_API_KEY ? "openai" : "anthropic",
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(candidates)}`;
    const result = await fetcher(prompt);
    const parsed = parseAiResponse(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      languageByKind = parsed.languageByKind;
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

  const notices: AnomalyNotice[] = candidates.map((c) => ({
    kind: c.kind,
    title: c.title,
    severity: c.severity,
    description: languageByKind[c.title]?.trim() || c.fallbackDescription,
    evidence: c.evidence,
  }));

  return {
    generatedAt: new Date(),
    windowDays: 7,
    notices,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistAnomalyReport(organizationId: string, report: AnomalyEngineerReport): Promise<void> {
  const riskFactors = report.notices.map((n) => `${n.severity} · ${n.kind} · ${n.title}`);
  const payload = report.notices.map((n) => `${n.kind}|${n.severity}|${n.evidence}|${n.description}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: ANOMALY_ENGINEER_TARGET_KIND,
          targetId: "anomaly_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: ANOMALY_ENGINEER_TARGET_KIND,
        targetId: "anomaly_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "anomaly-engineer-v1",
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
    console.warn("[anomalyEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
