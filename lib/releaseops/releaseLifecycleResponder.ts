/**
 * Phase 491 — release lifecycle transitions.
 *
 * Closed-union state machine. Operator-driven transitions through the
 * Phase 442 release statuses:
 *
 *   draft  →  ready          (finalize_scope; records scopeFinalizedAt + by)
 *   ready  →  deploying      (start_deploy; records actualDeployStart)
 *   deploying → deployed     (complete_deploy; records actualDeployEnd)
 *   deploying|deployed → rolled_back   (mark_rolled_back; records actualDeployEnd if not set)
 *   ready|deploying → failed (mark_failed; records actualDeployEnd if not set)
 *
 * Each transition is reject-by-default — illegal moves return
 * illegal_transition with the current status + requested action.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-union status + action.
   ────────────────────────────────────────────────────────────── */

export const ALL_RELEASE_STATUSES = ["draft", "ready", "deploying", "deployed", "rolled_back", "failed"] as const;
export type ReleaseStatus = (typeof ALL_RELEASE_STATUSES)[number];

export const ALL_LIFECYCLE_ACTIONS = [
  "finalize_scope",
  "start_deploy",
  "complete_deploy",
  "mark_rolled_back",
  "mark_failed",
] as const;
export type LifecycleAction = (typeof ALL_LIFECYCLE_ACTIONS)[number];

/* ──────────────────────────────────────────────────────────────────
   Pure transition.
   ────────────────────────────────────────────────────────────── */

export interface LifecycleTransition {
  ok: true;
  next: ReleaseStatus;
  fieldsToSet: Partial<{
    scopeFinalizedAt: Date;
    scopeFinalizedByUserId: string;
    actualDeployStart: Date;
    actualDeployEnd: Date;
  }>;
}

export interface LifecycleReject {
  ok: false;
  reason: "illegal_transition";
  from: ReleaseStatus;
  action: LifecycleAction;
}

export function applyTransition(
  current: ReleaseStatus,
  action: LifecycleAction,
  ctx: { actorUserId: string; now: Date },
): LifecycleTransition | LifecycleReject {
  if (action === "finalize_scope") {
    if (current !== "draft") return { ok: false, reason: "illegal_transition", from: current, action };
    return {
      ok: true,
      next: "ready",
      fieldsToSet: { scopeFinalizedAt: ctx.now, scopeFinalizedByUserId: ctx.actorUserId },
    };
  }
  if (action === "start_deploy") {
    if (current !== "ready") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "deploying", fieldsToSet: { actualDeployStart: ctx.now } };
  }
  if (action === "complete_deploy") {
    if (current !== "deploying") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "deployed", fieldsToSet: { actualDeployEnd: ctx.now } };
  }
  if (action === "mark_rolled_back") {
    if (current !== "deploying" && current !== "deployed") return { ok: false, reason: "illegal_transition", from: current, action };
    return { ok: true, next: "rolled_back", fieldsToSet: { actualDeployEnd: ctx.now } };
  }
  // mark_failed
  if (current !== "ready" && current !== "deploying") return { ok: false, reason: "illegal_transition", from: current, action };
  return { ok: true, next: "failed", fieldsToSet: { actualDeployEnd: ctx.now } };
}

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface LifecycleReleaseRow {
  id: string;
  organizationId: string;
  status: string;
  releaseTag: string | null;
}

export interface ReleaseLifecycleRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<LifecycleReleaseRow | null>;
    update(args: {
      where: { id: string };
      data: {
        status: ReleaseStatus;
        scopeFinalizedAt?: Date;
        scopeFinalizedByUserId?: string;
        actualDeployStart?: Date;
        actualDeployEnd?: Date;
      };
    }): Promise<{ id: string; status: string }>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Input + output.
   ────────────────────────────────────────────────────────────── */

export interface BuildLifecycleInput {
  organizationId: string;
  actorUserId: string;
  releaseId: string;
  action: LifecycleAction;
}

export type LifecycleError =
  | "release_not_found"
  | "cross_org_release"
  | "unknown_current_status"
  | "illegal_transition";

export type ReleaseLifecycleBody =
  | {
      ok: true;
      data: {
        id: string;
        previousStatus: ReleaseStatus;
        status: ReleaseStatus;
        action: LifecycleAction;
        actorUserId: string;
        atIso: string;
      };
    }
  | { ok: false; error: LifecycleError | "migration_pending" | "internal_error"; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ReleaseLifecycleBody }

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildReleaseLifecycleResponse(
  repo: ReleaseLifecycleRepo,
  input: BuildLifecycleInput,
  opts: { now?: Date; correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release) {
      return { status: 404, body: { ok: false, error: "release_not_found" } };
    }
    if (release.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }
    if (!(ALL_RELEASE_STATUSES as readonly string[]).includes(release.status)) {
      return {
        status: 409,
        body: { ok: false, error: "unknown_current_status", hint: `Release.status="${release.status}" not in closed-union; cannot transition.` },
      };
    }
    const current = release.status as ReleaseStatus;

    const now = opts.now ?? new Date();
    const transition = applyTransition(current, input.action, { actorUserId: input.actorUserId, now });
    if (!transition.ok) {
      return {
        status: 409,
        body: {
          ok: false,
          error: "illegal_transition",
          hint: `Cannot ${input.action} from status "${current}".`,
        },
      };
    }

    await repo.release.update({
      where: { id: release.id },
      data: { status: transition.next, ...transition.fieldsToSet },
    });

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          id: release.id,
          previousStatus: current,
          status: transition.next,
          action: input.action,
          actorUserId: input.actorUserId,
          atIso: now.toISOString(),
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 442 migration must be applied." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
