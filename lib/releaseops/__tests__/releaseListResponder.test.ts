import { describe, expect, it } from "vitest";
import {
  buildReleaseListResponse,
  isMissingTable,
  releaseStatusLabel,
  sidebarToneFor,
  type ReleaseListRepo,
} from "../releaseListResponder";
import {
  createReleaseDraft,
  transitionRelease,
  persistReadinessSnapshot,
  upsertEvidencePack,
} from "../releaseRepo";
import type {
  ReleaseEvidencePackRow,
  ReleaseReadinessSnapshotRow,
  ReleaseRow,
  ReleaseStatus,
} from "../releaseRepo";

interface Stub extends ReleaseListRepo {
  _releases: ReleaseRow[];
  _snapshots: ReleaseReadinessSnapshotRow[];
  _packs: ReleaseEvidencePackRow[];
}

function makeRepo(): Stub {
  const releases: ReleaseRow[] = [];
  const snapshots: ReleaseReadinessSnapshotRow[] = [];
  const packs: ReleaseEvidencePackRow[] = [];
  let counter = 0;
  const nextId = () => `id_${(counter += 1)}`;
  const now = () => new Date(2026, 0, 1, 0, 0, counter);

  const repo: Stub = {
    _releases: releases, _snapshots: snapshots, _packs: packs,
    release: {
      async findUnique({ where }) { const r = releases.find((x) => x.id === where.id); return r ? { ...r } : null; },
      async findFirst({ where }) {
        const r = releases.find((x) =>
          x.organizationId === where.organizationId &&
          x.applicationId === where.applicationId &&
          x.releaseTag === where.releaseTag);
        return r ? { ...r } : null;
      },
      async findMany({ where, take }) {
        const f = releases.filter((r) =>
          r.organizationId === where.organizationId &&
          (where.applicationId === undefined || r.applicationId === where.applicationId) &&
          (where.status === undefined || r.status === where.status),
        );
        f.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return (take ? f.slice(0, take) : f).map((r) => ({ ...r }));
      },
      async create({ data }) {
        const row: ReleaseRow = {
          id: nextId(),
          organizationId: data.organizationId, applicationId: data.applicationId,
          targetEnvironmentId: data.targetEnvironmentId ?? null,
          releaseTag: data.releaseTag ?? null, commitSha: data.commitSha ?? null,
          status: (data.status as ReleaseStatus) ?? "draft",
          scopeFinalizedAt: data.scopeFinalizedAt ?? null,
          scopeFinalizedByUserId: data.scopeFinalizedByUserId ?? null,
          rollbackReferenceReleaseId: data.rollbackReferenceReleaseId ?? null,
          plannedWindowStart: data.plannedWindowStart ?? null,
          plannedWindowEnd: data.plannedWindowEnd ?? null,
          actualDeployStart: data.actualDeployStart ?? null,
          actualDeployEnd: data.actualDeployEnd ?? null,
          summary: data.summary ?? null,
          createdAt: now(), createdByUserId: data.createdByUserId ?? null, updatedAt: now(),
        };
        releases.push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const r = releases.find((x) => x.id === where.id);
        if (!r) throw new Error("missing");
        Object.assign(r, data, { updatedAt: now() });
        return { ...r };
      },
    },
    releaseReadinessSnapshot: {
      async create({ data }) {
        const row: ReleaseReadinessSnapshotRow = { id: nextId(), evaluatedAt: data.evaluatedAt ?? now(), ...data };
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
      async findUnique({ where }) { const p = packs.find((x) => x.releaseId === where.releaseId); return p ? { ...p } : null; },
      async upsert({ where, create, update }) {
        const ex = packs.find((p) => p.releaseId === where.releaseId);
        if (ex) { Object.assign(ex, update, { updatedAt: now() }); return { ...ex }; }
        const row: ReleaseEvidencePackRow = {
          ...create,
          id: nextId(),
          generatedAt: create.generatedAt ?? now(),
          createdAt: now(), updatedAt: now(),
          signedAt: create.signedAt ?? null,
          contentHash: create.contentHash ?? null,
          exportRefsJson: create.exportRefsJson ?? null,
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
  branchGovernance: 90, changeCompliance: 50, artifactTraceability: 50,
  secretTraceability: 50, rollbackReadiness: 50, communicationReadiness: 50,
  driftRisk: 50, manualReconciliation: 50,
};

describe("releaseStatusLabel + sidebarToneFor — pinned", () => {
  it("releaseStatusLabel handles every status", () => {
    expect(releaseStatusLabel("draft")).toBe("Draft");
    expect(releaseStatusLabel("ready")).toBe("Ready");
    expect(releaseStatusLabel("deploying")).toBe("Deploying");
    expect(releaseStatusLabel("deployed")).toBe("Deployed");
    expect(releaseStatusLabel("rolled_back")).toBe("Rolled back");
    expect(releaseStatusLabel("failed")).toBe("Failed");
  });

  it("sidebarToneFor maps status → tone", () => {
    expect(sidebarToneFor("deployed")).toBe("emerald");
    expect(sidebarToneFor("deploying")).toBe("blue");
    expect(sidebarToneFor("ready")).toBe("amber");
    expect(sidebarToneFor("rolled_back")).toBe("blue");
    expect(sidebarToneFor("failed")).toBe("rose");
    expect(sidebarToneFor("draft")).toBe("zinc");
  });
});

describe("buildReleaseListResponse", () => {
  it("empty org → 200 ok:true with releases:[] + zeroed summary", async () => {
    const repo = makeRepo();
    const r = await buildReleaseListResponse(repo, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases).toEqual([]);
    expect(r.body.data.summary.total).toBe(0);
  });

  it("mixed-status org → rows include status + tone + latestReadiness + evidencePack flags", async () => {
    const repo = makeRepo();
    const a = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app", releaseTag: "v1" });
    await transitionRelease(repo, { releaseId: a.id, toStatus: "ready" });
    await persistReadinessSnapshot(repo, {
      organizationId: "o", releaseId: a.id, scores: BASE_SCORES,
      blockers: [], evaluationSource: "auto",
    });
    await upsertEvidencePack(repo, {
      organizationId: "o", releaseId: a.id,
      contentJson: { v: 1 },
    });

    const b = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app", releaseTag: "v2" });
    await transitionRelease(repo, { releaseId: b.id, toStatus: "ready" });
    await transitionRelease(repo, { releaseId: b.id, toStatus: "deploying" });
    await transitionRelease(repo, { releaseId: b.id, toStatus: "deployed" });

    const r = await buildReleaseListResponse(repo, "o");
    expect(r.status).toBe(200);
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases).toHaveLength(2);
    // newest first
    expect(r.body.data.releases[0].id).toBe(b.id);
    expect(r.body.data.releases[0].status).toBe("deployed");
    expect(r.body.data.releases[0].sidebarTone).toBe("emerald");
    expect(r.body.data.releases[0].latestReadiness).toBeNull();
    expect(r.body.data.releases[1].latestReadiness?.overallScore).toBeGreaterThan(50);
    expect(r.body.data.releases[1].evidencePack?.signed).toBe(false);
    expect(r.body.data.summary.deployed).toBe(1);
    expect(r.body.data.summary.ready).toBe(1);
    expect(r.body.data.summary.withEvidence).toBe(1);
  });

  it("applicationId filter narrows scope", async () => {
    const repo = makeRepo();
    await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_a", releaseTag: "a" });
    await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_b", releaseTag: "b" });
    const r = await buildReleaseListResponse(repo, "o", { applicationId: "app_a" });
    if (!r.body.ok) throw new Error("expected ok");
    expect(r.body.data.releases).toHaveLength(1);
    expect(r.body.data.releases[0].applicationId).toBe("app_a");
  });

  it("missing-table error → 503 migration_pending", async () => {
    const repo = makeRepo();
    repo.release.findMany = async () => {
      throw Object.assign(new Error("relation does not exist"), { code: "P2021" });
    };
    const r = await buildReleaseListResponse(repo, "o");
    expect(r.status).toBe(503);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("migration_pending");
  });

  it("unknown error → 500 internal_error with correlationId", async () => {
    const repo = makeRepo();
    repo.release.findMany = async () => { throw new Error("connection refused"); };
    const r = await buildReleaseListResponse(repo, "o", { correlationId: "cid_42" });
    expect(r.status).toBe(500);
    if (r.body.ok) throw new Error("expected error");
    expect(r.body.error).toBe("internal_error");
    expect(r.body.correlationId).toBe("cid_42");
  });

  it("isMissingTable detects P2021 code + 42P01 message + 'relation does not exist'", () => {
    expect(isMissingTable({ code: "P2021", message: "boom" })).toBe(true);
    expect(isMissingTable(new Error("Postgres responded with 42P01"))).toBe(true);
    expect(isMissingTable(new Error("relation \"x\" does not exist"))).toBe(true);
    expect(isMissingTable(new Error("rate limited"))).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});
