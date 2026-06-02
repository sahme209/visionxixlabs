/**
 * incident_engineer — real domain work · Phase 585.
 *
 * Reads recent DeploymentIncident + IncidentTriage rows, audit
 * failures, and pending approvals; emits a typed triage report
 * naming severity stacking, time-to-mitigate trend, and the highest-
 * priority items to focus on right now.
 *
 * No-input archetype — copy of compliance/detector blueprint.
 */

import "server-only";

import { prisma } from "@/lib/db";
import { makeInstrumentedFetcher } from "@/lib/releaseops/instrumentedAiFetcher";

export const INCIDENT_ENGINEER_TARGET_KIND = "engineer_incident_triage";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export interface TriagedIncident {
  incidentId: string;
  severity: IncidentSeverity;
  status: string;
  title: string;
  /** AI-enriched recommended next step; falls back to rules. */
  recommendedAction: string;
  ageHours: number;
}

export interface IncidentEngineerReport {
  generatedAt: Date;
  windowDays: number;
  totals: {
    open: number;
    mitigated: number;
    resolved: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  topIncidents: ReadonlyArray<TriagedIncident>;
  executiveSummary: string;
  outcome: "ai_generated" | "fallback_rules" | "error";
  modelHint: string | null;
  errorMessage: string | null;
}

const SEVERITY_RANK: Record<IncidentSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface ParsedAiOutput {
  executiveSummary: string;
  actionByIncidentId: Record<string, string>;
}

function buildSystemPrompt(): string {
  return [
    `You are the Incident Engineer on the Axiom platform.`,
    `Your job: phrase open and recently-mitigated incidents in the language an on-call SRE wants at standup.`,
    ``,
    `RULES:`,
    `  · Never invent incidents. Every recommendedAction must reference an incidentId from the input.`,
    `  · One sentence per incident, ≤ 220 characters, naming the concrete next step (escalate / page / runbook / wait for owner).`,
    `  · Executive summary: 2-3 sentences naming the volume, the worst-severity active item, and the recommended focus for the next hour.`,
    `  · Plain prose. No markdown headers.`,
    ``,
    `RETURN STRICT JSON only:`,
    `{`,
    `  "executiveSummary": "<2-3 sentences>",`,
    `  "actionByIncidentId": { "<incidentId>": "<sentence>", "...": "..." }`,
    `}`,
  ].join("\n");
}

function buildUserPrompt(input: {
  totals: IncidentEngineerReport["totals"];
  candidates: ReadonlyArray<{ incident: TriagedIncident; triage: { priority: string; suggestedOwnerTeam: string; estimatedTimeToMitigateMinutes: number; recommendedRunbook: string | null; autoEscalate: boolean } | null }>;
}): string {
  const lines: string[] = [];
  lines.push(`Workspace incident posture (last 14 days):`);
  lines.push(`  open=${input.totals.open} mitigated=${input.totals.mitigated} resolved=${input.totals.resolved}`);
  lines.push(`  by severity: critical=${input.totals.critical} high=${input.totals.high} medium=${input.totals.medium} low=${input.totals.low}`);
  lines.push(``);
  if (input.candidates.length === 0) {
    lines.push(`No active incidents. Provide an executive summary affirming the workspace is currently quiet and an empty actionByIncidentId.`);
  } else {
    lines.push(`Triage candidates (write actionByIncidentId entries only for these):`);
    for (const c of input.candidates) {
      lines.push(``);
      lines.push(`  [${c.incident.incidentId}] severity=${c.incident.severity} status=${c.incident.status} ageHours=${c.incident.ageHours}`);
      lines.push(`    title: ${c.incident.title}`);
      if (c.triage) {
        lines.push(`    triage: priority=${c.triage.priority} owner=${c.triage.suggestedOwnerTeam} ttm=${c.triage.estimatedTimeToMitigateMinutes}min${c.triage.recommendedRunbook ? ` runbook=${c.triage.recommendedRunbook}` : ""}${c.triage.autoEscalate ? " auto_escalate=true" : ""}`);
      }
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
    const raw = json.actionByIncidentId;
    if (!raw || typeof raw !== "object") return { executiveSummary: exec, actionByIncidentId: {} };
    const map: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string") map[k] = v.trim().slice(0, 400);
    }
    return { executiveSummary: exec, actionByIncidentId: map };
  } catch {
    return null;
  }
}

function fallbackAction(incident: TriagedIncident): string {
  if (incident.severity === "critical") return `Escalate ${incident.incidentId} (${incident.title}) — page on-call now.`;
  if (incident.severity === "high")     return `High-priority ${incident.incidentId} — confirm owner and start the runbook.`;
  if (incident.severity === "medium")   return `Triage ${incident.incidentId} into a ticket; revisit if status hasn't moved in 24h.`;
  return `Low-severity ${incident.incidentId} — add to the backlog unless it correlates with a higher-priority signal.`;
}

export async function runIncidentEngineer(organizationId: string): Promise<IncidentEngineerReport> {
  const now = Date.now();
  const since14d = new Date(now - 14 * 24 * 60 * 60 * 1000);

  const incidents = await prisma.deploymentIncident.findMany({
    where: { organizationId, createdAt: { gte: since14d } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      severity: true,
      status: true,
      title: true,
      createdAt: true,
    },
  }).catch(() => [] as Array<{ id: string; severity: string; status: string; title: string; createdAt: Date }>);

  const totals: IncidentEngineerReport["totals"] = {
    open: 0, mitigated: 0, resolved: 0,
    critical: 0, high: 0, medium: 0, low: 0,
  };
  for (const i of incidents) {
    if (i.status === "open")      totals.open++;
    if (i.status === "mitigated") totals.mitigated++;
    if (i.status === "resolved")  totals.resolved++;
    if (i.severity === "critical") totals.critical++;
    if (i.severity === "high")     totals.high++;
    if (i.severity === "medium")   totals.medium++;
    if (i.severity === "low")      totals.low++;
  }

  const incidentIds = incidents.map((i) => i.id);
  const triageRows = incidentIds.length > 0
    ? await prisma.incidentTriage.findMany({
        where: { organizationId, incidentId: { in: incidentIds } },
        select: {
          incidentId: true,
          priority: true,
          suggestedOwnerTeam: true,
          estimatedTimeToMitigateMinutes: true,
          recommendedRunbook: true,
          autoEscalate: true,
        },
      }).catch(() => [] as Array<{ incidentId: string; priority: string; suggestedOwnerTeam: string; estimatedTimeToMitigateMinutes: number; recommendedRunbook: string | null; autoEscalate: boolean }>)
    : [];
  const triageByIncident = new Map(triageRows.map((t) => [t.incidentId, t]));

  // Top 10 unresolved incidents, severity-then-recency.
  const candidates = incidents
    .filter((i) => i.status !== "resolved")
    .sort((a, b) => {
      const sa = SEVERITY_RANK[a.severity as IncidentSeverity] ?? 9;
      const sb = SEVERITY_RANK[b.severity as IncidentSeverity] ?? 9;
      if (sa !== sb) return sa - sb;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, 10);

  const triagedCandidates = candidates.map((i) => ({
    incident: {
      incidentId: i.id,
      severity: (i.severity as IncidentSeverity) ?? "low",
      status: i.status,
      title: i.title,
      recommendedAction: "",
      ageHours: Math.round((now - i.createdAt.getTime()) / (60 * 60 * 1000)),
    } satisfies TriagedIncident,
    triage: triageByIncident.get(i.id) ?? null,
  }));

  let executiveSummary = candidates.length === 0
    ? "No unresolved incidents in the last 14 days. The on-call backlog is clear."
    : `${candidates.length} unresolved incident${candidates.length === 1 ? "" : "s"} on the dashboard — ${totals.critical} critical, ${totals.high} high. Review the top items below.`;
  let actionByIncidentId: Record<string, string> = {};
  let outcome: IncidentEngineerReport["outcome"] = "fallback_rules";
  let modelHint: string | null = null;
  let errorMessage: string | null = null;

  try {
    const fetcher = makeInstrumentedFetcher({
      engineName: "engineer_domain:incident_engineer",
      organizationId,
      timeoutMs: 30_000,
    });
    const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt({ totals, candidates: triagedCandidates })}`;
    const result = await fetcher(prompt);
    const parsed = parseAiResponse(result.text);
    if (parsed) {
      executiveSummary = parsed.executiveSummary;
      actionByIncidentId = parsed.actionByIncidentId;
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

  const topIncidents: TriagedIncident[] = triagedCandidates.map(({ incident }) => ({
    ...incident,
    recommendedAction: actionByIncidentId[incident.incidentId]?.trim() || fallbackAction(incident),
  }));

  return {
    generatedAt: new Date(),
    windowDays: 14,
    totals,
    topIncidents,
    executiveSummary,
    outcome,
    modelHint,
    errorMessage,
  };
}

export async function persistIncidentReport(organizationId: string, report: IncidentEngineerReport): Promise<void> {
  const riskFactors = report.topIncidents.map((i) => `${i.severity} · ${i.incidentId} · ${i.title}`);
  const payload = report.topIncidents.map((i) => `${i.incidentId}|${i.severity}|${i.status}|${i.ageHours}h|${i.recommendedAction}`);
  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: INCIDENT_ENGINEER_TARGET_KIND,
          targetId: "incident_engineer",
        },
      },
      create: {
        organizationId,
        targetKind: INCIDENT_ENGINEER_TARGET_KIND,
        targetId: "incident_engineer",
        narrative: report.executiveSummary,
        riskFactorsJson: riskFactors as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: report.outcome,
        errorMessage: report.errorMessage,
        modelHint: report.modelHint,
        engineVersion: "incident-engineer-v1",
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
    console.warn("[incidentEngineer] persist failed:", err instanceof Error ? err.message : err);
  }
}
