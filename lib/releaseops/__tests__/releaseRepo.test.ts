import { describe, expect, it } from "vitest";
import {
  ALL_RELEASE_STATUSES,
  computeOverallScore,
  createReleaseDraft,
  isKnownReleaseStatus,
  isLegalReleaseTransition,
  listRecentReadinessSnapshots,
  persistReadinessSnapshot,
  readEvidencePack,
  riskLevelFor,
  transitionRelease,
  upsertEvidencePack,
  type ReleaseRepo,
  type ReleaseRow,
  type ReleaseReadinessSnapshotRow,
  type ReleaseEvidencePackRow,
  type ReleaseStatus,
} from "../releaseRepo";

/* ──────────────────────────────────────────────────────────────────
   Phase 442 — in-memory Prisma stub for the Release repo. Mirrors the
   shape Phases 414 / 427 use.
   ────────────────────────────────────────────────────────────── */

interface Stub extends ReleaseRepo {
  _releases: ReleaseRow[];
  _snapshots: ReleaseReadinessSnapshotRow[];
  _packs: ReleaseEvidencePackRow[];
  _now(): Date;
  _advance(ms: number): void;
}

function makeRepo(start = new Date("2026-06-01T12:00:00Z")): Stub {
  const releases: ReleaseRow[] = [];
  const snapshots: ReleaseReadinessSnapshotRow[] = [];
  const packs: ReleaseEvidencePackRow[] = [];
  let clock = new Date(start);
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;
  const now = () => new Date(clock);

  const repo: Stub = {
    _releases: releases,
    _snapshots: snapshots,
    _packs: packs,
    _now: now,
    _advance(ms) { clock = new Date(clock.getTime() + ms); },

    release: {
      async findUnique({ where }) {
        const row = releases.find((r) => r.id === where.id);
        return row ? { ...row } : null;
      },
      async findFirst({ where }) {
        const row = releases.find((r) =>
          r.organizationId === where.organizationId &&
          r.applicationId === where.applicationId &&
          r.releaseTag === where.releaseTag,
        );
        return row ? { ...row } : null;
      },
      async findMany({ where, take }) {
        const filtered = releases.filter((r) =>
          r.organizationId === where.organizationId &&
          (where.applicationId === undefined || r.applicationId === where.applicationId) &&
          (where.status === undefined || r.status === where.status),
        );
        filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return (take ? filtered.slice(0, take) : filtered).map((r) => ({ ...r }));
      },
      async create({ data }) {
        const row: ReleaseRow = {
          id: nextId(),
          organizationId: data.organizationId,
          applicationId: data.applicationId,
          targetEnvironmentId: data.targetEnvironmentId ?? null,
          releaseTag: data.releaseTag ?? null,
          commitSha: data.commitSha ?? null,
          status: (data.status as ReleaseStatus) ?? "draft",
          scopeFinalizedAt: data.scopeFinalizedAt ?? null,
          scopeFinalizedByUserId: data.scopeFinalizedByUserId ?? null,
          rollbackReferenceReleaseId: data.rollbackReferenceReleaseId ?? null,
          plannedWindowStart: data.plannedWindowStart ?? null,
          plannedWindowEnd: data.plannedWindowEnd ?? null,
          actualDeployStart: data.actualDeployStart ?? null,
          actualDeployEnd: data.actualDeployEnd ?? null,
          summary: data.summary ?? null,
          createdAt: now(),
          createdByUserId: data.createdByUserId ?? null,
          updatedAt: now(),
        };
        releases.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = releases.find((r) => r.id === where.id);
        if (!row) throw new Error(`stub: release ${where.id} not found`);
        Object.assign(row, data, { updatedAt: now() });
        return { ...row };
      },
    },

    releaseReadinessSnapshot: {
      async create({ data }) {
        const row: ReleaseReadinessSnapshotRow = {
          id: nextId(),
          evaluatedAt: data.evaluatedAt ?? now(),
          ...data,
        };
        snapshots.push(row);
        return { ...row };
      },
      async findMany({ where, take }) {
        return snapshots
          .filter((s) => s.releaseId === where.releaseId)
          .slice()
          .sort((a, b) => b.evaluatedAt.getTime() - a.evaluatedAt.getTime())
          .slice(0, take)
          .map((s) => ({ ...s }));
      },
    },

    releaseEvidencePack: {
      async findUnique({ where }) {
        const row = packs.find((p) => p.releaseId === where.releaseId);
        return row ? { ...row } : null;
      },
      async upsert({ where, create, update }) {
        const existing = packs.find((p) => p.releaseId === where.releaseId);
        if (existing) {
          Object.assign(existing, update, { updatedAt: now() });
          return { ...existing };
        }
        const row: ReleaseEvidencePackRow = {
          id: nextId(),
          generatedAt: create.generatedAt ?? now(),
          createdAt: now(),
          updatedAt: now(),
          signedAt: create.signedAt ?? null,
          contentHash: create.contentHash ?? null,
          exportRefsJson: create.exportRefsJson ?? null,
          ...create,
        };
        packs.push(row);
        return { ...row };
      },
    },

    async $transaction(fn) { return fn(repo); },
  };
  return repo;
}

const BASE_SCORES = {
  branchGovernance: 80,
  changeCompliance: 70,
  artifactTraceability: 85,
  secretTraceability: 60,
  rollbackReadiness: 50,
  communicationReadiness: 65,
  driftRisk: 75,
  manualReconciliation: 90,
};

/* ──────────────────────────────────────────────────────────────────
   Pure helpers.
   ────────────────────────────────────────────────────────────── */

describe("isLegalReleaseTransition — closed-union table", () => {
  it("draft → ready is legal; draft → deployed is not", () => {
    expect(isLegalReleaseTransition("draft", "ready")).toBe(true);
    expect(isLegalReleaseTransition("draft", "deployed")).toBe(false);
    expect(isLegalReleaseTransition("draft", "deploying")).toBe(false);
  });

  it("ready can move forward to deploying OR back to draft", () => {
    expect(isLegalReleaseTransition("ready", "deploying")).toBe(true);
    expect(isLegalReleaseTransition("ready", "draft")).toBe(true);
    expect(isLegalReleaseTransition("ready", "deployed")).toBe(false);
  });

  it("deploying → {deployed, failed}; nothing else", () => {
    expect(isLegalReleaseTransition("deploying", "deployed")).toBe(true);
    expect(isLegalReleaseTransition("deploying", "failed")).toBe(true);
    expect(isLegalReleaseTransition("deploying", "rolled_back")).toBe(false);
  });

  it("deployed → rolled_back only", () => {
    expect(isLegalReleaseTransition("deployed", "rolled_back")).toBe(true);
    expect(isLegalReleaseTransition("deployed", "failed")).toBe(false);
  });

  it("rolled_back is terminal", () => {
    for (const next of ALL_RELEASE_STATUSES) {
      expect(isLegalReleaseTransition("rolled_back", next)).toBe(false);
    }
  });

  it("failed can be re-scoped (→ draft) or re-readied (→ ready)", () => {
    expect(isLegalReleaseTransition("failed", "draft")).toBe(true);
    expect(isLegalReleaseTransition("failed", "ready")).toBe(true);
    expect(isLegalReleaseTransition("failed", "deploying")).toBe(false);
  });
});

describe("computeOverallScore + riskLevelFor", () => {
  it("computeOverallScore is the plain mean of 8 dimensions", () => {
    const score = computeOverallScore({
      branchGovernance: 100, changeCompliance: 100, artifactTraceability: 100, secretTraceability: 100,
      rollbackReadiness: 100, communicationReadiness: 100, driftRisk: 100, manualReconciliation: 100,
    });
    expect(score).toBe(100);
  });

  it("riskLevelFor maps score bands", () => {
    expect(riskLevelFor(0)).toBe("critical");
    expect(riskLevelFor(39)).toBe("critical");
    expect(riskLevelFor(40)).toBe("high");
    expect(riskLevelFor(59)).toBe("high");
    expect(riskLevelFor(60)).toBe("medium");
    expect(riskLevelFor(79)).toBe("medium");
    expect(riskLevelFor(80)).toBe("low");
    expect(riskLevelFor(100)).toBe("low");
  });
});

describe("isKnownReleaseStatus", () => {
  it("accepts every kernel status, rejects garbage", () => {
    for (const s of ALL_RELEASE_STATUSES) expect(isKnownReleaseStatus(s)).toBe(true);
    for (const s of ["", "DRAFT", "complete", "rollback"]) expect(isKnownReleaseStatus(s)).toBe(false);
  });
});

/* ──────────────────────────────────────────────────────────────────
   createReleaseDraft.
   ────────────────────────────────────────────────────────────── */

describe("createReleaseDraft", () => {
  it("creates a draft release with defaults; releaseTag/commitSha/window optional", async () => {
    const repo = makeRepo();
    const r = await createReleaseDraft(repo, {
      organizationId: "o", applicationId: "app_1",
    });
    expect(r.status).toBe("draft");
    expect(r.releaseTag).toBeNull();
    expect(r.commitSha).toBeNull();
    expect(r.scopeFinalizedAt).toBeNull();
    expect(repo._releases).toHaveLength(1);
  });

  it("carries optional fields through verbatim", async () => {
    const repo = makeRepo();
    const r = await createReleaseDraft(repo, {
      organizationId: "o", applicationId: "app_1",
      releaseTag: "v2.7.0", commitSha: "abc123",
      targetEnvironmentId: "env_prod",
      summary: "Checkout retry banner",
      createdByUserId: "user_42",
    });
    expect(r.releaseTag).toBe("v2.7.0");
    expect(r.commitSha).toBe("abc123");
    expect(r.targetEnvironmentId).toBe("env_prod");
    expect(r.summary).toBe("Checkout retry banner");
    expect(r.createdByUserId).toBe("user_42");
  });
});

/* ──────────────────────────────────────────────────────────────────
   transitionRelease — legal + illegal + side-effects.
   ────────────────────────────────────────────────────────────── */

describe("transitionRelease — legal transitions stamp the right side effects", () => {
  it("draft → ready stamps scopeFinalizedAt + finalizedByUserId", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    repo._advance(60_000);
    const r = await transitionRelease(repo, {
      releaseId: created.id, toStatus: "ready",
      scopeFinalizedByUserId: "user_captain",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.release.status).toBe("ready");
    expect(r.release.scopeFinalizedAt).not.toBeNull();
    expect(r.release.scopeFinalizedByUserId).toBe("user_captain");
  });

  it("ready → deploying stamps actualDeployStart", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "ready" });
    repo._advance(60_000);
    const r = await transitionRelease(repo, { releaseId: created.id, toStatus: "deploying" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.release.actualDeployStart).not.toBeNull();
    expect(r.release.actualDeployEnd).toBeNull();
  });

  it("deploying → deployed stamps actualDeployEnd", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "ready" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "deploying" });
    repo._advance(60_000);
    const r = await transitionRelease(repo, { releaseId: created.id, toStatus: "deployed" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.release.actualDeployEnd).not.toBeNull();
  });

  it("deploying → failed also stamps actualDeployEnd", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "ready" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "deploying" });
    const r = await transitionRelease(repo, { releaseId: created.id, toStatus: "failed" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.release.actualDeployEnd).not.toBeNull();
  });
});

describe("transitionRelease — illegal transitions", () => {
  it("draft → deployed returns illegal_transition", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    const r = await transitionRelease(repo, { releaseId: created.id, toStatus: "deployed" });
    expect(r).toEqual({ ok: false, reason: "illegal_transition", from: "draft", to: "deployed" });
  });

  it("rolled_back is terminal — any further transition rejected", async () => {
    const repo = makeRepo();
    const previous = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1", releaseTag: "v1" });
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1", releaseTag: "v2" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "ready" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "deploying" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "deployed" });
    await transitionRelease(repo, {
      releaseId: created.id, toStatus: "rolled_back",
      rollbackReferenceReleaseId: previous.id,
    });
    const r = await transitionRelease(repo, { releaseId: created.id, toStatus: "ready" });
    expect(r.ok).toBe(false);
  });

  it("non-existent releaseId returns release_not_found", async () => {
    const repo = makeRepo();
    const r = await transitionRelease(repo, { releaseId: "nope", toStatus: "ready" });
    expect(r).toEqual({ ok: false, reason: "release_not_found" });
  });

  it("deployed → rolled_back without a rollback reference is rejected", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "ready" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "deploying" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "deployed" });
    const r = await transitionRelease(repo, { releaseId: created.id, toStatus: "rolled_back" });
    expect(r.ok).toBe(false);
  });

  it("deployed → rolled_back WITH a rollback reference is accepted + reference persisted", async () => {
    const repo = makeRepo();
    const previous = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1", releaseTag: "v1" });
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1", releaseTag: "v2" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "ready" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "deploying" });
    await transitionRelease(repo, { releaseId: created.id, toStatus: "deployed" });
    const r = await transitionRelease(repo, {
      releaseId: created.id, toStatus: "rolled_back",
      rollbackReferenceReleaseId: previous.id,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.release.rollbackReferenceReleaseId).toBe(previous.id);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Readiness snapshots.
   ────────────────────────────────────────────────────────────── */

describe("persistReadinessSnapshot + listRecentReadinessSnapshots", () => {
  it("persists a snapshot with computed overallScore + risk level", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    const snap = await persistReadinessSnapshot(repo, {
      organizationId: "o", releaseId: created.id,
      scores: BASE_SCORES, blockers: [],
      evaluationSource: "auto",
    });
    // mean of BASE_SCORES = (80+70+85+60+50+65+75+90)/8 = 575/8 = 71.875 → 72
    expect(snap.overallScore).toBe(72);
    expect(snap.riskLevel).toBe("medium");
    expect(repo._snapshots).toHaveLength(1);
  });

  it("blockers JSON round-trips verbatim", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    const blockers = [
      {
        id: "missing_rollback_plan",
        category: "rollback_readiness" as const,
        severity: "high" as const,
        message: "No rollback plan attached.",
        remediation: "Attach the previous release tag.",
      },
    ];
    const snap = await persistReadinessSnapshot(repo, {
      organizationId: "o", releaseId: created.id,
      scores: BASE_SCORES, blockers,
      evaluationSource: "manual",
    });
    expect(snap.blockersJson).toEqual(blockers);
  });

  it("listRecentReadinessSnapshots returns newest-first + respects take", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    for (let i = 0; i < 5; i++) {
      repo._advance(60_000);
      await persistReadinessSnapshot(repo, {
        organizationId: "o", releaseId: created.id,
        scores: BASE_SCORES, blockers: [],
        evaluationSource: `cron:tick-${i}`,
      });
    }
    const recent = await listRecentReadinessSnapshots(repo, { releaseId: created.id, take: 3 });
    expect(recent).toHaveLength(3);
    expect(recent[0].evaluationSource).toBe("cron:tick-4");
    expect(recent[2].evaluationSource).toBe("cron:tick-2");
  });

  it("snapshots are scoped to releaseId — no cross-release bleed", async () => {
    const repo = makeRepo();
    const a = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1", releaseTag: "v1" });
    const b = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1", releaseTag: "v2" });
    await persistReadinessSnapshot(repo, { organizationId: "o", releaseId: a.id, scores: BASE_SCORES, blockers: [], evaluationSource: "auto" });
    await persistReadinessSnapshot(repo, { organizationId: "o", releaseId: b.id, scores: BASE_SCORES, blockers: [], evaluationSource: "auto" });
    const recentA = await listRecentReadinessSnapshots(repo, { releaseId: a.id });
    expect(recentA).toHaveLength(1);
    expect(recentA[0].releaseId).toBe(a.id);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Evidence pack.
   ────────────────────────────────────────────────────────────── */

describe("upsertEvidencePack + readEvidencePack", () => {
  it("creates a new pack on first upsert, returns it via readEvidencePack", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    const pack = await upsertEvidencePack(repo, {
      organizationId: "o", releaseId: created.id,
      contentJson: { release: { id: created.id, tag: "v2.7.0" } },
    });
    expect(pack.releaseId).toBe(created.id);
    expect(pack.contentJson).toEqual({ release: { id: created.id, tag: "v2.7.0" } });
    expect(pack.signedAt).toBeNull();

    const read = await readEvidencePack(repo, { releaseId: created.id });
    expect(read?.id).toBe(pack.id);
  });

  it("second upsert mutates content + records signedAt without creating a duplicate row", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    await upsertEvidencePack(repo, { organizationId: "o", releaseId: created.id, contentJson: { v: 1 } });
    repo._advance(60_000);
    const sealedAt = repo._now();
    const sealed = await upsertEvidencePack(repo, {
      organizationId: "o", releaseId: created.id,
      contentJson: { v: 2, final: true },
      signedAt: sealedAt, contentHash: "sha256-deadbeef",
    });
    expect(repo._packs).toHaveLength(1);
    expect(sealed.contentJson).toEqual({ v: 2, final: true });
    expect(sealed.signedAt?.getTime()).toBe(sealedAt.getTime());
    expect(sealed.contentHash).toBe("sha256-deadbeef");
  });

  it("readEvidencePack returns null when no pack exists for the release", async () => {
    const repo = makeRepo();
    const created = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    const read = await readEvidencePack(repo, { releaseId: created.id });
    expect(read).toBeNull();
  });
});
