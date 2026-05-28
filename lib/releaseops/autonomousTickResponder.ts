/**
 * Phase 513 — Autonomous Cron tick responder.
 *
 * Periodically scans the org's state and runs the AGI engines
 * autonomously, without any operator clicks:
 *
 *   1. Active releases without recent advisor recommendations
 *      → run buildAdvisorGenerateResponse
 *   2. Open incidents without recent triage
 *      → run buildTriageGenerateResponse
 *   3. Open incidents with triage but no remediation proposals
 *      → run buildRemediationGenerateResponse
 *   4. Org-level: refresh policy proposals
 *      → run buildProposalGenerateResponse
 *
 * Returns a structured tick report for observability. Per-org
 * iteration. Errors on individual orgs/engines never abort the
 * whole tick — they're captured in the report.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface OrgRow { id: string }

export interface ReleaseTickRow {
  id: string;
  organizationId: string;
  status: string;
}

export interface IncidentTickRow {
  id: string;
  organizationId: string;
  status: string;
}

export interface RecentRow {
  generatedAt: Date;
}

export interface AutonomousTickRepo {
  organization: {
    findMany(args: { select: { id: boolean }; take?: number }): Promise<OrgRow[]>;
  };
  release: {
    findMany(args: {
      where: { organizationId: string; status: { in: string[] } };
      orderBy: { createdAt: "desc" };
      take?: number;
      select?: Record<string, boolean>;
    }): Promise<ReleaseTickRow[]>;
  };
  advisorRecommendation: {
    findFirst(args: {
      where: { organizationId: string; releaseId: string };
      orderBy: { generatedAt: "desc" };
    }): Promise<RecentRow | null>;
  };
  deploymentIncident: {
    findMany(args: {
      where: { organizationId: string; status: { in: string[] } };
      orderBy: { reportedAt: "desc" };
      take?: number;
      select?: Record<string, boolean>;
    }): Promise<IncidentTickRow[]>;
  };
  incidentTriage: {
    findFirst(args: {
      where: { organizationId: string; incidentId: string };
      orderBy: { generatedAt: "desc" };
    }): Promise<RecentRow | null>;
  };
  remediationProposal: {
    findFirst(args: {
      where: { organizationId: string; incidentId: string };
      orderBy: { generatedAt: "desc" };
    }): Promise<RecentRow | null>;
  };
  policyProposal: {
    findFirst(args: {
      where: { organizationId: string };
      orderBy: { generatedAt: "desc" };
    }): Promise<RecentRow | null>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Engine runner contracts. Caller provides functions that take the
   org + subject id and do the actual work. The responder just
   coordinates.
   ────────────────────────────────────────────────────────────── */

export type EngineRunResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface EngineRunners {
  runAdvisor: (organizationId: string, releaseId: string) => Promise<EngineRunResult>;
  runTriage: (organizationId: string, incidentId: string) => Promise<EngineRunResult>;
  runRemediation: (organizationId: string, incidentId: string) => Promise<EngineRunResult>;
  runPolicyProposal: (organizationId: string) => Promise<EngineRunResult>;
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface OrgTickReport {
  organizationId: string;
  advisorRuns: { releaseId: string; outcome: "ok" | "skipped" | "error"; reason?: string }[];
  triageRuns: { incidentId: string; outcome: "ok" | "skipped" | "error"; reason?: string }[];
  remediationRuns: { incidentId: string; outcome: "ok" | "skipped" | "error"; reason?: string }[];
  policyProposalRun: { outcome: "ok" | "skipped" | "error"; reason?: string } | null;
}

export interface TickReport {
  ok: true;
  generatedAtIso: string;
  orgCount: number;
  totalRuns: number;
  okRuns: number;
  errorRuns: number;
  skippedRuns: number;
  perOrg: OrgTickReport[];
}

export interface TickError {
  ok: false;
  error: string;
  hint?: string;
}

/* ──────────────────────────────────────────────────────────────────
   Configurable thresholds.
   ────────────────────────────────────────────────────────────── */

export interface TickConfig {
  /** Hours since last advisor run before we re-run. Default 4. */
  advisorMaxAgeHours: number;
  /** Hours since last triage run before we re-run. Default 1. */
  triageMaxAgeHours: number;
  /** Hours since last remediation run before we re-run. Default 1. */
  remediationMaxAgeHours: number;
  /** Hours since last policy-proposal run before we re-run. Default 24. */
  policyProposalMaxAgeHours: number;
  /** Max active releases to scan per org per tick. Default 10. */
  maxReleasesPerOrg: number;
  /** Max open incidents to scan per org per tick. Default 20. */
  maxIncidentsPerOrg: number;
  /** Max orgs to process in a single tick. Default 100. */
  maxOrgsPerTick: number;
}

const DEFAULT_CONFIG: TickConfig = {
  advisorMaxAgeHours: 4,
  triageMaxAgeHours: 1,
  remediationMaxAgeHours: 1,
  policyProposalMaxAgeHours: 24,
  maxReleasesPerOrg: 10,
  maxIncidentsPerOrg: 20,
  maxOrgsPerTick: 100,
};

/* ──────────────────────────────────────────────────────────────────
   Responder.
   ────────────────────────────────────────────────────────────── */

export async function runAutonomousTick(
  repo: AutonomousTickRepo,
  runners: EngineRunners,
  opts: { now?: Date; config?: Partial<TickConfig> } = {},
): Promise<TickReport | TickError> {
  const now = opts.now ?? new Date();
  const config: TickConfig = { ...DEFAULT_CONFIG, ...(opts.config ?? {}) };

  try {
    const orgs = await safe(() => repo.organization.findMany({ select: { id: true }, take: config.maxOrgsPerTick }), []);

    const perOrg: OrgTickReport[] = [];
    let totalRuns = 0;
    let okRuns = 0;
    let errorRuns = 0;
    let skippedRuns = 0;

    for (const org of orgs) {
      const orgReport: OrgTickReport = {
        organizationId: org.id,
        advisorRuns: [],
        triageRuns: [],
        remediationRuns: [],
        policyProposalRun: null,
      };

      // 1. Advisor for active releases.
      const releases = await safe(() =>
        repo.release.findMany({
          where: { organizationId: org.id, status: { in: ["draft", "ready", "deploying"] } },
          orderBy: { createdAt: "desc" },
          take: config.maxReleasesPerOrg,
        }),
        [] as ReleaseTickRow[],
      );

      for (const rel of releases) {
        const recent = await safe(() =>
          repo.advisorRecommendation.findFirst({
            where: { organizationId: org.id, releaseId: rel.id },
            orderBy: { generatedAt: "desc" },
          }),
          null,
        );
        if (recent && hoursSince(recent.generatedAt, now) < config.advisorMaxAgeHours) {
          orgReport.advisorRuns.push({ releaseId: rel.id, outcome: "skipped", reason: "recent_run_present" });
          skippedRuns += 1;
          totalRuns += 1;
          continue;
        }
        const result = await safeRun(() => runners.runAdvisor(org.id, rel.id));
        if (result.ok) { orgReport.advisorRuns.push({ releaseId: rel.id, outcome: "ok" }); okRuns += 1; }
        else { orgReport.advisorRuns.push({ releaseId: rel.id, outcome: "error", reason: result.reason }); errorRuns += 1; }
        totalRuns += 1;
      }

      // 2. Triage for open incidents.
      const incidents = await safe(() =>
        repo.deploymentIncident.findMany({
          where: { organizationId: org.id, status: { in: ["open", "mitigated"] } },
          orderBy: { reportedAt: "desc" },
          take: config.maxIncidentsPerOrg,
        }),
        [] as IncidentTickRow[],
      );

      for (const inc of incidents) {
        const recentTriage = await safe(() =>
          repo.incidentTriage.findFirst({
            where: { organizationId: org.id, incidentId: inc.id },
            orderBy: { generatedAt: "desc" },
          }),
          null,
        );
        if (!recentTriage || hoursSince(recentTriage.generatedAt, now) >= config.triageMaxAgeHours) {
          const result = await safeRun(() => runners.runTriage(org.id, inc.id));
          if (result.ok) { orgReport.triageRuns.push({ incidentId: inc.id, outcome: "ok" }); okRuns += 1; }
          else { orgReport.triageRuns.push({ incidentId: inc.id, outcome: "error", reason: result.reason }); errorRuns += 1; }
          totalRuns += 1;
        } else {
          orgReport.triageRuns.push({ incidentId: inc.id, outcome: "skipped", reason: "recent_run_present" });
          skippedRuns += 1;
          totalRuns += 1;
        }

        // 3. Remediation for open P0/P1 (we don't know the priority here
        //    without re-reading the triage, so we always try; aggregator
        //    will reject if no triage exists, and that becomes a "skipped"
        //    via the error surface).
        const recentRem = await safe(() =>
          repo.remediationProposal.findFirst({
            where: { organizationId: org.id, incidentId: inc.id },
            orderBy: { generatedAt: "desc" },
          }),
          null,
        );
        if (!recentRem || hoursSince(recentRem.generatedAt, now) >= config.remediationMaxAgeHours) {
          const result = await safeRun(() => runners.runRemediation(org.id, inc.id));
          if (result.ok) { orgReport.remediationRuns.push({ incidentId: inc.id, outcome: "ok" }); okRuns += 1; }
          else { orgReport.remediationRuns.push({ incidentId: inc.id, outcome: "error", reason: result.reason }); errorRuns += 1; }
          totalRuns += 1;
        }
      }

      // 4. Policy proposals — at most once per advisorMaxAgeHours.
      const recentPolicy = await safe(() =>
        repo.policyProposal.findFirst({
          where: { organizationId: org.id },
          orderBy: { generatedAt: "desc" },
        }),
        null,
      );
      if (!recentPolicy || hoursSince(recentPolicy.generatedAt, now) >= config.policyProposalMaxAgeHours) {
        const result = await safeRun(() => runners.runPolicyProposal(org.id));
        if (result.ok) { orgReport.policyProposalRun = { outcome: "ok" }; okRuns += 1; }
        else { orgReport.policyProposalRun = { outcome: "error", reason: result.reason }; errorRuns += 1; }
        totalRuns += 1;
      } else {
        orgReport.policyProposalRun = { outcome: "skipped", reason: "recent_run_present" };
        skippedRuns += 1;
        totalRuns += 1;
      }

      perOrg.push(orgReport);
    }

    return {
      ok: true,
      generatedAtIso: now.toISOString(),
      orgCount: orgs.length,
      totalRuns,
      okRuns,
      errorRuns,
      skippedRuns,
      perOrg,
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return { ok: false, error: "migration_pending", hint: "Autonomous tick depends on the AGI tables (advisor/triage/remediation/policy-proposal)." };
    }
    return { ok: false, error: "internal_error", hint: err instanceof Error ? err.message : "unknown" };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Internal helpers.
   ────────────────────────────────────────────────────────────── */

function hoursSince(then: Date, now: Date): number {
  return (now.getTime() - then.getTime()) / 3_600_000;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); }
  catch (err) { if (isMissingTable(err)) return fallback; throw err; }
}

async function safeRun(fn: () => Promise<EngineRunResult>): Promise<EngineRunResult> {
  try { return await fn(); }
  catch (err) { return { ok: false, reason: err instanceof Error ? err.message : "unknown" }; }
}
