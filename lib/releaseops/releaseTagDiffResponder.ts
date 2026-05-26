/**
 * Phase 456 — release-tag diff responder.
 *
 * Pure response builder for the dashboard + public v1 routes. Given
 * a repositoryId + a target tag name, finds the previous tag and
 * computes the diff via Phase 451's diffReleaseTags helper, then
 * enriches the projected PR ids with PullRequestRecord rows for
 * the UI.
 */

import {
  diffReleaseTags,
  listReleaseTagsForRepo,
  type GitDiscoveryRepo,
  type ReleaseTagDiffSummary,
  type ReleaseTagRecordRow,
} from "./gitDiscoveryRepo";
import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Output shape.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseTagDiffResponseBody {
  ok: true;
  data: {
    generatedAt: string;
    diff: ReleaseTagDiffSummary;
    /** Optional projection of PR titles for the newly-included list. */
    newlyIncludedPrs: ReadonlyArray<{ id: string; title?: string; webUrl?: string }>;
    droppedPrs: ReadonlyArray<{ id: string; title?: string; webUrl?: string }>;
  };
}

export type ResponseBody =
  | ReleaseTagDiffResponseBody
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult {
  status: number;
  body: ResponseBody;
}

/* ──────────────────────────────────────────────────────────────────
   Extended repo contract — adds the PR enrichment lookup.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseTagDiffRepo extends GitDiscoveryRepo {
  pullRequestRecord: GitDiscoveryRepo["pullRequestRecord"] & {
    findByIds(ids: ReadonlyArray<string>): Promise<ReadonlyArray<{ id: string; title?: string; webUrl?: string }>>;
  };
}

export interface BuildDiffOptions {
  /** ISO clock override for deterministic UI rendering in tests. */
  now?: Date;
  correlationId?: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildReleaseTagDiffResponse(
  repo: ReleaseTagDiffRepo,
  args: {
    organizationId: string;
    repositoryId: string;
    /** Target (newer) tag name. */
    toTag: string;
    /** Override the from-tag if the caller wants to compare against an arbitrary previous version. */
    fromTagOverride?: string;
  },
  opts: BuildDiffOptions = {},
): Promise<ResponderResult> {
  try {
    const now = opts.now ?? new Date();
    const recent = await listReleaseTagsForRepo(repo, {
      organizationId: args.organizationId,
      repositoryId: args.repositoryId,
      take: 50,
    });
    const to = recent.find((t) => t.tagName === args.toTag);
    if (!to) {
      return {
        status: 404,
        body: { ok: false, error: "to_tag_not_found", hint: `No release tag ${args.toTag} in this repository.` },
      };
    }
    const from = args.fromTagOverride
      ? recent.find((t) => t.tagName === args.fromTagOverride)
      : findPreviousTag(recent, to);
    if (!from) {
      return {
        status: 404,
        body: {
          ok: false,
          error: "from_tag_not_found",
          hint: args.fromTagOverride
            ? `No release tag ${args.fromTagOverride} in this repository.`
            : "No prior release tag found to diff against. Tag a baseline first.",
        },
      };
    }

    const summary = diffReleaseTags(from, to);
    const enrichIds = Array.from(new Set([...summary.newlyIncludedPrIds, ...summary.droppedPrIds]));
    const prs = await repo.pullRequestRecord.findByIds(enrichIds);
    const byId = new Map(prs.map((p) => [p.id, p]));

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          diff: summary,
          newlyIncludedPrs: summary.newlyIncludedPrIds.map((id) => byId.get(id) ?? { id }),
          droppedPrs: summary.droppedPrIds.map((id) => byId.get(id) ?? { id }),
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: {
          ok: false, error: "migration_pending",
          hint: "Git/CI-CD discovery tables aren't migrated yet.",
        },
      };
    }
    return {
      status: 500,
      body: {
        ok: false, error: "internal_error",
        ...(opts.correlationId ? { correlationId: opts.correlationId } : {}),
      },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Internals.
   ────────────────────────────────────────────────────────────── */

/**
 * Returns the closest older tag in `recent` (which is newest-first
 * per listReleaseTagsForRepo). Returns null if `to` is the oldest or
 * not in the list.
 */
function findPreviousTag(
  recent: ReadonlyArray<ReleaseTagRecordRow>,
  to: ReleaseTagRecordRow,
): ReleaseTagRecordRow | undefined {
  const idx = recent.findIndex((t) => t.id === to.id);
  if (idx === -1) return undefined;
  // recent is sorted newest-first; the previous tag is the next index.
  return recent[idx + 1];
}
