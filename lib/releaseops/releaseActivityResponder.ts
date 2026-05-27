/**
 * Phase 488 — per-release activity timeline.
 *
 * Synthesizes a chronologically-sorted event timeline for one release
 * from the rows we already persist:
 *   - Release lifecycle (createdAt, scopeFinalizedAt, actualDeployStart/End)
 *   - ReleaseReadinessSnapshot.evaluatedAt
 *   - CherryPickException requestedAt + decidedAt
 *   - PolicyViolation detectedAt + exceptionGrantedAt + resolution
 *   - ReleaseEvidencePack generatedAt + signedAt
 *
 * No new schema. The kernel returns a typed event list; the UI
 * renders it as a vertical timeline.
 */

import { isMissingTable } from "./releaseListResponder";

/* ──────────────────────────────────────────────────────────────────
   Closed-union event kind.
   ────────────────────────────────────────────────────────────── */

export const ALL_ACTIVITY_KINDS = [
  "release_created",
  "scope_finalized",
  "deploy_started",
  "deploy_completed",
  "readiness_evaluated",
  "cherry_pick_requested",
  "cherry_pick_decided",
  "violation_detected",
  "violation_exception_granted",
  "violation_resolved",
  "evidence_pack_generated",
  "evidence_pack_sealed",
] as const;
export type ActivityKind = (typeof ALL_ACTIVITY_KINDS)[number];

/* ──────────────────────────────────────────────────────────────────
   Repo contract.
   ────────────────────────────────────────────────────────────── */

export interface ActivityReleaseRow {
  id: string;
  organizationId: string;
  releaseTag: string | null;
  status: string;
  scopeFinalizedAt: Date | null;
  scopeFinalizedByUserId: string | null;
  actualDeployStart: Date | null;
  actualDeployEnd: Date | null;
  createdAt: Date;
  createdByUserId: string | null;
}

export interface ActivityReadinessRow {
  id: string;
  overallScore: number;
  riskLevel: string;
  evaluatedAt: Date;
  evaluationSource: string;
}

export interface ActivityCherryPickRow {
  id: string;
  status: string;
  requestedByUserId: string;
  requestedAt: Date;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  decisionReason: string | null;
}

export interface ActivityViolationRow {
  id: string;
  status: string;
  message: string;
  detectedAt: Date;
  exceptionGrantedByUserId: string | null;
  exceptionGrantedAt: Date | null;
  rule: { key: string; label: string; severity: string };
}

export interface ActivityEvidencePackRow {
  id: string;
  generatedAt: Date;
  signedAt: Date | null;
  contentHash: string | null;
}

export interface ReleaseActivityRepo {
  release: {
    findUnique(args: { where: { id: string } }): Promise<ActivityReleaseRow | null>;
  };
  releaseReadinessSnapshot: {
    findMany(args: { where: { releaseId: string }; orderBy: { evaluatedAt: "asc" } }): Promise<ActivityReadinessRow[]>;
  };
  cherryPickException: {
    findMany(args: {
      where: { organizationId: string; releaseId: string };
      orderBy: { requestedAt: "asc" };
    }): Promise<ActivityCherryPickRow[]>;
  };
  policyViolation: {
    findMany(args: {
      where: { organizationId: string; releaseId: string };
      include: { rule: true };
      orderBy: { detectedAt: "asc" };
    }): Promise<ActivityViolationRow[]>;
  };
  releaseEvidencePack: {
    findUnique(args: { where: { releaseId: string } }): Promise<ActivityEvidencePackRow | null>;
  };
}

/* ──────────────────────────────────────────────────────────────────
   Output.
   ────────────────────────────────────────────────────────────── */

export interface ActivityEvent {
  kind: ActivityKind;
  /** ISO timestamp when the event happened. */
  atIso: string;
  /** User who performed it, if known. */
  actorUserId: string | null;
  /** Operator-readable summary. */
  summary: string;
  /** Optional severity hint for the UI badge. */
  tone: "info" | "success" | "warning" | "danger";
  /** Optional reference fields the UI can deep-link with. */
  refs?: { violationId?: string; cherryPickId?: string; readinessSnapshotId?: string; ruleKey?: string };
}

export type ReleaseActivityBody =
  | {
      ok: true;
      data: {
        releaseId: string;
        releaseTag: string | null;
        events: ActivityEvent[];
        summary: { total: number; byKind: Partial<Record<ActivityKind, number>> };
      };
    }
  | { ok: false; error: string; hint?: string; correlationId?: string };

export interface ResponderResult { status: number; body: ReleaseActivityBody }

export interface BuildReleaseActivityInput {
  organizationId: string;
  releaseId: string;
}

/* ──────────────────────────────────────────────────────────────────
   Public surface.
   ────────────────────────────────────────────────────────────── */

export async function buildReleaseActivityResponse(
  repo: ReleaseActivityRepo,
  input: BuildReleaseActivityInput,
  opts: { correlationId?: string } = {},
): Promise<ResponderResult> {
  try {
    const release = await repo.release.findUnique({ where: { id: input.releaseId } });
    if (!release) {
      return { status: 404, body: { ok: false, error: "release_not_found" } };
    }
    if (release.organizationId !== input.organizationId) {
      return { status: 403, body: { ok: false, error: "cross_org_release" } };
    }

    const [snapshots, cherryPicks, violations, pack] = await Promise.all([
      repo.releaseReadinessSnapshot.findMany({ where: { releaseId: release.id }, orderBy: { evaluatedAt: "asc" } }),
      repo.cherryPickException.findMany({
        where: { organizationId: input.organizationId, releaseId: release.id },
        orderBy: { requestedAt: "asc" },
      }),
      repo.policyViolation.findMany({
        where: { organizationId: input.organizationId, releaseId: release.id },
        include: { rule: true },
        orderBy: { detectedAt: "asc" },
      }),
      repo.releaseEvidencePack.findUnique({ where: { releaseId: release.id } }),
    ]);

    const events: ActivityEvent[] = [];

    // Release-level events.
    events.push({
      kind: "release_created",
      atIso: release.createdAt.toISOString(),
      actorUserId: release.createdByUserId,
      summary: `Release ${release.releaseTag ?? "(untagged)"} created.`,
      tone: "info",
    });
    if (release.scopeFinalizedAt) {
      events.push({
        kind: "scope_finalized",
        atIso: release.scopeFinalizedAt.toISOString(),
        actorUserId: release.scopeFinalizedByUserId,
        summary: "Scope finalized — release frozen against further additions.",
        tone: "info",
      });
    }
    if (release.actualDeployStart) {
      events.push({
        kind: "deploy_started",
        atIso: release.actualDeployStart.toISOString(),
        actorUserId: null,
        summary: "Deploy window opened.",
        tone: "info",
      });
    }
    if (release.actualDeployEnd) {
      events.push({
        kind: "deploy_completed",
        atIso: release.actualDeployEnd.toISOString(),
        actorUserId: null,
        summary: "Deploy window closed.",
        tone: "success",
      });
    }

    // Readiness snapshots.
    for (const s of snapshots) {
      events.push({
        kind: "readiness_evaluated",
        atIso: s.evaluatedAt.toISOString(),
        actorUserId: null,
        summary: `Readiness re-evaluated → ${s.overallScore}/100 (${s.riskLevel}).`,
        tone: s.riskLevel === "low" ? "success" : s.riskLevel === "medium" ? "warning" : "danger",
        refs: { readinessSnapshotId: s.id },
      });
    }

    // Cherry-picks.
    for (const c of cherryPicks) {
      events.push({
        kind: "cherry_pick_requested",
        atIso: c.requestedAt.toISOString(),
        actorUserId: c.requestedByUserId,
        summary: `Cherry-pick exception requested.`,
        tone: "warning",
        refs: { cherryPickId: c.id },
      });
      if (c.decidedAt) {
        events.push({
          kind: "cherry_pick_decided",
          atIso: c.decidedAt.toISOString(),
          actorUserId: c.decidedByUserId,
          summary: `Cherry-pick exception ${c.status}.${c.decisionReason ? ` — "${c.decisionReason}"` : ""}`,
          tone: c.status === "approved" ? "success" : c.status === "denied" ? "danger" : "warning",
          refs: { cherryPickId: c.id },
        });
      }
    }

    // Violations.
    for (const v of violations) {
      events.push({
        kind: "violation_detected",
        atIso: v.detectedAt.toISOString(),
        actorUserId: null,
        summary: `Policy violation: ${v.rule.label} — ${v.message}`,
        tone: v.rule.severity === "blocker" ? "danger" : v.rule.severity === "warning" ? "warning" : "info",
        refs: { violationId: v.id, ruleKey: v.rule.key },
      });
      if (v.exceptionGrantedAt) {
        events.push({
          kind: "violation_exception_granted",
          atIso: v.exceptionGrantedAt.toISOString(),
          actorUserId: v.exceptionGrantedByUserId,
          summary: `Exception granted for ${v.rule.label}.`,
          tone: "warning",
          refs: { violationId: v.id, ruleKey: v.rule.key },
        });
      }
      // Status==resolved → infer resolution event from the most-recent
      // update timestamp. Without a dedicated resolvedAt column we
      // tag it as "detected" for now if the row is open or
      // exception_granted; "resolved" rows surface as a separate event
      // anchored to the violation's lifecycle when the rule passes
      // again on re-evaluation. (Audit-of-audit lands a dedicated
      // event log table in a follow-on phase.)
      if (v.status === "resolved") {
        events.push({
          kind: "violation_resolved",
          atIso: v.detectedAt.toISOString(),
          actorUserId: null,
          summary: `Policy violation resolved: ${v.rule.label}.`,
          tone: "success",
          refs: { violationId: v.id, ruleKey: v.rule.key },
        });
      }
    }

    // Evidence pack.
    if (pack) {
      events.push({
        kind: "evidence_pack_generated",
        atIso: pack.generatedAt.toISOString(),
        actorUserId: null,
        summary: `Evidence pack generated.${pack.contentHash ? ` sha ${pack.contentHash.slice(0, 12)}…` : ""}`,
        tone: "info",
      });
      if (pack.signedAt) {
        events.push({
          kind: "evidence_pack_sealed",
          atIso: pack.signedAt.toISOString(),
          actorUserId: null,
          summary: "Evidence pack sealed against further edits.",
          tone: "success",
        });
      }
    }

    // Sort chronologically — oldest first reads naturally for a timeline.
    events.sort((a, b) => a.atIso.localeCompare(b.atIso));

    const byKind: Partial<Record<ActivityKind, number>> = {};
    for (const e of events) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;

    return {
      status: 200,
      body: {
        ok: true,
        data: {
          releaseId: release.id,
          releaseTag: release.releaseTag,
          events,
          summary: { total: events.length, byKind },
        },
      },
    };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        status: 503,
        body: { ok: false, error: "migration_pending", hint: "Phase 442 / 466 migrations needed for activity timeline." },
      };
    }
    return {
      status: 500,
      body: { ok: false, error: "internal_error", ...(opts.correlationId ? { correlationId: opts.correlationId } : {}) },
    };
  }
}
