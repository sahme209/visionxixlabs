/**
 * Phase 475 — evidence pack generate + persist orchestrator.
 *
 * Loads the release + repository + readiness + PRs + tickets +
 * cherry-picks for one release, calls generateEvidencePack, and
 * upserts the row into ReleaseEvidencePack. Pure helpers (the
 * generator, the branch-validation evaluator) stay testable; the
 * Prisma plumbing lives here behind a structural Repo contract.
 */

import { isMissingTable } from "./releaseListResponder";
import {
  generateEvidencePack,
  type EvidencePackGeneratorInput,
  type EvidencePackInputPr,
  type EvidencePackInputCherryPick,
  type EvidencePackInputTicket,
  type EvidencePackInputReadiness,
  type EvidencePackInputRelease,
  type EvidencePackInputRepository,
  type EvidencePackContent,
} from "./evidencePackGenerator";

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface EvidencePackRepoRelease extends EvidencePackInputRelease {}
export interface EvidencePackRepoRepository extends EvidencePackInputRepository {}
export interface EvidencePackRepoPr extends EvidencePackInputPr {
  organizationId: string;
  repositoryId: string;
}
export interface EvidencePackRepoCherryPick extends EvidencePackInputCherryPick {
  organizationId: string;
  releaseId: string;
}
export interface EvidencePackRepoTicket extends EvidencePackInputTicket {
  organizationId: string;
  linkedReleaseIds: string[];
}
export interface EvidencePackRepoReadiness extends EvidencePackInputReadiness {
  releaseId: string;
}

export interface EvidencePackRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<EvidencePackRepoRelease | null>;
  };
  repository: {
    findUnique(args: { where: { id: string } }): Promise<EvidencePackRepoRepository | null>;
  };
  releaseReadinessSnapshot: {
    findFirst(args: {
      where: { releaseId: string };
      orderBy: { evaluatedAt: "desc" };
    }): Promise<EvidencePackRepoReadiness | null>;
  };
  pullRequestRecord: {
    findMany(args: {
      where: { organizationId: string; repositoryId: string };
      orderBy: { updatedAt: "desc" };
      take?: number;
    }): Promise<EvidencePackRepoPr[]>;
  };
  cherryPickException: {
    findMany(args: {
      where: { organizationId: string; releaseId: string };
      orderBy: { requestedAt: "desc" };
    }): Promise<EvidencePackRepoCherryPick[]>;
  };
  changeTicket: {
    findMany(args: {
      where: { organizationId: string; linkedReleaseIds: { has: string } };
    }): Promise<EvidencePackRepoTicket[]>;
  };
  releaseEvidencePack: {
    upsert(args: {
      where: { releaseId: string };
      create: {
        organizationId: string;
        releaseId: string;
        contentJson: EvidencePackContent;
        contentHash: string;
      };
      update: {
        contentJson: EvidencePackContent;
        contentHash: string;
        generatedAt: Date;
      };
    }): Promise<{ id: string }>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildEvidencePackInput {
  organizationId: string;
  releaseId: string;
  repositoryId?: string;
  prCap?: number;
}

export type EvidencePackBody =
  | {
      ok: true;
      data: {
        evidencePackId: string;
        contentHash: string;
        generatedAtIso: string;
        summary: {
          prCount: number;
          cherryPickCount: number;
          linkedTicketCount: number;
          branchTotal: number;
          branchPassing: number;
          branchFailing: number;
        };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: EvidencePackBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildEvidencePackResponse(
  repo: EvidencePackRepo,
  input: BuildEvidencePackInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();

    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release) {
      return { status: 404, body: { ok: false, error: "release_not_found" } };
    }
    if (release.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }

    let repository: EvidencePackRepoRepository | null = null;
    if (input.repositoryId) {
      repository = await repo.repository.findUnique({ where: { id: input.repositoryId } });
      if (!repository) {
        return { status: 404, body: { ok: false, error: "repository_not_found" } };
      }
    }

    const [readiness, cherryPicks, linkedTickets, prs] = await Promise.all([
      repo.releaseReadinessSnapshot.findFirst({
        where: { releaseId: release.id },
        orderBy: { evaluatedAt: "desc" },
      }),
      repo.cherryPickException.findMany({
        where: { organizationId: input.organizationId, releaseId: release.id },
        orderBy: { requestedAt: "desc" },
      }),
      repo.changeTicket.findMany({
        where: { organizationId: input.organizationId, linkedReleaseIds: { has: release.id } },
      }),
      repository
        ? repo.pullRequestRecord.findMany({
            where: { organizationId: input.organizationId, repositoryId: repository.id },
            orderBy: { updatedAt: "desc" },
            take: input.prCap ?? 200,
          })
        : Promise.resolve([] as EvidencePackRepoPr[]),
    ]);

    const generatorInput: EvidencePackGeneratorInput = {
      release,
      repository,
      latestReadiness: readiness,
      prs,
      cherryPicks,
      linkedTickets,
      // The branch-validation evaluator needs single-PR context (the
      // PR being deployed). The aggregated pack records the
      // already-evaluated check list from the per-release detail page
      // if present, but here we leave it empty — the next phase wires
      // the kernel up to the pack generator end-to-end.
      branchChecks: [],
    };

    const { content, contentHash } = generateEvidencePack(generatorInput, { now });

    const pack = await repo.releaseEvidencePack.upsert({
      where: { releaseId: release.id },
      create: {
        organizationId: input.organizationId,
        releaseId: release.id,
        contentJson: content,
        contentHash,
      },
      update: {
        contentJson: content,
        contentHash,
        generatedAt: now,
      },
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          evidencePackId: pack.id,
          contentHash,
          generatedAtIso: now.toISOString(),
          summary: {
            prCount: prs.length,
            cherryPickCount: cherryPicks.length,
            linkedTicketCount: linkedTickets.length,
            branchTotal: content.branchValidation.total,
            branchPassing: content.branchValidation.passing,
            branchFailing: content.branchValidation.failing,
          },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return { status: 503, body: { ok: false, error: "migration_pending", hint: "Phase 442 / 466 migrations must be applied for evidence packs." } };
    }
    return { status: 500, body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) } };
  }
}
