/**
 * pipeline_repair_engineer — real domain work · Phase 596.
 *
 * Reads recent failed AxiomAgentRun rows for the workspace, groups
 * them by failure signature, and drafts a repair playbook: cause +
 * remediation step + suggested verification.
 *
 * No-input archetype.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const PIPELINE_REPAIR_TARGET_KIND = "engineer_pipeline_repair_playbook";

export type RepairCategory =
  | "credentials"
  | "rate_limit"
  | "schema_drift"
  | "transient_io"
  | "agent_logic"
  | "unknown";

export interface RepairEntry {
  signatureId: string;
  trigger: string;
  errorPattern: string;
  count: number;
  latestAt: Date;
  category: RepairCategory;
  /** AI-enriched cause + remediation. Rules fallback when AI absent. */
  cause: string;
  remediation: string;
  verification: string;
}

export interface PipelineRepairReport {
  generatedAt: Date;
  windowDays: number;
  totalFailures: number;
  entries: ReadonlyArray<RepairEntry>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface Candidate {
  signatureId: string;
  trigger: string;
  errorPattern: string;
  count: number;
  latestAt: Date;
  fallbackCategory: RepairCategory;
  fallbackCause: string;
  fallbackRemediation: string;
  fallbackVerification: string;
}

interface ParsedAi {
  executiveSummary: string;
  bySignature: Record<
    string,
    { category: RepairCategory; cause: string; remediation: string; verification: string }
  >;
}

const MAX_SIGNATURES = 10;
const ERROR_PATTERN_MAX = 120;

function normalizeError(raw: string | null): string {
  if (!raw) return "no_message";
  const stripped = raw
    .replace(/[a-f0-9]{8,}/gi, "<id>")
    .replace(/\d{4,}/g, "<n>")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, ERROR_PATTERN_MAX);
}

function fallbackRepair(c: { errorPattern: string; count: number }): {
  category: RepairCategory;
  cause: string;
  remediation: string;
  verification: string;
} {
  const err = c.errorPattern.toLowerCase();
  if (err.includes("unauthor") || err.includes("403") || err.includes("401") || err.includes("invalid_credentials") || err.includes("api_key")) {
    return {
      category: "credentials",
      cause: `${c.count} failure${c.count === 1 ? "" : "s"} on auth — cloud or provider credentials likely revoked or scoped too narrowly.`,
      remediation: `Rotate the cloud-account credentials, confirm IAM scope covers the resources the agent reads, and re-link.`,
      verification: `Trigger a manual agent run after re-linking and watch for the success outcome.`,
    };
  }
  if (err.includes("rate") || err.includes("429") || err.includes("quota")) {
    return {
      category: "rate_limit",
      cause: `${c.count} rate-limit / quota responses — workspace exceeded the upstream provider's request budget.`,
      remediation: `Stagger the agent's polling cadence or raise the provider quota. Audit cron schedule overlap.`,
      verification: `Watch the next two scheduled ticks succeed and rate-limit errors stay flat.`,
    };
  }
  if (err.includes("schema") || err.includes("column") || err.includes("relation") || err.includes("does not exist") || err.includes("migration")) {
    return {
      category: "schema_drift",
      cause: `${c.count} failure${c.count === 1 ? "" : "s"} reference missing schema — a migration likely shipped without redeploying the agent.`,
      remediation: `Re-run prisma generate + migrate deploy, then redeploy the worker so the client matches the live schema.`,
      verification: `Confirm the next agent run reaches "running" instead of failing on the first DB hit.`,
    };
  }
  if (err.includes("timeout") || err.includes("econnreset") || err.includes("etimedout") || err.includes("network") || err.includes("socket")) {
    return {
      category: "transient_io",
      cause: `${c.count} transient I/O / network failure${c.count === 1 ? "" : "s"} — likely upstream blip rather than logic bug.`,
      remediation: `Retry with exponential backoff. If the same signature keeps recurring, escalate to provider status check.`,
      verification: `Watch the next 3 runs; ≤ 1 recurrence is healthy noise, 3 of 3 is a real outage.`,
    };
  }
  if (c.count >= 5) {
    return {
      category: "agent_logic",
      cause: `${c.count} failure${c.count === 1 ? "" : "s"} with the same signature — likely a code-path the agent hits that throws unguarded.`,
      remediation: `Open the run log for the latest occurrence, find the throwing call site, add the missing guard or fix the logic.`,
      verification: `Re-run the agent against the same input shape and confirm the failure does not reproduce.`,
    };
  }
  return {
    category: "unknown",
    cause: `${c.count} occurrence${c.count === 1 ? "" : "s"} — signature too sparse to categorize automatically.`,
    remediation: `Open the most recent run log, capture the stack, then decide whether to retry, guard, or escalate.`,
    verification: `Track whether the signature reoccurs in the next 24 hours.`,
  };
}

function buildSystemPrompt(): string {
  return [
    `You are the Pipeline Repair Engineer on the Axiom platform.`,
    `Your job: turn raw failed-agent-run signatures into a repair playbook a workspace operator can act on without reading the stack trace.`,
    ``,
    `CATEGORIES:`,
    `  · credentials   — auth / IAM / token issue`,
    `  · rate_limit    — provider quota / 429 / throttle`,
    `  · schema_drift  — DB schema doesn't match client expectations`,
    `  · transient_io  — network / timeout / socket — likely upstream blip`,
    `  · agent_logic   — code-path the agent hits that throws unguarded`,
    `  · unknown       — signature too sparse to categorize`,
    ``,
    `RULES:`,
    `  · Only emit signatureId keys present in the input.`,
    `  · cause: one sentence ≤ 220 characters naming the concrete signal.`,
    `  · remediation: one sentence ≤ 240 characters naming the concrete first step.`,
    `  · verification: one sentence ≤ 200 characters naming the observable signal that proves the fix worked.`,
    `  · Executive summary: 2-3 sentences naming the dominant category and the most material failure signature.`,
    `  · Never invent failures — only rephrase signatures the input names.`,
    `  · Plain prose. No markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "bySignature": { "<signatureId>": { "category": "<cat>", "cause": "...", "remediation": "...", "verification": "..." } }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(totalFailures: number, candidates: ReadonlyArray<Candidate>): string {
  if (candidates.length === 0) {
    return [
      `Workspace had ${totalFailures} failed AxiomAgentRun rows in the last 7 days.`,
      `Nothing crosses the surfacing threshold. Affirm a calm state and return empty bySignature.`,
    ].join("\n");
  }
  const lines: string[] = [];
  lines.push(`Workspace failed-run signatures (last 7 days, ranked by count):`);
  for (const c of candidates) {
    lines.push(``);
    lines.push(`  [${c.signatureId}] count=${c.count} latestAt=${c.latestAt.toISOString()}`);
    lines.push(`    trigger: ${c.trigger}`);
    lines.push(`    error pattern: ${c.errorPattern}`);
    lines.push(`    rules category: ${c.fallbackCategory}`);
    lines.push(`    rules cause: ${c.fallbackCause}`);
    lines.push(`    rules remediation: ${c.fallbackRemediation}`);
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
    const raw = j.bySignature;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, bySignature: {} };
    const map: ParsedAi["bySignature"] = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const obj = v as Record<string, unknown>;
      const cat = obj.category;
      const cause = typeof obj.cause === "string" ? obj.cause.trim().slice(0, 320) : "";
      const remediation = typeof obj.remediation === "string" ? obj.remediation.trim().slice(0, 320) : "";
      const verification = typeof obj.verification === "string" ? obj.verification.trim().slice(0, 280) : "";
      if (
        cause && remediation && verification &&
        (cat === "credentials" || cat === "rate_limit" || cat === "schema_drift" ||
         cat === "transient_io" || cat === "agent_logic" || cat === "unknown")
      ) {
        map[k] = { category: cat as RepairCategory, cause, remediation, verification };
      }
    }
    return { executiveSummary: exec, bySignature: map };
  } catch {
    return null;
  }
}

export async function runPipelineRepairEngineer(organizationId: string): Promise<PipelineRepairReport> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let failureRows: Array<{
    trigger: string;
    errorMessage: string | null;
    createdAt: Date;
  }> = [];
  try {
    const rows = await prisma.axiomAgentRun.findMany({
      where: { organizationId, status: "failed", createdAt: { gte: since7d } },
      select: { trigger: true, errorMessage: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    failureRows = rows.map((r) => ({
      trigger: String(r.trigger),
      errorMessage: r.errorMessage,
      createdAt: r.createdAt,
    }));
  } catch {
    failureRows = [];
  }
  const totalFailures = failureRows.length;

  const grouped = new Map<string, Candidate>();
  for (const row of failureRows) {
    const pattern = normalizeError(row.errorMessage);
    const signatureId = `${row.trigger}::${pattern}`;
    const existing = grouped.get(signatureId);
    if (existing) {
      existing.count += 1;
      if (row.createdAt > existing.latestAt) existing.latestAt = row.createdAt;
    } else {
      const fb = fallbackRepair({ errorPattern: pattern, count: 1 });
      grouped.set(signatureId, {
        signatureId,
        trigger: row.trigger,
        errorPattern: pattern,
        count: 1,
        latestAt: row.createdAt,
        fallbackCategory: fb.category,
        fallbackCause: fb.cause,
        fallbackRemediation: fb.remediation,
        fallbackVerification: fb.verification,
      });
    }
  }
  for (const c of grouped.values()) {
    const fb = fallbackRepair({ errorPattern: c.errorPattern, count: c.count });
    c.fallbackCategory = fb.category;
    c.fallbackCause = fb.cause;
    c.fallbackRemediation = fb.remediation;
    c.fallbackVerification = fb.verification;
  }

  const candidates: Candidate[] = Array.from(grouped.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_SIGNATURES);

  let executiveSummary = candidates.length === 0
    ? `No failed AxiomAgentRun rows in the last 7 days — agent pipeline is running cleanly.`
    : `${totalFailures} failed agent run${totalFailures === 1 ? "" : "s"} across ${candidates.length} distinct signature${candidates.length === 1 ? "" : "s"} in the last 7 days — review the repair playbook below.`;
  let bySignature: ParsedAi["bySignature"] = {};
  let outcome: PipelineRepairReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:pipeline_repair_engineer",
      organizationId,
      timeoutMs: 45_000,
      maxTokens: 2000,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(totalFailures, candidates)}`;
    const result = await fetcher(prompt);
    const parsed = parseAi(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      bySignature = parsed.bySignature;
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

  const entries: RepairEntry[] = candidates.map((c) => {
    const ai = bySignature[c.signatureId];
    return {
      signatureId: c.signatureId,
      trigger: c.trigger,
      errorPattern: c.errorPattern,
      count: c.count,
      latestAt: c.latestAt,
      category: ai?.category ?? c.fallbackCategory,
      cause: ai?.cause ?? c.fallbackCause,
      remediation: ai?.remediation ?? c.fallbackRemediation,
      verification: ai?.verification ?? c.fallbackVerification,
    };
  });

  return {
    generatedAt: new Date(),
    windowDays: 7,
    totalFailures,
    entries,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistPipelineRepairReport(organizationId: string, report: PipelineRepairReport): Promise<void> {
  const riskFactors = report.entries.map((e) => `${e.category} · ${e.count}× · ${e.trigger}`);
  const payload: string[] = [];
  for (const e of report.entries) {
    payload.push(`cause|${e.signatureId}|${e.category}|${e.count}|${e.cause}`);
    payload.push(`remediation|${e.signatureId}|${e.remediation}`);
    payload.push(`verification|${e.signatureId}|${e.verification}`);
  }
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: PIPELINE_REPAIR_TARGET_KIND,
          targetId: "pipeline_repair_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: PIPELINE_REPAIR_TARGET_KIND,
        targetId: "pipeline_repair_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "pipeline-repair-engineer-v1",
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
    console.warn("[pipelineRepairEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
