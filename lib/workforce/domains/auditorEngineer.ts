/**
 * auditor_engineer — real domain work · Phase 589.
 *
 * Reads SecureAuditRecord for the workspace and surfaces compliance-
 * adjacent audit observations: failure rate, blocked-outcome rate,
 * top engineers by audit volume, recent administrative changes.
 * Useful evidence for SOC2 / ISO27001 control packets.
 *
 * No-input archetype.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const AUDITOR_ENGINEER_TARGET_KIND = "engineer_auditor_observations";

export interface AuditorObservation {
  observationId: string;
  title: string;
  /** AI-enriched evidence statement, falls back to a rules-based one. */
  evidence: string;
  category: "trail_health" | "policy_overrides" | "approval_decisions" | "engineer_activity";
}

export interface AuditorEngineerReport {
  generatedAt: Date;
  windowDays: number;
  totalAuditEvents: number;
  outcomeCounts: Record<string, number>;
  observations: ReadonlyArray<AuditorObservation>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

interface Candidate {
  observationId: string;
  title: string;
  category: AuditorObservation["category"];
  fallbackEvidence: string;
}

interface ParsedAiOutput {
  executiveSummary: string;
  evidenceByObservationId: Record<string, string>;
}

function buildSystemPrompt(): string {
  return [
    `You are the Auditor Engineer on the Axiom platform.`,
    `Your job: phrase audit-trail observations in the language a SOC2 / ISO27001 control evidence packet expects.`,
    ``,
    `RULES:`,
    `  · Never invent observations. evidenceByObservationId only references ids from the input.`,
    `  · One sentence per observation, ≤ 220 characters, naming the specific evidence (counts, names, dates) without speculation.`,
    `  · Executive summary: 2-3 sentences naming overall trail health, the most material control evidence, and the recommended audit checkpoint.`,
    `  · Plain prose. No markdown.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "evidenceByObservationId": { "<id>": "<sentence>", "...": "..." }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(state: {
  totalEvents: number;
  outcomeCounts: Record<string, number>;
  candidates: ReadonlyArray<Candidate>;
}): string {
  const lines: string[] = [];
  lines.push(`Workspace audit-trail context (last 30 days):`);
  lines.push(`  total events: ${state.totalEvents}`);
  lines.push(`  outcomes: success=${state.outcomeCounts.success ?? 0} failure=${state.outcomeCounts.failure ?? 0} blocked=${state.outcomeCounts.blocked ?? 0}`);
  lines.push(``);
  if (state.candidates.length === 0) {
    lines.push(`No specific candidate observations beyond the totals above. Return an executive summary and an empty evidenceByObservationId.`);
  } else {
    lines.push(`Candidate observations (rephrase only — never add or drop):`);
    for (const c of state.candidates) {
      lines.push(``);
      lines.push(`  [${c.observationId}] category=${c.category}`);
      lines.push(`    title: ${c.title}`);
      lines.push(`    rules evidence: ${c.fallbackEvidence}`);
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
    const raw = json.evidenceByObservationId;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, evidenceByObservationId: {} };
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string") map[k] = v.trim().slice(0, 400);
    }
    return { executiveSummary: exec, evidenceByObservationId: map };
  } catch {
    return null;
  }
}

export async function runAuditorEngineer(organizationId: string): Promise<AuditorEngineerReport> {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  let totalEvents = 0;
  const outcomeCounts: Record<string, number> = { success: 0, failure: 0, blocked: 0 };
  let policyOverrides = 0;
  let approvalDecisions = 0;
  let engineerActivity = 0;
  try {
    totalEvents = await prisma.secureAuditRecord.count({
      where: { organizationId, occurredAt: { gte: since30d } },
    });
    const outcomeRows = await prisma.secureAuditRecord.groupBy({
      by: ["outcome"],
      where: { organizationId, occurredAt: { gte: since30d } },
      _count: { _all: true },
    });
    for (const r of outcomeRows) {
      if (r.outcome in outcomeCounts) outcomeCounts[r.outcome] = r._count._all;
    }
    [policyOverrides, approvalDecisions, engineerActivity] = await Promise.all([
      prisma.secureAuditRecord.count({
        where: {
          organizationId,
          occurredAt: { gte: since30d },
          action: { in: ["engineer.policy_override_updated", "engineer.enable_toggled", "engineer.notes_updated"] },
        },
      }),
      prisma.secureAuditRecord.count({
        where: {
          organizationId,
          occurredAt: { gte: since30d },
          action: { in: ["approval.grant", "approval.deny", "engineer.approval_voted"] },
        },
      }),
      prisma.secureAuditRecord.count({
        where: {
          organizationId,
          occurredAt: { gte: since30d },
          action: { startsWith: "engineer." },
        },
      }),
    ]);
  } catch { /* migration_pending → totals stay zero */ }

  const candidates: Candidate[] = [];
  candidates.push({
    observationId: "trail_volume",
    title: "Audit trail volume",
    category: "trail_health",
    fallbackEvidence: `${totalEvents} SecureAuditRecord entries persisted in the last 30 days for this workspace.`,
  });
  if ((outcomeCounts.failure ?? 0) + (outcomeCounts.blocked ?? 0) > 0) {
    candidates.push({
      observationId: "trail_outcome_split",
      title: "Audit outcome split",
      category: "trail_health",
      fallbackEvidence: `${outcomeCounts.success ?? 0} success / ${outcomeCounts.failure ?? 0} failure / ${outcomeCounts.blocked ?? 0} blocked events recorded.`,
    });
  }
  if (policyOverrides > 0) {
    candidates.push({
      observationId: "policy_override_activity",
      title: "Policy-override activity",
      category: "policy_overrides",
      fallbackEvidence: `${policyOverrides} workspace policy override / notes events in the window.`,
    });
  }
  if (approvalDecisions > 0) {
    candidates.push({
      observationId: "approval_decisions",
      title: "Approval decisions",
      category: "approval_decisions",
      fallbackEvidence: `${approvalDecisions} approval-grant/deny/vote events recorded.`,
    });
  }
  if (engineerActivity > 0) {
    candidates.push({
      observationId: "engineer_activity",
      title: "Engineer audit activity",
      category: "engineer_activity",
      fallbackEvidence: `${engineerActivity} engineer.* audit events persisted across the workforce.`,
    });
  }

  let executiveSummary = totalEvents === 0
    ? "No SecureAuditRecord activity in the last 30 days. Either the workspace is brand new or the audit fabric hasn't begun emitting."
    : `Audit trail recorded ${totalEvents} events in the last 30 days with ${outcomeCounts.success ?? 0} success, ${outcomeCounts.failure ?? 0} failure, ${outcomeCounts.blocked ?? 0} blocked.`;
  let evidenceByObservationId: Record<string, string> = {};
  let outcome: AuditorEngineerReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:auditor_engineer",
      organizationId,
      timeoutMs: 30_000,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt({ totalEvents, outcomeCounts, candidates })}`;
    const result = await fetcher(prompt);
    const parsed = parseAiResponse(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      evidenceByObservationId = parsed.evidenceByObservationId;
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

  const observations: AuditorObservation[] = candidates.map((c) => ({
    observationId: c.observationId,
    title: c.title,
    category: c.category,
    evidence: evidenceByObservationId[c.observationId]?.trim() || c.fallbackEvidence,
  }));

  return {
    generatedAt: new Date(),
    windowDays: 30,
    totalAuditEvents: totalEvents,
    outcomeCounts,
    observations,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistAuditorReport(organizationId: string, report: AuditorEngineerReport): Promise<void> {
  const riskFactors = report.observations.map((o) => `${o.category} · ${o.title}`);
  const payload = report.observations.map((o) => `${o.observationId}|${o.category}|${o.evidence}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: AUDITOR_ENGINEER_TARGET_KIND,
          targetId: "auditor_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: AUDITOR_ENGINEER_TARGET_KIND,
        targetId: "auditor_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "auditor-engineer-v1",
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
    console.warn("[auditorEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
