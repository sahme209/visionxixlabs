import { describe, expect, it } from "vitest";
import {
  UNMEASURED_BASELINE,
  dimensionForEngineBlockerKind,
  persistReleaseReadinessEvaluation,
  severityForEngineBlocker,
} from "../persistReadinessEvaluation";
import { createReleaseDraft, listRecentReadinessSnapshots } from "../releaseRepo";
import type {
  ReleaseEvidencePackRow,
  ReleaseReadinessSnapshotRow,
  ReleaseRepo,
  ReleaseRow,
} from "../releaseRepo";
import type {
  GithubBranchProtectionPreview,
  GithubRepoPreview,
  GithubWorkflowPreview,
} from "@/lib/connectors/github/githubPreviewSync";

/* ──────────────────────────────────────────────────────────────────
   Reuse the Phase 442 in-memory stub pattern.
   ────────────────────────────────────────────────────────────── */

interface Stub extends ReleaseRepo {
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
          organizationId: data.organizationId,
          applicationId: data.applicationId,
          targetEnvironmentId: data.targetEnvironmentId ?? null,
          releaseTag: data.releaseTag ?? null,
          commitSha: data.commitSha ?? null,
          status: (data.status as ReleaseRow["status"]) ?? "draft",
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

/* ──────────────────────────────────────────────────────────────────
   Engine input fixtures.
   ────────────────────────────────────────────────────────────── */

const CLEAN_REPO: GithubRepoPreview = {
  id: "repo_1", name: "checkout", defaultBranch: "main",
} as unknown as GithubRepoPreview;

const STRONG_PROTECTION: GithubBranchProtectionPreview = {
  repoId: "repo_1", branch: "main",
  requiredReviewers: 2, requireSignedCommits: true,
  requireStatusChecks: ["ci/build", "ci/test"],
} as unknown as GithubBranchProtectionPreview;

const WEAK_PROTECTION: GithubBranchProtectionPreview = {
  repoId: "repo_1", branch: "main",
  requiredReviewers: 1, requireSignedCommits: false,
  requireStatusChecks: [],
} as unknown as GithubBranchProtectionPreview;

const PASSING_WORKFLOW: GithubWorkflowPreview = {
  id: "wf_1", repoId: "repo_1", name: "CI", filename: ".github/workflows/ci.yml",
  lastRunStatus: "success", lastRunAt: "2026-05-25T12:00:00Z",
} as unknown as GithubWorkflowPreview;

const FAILING_WORKFLOW: GithubWorkflowPreview = {
  id: "wf_2", repoId: "repo_1", name: "Deploy", filename: ".github/workflows/deploy.yml",
  lastRunStatus: "failure", lastRunAt: "2026-05-25T12:00:00Z",
} as unknown as GithubWorkflowPreview;

/* ──────────────────────────────────────────────────────────────────
   Pure helpers.
   ────────────────────────────────────────────────────────────── */

describe("dimensionForEngineBlockerKind — closed-union mapping", () => {
  it("branch-protection kinds map to branch_governance", () => {
    expect(dimensionForEngineBlockerKind("branch_protection_missing")).toBe("branch_governance");
    expect(dimensionForEngineBlockerKind("branch_protection_weak")).toBe("branch_governance");
    expect(dimensionForEngineBlockerKind("signed_commits_missing")).toBe("branch_governance");
    expect(dimensionForEngineBlockerKind("required_checks_missing")).toBe("branch_governance");
  });

  it("workflow_failing maps to artifact_traceability", () => {
    expect(dimensionForEngineBlockerKind("workflow_failing")).toBe("artifact_traceability");
  });

  it("drift/sync kinds map to drift_risk", () => {
    expect(dimensionForEngineBlockerKind("stale_sync")).toBe("drift_risk");
    expect(dimensionForEngineBlockerKind("env_drift")).toBe("drift_risk");
  });

  it("rollback_unverified maps to rollback_readiness", () => {
    expect(dimensionForEngineBlockerKind("rollback_unverified")).toBe("rollback_readiness");
  });

  it("no_deployment_approval maps to communication_readiness", () => {
    expect(dimensionForEngineBlockerKind("no_deployment_approval")).toBe("communication_readiness");
  });
});

describe("severityForEngineBlocker — closed-union mapping", () => {
  it("info collapses to low (Phase 442 has no info level)", () => {
    expect(severityForEngineBlocker("info")).toBe("low");
  });
  it("low/medium/high/critical pass through", () => {
    expect(severityForEngineBlocker("low")).toBe("low");
    expect(severityForEngineBlocker("medium")).toBe("medium");
    expect(severityForEngineBlocker("high")).toBe("high");
    expect(severityForEngineBlocker("critical")).toBe("critical");
  });
});

/* ──────────────────────────────────────────────────────────────────
   persistReleaseReadinessEvaluation — end-to-end.
   ────────────────────────────────────────────────────────────── */

describe("persistReleaseReadinessEvaluation", () => {
  it("clean inputs → snapshot with branchGovernance=100, other dims at baseline, no blockers", async () => {
    const repo = makeRepo();
    const release = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });

    const result = await persistReleaseReadinessEvaluation(repo, {
      organizationId: "o", releaseId: release.id,
      engineInputs: { repos: [CLEAN_REPO], workflows: [PASSING_WORKFLOW], protections: [STRONG_PROTECTION] },
      evaluationSource: "auto",
    });

    expect(result.snapshot.branchGovernance).toBe(100);
    expect(result.snapshot.changeCompliance).toBe(UNMEASURED_BASELINE);
    expect(result.snapshot.artifactTraceability).toBe(UNMEASURED_BASELINE);
    expect(result.snapshot.secretTraceability).toBe(UNMEASURED_BASELINE);
    expect(result.snapshot.rollbackReadiness).toBe(UNMEASURED_BASELINE);
    expect(result.snapshot.communicationReadiness).toBe(UNMEASURED_BASELINE);
    expect(result.snapshot.driftRisk).toBe(UNMEASURED_BASELINE);
    expect(result.snapshot.manualReconciliation).toBe(UNMEASURED_BASELINE);
    expect(result.snapshot.blockersJson).toEqual([]);
    expect(result.engineGrade).toBe("A");
  });

  it("missing branch protection → branchGovernance drops, blocker projected with branch_governance category", async () => {
    const repo = makeRepo();
    const release = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });

    const result = await persistReleaseReadinessEvaluation(repo, {
      organizationId: "o", releaseId: release.id,
      engineInputs: {
        repos: [CLEAN_REPO],
        workflows: [PASSING_WORKFLOW],
        protections: [], // ← no protection → critical blocker
      },
      evaluationSource: "auto",
    });

    // engine subtracts 24 for critical: 100 - 24 = 76
    expect(result.snapshot.branchGovernance).toBe(76);
    expect(result.snapshot.blockersJson.length).toBe(1);
    const b = result.snapshot.blockersJson[0];
    expect(b.category).toBe("branch_governance");
    expect(b.severity).toBe("critical");
  });

  it("failing workflow → projects to artifact_traceability category", async () => {
    const repo = makeRepo();
    const release = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    const result = await persistReleaseReadinessEvaluation(repo, {
      organizationId: "o", releaseId: release.id,
      engineInputs: { repos: [CLEAN_REPO], workflows: [FAILING_WORKFLOW], protections: [STRONG_PROTECTION] },
      evaluationSource: "auto",
    });
    const wfBlocker = result.snapshot.blockersJson.find((b) => b.id.startsWith("blk_wf_"));
    expect(wfBlocker).toBeDefined();
    expect(wfBlocker!.category).toBe("artifact_traceability");
    expect(wfBlocker!.severity).toBe("high");
  });

  it("multiple weak signals → branchGovernance reflects engine math; overall reflects 8-dim mean", async () => {
    const repo = makeRepo();
    const release = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    const result = await persistReleaseReadinessEvaluation(repo, {
      organizationId: "o", releaseId: release.id,
      engineInputs: {
        repos: [CLEAN_REPO],
        workflows: [PASSING_WORKFLOW],
        protections: [WEAK_PROTECTION], // 3 weak signals: reviewers <2 (high=14) + unsigned (medium=8) + no checks (high=14) = -36
      },
      evaluationSource: "auto",
    });
    expect(result.snapshot.branchGovernance).toBe(100 - 14 - 8 - 14);
    // overallScore = mean of 8 dims = (64 + 50*7) / 8 = (64+350)/8 = 51.75 → 52
    expect(result.snapshot.overallScore).toBe(52);
    expect(result.snapshot.riskLevel).toBe("high"); // 40-59
  });

  it("snapshot is persisted + retrievable via listRecentReadinessSnapshots", async () => {
    const repo = makeRepo();
    const release = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    await persistReleaseReadinessEvaluation(repo, {
      organizationId: "o", releaseId: release.id,
      engineInputs: { repos: [CLEAN_REPO], workflows: [PASSING_WORKFLOW], protections: [STRONG_PROTECTION] },
      evaluationSource: "cron:nightly",
    });
    const recent = await listRecentReadinessSnapshots(repo, { releaseId: release.id });
    expect(recent).toHaveLength(1);
    expect(recent[0].evaluationSource).toBe("cron:nightly");
  });

  it("evaluatedAt override is honored (determinism for tests/replay)", async () => {
    const repo = makeRepo();
    const release = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    const at = new Date("2026-06-01T22:00:00Z");
    const r = await persistReleaseReadinessEvaluation(repo, {
      organizationId: "o", releaseId: release.id,
      engineInputs: { repos: [CLEAN_REPO], workflows: [PASSING_WORKFLOW], protections: [STRONG_PROTECTION] },
      evaluationSource: "manual",
      evaluatedAt: at,
    });
    expect(r.snapshot.evaluatedAt.getTime()).toBe(at.getTime());
  });

  it("engineSummary + engineGrade are returned for UI badges", async () => {
    const repo = makeRepo();
    const release = await createReleaseDraft(repo, { organizationId: "o", applicationId: "app_1" });
    const r = await persistReleaseReadinessEvaluation(repo, {
      organizationId: "o", releaseId: release.id,
      engineInputs: { repos: [CLEAN_REPO], workflows: [PASSING_WORKFLOW], protections: [STRONG_PROTECTION] },
      evaluationSource: "auto",
    });
    expect(r.engineSummary).toMatch(/Release-ready/);
    expect(r.engineGrade).toBe("A");
  });
});
