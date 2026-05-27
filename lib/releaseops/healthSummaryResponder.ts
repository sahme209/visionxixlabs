/**
 * Phase 490 — ReleaseOps platform health summary.
 *
 * Cross-subsystem aggregation for the operator landing surface. One
 * round-trip, every count an auditor needs at a glance:
 *
 *   - Releases by status (draft / ready / deploying / deployed)
 *   - Open blocking policy violations
 *   - Open critical drift findings
 *   - Pending cherry-pick exceptions (status=requested)
 *   - Pending change tickets (status=pending / in_progress)
 *   - Average readiness score across the latest snapshot per release
 *
 * Each count is a `count()` query — cheap, indexable, no full-row
 * loads. The dashboard tile renders this once per page load.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface HealthSummaryRepo {
  release: {
    count(args: { where: { organizationId: string; status?: string } }): Promise<number>;
    findMany(args: { where: { organizationId: string }; select: { id: true } }): Promise<Array<{ id: string }>>;
  };
  policyViolation: {
    count(args: {
      where: {
        organizationId: string;
        status?: "open";
        rule?: { blocking: boolean };
      };
    }): Promise<number>;
  };
  driftFinding: {
    count(args: {
      where: { organizationId: string; status?: "open"; severity?: "critical" };
    }): Promise<number>;
  };
  cherryPickException: {
    count(args: {
      where: { organizationId: string; status?: "requested" };
    }): Promise<number>;
  };
  changeTicket: {
    count(args: {
      where: { organizationId: string; status?: { in: Array<"pending" | "in_progress"> } };
    }): Promise<number>;
  };
  releaseReadinessSnapshot: {
    findFirst(args: {
      where: { releaseId: string };
      orderBy: { evaluatedAt: "desc" };
    }): Promise<{ overallScore: number } | null>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface HealthSummaryBody {
  ok: true;
  data: {
    generatedAt: string;
    releases: {
      total: number;
      draft: number;
      ready: number;
      deploying: number;
      deployed: number;
    };
    policy: {
      blockingOpen: number;
    };
    drift: {
      criticalOpen: number;
    };
    cherryPicks: {
      requested: number;
    };
    changeTickets: {
      inFlight: number;
    };
    readiness: {
      evaluated: number;
      averageScore: number | null;
    };
    /** Headline score 0-100 — composite of readiness avg minus
     *  open-issue penalties. Surfaces in the dashboard hero. */
    platformHealthScore: number;
  };
}

export type HealthSummaryResponseBody =
  | HealthSummaryBody
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: HealthSummaryResponseBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildHealthSummaryResponse(
  repo: HealthSummaryRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();

    const [
      totalReleases,
      draftReleases,
      readyReleases,
      deployingReleases,
      deployedReleases,
      blockingOpen,
      criticalDriftOpen,
      cherryPicksRequested,
      ticketsInFlight,
      releases,
    ] = await Promise.all([
      repo.release.count({ where: { organizationId } }),
      repo.release.count({ where: { organizationId, status: "draft" } }),
      repo.release.count({ where: { organizationId, status: "ready" } }),
      repo.release.count({ where: { organizationId, status: "deploying" } }),
      repo.release.count({ where: { organizationId, status: "deployed" } }),
      repo.policyViolation.count({ where: { organizationId, status: "open", rule: { blocking: true } } }),
      repo.driftFinding.count({ where: { organizationId, status: "open", severity: "critical" } }),
      repo.cherryPickException.count({ where: { organizationId, status: "requested" } }),
      repo.changeTicket.count({ where: { organizationId, status: { in: ["pending", "in_progress"] } } }),
      repo.release.findMany({ where: { organizationId }, select: { id: true } }),
    ]);

    // Average readiness across the latest snapshot per release.
    let scoreSum = 0;
    let evaluated = 0;
    for (const r of releases) {
      const snap = await repo.releaseReadinessSnapshot.findFirst({
        where: { releaseId: r.id },
        orderBy: { evaluatedAt: "desc" },
      });
      if (snap) {
        scoreSum += snap.overallScore;
        evaluated += 1;
      }
    }
    const averageScore = evaluated > 0 ? Math.round(scoreSum / evaluated) : null;

    // Composite platform health: readiness avg minus issue penalties.
    // Clamped 0-100; every blocker subtracts 8, every critical drift
    // subtracts 5, every pending cherry-pick subtracts 3.
    const baseScore = averageScore ?? 70;
    const penalty =
      blockingOpen * 8 + criticalDriftOpen * 5 + cherryPicksRequested * 3;
    const platformHealthScore = Math.max(0, Math.min(100, baseScore - penalty));

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          releases: {
            total: totalReleases,
            draft: draftReleases,
            ready: readyReleases,
            deploying: deployingReleases,
            deployed: deployedReleases,
          },
          policy: { blockingOpen },
          drift: { criticalOpen: criticalDriftOpen },
          cherryPicks: { requested: cherryPicksRequested },
          changeTickets: { inFlight: ticketsInFlight },
          readiness: { evaluated, averageScore },
          platformHealthScore,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 442 / 466 / 486 migrations all required for the platform summary." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
