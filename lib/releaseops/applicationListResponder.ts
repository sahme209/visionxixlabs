/**
 * Phase 493 — application inventory responder.
 *
 * Reads the Application rows (Phase 441 model, migrated in Phase 466)
 * and enriches each with component + repository counts so the
 * dashboard shows operators what apps the platform tracks before
 * they wire repos and releases to them.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Row + repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ApplicationRow {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  ownerTeamLabel: string | null;
  businessTier: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationListRepo {
  application: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { name: "asc" };
    }): Promise<ApplicationRow[]>;
  };
  component: {
    count(args: { where: { organizationId: string; applicationId: string } }): Promise<number>;
  };
  release: {
    count(args: { where: { organizationId: string; applicationId: string; status?: string } }): Promise<number>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface ApplicationListRow {
  id: string;
  slug: string;
  name: string;
  ownerTeamLabel: string | null;
  businessTier: string | null;
  description: string | null;
  componentCount: number;
  releaseCount: number;
  releasesDeployed: number;
  createdAtIso: string;
}

export type ApplicationListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        applications: ApplicationListRow[];
        summary: {
          total: number;
          withReleases: number;
          totalComponents: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ApplicationListBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildApplicationListResponse(
  repo: ApplicationListRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const rows = await repo.application.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });

    const enriched: ApplicationListRow[] = await Promise.all(rows.map(async (a) => {
      const [componentCount, releaseCount, releasesDeployed] = await Promise.all([
        repo.component.count({ where: { organizationId, applicationId: a.id } }),
        repo.release.count({ where: { organizationId, applicationId: a.id } }),
        repo.release.count({ where: { organizationId, applicationId: a.id, status: "deployed" } }),
      ]);
      return {
        id: a.id,
        slug: a.slug,
        name: a.name,
        ownerTeamLabel: a.ownerTeamLabel,
        businessTier: a.businessTier,
        description: a.description,
        componentCount,
        releaseCount,
        releasesDeployed,
        createdAtIso: a.createdAt.toISOString(),
      };
    }));

    let totalComponents = 0;
    let withReleases = 0;
    for (const a of enriched) {
      totalComponents += a.componentCount;
      if (a.releaseCount > 0) withReleases += 1;
    }

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          applications: enriched,
          summary: { total: enriched.length, withReleases, totalComponents },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Application table needs Phase 466 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
