/**
 * Phase 459 — repository inventory responder.
 *
 * Returns the org's Repository rows (Phase 441 model) with their
 * latest activity summary attached: recent tag count, recent PR
 * activity, latest workflow status.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Row + repo contract.
   ────────────────────────────────────────────────────────────── */

export interface RepositoryRow {
  id: string;
  organizationId: string;
  provider: "github" | "gitlab" | "azuredevops" | "other";
  remoteOwner: string;
  remoteName: string;
  remoteUrl: string;
  defaultBranch: string;
  protectedBranches: string[];
  codeownersPresent: boolean;
  prTemplatePresent: boolean;
  repoFlavor: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RepositoryListRepo {
  repository: {
    findMany(args: {
      where: { organizationId: string };
      orderBy: { remoteName: "asc" };
    }): Promise<RepositoryRow[]>;
  };
  pullRequestRecord: {
    count(args: { where: { organizationId: string; repositoryId: string; state?: "open" } }): Promise<number>;
  };
  releaseTagRecord: {
    count(args: { where: { organizationId: string; repositoryId: string } }): Promise<number>;
  };
  workflowRunRecord: {
    findFirst(args: {
      where: { organizationId: string; repositoryId: string };
      orderBy: { startedAt: "desc" };
    }): Promise<{ status: string; conclusion: string | null; workflowName: string; startedAt: Date | null } | null>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface RepositoryListRow {
  id: string;
  provider: RepositoryRow["provider"];
  displayName: string;
  remoteUrl: string;
  defaultBranch: string;
  protectionStrength: "strong" | "weak" | "none";
  flavorBadge: string | null;
  openPrCount: number;
  recentTagCount: number;
  lastWorkflow: {
    name: string;
    state: "queued" | "in_progress" | "completed";
    conclusion: string | null;
    /** ISO timestamp of startedAt, null when never observed. */
    startedAtIso: string | null;
  } | null;
}

export type ListBody =
  | { ok: true; data: { generatedAt: string; repositories: RepositoryListRow[]; summary: { total: number; byProvider: Record<string, number>; weakProtection: number } } }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ListBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildRepositoryListResponse(
  repo: RepositoryListRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const rows = await repo.repository.findMany({
      where: { organizationId },
      orderBy: { remoteName: "asc" },
    });
    const enriched: RepositoryListRow[] = await Promise.all(rows.map(async (r) => {
      const [openPrCount, recentTagCount, lastRun] = await Promise.all([
        repo.pullRequestRecord.count({ where: { organizationId, repositoryId: r.id, state: "open" } }),
        repo.releaseTagRecord.count({ where: { organizationId, repositoryId: r.id } }),
        repo.workflowRunRecord.findFirst({
          where: { organizationId, repositoryId: r.id },
          orderBy: { startedAt: "desc" },
        }),
      ]);
      return {
        id: r.id,
        provider: r.provider,
        displayName: `${r.remoteOwner}/${r.remoteName}`,
        remoteUrl: r.remoteUrl,
        defaultBranch: r.defaultBranch,
        protectionStrength: classifyProtection(r),
        flavorBadge: r.repoFlavor,
        openPrCount,
        recentTagCount,
        lastWorkflow: lastRun
          ? {
              name: lastRun.workflowName,
              state: lastRun.status as "queued" | "in_progress" | "completed",
              conclusion: lastRun.conclusion,
              startedAtIso: lastRun.startedAt ? lastRun.startedAt.toISOString() : null,
            }
          : null,
      };
    }));
    const byProvider: Record<string, number> = {};
    let weakProtection = 0;
    for (const r of enriched) {
      byProvider[r.provider] = (byProvider[r.provider] ?? 0) + 1;
      if (r.protectionStrength !== "strong") weakProtection += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          repositories: enriched,
          summary: { total: enriched.length, byProvider, weakProtection },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase A migration not applied yet." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

export function classifyProtection(r: RepositoryRow): "strong" | "weak" | "none" {
  if (r.protectedBranches.length === 0) return "none";
  if (r.codeownersPresent && r.prTemplatePresent) return "strong";
  return "weak";
}
