/**
 * Phase 499 — branch protection snapshot.
 *
 * Pure projector turns a GitHub branch-protection API payload into a
 * normalized snapshot row. The refresh responder upserts on
 * (repositoryId, branchName). The list responder serves a per-repo
 * inbox the dashboard renders.
 *
 * The GitHub API fetch itself ships in a follow-on phase — until
 * then, operators can POST raw JSON they've pulled by hand (curl
 * https://api.github.com/repos/{owner}/{repo}/branches/{branch}/protection)
 * or the platform's later sync job will call into this same projector.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const PROTECTION_STRENGTHS = ["strong", "weak", "none"] as const;
export type ProtectionStrength = (typeof PROTECTION_STRENGTHS)[number];

/* ──────────────────────────────────────────────────────────────────
   Pure projector.
   ────────────────────────────────────────────────────────────── */

export interface ProjectedProtection {
  strength: ProtectionStrength;
  requiresPullRequest: boolean;
  requiredReviewCount: number;
  dismissStaleReviews: boolean;
  requireCodeOwnerReviews: boolean;
  requiresStatusChecks: boolean;
  requiredStatusCheckContexts: string[];
  requiresSignedCommits: boolean;
  requiresLinearHistory: boolean;
  enforceAdmins: boolean;
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
}

/**
 * Project a GitHub branch protection API payload into the normalized
 * snapshot shape. Tolerates partial/legacy payloads by defaulting
 * everything off.
 */
export function projectGitHubBranchProtection(payload: unknown): ProjectedProtection {
  const flat = (payload ?? {}) as Record<string, unknown>;
  const prReviews = (flat.required_pull_request_reviews ?? {}) as Record<string, unknown>;
  const statusChecks = (flat.required_status_checks ?? {}) as Record<string, unknown>;
  const enforceAdminsRaw = flat.enforce_admins;
  const allowForce = flat.allow_force_pushes;
  const allowDeletions = flat.allow_deletions;
  const signedCommits = flat.required_signatures;
  const linear = flat.required_linear_history;

  const requiresPullRequest = Object.keys(prReviews).length > 0;
  const requiredReviewCount = typeof prReviews.required_approving_review_count === "number"
    ? prReviews.required_approving_review_count
    : (requiresPullRequest ? 1 : 0);
  const dismissStaleReviews = Boolean(prReviews.dismiss_stale_reviews);
  const requireCodeOwnerReviews = Boolean(prReviews.require_code_owner_reviews);

  const requiresStatusChecks = Array.isArray(statusChecks.contexts)
    ? (statusChecks.contexts as unknown[]).length > 0
    : false;
  const requiredStatusCheckContexts = Array.isArray(statusChecks.contexts)
    ? (statusChecks.contexts as unknown[]).filter((c): c is string => typeof c === "string")
    : [];

  const requiresSignedCommits = readEnabled(signedCommits);
  const requiresLinearHistory = readEnabled(linear);
  const enforceAdmins = readEnabled(enforceAdminsRaw);
  const allowsForcePushes = readEnabled(allowForce);
  const allowsDeletions = readEnabled(allowDeletions);

  const strength = computeStrength({
    requiresPullRequest, requiredReviewCount, requiresStatusChecks, requiresSignedCommits,
    allowsForcePushes, allowsDeletions, enforceAdmins,
  });

  return {
    strength,
    requiresPullRequest, requiredReviewCount, dismissStaleReviews, requireCodeOwnerReviews,
    requiresStatusChecks, requiredStatusCheckContexts,
    requiresSignedCommits, requiresLinearHistory, enforceAdmins,
    allowsForcePushes, allowsDeletions,
  };
}

function readEnabled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "enabled" in (value as Record<string, unknown>)) {
    return Boolean((value as { enabled: unknown }).enabled);
  }
  return false;
}

function computeStrength(s: {
  requiresPullRequest: boolean;
  requiredReviewCount: number;
  requiresStatusChecks: boolean;
  requiresSignedCommits: boolean;
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
  enforceAdmins: boolean;
}): ProtectionStrength {
  if (!s.requiresPullRequest && !s.requiresStatusChecks) return "none";
  // Force-push or deletion allowed nukes any pretense of strong.
  if (s.allowsForcePushes || s.allowsDeletions) return "weak";
  const strongPr = s.requiresPullRequest && s.requiredReviewCount >= 2;
  const okPr = s.requiresPullRequest && s.requiredReviewCount >= 1;
  if (strongPr && s.requiresStatusChecks && s.requiresSignedCommits && s.enforceAdmins) return "strong";
  if (okPr || s.requiresStatusChecks) return "weak";
  return "none";
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface RepositoryRow {
  id: string;
  organizationId: string;
  remoteOwner: string;
  remoteName: string;
}

export interface BranchProtectionRow {
  id: string;
  organizationId: string;
  repositoryId: string;
  branchName: string;
  strength: string;
  requiresPullRequest: boolean;
  requiredReviewCount: number;
  dismissStaleReviews: boolean;
  requireCodeOwnerReviews: boolean;
  requiresStatusChecks: boolean;
  requiredStatusCheckContexts: string[];
  requiresSignedCommits: boolean;
  requiresLinearHistory: boolean;
  enforceAdmins: boolean;
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
  source: string;
  fetchedAt: Date;
  updatedAt: Date;
}

export interface BranchProtectionRepo {
  repository: {
    findUnique(args: { where: { id: string } }): Promise<RepositoryRow | null>;
  };
  branchProtectionSnapshot: {
    upsert(args: {
      where: { repositoryId_branchName: { repositoryId: string; branchName: string } };
      create: {
        organizationId: string;
        repositoryId: string;
        branchName: string;
        strength: string;
        requiresPullRequest: boolean;
        requiredReviewCount: number;
        dismissStaleReviews: boolean;
        requireCodeOwnerReviews: boolean;
        requiresStatusChecks: boolean;
        requiredStatusCheckContexts: string[];
        requiresSignedCommits: boolean;
        requiresLinearHistory: boolean;
        enforceAdmins: boolean;
        allowsForcePushes: boolean;
        allowsDeletions: boolean;
        source: string;
        rawJson: unknown;
      };
      update: {
        strength: string;
        requiresPullRequest: boolean;
        requiredReviewCount: number;
        dismissStaleReviews: boolean;
        requireCodeOwnerReviews: boolean;
        requiresStatusChecks: boolean;
        requiredStatusCheckContexts: string[];
        requiresSignedCommits: boolean;
        requiresLinearHistory: boolean;
        enforceAdmins: boolean;
        allowsForcePushes: boolean;
        allowsDeletions: boolean;
        source: string;
        rawJson: unknown;
        fetchedAt: Date;
      };
    }): Promise<BranchProtectionRow>;
    findMany(args: {
      where: { organizationId: string; repositoryId?: string };
      orderBy: { branchName: "asc" };
    }): Promise<BranchProtectionRow[]>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Refresh (upsert).
   ────────────────────────────────────────────────────────────── */

export interface RefreshInput {
  organizationId: string;
  repositoryId: string;
  branchName: string;
  payload: unknown;
  source?: "github_api" | "manual" | "import";
}

export type RefreshError =
  | "branch_name_required"
  | "repository_not_found"
  | "cross_org_repository";

export type RefreshBody =
  | {
      ok: true;
      data: {
        repositoryId: string;
        branchName: string;
        strength: ProtectionStrength;
        snapshot: ProjectedProtection;
      };
    }
  | { ok: false; error: RefreshError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface RefreshResult { status: number; body: RefreshBody }

export async function buildBranchProtectionRefreshResponse(
  repo: BranchProtectionRepo,
  input: RefreshInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<RefreshResult> {
  const branch = input.branchName?.trim() ?? "";
  if (!branch) return { status: 422, body: { ok: false, error: "branch_name_required" } };

  try {
    const r = await repo.repository.findUnique({ where: { id: input.repositoryId } });
    if (!r) return { status: 404, body: { ok: false, error: "repository_not_found" } };
    if (r.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_repository" } };
    }

    const projected = projectGitHubBranchProtection(input.payload);
    const source = input.source ?? "github_api";
    const now = opts.now ?? new Date();

    await repo.branchProtectionSnapshot.upsert({
      where: { repositoryId_branchName: { repositoryId: r.id, branchName: branch } },
      create: {
        organizationId: r.organizationId,
        repositoryId: r.id,
        branchName: branch,
        ...projected,
        source,
        rawJson: input.payload as object,
      },
      update: {
        ...projected,
        source,
        rawJson: input.payload as object,
        fetchedAt: now,
      },
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          repositoryId: r.id,
          branchName: branch,
          strength: projected.strength,
          snapshot: projected,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "BranchProtectionSnapshot table needs Phase 499 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   List.
   ────────────────────────────────────────────────────────────── */

export interface BranchProtectionView {
  id: string;
  repositoryId: string;
  branchName: string;
  strength: ProtectionStrength | "unknown";
  requiresPullRequest: boolean;
  requiredReviewCount: number;
  requiresStatusChecks: boolean;
  requiredStatusCheckContexts: string[];
  requiresSignedCommits: boolean;
  allowsForcePushes: boolean;
  source: string;
  fetchedAtIso: string;
}

function isStrength(s: string): s is ProtectionStrength {
  return (PROTECTION_STRENGTHS as readonly string[]).includes(s);
}

function projectRow(r: BranchProtectionRow): BranchProtectionView {
  return {
    id: r.id,
    repositoryId: r.repositoryId,
    branchName: r.branchName,
    strength: isStrength(r.strength) ? r.strength : "unknown",
    requiresPullRequest: r.requiresPullRequest,
    requiredReviewCount: r.requiredReviewCount,
    requiresStatusChecks: r.requiresStatusChecks,
    requiredStatusCheckContexts: r.requiredStatusCheckContexts,
    requiresSignedCommits: r.requiresSignedCommits,
    allowsForcePushes: r.allowsForcePushes,
    source: r.source,
    fetchedAtIso: r.fetchedAt.toISOString(),
  };
}

export type ListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        snapshots: BranchProtectionView[];
        summary: { total: number; strong: number; weak: number; none: number };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: ListBody }

export async function buildBranchProtectionListResponse(
  repo: BranchProtectionRepo,
  input: { organizationId: string; repositoryId?: string },
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const where: { organizationId: string; repositoryId?: string } = { organizationId: input.organizationId };
    if (input.repositoryId) where.repositoryId = input.repositoryId;
    const rows = await repo.branchProtectionSnapshot.findMany({ where, orderBy: { branchName: "asc" } });
    const snapshots = rows.map(projectRow);
    let strong = 0, weak = 0, none = 0;
    for (const s of snapshots) {
      if (s.strength === "strong") strong += 1;
      else if (s.strength === "weak") weak += 1;
      else if (s.strength === "none") none += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          snapshots,
          summary: { total: snapshots.length, strong, weak, none },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "BranchProtectionSnapshot table needs Phase 499 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
