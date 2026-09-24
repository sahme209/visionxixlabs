/**
 * workload_performance_engineer — real domain work · Phase 640.
 *
 * Operator-input archetype. Operator pastes a telemetry snapshot
 * (CloudWatch JSON, Datadog API output, vCenter perfQuery, kubectl
 * top, Prometheus query result — any tabular metric source) +
 * service description + baseline expectations. Engineer analyzes
 * baseline deviation, hypothesizes root causes, recommends ordered
 * remediation, and routes to downstream workforce engineers.
 *
 * Built specifically for the LinkedIn enterprise lead's
 * "Performance monitoring" ask. Honest scope: this is point-in-time
 * AI analysis of pasted metrics, not autonomous polling (the
 * autonomous polling lands in a follow-up via the webhook ingestion
 * endpoint).
 *
 * Output maps to the operator's incident-response workflow:
 *   · performanceVerdict — closed-union severity
 *   · baselineDeviations — per-metric typed gap
 *   · rootCauseHypotheses — ranked 3 plausible causes
 *   · recommendedActions — ordered remediation steps
 *   · escalationPath — which downstream engineers to involve next
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";
import {
  INJECTION_RESISTANCE_CLAUSE,
  buildUserInputSection,
} from "@/lib/workforce/domains/promptHardening";

export const WORKLOAD_PERFORMANCE_TARGET_KIND = "engineer_workload_performance_analysis";

export type PerformanceVerdict = "healthy" | "concerning" | "degraded" | "critical";

export type DeviationSeverity = "minor" | "moderate" | "major" | "severe";

export interface WorkloadPerformanceInput {
  title: string;
  serviceDescription: string;
  telemetrySnapshot: string;
  baselineExpectations?: string;
  recentChanges?: string;
}

export interface BaselineDeviation {
  metric: string;
  expected: string;
  observed: string;
  severity: DeviationSeverity;
}

export interface WorkloadPerformanceAnalysis {
  slug: string;
  title: string;
  executiveSummary: string;
  performanceVerdict: PerformanceVerdict;
  verdictRationale: string;
  baselineDeviations: ReadonlyArray<BaselineDeviation>;
  rootCauseHypotheses: ReadonlyArray<string>;
  recommendedActions: ReadonlyArray<string>;
  escalationPath: ReadonlyArray<string>;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface ParsedAi {
  executiveSummary: string;
  performanceVerdict: PerformanceVerdict;
  verdictRationale: string;
  baselineDeviations: BaselineDeviation[];
  rootCauseHypotheses: string[];
  recommendedActions: string[];
  escalationPath: string[];
}

const MAX_TITLE = 200;
const MAX_BODY = 12000;

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
    `You are the Workload Performance Engineer on the Axiom platform.`,
    `Your job: take a customer's pasted telemetry snapshot (CloudWatch / Datadog / Prometheus / vCenter perfQuery / kubectl top — any tabular metric source) and analyze whether the workload is operating within baseline expectations.`,
    ``,
    INJECTION_RESISTANCE_CLAUSE,
    ``,
    `VERDICTS:`,
    `  · healthy     — within baseline, no action needed`,
    `  · concerning  — drifting toward threshold, watch over next 24h`,
    `  · degraded    — outside baseline, customer-visible latency or error rate elevated`,
    `  · critical    — multiple metrics over threshold, incident-class severity`,
    ``,
    `DEVIATION SEVERITY per metric:`,
    `  · minor     — within 25% of baseline, may be noise`,
    `  · moderate  — 25-50% deviation, investigate but not urgent`,
    `  · major     — 50-100% deviation, page on-call`,
    `  · severe    — > 100% deviation, fire alarm`,
    ``,
    `RULES:`,
    `  · Honest scope. If the telemetry snapshot is too sparse to analyze (only one data point, no time series), surface that as a gap and set verdict=concerning.`,
    `  · Executive summary: 3-4 sentences naming the verdict, the worst-deviating metric, the most likely root cause, and the headline recommended action.`,
    `  · verdictRationale: 2-3 sentences ≤ 480 chars explaining WHY this verdict (cite specific metric values from the snapshot).`,
    `  · baselineDeviations: 0-6 entries naming each metric over threshold. Quote BOTH the observed value and the expected baseline. Pick severity from the closed union above.`,
    `  · rootCauseHypotheses: 2-4 entries each ≤ 280 chars. Ranked most-likely first. Quote concrete evidence from the snapshot (e.g. "CPU steal time at 23% suggests noisy neighbor on the host").`,
    `  · recommendedActions: 3-6 entries each ≤ 320 chars. ORDERED — first one is the most-important next step. Each action names the observable signal that will prove it worked.`,
    `  · escalationPath: 0-4 entries naming downstream Axiom workforce engineers to involve (verifier_engineer / anomaly_engineer / pipeline_repair_engineer / incident_engineer / reasoner_engineer / approver_engineer). Use exact engineer ids. Empty when verdict=healthy.`,
    `  · Never invent metric values not present in the snapshot.`,
    `  · Never fabricate baseline numbers — if baseline expectations were not supplied, say "operator did not declare baseline" in verdictRationale.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "...",`,
    `  "performanceVerdict": "<healthy|concerning|degraded|critical>",`,
    `  "verdictRationale": "...",`,
    `  "baselineDeviations": [`,
    `    { "metric": "...", "expected": "...", "observed": "...", "severity": "<minor|moderate|major|severe>" }`,
    `  ],`,
    `  "rootCauseHypotheses": ["...", "..."],`,
    `  "recommendedActions": ["...", "..."],`,
    `  "escalationPath": ["...", "..."]`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(i: WorkloadPerformanceInput): string {
  return buildUserInputSection([
    { label: "title", content: i.title },
    { label: "service_description", content: i.serviceDescription },
    { label: "baseline_expectations", content: i.baselineExpectations ?? "" },
    { label: "recent_changes", content: i.recentChanges ?? "" },
    { label: "telemetry_snapshot", content: i.telemetrySnapshot },
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
    const vRaw = j.performanceVerdict;
    const performanceVerdict: PerformanceVerdict =
      vRaw === "healthy" || vRaw === "concerning" || vRaw === "degraded" || vRaw === "critical"
        ? vRaw
        : "concerning";
    const verdictRationale = typeof j.verdictRationale === "string" ? j.verdictRationale.trim().slice(0, 600) : "";
    const devsRaw = Array.isArray(j.baselineDeviations) ? (j.baselineDeviations as unknown[]) : [];
    const baselineDeviations: BaselineDeviation[] = [];
    for (let i = 0; i < devsRaw.length && baselineDeviations.length < 6; i += 1) {
      const item = devsRaw[i];
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const metric = typeof obj.metric === "string" ? obj.metric.trim().slice(0, 120) : "";
      const expected = typeof obj.expected === "string" ? obj.expected.trim().slice(0, 200) : "";
      const observed = typeof obj.observed === "string" ? obj.observed.trim().slice(0, 200) : "";
      const sevRaw = obj.severity;
      const severity: DeviationSeverity =
        sevRaw === "minor" || sevRaw === "moderate" || sevRaw === "major" || sevRaw === "severe"
          ? sevRaw
          : "moderate";
      if (metric && expected && observed) {
        baselineDeviations.push({ metric, expected, observed, severity });
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
      performanceVerdict,
      verdictRationale,
      baselineDeviations,
      rootCauseHypotheses: strs(j.rootCauseHypotheses, 4, 320),
      recommendedActions: strs(j.recommendedActions, 6, 400),
      escalationPath: strs(j.escalationPath, 4, 80),
    };
  } catch {
    return null;
  }
}

export async function runWorkloadPerformanceEngineer(
  organizationId: string,
  raw: WorkloadPerformanceInput,
): Promise<WorkloadPerformanceAnalysis> {
  const title = raw.title.trim().slice(0, MAX_TITLE);
  const serviceDescription = raw.serviceDescription.trim().slice(0, MAX_BODY);
  const telemetrySnapshot = raw.telemetrySnapshot.trim().slice(0, MAX_BODY);
  if (!title || !serviceDescription || !telemetrySnapshot) {
    return {
      slug: "",
      title,
      executiveSummary: "Input incomplete. Title + service description + telemetry snapshot are required.",
      performanceVerdict: "concerning",
      verdictRationale: "",
      baselineDeviations: [],
      rootCauseHypotheses: [],
      recommendedActions: [],
      escalationPath: [],
      outcome: "error",
      modelHint: null,
      errorMessage: "missing_input",
    };
  }
  const slug = slugify(title) || `perf_${Date.now().toString(36)}`;
  const input: WorkloadPerformanceInput = {
    title,
    serviceDescription,
    telemetrySnapshot,
    baselineExpectations: raw.baselineExpectations?.trim().slice(0, 2000),
    recentChanges: raw.recentChanges?.trim().slice(0, 2000),
  };

  let outcome: WorkloadPerformanceAnalysis["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;
  let parsed: ParsedAi | null = null;
  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:workload_performance_engineer",
      organizationId,
      timeoutMs: 75_000,
      maxTokens: 3000,
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
      parsed?.executiveSummary ??
      `Stub workload performance analysis for "${title}". Re-run when the AI provider is healthy.`,
    performanceVerdict: parsed?.performanceVerdict ?? "concerning",
    verdictRationale: parsed?.verdictRationale ?? "",
    baselineDeviations: parsed?.baselineDeviations ?? [],
    rootCauseHypotheses: parsed?.rootCauseHypotheses ?? [],
    recommendedActions: parsed?.recommendedActions ?? [],
    escalationPath: parsed?.escalationPath ?? [],
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistWorkloadPerformanceAnalysis(
  organizationId: string,
  a: WorkloadPerformanceAnalysis,
): Promise<void> {
  if (!a.slug) return;
  const payload: string[] = [
    `title|${a.title}`,
    `verdict|${a.performanceVerdict}`,
    `verdict_rationale|${a.verdictRationale}`,
  ];
  for (const d of a.baselineDeviations) {
    payload.push(`deviation|${d.severity}|${d.metric}|${d.expected}|${d.observed}`);
  }
  for (const h of a.rootCauseHypotheses) payload.push(`hypothesis|${h}`);
  for (const r of a.recommendedActions) payload.push(`action|${r}`);
  for (const e of a.escalationPath) payload.push(`escalate|${e}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: WORKLOAD_PERFORMANCE_TARGET_KIND,
          targetId: a.slug,
        },
      },
      create: {
        organizationId,
        targetKind: WORKLOAD_PERFORMANCE_TARGET_KIND,
        targetId: a.slug,
        narrative: a.executiveSummary,
        riskFactorsJson: a.rootCauseHypotheses as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: a.outcome,
        errorMessage: a.errorMessage,
        modelHint: a.modelHint,
        engineVersion: "workload-performance-engineer-v1",
      },
      update: {
        narrative: a.executiveSummary,
        riskFactorsJson: a.rootCauseHypotheses as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: a.outcome,
        errorMessage: a.errorMessage,
        modelHint: a.modelHint,
      },
    });
  } catch (err) {
    console.warn(
      "[workloadPerformanceEngineer] persist failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
