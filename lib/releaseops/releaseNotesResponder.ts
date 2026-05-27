/**
 * Phase 500 — release notes draft responder.
 *
 * Pure state machine over the ReleaseNotesDraft table:
 *   • buildReleaseNotesUpsertResponse   — create or replace bullets/headline (only legal in 'draft')
 *   • buildReleaseNotesTransitionResponse — draft → reviewed → published (reject-by-default)
 *   • buildReleaseNotesListResponse     — chronological inbox
 *   • buildReleaseNotesReadResponse     — single-release fetch
 *
 * The AI generator (lib/releaseops/aiReleaseNoteGenerator.ts) writes
 * into this table via the upsert path with source="ai".
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-unions.
   ────────────────────────────────────────────────────────────── */

export const RELEASE_NOTES_STATUSES = ["draft", "reviewed", "published"] as const;
export type ReleaseNotesStatus = (typeof RELEASE_NOTES_STATUSES)[number];

export const RELEASE_NOTES_TRANSITIONS = ["review", "publish", "revoke"] as const;
export type ReleaseNotesTransition = (typeof RELEASE_NOTES_TRANSITIONS)[number];

export const RELEASE_NOTES_SOURCES = ["manual", "ai", "imported"] as const;
export type ReleaseNotesSource = (typeof RELEASE_NOTES_SOURCES)[number];

function isStatus(s: string): s is ReleaseNotesStatus {
  return (RELEASE_NOTES_STATUSES as readonly string[]).includes(s);
}
function isSource(s: string): s is ReleaseNotesSource {
  return (RELEASE_NOTES_SOURCES as readonly string[]).includes(s);
}

/* ──────────────────────────────────────────────────────────────────
   State machine — pure.
   ────────────────────────────────────────────────────────────── */

export interface TransitionPlan {
  ok: true;
  next: ReleaseNotesStatus;
  fields: Partial<{
    reviewedByUserId: string;
    reviewedAt: Date;
    publishedByUserId: string | null;
    publishedAt: Date | null;
    publishedUrl: string | null;
  }>;
}

export interface TransitionReject {
  ok: false;
  from: ReleaseNotesStatus;
  action: ReleaseNotesTransition;
  reason: "illegal_transition";
}

export function planTransition(
  current: ReleaseNotesStatus,
  action: ReleaseNotesTransition,
  ctx: { actorUserId: string; now: Date; publishedUrl?: string },
): TransitionPlan | TransitionReject {
  if (action === "review") {
    if (current !== "draft") return { ok: false, from: current, action, reason: "illegal_transition" };
    return { ok: true, next: "reviewed", fields: { reviewedByUserId: ctx.actorUserId, reviewedAt: ctx.now } };
  }
  if (action === "publish") {
    if (current !== "reviewed") return { ok: false, from: current, action, reason: "illegal_transition" };
    return {
      ok: true,
      next: "published",
      fields: {
        publishedByUserId: ctx.actorUserId,
        publishedAt: ctx.now,
        publishedUrl: ctx.publishedUrl ?? null,
      },
    };
  }
  if (action === "revoke") {
    // Revoke is only valid from reviewed (back to draft). Published is sealed.
    if (current !== "reviewed") return { ok: false, from: current, action, reason: "illegal_transition" };
    return {
      ok: true,
      next: "draft",
      fields: { reviewedByUserId: undefined, reviewedAt: undefined },
    };
  }
  return { ok: false, from: current, action, reason: "illegal_transition" };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseLookupRow { id: string; organizationId: string }

export interface DraftRow {
  id: string;
  organizationId: string;
  releaseId: string;
  status: string;
  bulletsJson: unknown;
  headline: string | null;
  source: string;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  publishedByUserId: string | null;
  publishedAt: Date | null;
  publishedUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReleaseNotesRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<ReleaseLookupRow | null>;
  };
  releaseNotesDraft: {
    findUnique(args: { where: { releaseId: string } }): Promise<DraftRow | null>;
    findMany(args: {
      where: { organizationId: string; status?: string };
      orderBy: { updatedAt: "desc" };
      take?: number;
    }): Promise<DraftRow[]>;
    upsert(args: {
      where: { releaseId: string };
      create: {
        organizationId: string;
        releaseId: string;
        status: "draft";
        bulletsJson: unknown;
        headline: string | null;
        source: ReleaseNotesSource;
      };
      update: {
        bulletsJson: unknown;
        headline: string | null;
        source: ReleaseNotesSource;
      };
    }): Promise<DraftRow>;
    update(args: {
      where: { id: string };
      data: {
        status: ReleaseNotesStatus;
        reviewedByUserId?: string | null;
        reviewedAt?: Date | null;
        publishedByUserId?: string | null;
        publishedAt?: Date | null;
        publishedUrl?: string | null;
      };
    }): Promise<DraftRow>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Projection.
   ────────────────────────────────────────────────────────────── */

export interface ReleaseNotesView {
  id: string;
  releaseId: string;
  status: ReleaseNotesStatus | "unknown";
  bullets: string[];
  headline: string | null;
  source: ReleaseNotesSource | "unknown";
  reviewedByUserId: string | null;
  reviewedAtIso: string | null;
  publishedByUserId: string | null;
  publishedAtIso: string | null;
  publishedUrl: string | null;
  createdAtIso: string;
  updatedAtIso: string;
}

function normalizeBullets(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is string => typeof b === "string" && b.trim().length > 0).map((b) => b.trim());
}

function projectRow(r: DraftRow): ReleaseNotesView {
  return {
    id: r.id,
    releaseId: r.releaseId,
    status: isStatus(r.status) ? r.status : "unknown",
    bullets: normalizeBullets(r.bulletsJson),
    headline: r.headline,
    source: isSource(r.source) ? r.source : "unknown",
    reviewedByUserId: r.reviewedByUserId,
    reviewedAtIso: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    publishedByUserId: r.publishedByUserId,
    publishedAtIso: r.publishedAt ? r.publishedAt.toISOString() : null,
    publishedUrl: r.publishedUrl,
    createdAtIso: r.createdAt.toISOString(),
    updatedAtIso: r.updatedAt.toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────────
   Upsert (replace bullets while in draft).
   ────────────────────────────────────────────────────────────── */

export interface UpsertInput {
  organizationId: string;
  releaseId: string;
  bullets: string[];
  headline?: string;
  source?: ReleaseNotesSource;
}

export type UpsertError =
  | "release_not_found"
  | "cross_org_release"
  | "bullets_empty"
  | "bullet_too_long"
  | "not_draft";

export type UpsertBody =
  | { ok: true; data: { draft: ReleaseNotesView } }
  | { ok: false; error: UpsertError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface UpsertResult { status: number; body: UpsertBody }

export async function buildReleaseNotesUpsertResponse(
  repo: ReleaseNotesRepo,
  input: UpsertInput,
  opts: { correlationId?: string } = {},
): Promise<UpsertResult> {
  const cleaned = normalizeBullets(input.bullets);
  if (cleaned.length === 0) {
    return { status: 422, body: { ok: false, error: "bullets_empty", hint: "At least one non-empty bullet is required." } };
  }
  if (cleaned.some((b) => b.length > 500)) {
    return { status: 422, body: { ok: false, error: "bullet_too_long", hint: "Each bullet must be ≤ 500 chars." } };
  }
  const source: ReleaseNotesSource = input.source && isSource(input.source) ? input.source : "manual";

  try {
    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release) return { status: 404, body: { ok: false, error: "release_not_found" } };
    if (release.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }

    // If an existing draft has advanced past 'draft', reject (caller must revoke first).
    const existing = await repo.releaseNotesDraft.findUnique({ where: { releaseId: input.releaseId } });
    if (existing && existing.status !== "draft") {
      return {
        status: 409,
        body: { ok: false, error: "not_draft", hint: `Draft is ${existing.status}; revoke before editing bullets.` },
      };
    }

    const row = await repo.releaseNotesDraft.upsert({
      where: { releaseId: input.releaseId },
      create: {
        organizationId: release.organizationId,
        releaseId: release.id,
        status: "draft",
        bulletsJson: cleaned,
        headline: input.headline?.trim() || null,
        source,
      },
      update: {
        bulletsJson: cleaned,
        headline: input.headline?.trim() || null,
        source,
      },
    });
    return { status: 200, body: { ok: true, data: { draft: projectRow(row) } } };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "ReleaseNotesDraft table needs Phase 500 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}

/* ──────────────────────────────────────────────────────────────────
   Transition.
   ────────────────────────────────────────────────────────────── */

export interface TransitionInput {
  organizationId: string;
  actorUserId: string;
  releaseId: string;
  action: ReleaseNotesTransition;
  publishedUrl?: string;
}

export type TransitionError =
  | "draft_not_found"
  | "cross_org_release"
  | "unknown_current_status"
  | "illegal_transition";

export type TransitionBody =
  | {
      ok: true;
      data: {
        releaseId: string;
        previousStatus: ReleaseNotesStatus;
        status: ReleaseNotesStatus;
        action: ReleaseNotesTransition;
        actorUserId: string;
      };
    }
  | { ok: false; error: TransitionError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface TransitionResult { status: number; body: TransitionBody }

export async function buildReleaseNotesTransitionResponse(
  repo: ReleaseNotesRepo,
  input: TransitionInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<TransitionResult> {
  if (!(RELEASE_NOTES_TRANSITIONS as readonly string[]).includes(input.action)) {
    return { status: 422, body: { ok: false, error: "illegal_transition", hint: `Unknown action "${input.action}".` } };
  }
  try {
    const existing = await repo.releaseNotesDraft.findUnique({ where: { releaseId: input.releaseId } });
    if (!existing) return { status: 404, body: { ok: false, error: "draft_not_found" } };
    if (existing.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }
    if (!isStatus(existing.status)) {
      return {
        status: 409,
        body: { ok: false, error: "unknown_current_status", hint: `Draft.status="${existing.status}" not in closed-union.` },
      };
    }

    const now = opts.now ?? new Date();
    const plan = planTransition(existing.status as ReleaseNotesStatus, input.action, {
      actorUserId: input.actorUserId, now,
      ...(input.publishedUrl ? { publishedUrl: input.publishedUrl } : {}),
    });
    if (!plan.ok) {
      return {
        status: 409,
        body: { ok: false, error: "illegal_transition", hint: `Cannot ${input.action} from "${existing.status}".` },
      };
    }

    // revoke clears reviewer fields back to null.
    const updateData: {
      status: ReleaseNotesStatus;
      reviewedByUserId?: string | null;
      reviewedAt?: Date | null;
      publishedByUserId?: string | null;
      publishedAt?: Date | null;
      publishedUrl?: string | null;
    } = { status: plan.next };
    if (input.action === "revoke") {
      updateData.reviewedByUserId = null;
      updateData.reviewedAt = null;
    }
    if (plan.fields.reviewedByUserId !== undefined && input.action !== "revoke") updateData.reviewedByUserId = plan.fields.reviewedByUserId;
    if (plan.fields.reviewedAt !== undefined && input.action !== "revoke") updateData.reviewedAt = plan.fields.reviewedAt;
    if (plan.fields.publishedByUserId !== undefined) updateData.publishedByUserId = plan.fields.publishedByUserId;
    if (plan.fields.publishedAt !== undefined) updateData.publishedAt = plan.fields.publishedAt;
    if (plan.fields.publishedUrl !== undefined) updateData.publishedUrl = plan.fields.publishedUrl;

    await repo.releaseNotesDraft.update({ where: { id: existing.id }, data: updateData });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          releaseId: existing.releaseId,
          previousStatus: existing.status as ReleaseNotesStatus,
          status: plan.next,
          action: input.action,
          actorUserId: input.actorUserId,
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "ReleaseNotesDraft table needs Phase 500 migration." },
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

export type ListBody =
  | {
      ok: true;
      data: {
        generatedAt: string;
        drafts: ReleaseNotesView[];
        summary: { total: number; draft: number; reviewed: number; published: number };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ListResult { status: number; body: ListBody }

export async function buildReleaseNotesListResponse(
  repo: ReleaseNotesRepo,
  organizationId: string,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ListResult> {
  try {
    const now = opts.now ?? new Date();
    const rows = await repo.releaseNotesDraft.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const drafts = rows.map(projectRow);
    let draft = 0, reviewed = 0, published = 0;
    for (const d of drafts) {
      if (d.status === "draft") draft += 1;
      else if (d.status === "reviewed") reviewed += 1;
      else if (d.status === "published") published += 1;
    }
    return {
      status: 200,
      body: {
        ok: true,
        data: {
          generatedAt: now.toISOString(),
          drafts,
          summary: { total: drafts.length, draft, reviewed, published },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "ReleaseNotesDraft table needs Phase 500 migration." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
