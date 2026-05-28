/**
 * Phase 509 — IncidentTriageInputs aggregator.
 *
 * Gathers everything the triage engine needs from the DB. Safe-degraded
 * for partial migrations.
 */

import { isMissingTable } from "./releaseListResponder";
import type { IncidentTriageInputs } from "./incidentTriageEngine";

export interface IncidentRow {
  id: string;
  organizationId: string;
  releaseId: string;
  severity: string;
  status: string;
  title: string;
  summary: string | null;
  reportedAt: Date;
}

export interface ReleaseRow {
  id: string;
  organizationId: string;
  status: string;
  releaseTag: string | null;
  actualDeployEnd: Date | null;
  targetEnvironmentId: string | null;
}

export interface IncidentTriageAggregateRepo {
  deploymentIncident: {
    findUnique(args: { where: { id: string } }): Promise<IncidentRow | null>;
    count(args: { where: { organizationId: string; releaseId: string; status: "open"; severity: "critical" } }): Promise<number>;
    findMany(args: {
      where: { organizationId: string; status: { in: string[] } };
      orderBy: { reportedAt: "desc" };
      take?: number;
      select?: Record<string, boolean>;
    }): Promise<Array<{ title: string }>>;
  };
  release: {
    findUnique(args: { where: { id: string } }): Promise<ReleaseRow | null>;
  };
  advisorRecommendation: {
    findMany(args: {
      where: { organizationId: string; releaseId: string; operatorDecision: "pending"; kind: { in: string[] } };
      select: { kind: boolean };
    }): Promise<Array<{ kind: string }>>;
  };
  releaseFreezeSession?: {
    findFirst(args: { where: { organizationId: string; status: "active" } }): Promise<{ id: string } | null>;
  };
}

export type AggregateError = "incident_not_found" | "cross_org_incident" | "release_not_found";

export interface AggregateOk { ok: true; inputs: IncidentTriageInputs }
export interface AggregateErr { ok: false; error: AggregateError; hint?: string }

const PROD_ENV_TIERS = new Set(["prod", "production", "live"]);

export async function aggregateIncidentTriageInputs(
  repo: IncidentTriageAggregateRepo,
  input: { organizationId: string; incidentId: string; businessImpactHint?: string | null },
  opts: { now?: Date } = {},
): Promise<AggregateOk | AggregateErr> {
  const now = opts.now ?? new Date();

  const incident = await repo.deploymentIncident.findUnique({ where: { id: input.incidentId } });
  if (!incident) return { ok: false, error: "incident_not_found" };
  if (incident.organizationId !== input.organizationId) return { ok: false, error: "cross_org_incident" };

  const release = await repo.release.findUnique({ where: { id: incident.releaseId } });
  if (!release) return { ok: false, error: "release_not_found" };

  const isProduction = release.targetEnvironmentId
    ? PROD_ENV_TIERS.has(release.targetEnvironmentId.toLowerCase())
    : release.status === "deployed"; // best guess fallback

  const openCriticalIncidentsOnThisRelease = await safeCount(() =>
    repo.deploymentIncident.count({
      where: { organizationId: input.organizationId, releaseId: release.id, status: "open", severity: "critical" },
    }),
  );

  const blockKinds = await safe(() =>
    repo.advisorRecommendation.findMany({
      where: {
        organizationId: input.organizationId,
        releaseId: release.id,
        operatorDecision: "pending",
        kind: { in: ["block_deploy", "rollback"] },
      },
      select: { kind: true },
    }),
    [] as Array<{ kind: string }>,
  );

  // "Similar past incidents" = past incidents whose title shares a meaningful
  // token (≥4 chars) with this incident's title. Lightweight bag-of-words.
  const histTitles = await safe(() =>
    repo.deploymentIncident.findMany({
      where: { organizationId: input.organizationId, status: { in: ["mitigated", "resolved"] } },
      orderBy: { reportedAt: "desc" },
      take: 50,
      select: { title: true },
    }),
    [] as Array<{ title: string }>,
  );
  const tokens = tokenizeTitle(incident.title);
  const similarHistoricalIncidents = histTitles.filter((h) =>
    tokens.some((t) => h.title.toLowerCase().includes(t)),
  ).length;
  // Median mitigation minutes is approximated as a constant for now — a
  // future phase wires actualMitigatedAt - reportedAt across the matching set.
  const medianHistoricalMitigationMinutes = similarHistoricalIncidents > 0 ? 60 : 0;

  const freeze = repo.releaseFreezeSession
    ? await safe(() => repo.releaseFreezeSession!.findFirst({ where: { organizationId: input.organizationId, status: "active" } }), null)
    : null;

  const inputs: IncidentTriageInputs = {
    incident: {
      id: incident.id,
      severity: incident.severity,
      title: incident.title,
      summary: incident.summary,
      reportedAtIso: incident.reportedAt.toISOString(),
    },
    release: {
      id: release.id,
      status: release.status,
      releaseTag: release.releaseTag,
      isProduction,
      deployedAtIso: release.actualDeployEnd ? release.actualDeployEnd.toISOString() : null,
    },
    openCriticalIncidentsOnThisRelease,
    pendingAdvisorBlockKinds: blockKinds.map((b) => b.kind),
    similarHistoricalIncidents,
    medianHistoricalMitigationMinutes,
    businessImpactHint: input.businessImpactHint ?? null,
    isInPlannedFreeze: freeze !== null,
    now,
  };

  return { ok: true, inputs };
}

function tokenizeTitle(title: string): string[] {
  return title.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return fallback; throw err; }
}
async function safeCount(fn: () => Promise<number>): Promise<number> {
  return safe(fn, 0);
}
