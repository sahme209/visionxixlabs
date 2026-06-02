/**
 * detector_engineer — real domain work · Phase 583.
 *
 * Watches recent platform state across findings + audit + runs +
 * approvals, asks Claude to identify typed signals worth a human's
 * attention. Same blueprint as Phase 582's compliance_engineer:
 * pure rules layer is always honest, AI layer adds language only.
 *
 * Output is a typed `DetectedSignal[]` — each signal has a
 * confidence label, a category, the human-language description,
 * and the rule-based evidence that triggered it.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const DETECTOR_ENGINEER_TARGET_KIND = "engineer_detector_signals";

export type SignalCategory =
  | "security_drift"
  | "scan_anomaly"
  | "approval_backlog"
  | "engineer_block_rate"
  | "audit_pattern"
  | "configuration_change"
  | "general";

export type SignalConfidence = "low" | "medium" | "high";

export interface DetectedSignal {
  category: SignalCategory;
  title: string;
  /** AI-enriched plain-language narrative; falls back to the rules
   *  description when AI is unavailable. */
  description: string;
  confidence: SignalConfidence;
  evidence: string;
}

export interface DetectorEngineerReport {
  generatedAt: Date;
  windowDays: number;
  signals: ReadonlyArray<DetectedSignal>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
  /** Counts the engineer collected from the workspace before talking
   *  to the AI — used by the surface header and by the audit detail. */
  inputs: {
    findingsLast7d: number;
    failedRunsLast7d: number;
    pendingApprovals: number;
    blockedAttempts30d: number;
  };
}

/* ────────────────────────────────────────────────────────────────────
   Pure rules — the engineer's actual detection logic. Each helper
   inspects one dimension of workspace state and returns 0..N candidate
   signals. The AI layer below decides which deserve language and a
   confidence label, but never invents signals not seeded here.
   ──────────────────────────────────────────────────────────────── */

interface CandidateSignal {
  category: SignalCategory;
  title: string;
  fallbackDescription: string;
  fallbackConfidence: SignalConfidence;
  evidence: string;
}

function buildCandidates(state: DetectorEngineerReport["inputs"], findingSeverities: Record<string, number>): CandidateSignal[] {
  const candidates: CandidateSignal[] = [];

  if (state.findingsLast7d >= 25) {
    candidates.push({
      category: "scan_anomaly",
      title: "Elevated finding volume",
      fallbackDescription: `${state.findingsLast7d} findings recorded in the last 7 days — above the calm-baseline threshold of 25.`,
      fallbackConfidence: state.findingsLast7d >= 75 ? "high" : "medium",
      evidence: `findings_last_7d=${state.findingsLast7d}`,
    });
  }
  if (findingSeverities.critical + findingSeverities.high >= 5) {
    candidates.push({
      category: "security_drift",
      title: "Critical + high-severity backlog",
      fallbackDescription: `${findingSeverities.critical} critical and ${findingSeverities.high} high-severity findings recorded in the window.`,
      fallbackConfidence: findingSeverities.critical >= 3 ? "high" : "medium",
      evidence: `critical=${findingSeverities.critical} high=${findingSeverities.high}`,
    });
  }
  if (state.failedRunsLast7d >= 3) {
    candidates.push({
      category: "scan_anomaly",
      title: "Scan failures climbing",
      fallbackDescription: `${state.failedRunsLast7d} scan runs failed in the last 7 days — investigate connector health.`,
      fallbackConfidence: state.failedRunsLast7d >= 7 ? "high" : "medium",
      evidence: `failed_runs_last_7d=${state.failedRunsLast7d}`,
    });
  }
  if (state.pendingApprovals >= 10) {
    candidates.push({
      category: "approval_backlog",
      title: "Approval queue backlog",
      fallbackDescription: `${state.pendingApprovals} approval items pending — risk of staleness past the 7-day auto-expire window.`,
      fallbackConfidence: state.pendingApprovals >= 20 ? "high" : "medium",
      evidence: `pending_approvals=${state.pendingApprovals}`,
    });
  }
  if (state.blockedAttempts30d >= 20) {
    candidates.push({
      category: "engineer_block_rate",
      title: "Workforce block-rate spike",
      fallbackDescription: `${state.blockedAttempts30d} gated engineer attempts blocked in the last 30 days — review the runtime-gate ruleset.`,
      fallbackConfidence: state.blockedAttempts30d >= 50 ? "high" : "medium",
      evidence: `blocked_attempts_30d=${state.blockedAttempts30d}`,
    });
  }
  return candidates;
}

/* ────────────────────────────────────────────────────────────────────
   AI enrichment.
   ──────────────────────────────────────────────────────────── */

interface ParsedAiOutput {
  executiveSummary: string;
  signalLanguage: Record<string, { description: string; confidence: SignalConfidence }>;
}

function buildSystemPrompt(): string {
  return [
    `You are the Detector Engineer on the Axiom cloud-operations platform.`,
    `Your job: take rule-based candidate signals and phrase them in the language an SRE / Security operator wants to hear at standup.`,
    ``,
    `RULES:`,
    `  · Never invent signals. Every output entry must correspond to an input candidate (matched by title).`,
    `  · One sentence per signal description, ≤ 220 characters.`,
    `  · Pick a confidence label from {"low","medium","high"} per signal — match or tighten the rule-based default; never loosen it.`,
    `  · Executive summary is 2-3 sentences naming the most material signal, the trend it implies, and the recommended next investigative step.`,
    `  · No headings, no bullet points. Plain prose.`,
    ``,
    `RETURN STRICT JSON only matching:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "signalLanguage": {`,
    `    "<exact-candidate-title>": { "description": "<sentence>", "confidence": "low|medium|high" }`,
    `  }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(candidates: CandidateSignal[], inputs: DetectorEngineerReport["inputs"]): string {
  const lines: string[] = [];
  lines.push(`Workspace state (last 7-30 days):`);
  lines.push(`  findings (7d):                ${inputs.findingsLast7d}`);
  lines.push(`  failed scan runs (7d):        ${inputs.failedRunsLast7d}`);
  lines.push(`  pending approvals:            ${inputs.pendingApprovals}`);
  lines.push(`  blocked engineer attempts (30d): ${inputs.blockedAttempts30d}`);
  lines.push(``);
  if (candidates.length === 0) {
    lines.push(`No candidate signals fired. Provide an executive summary affirming the workspace is currently quiet relative to thresholds, and an empty signalLanguage object.`);
  } else {
    lines.push(`Candidate signals (rephrase only — never add or drop):`);
    for (const c of candidates) {
      lines.push(``);
      lines.push(`  [${c.category}] ${c.title}`);
      lines.push(`    rules description: ${c.fallbackDescription}`);
      lines.push(`    rules confidence: ${c.fallbackConfidence}`);
      lines.push(`    evidence: ${c.evidence}`);
    }
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
    const langRaw = json.signalLanguage;
    if (!langRaw || typeof langRaw !== "object") return { executiveSummary: exec, signalLanguage: {} };
    const language: ParsedAiOutput["signalLanguage"] = {};
    for (const [k, v] of Object.entries(langRaw as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const obj = v as Record<string, unknown>;
      const desc = typeof obj.description === "string" ? obj.description.trim().slice(0, 600) : "";
      const conf = obj.confidence === "low" || obj.confidence === "medium" || obj.confidence === "high"
        ? (obj.confidence as SignalConfidence)
        : null;
      if (desc && conf) language[k] = { description: desc, confidence: conf };
    }
    return { executiveSummary: exec, signalLanguage: language };
  } catch {
    return null;
  }
}

/** Confidence escalation only — pure-rules confidence is the floor. */
function effectiveConfidence(ruleFloor: SignalConfidence, aiSuggested: SignalConfidence): SignalConfidence {
  const rank: Record<SignalConfidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[aiSuggested] > rank[ruleFloor] ? aiSuggested : ruleFloor;
}

export async function runDetectorEngineer(organizationId: string): Promise<DetectorEngineerReport> {
  const now = Date.now();
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // Step 1 — load workspace state via canonical reads.
  const [findingCount, severityGroups, failedRuns, pendingApprovals, blockedAttempts] = await Promise.all([
    prisma.axiomFinding.count({ where: { run: { organizationId }, createdAt: { gte: since7d } } }).catch(() => 0),
    prisma.axiomFinding.groupBy({
      by: ["severity"],
      where: { run: { organizationId }, createdAt: { gte: since7d } },
      _count: { _all: true },
    }).catch(() => [] as Array<{ severity: string; _count: { _all: number } }>),
    prisma.axiomAgentRun.count({ where: { organizationId, status: "failed", createdAt: { gte: since7d } } }).catch(() => 0),
    prisma.axiomApprovalItem.count({ where: { organizationId, status: "pending" } }).catch(() => 0),
    prisma.agentEngineerActionAttempt.count({ where: { organizationId, runtimeDecision: "blocked", createdAt: { gte: since30d } } }).catch(() => 0),
  ]);

  const findingSeverities: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const row of severityGroups) {
    if (row.severity in findingSeverities) findingSeverities[row.severity] = row._count._all;
  }

  const inputs: DetectorEngineerReport["inputs"] = {
    findingsLast7d: findingCount,
    failedRunsLast7d: failedRuns,
    pendingApprovals,
    blockedAttempts30d: blockedAttempts,
  };

  // Step 2 — pure rules layer produces candidates.
  const candidates = buildCandidates(inputs, findingSeverities);

  // Step 3 — AI enrichment.
  let executiveSummary = candidates.length === 0
    ? "Workspace is quiet relative to detection thresholds. No notable signals fired this window."
    : `${candidates.length} signal${candidates.length === 1 ? "" : "s"} fired against detection thresholds — review the per-signal evidence below.`;
  let signalLanguage: ParsedAiOutput["signalLanguage"] = {};
  let outcome: DetectorEngineerReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:detector_engineer",
      organizationId,
      timeoutMs: 30_000,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(candidates, inputs)}`;
    const result = await fetcher(prompt);
    const parsed = parseAiResponse(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      signalLanguage = parsed.signalLanguage;
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

  // Step 4 — merge AI + rules into typed signal list.
  const signals: DetectedSignal[] = candidates.map((c) => {
    const ai = signalLanguage[c.title];
    return {
      category: c.category,
      title: c.title,
      description: ai?.description ?? c.fallbackDescription,
      confidence: ai ? effectiveConfidence(c.fallbackConfidence, ai.confidence) : c.fallbackConfidence,
      evidence: c.evidence,
    };
  });

  return {
    generatedAt: new Date(),
    windowDays: 7,
    signals,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
    inputs,
  };
}

export async function persistDetectorReport(organizationId: string, report: DetectorEngineerReport): Promise<void> {
  // Same persistence shape compliance_engineer uses — narrative=
  // executive summary, riskFactorsJson = signal titles, nextActionsJson
  // = pipe-delimited per-signal payload the surface decodes.
  const riskFactors = report.signals.map((s) => `${s.confidence} · ${s.category} · ${s.title}`);
  const payload = report.signals.map((s) => `${s.title}|${s.category}|${s.confidence}|${s.evidence}|${s.description}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: DETECTOR_ENGINEER_TARGET_KIND,
          targetId: "detector_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: DETECTOR_ENGINEER_TARGET_KIND,
        targetId: "detector_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "detector-engineer-v1",
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
    console.warn("[detectorEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
