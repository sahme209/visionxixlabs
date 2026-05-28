/**
 * Phase 512 — RemediationInputs aggregator.
 *
 * Gathers everything the remediation engine needs from existing
 * data: most-recent triage for the incident, the release context,
 * available runbook keys. Safe-degraded for partial migrations.
 */

import { isMissingTable } from "./releaseListResponder";
import type { RemediationInputs } from "./remediationProposalEngine";

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
  applicationId: string;
  status: string;
  releaseTag: string | null;
  actualDeployEnd: Date | null;
  targetEnvironmentId: string | null;
}

export interface PreviousReleaseRow {
  releaseTag: string | null;
  actualDeployEnd: Date | null;
}

export interface TriageLookupRow {
  id: string;
  priority: string;
  suggestedOwnerTeam: string;
  recommendedRunbook: string | null;
  autoEscalate: boolean;
}

export interface RemediationAggregateRepo {
  deploymentIncident: {
    findUnique(args: { where: { id: string } }): Promise<IncidentRow | null>;
  };
  release: {
    findUnique(args: { where: { id: string } }): Promise<ReleaseRow | null>;
    findFirst(args: {
      where: { organizationId: string; applicationId: string; status: "deployed" };
      orderBy: { actualDeployEnd: "desc" };
    }): Promise<PreviousReleaseRow | null>;
  };
  incidentTriage: {
    findFirst(args: {
      where: { organizationId: string; incidentId: string; operatorDecision: { in: string[] } };
      orderBy: { generatedAt: "desc" };
    }): Promise<TriageLookupRow | null>;
  };
}

export type AggregateError = "incident_not_found" | "cross_org_incident" | "release_not_found" | "triage_not_found";

export interface AggregateOk { ok: true; inputs: RemediationInputs; triageId: string }
export interface AggregateErr { ok: false; error: AggregateError; hint?: string }

const PROD_ENV_TIERS = new Set(["prod", "production", "live"]);

const VENDOR_HINT_PATTERN = /\b(third[- ]?party|vendor|external service|upstream|aws|azure|gcp|stripe|datadog|cloudflare|fastly)\b/i;
const HIGH_ERROR_PATTERN = /\b(5xx|500|503|error rate|elevated errors?|errors? spike)\b/i;
const CAPACITY_PATTERN = /\b(capacity|saturat|out of memory|oom|disk full|cpu pegged|exhausted|throttl)\b/i;
const FLAG_PATTERN = /\b(feature[- ]?flag|toggle|launchdarkly|optimizely)\b/i;

export async function aggregateRemediationInputs(
  repo: RemediationAggregateRepo,
  input: { organizationId: string; incidentId: string },
  opts: { now?: Date } = {},
): Promise<AggregateOk | AggregateErr> {
  const now = opts.now ?? new Date();

  const incident = await repo.deploymentIncident.findUnique({ where: { id: input.incidentId } });
  if (!incident) return { ok: false, error: "incident_not_found" };
  if (incident.organizationId !== input.organizationId) return { ok: false, error: "cross_org_incident" };

  const release = await repo.release.findUnique({ where: { id: incident.releaseId } });
  if (!release) return { ok: false, error: "release_not_found" };

  // Most recent triage for this incident (accepted/overridden/pending).
  const triage = await safe(() =>
    repo.incidentTriage.findFirst({
      where: { organizationId: input.organizationId, incidentId: incident.id, operatorDecision: { in: ["pending", "accepted", "overridden"] } },
      orderBy: { generatedAt: "desc" },
    }),
    null,
  );
  if (!triage) return { ok: false, error: "triage_not_found", hint: "Run incident triage before generating remediation proposals." };

  // Previous successful release for rollback.
  const prev = await safe(() =>
    repo.release.findFirst({
      where: { organizationId: input.organizationId, applicationId: release.applicationId, status: "deployed" },
      orderBy: { actualDeployEnd: "desc" },
    }),
    null,
  );
  const previousSuccessfulTag = prev && prev.releaseTag !== release.releaseTag ? prev.releaseTag : null;

  const minutesSinceDeploy = release.actualDeployEnd
    ? Math.max(0, Math.floor((now.getTime() - release.actualDeployEnd.getTime()) / 60_000))
    : Math.max(0, Math.floor((now.getTime() - incident.reportedAt.getTime()) / 60_000));

  const isProduction = release.targetEnvironmentId
    ? PROD_ENV_TIERS.has(release.targetEnvironmentId.toLowerCase())
    : release.status === "deployed";

  // Heuristics from incident text (will be replaced by real signals
  // when observability connectors land).
  const text = `${incident.title} ${incident.summary ?? ""}`;
  const thirdPartyDependencyHint = VENDOR_HINT_PATTERN.test(text);
  const highErrorRate = HIGH_ERROR_PATTERN.test(text);
  const isCapacitySaturated = CAPACITY_PATTERN.test(text);
  const releaseFeatureFlags = FLAG_PATTERN.test(text) ? ["release_flag_detected"] : [];

  // Treat priorities outside the closed-union as "P3" (most conservative).
  const priority = (["P0", "P1", "P2", "P3"] as const).includes(triage.priority as never)
    ? (triage.priority as "P0" | "P1" | "P2" | "P3")
    : "P3";

  const inputs: RemediationInputs = {
    triage: {
      priority,
      suggestedOwnerTeam: triage.suggestedOwnerTeam,
      recommendedRunbook: triage.recommendedRunbook,
      autoEscalate: triage.autoEscalate,
    },
    incident: {
      id: incident.id,
      title: incident.title,
      summary: incident.summary,
      severity: incident.severity,
      reportedAtIso: incident.reportedAt.toISOString(),
    },
    release: {
      id: release.id,
      status: release.status,
      releaseTag: release.releaseTag,
      previousSuccessfulTag,
      minutesSinceDeploy,
      isProduction,
    },
    releaseFeatureFlags,
    isCapacitySaturated,
    thirdPartyDependencyHint,
    highErrorRate,
    availableRunbookKeys: triage.recommendedRunbook ? [triage.recommendedRunbook] : [],
    now,
  };

  return { ok: true, inputs, triageId: triage.id };
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return fallback; throw err; }
}
