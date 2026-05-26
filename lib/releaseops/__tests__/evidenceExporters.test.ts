import { describe, expect, it } from "vitest";
import {
  EVIDENCE_EXPORT_DISCLAIMER,
  exportEvidence,
  exportEvidenceAsJson,
  exportEvidenceAsMarkdown,
} from "../evidenceExporters";
import type {
  ReleaseRow,
  ReleaseReadinessSnapshotRow,
  ReleaseEvidencePackRow,
} from "../releaseRepo";

const NOW = new Date("2026-06-01T22:00:00Z");

function makeRelease(over: Partial<ReleaseRow> = {}): ReleaseRow {
  return {
    id: "rel_01",
    organizationId: "o",
    applicationId: "app_checkout",
    targetEnvironmentId: "env_prod",
    releaseTag: "v2.7.0",
    commitSha: "deadbeefcafe",
    status: "deployed",
    scopeFinalizedAt: new Date("2026-06-01T20:00:00Z"),
    scopeFinalizedByUserId: "user_captain",
    rollbackReferenceReleaseId: "rel_00",
    plannedWindowStart: new Date("2026-06-01T22:00:00Z"),
    plannedWindowEnd: new Date("2026-06-01T23:30:00Z"),
    actualDeployStart: new Date("2026-06-01T22:05:00Z"),
    actualDeployEnd: new Date("2026-06-01T22:38:00Z"),
    summary: "Checkout retry banner + payment retries",
    createdAt: new Date("2026-06-01T18:00:00Z"),
    createdByUserId: "user_dev",
    updatedAt: new Date("2026-06-01T22:38:00Z"),
    ...over,
  };
}

function makeSnapshot(over: Partial<ReleaseReadinessSnapshotRow> = {}): ReleaseReadinessSnapshotRow {
  return {
    id: "snap_01",
    organizationId: "o",
    releaseId: "rel_01",
    evaluatedAt: new Date("2026-06-01T21:55:00Z"),
    branchGovernance: 88,
    changeCompliance: 50,
    artifactTraceability: 50,
    secretTraceability: 50,
    rollbackReadiness: 50,
    communicationReadiness: 50,
    driftRisk: 50,
    manualReconciliation: 50,
    overallScore: 55,
    riskLevel: "high",
    blockersJson: [
      { id: "b1", category: "branch_governance", severity: "high", message: "Missing CODEOWNERS approval.", remediation: "Get @platform team review." },
    ],
    evaluationSource: "auto",
    ...over,
  };
}

function makePack(over: Partial<ReleaseEvidencePackRow> = {}): ReleaseEvidencePackRow {
  return {
    id: "pack_01",
    organizationId: "o",
    releaseId: "rel_01",
    generatedAt: new Date("2026-06-01T22:00:00Z"),
    signedAt: new Date("2026-06-01T22:39:00Z"),
    contentHash: "sha256-deadbeef",
    contentJson: {
      release: { id: "rel_01", tag: "v2.7.0" },
      scope: { prList: [{ number: 482, title: "Retry banner" }] },
    },
    exportRefsJson: { pdf: "/exports/rel_01.pdf" },
    createdAt: new Date("2026-06-01T22:00:00Z"),
    updatedAt: new Date("2026-06-01T22:39:00Z"),
    ...over,
  };
}

/* ──────────────────────────────────────────────────────────────────
   JSON exporter.
   ────────────────────────────────────────────────────────────── */

describe("exportEvidenceAsJson", () => {
  it("returns the canonical schemaVersion + ISO timestamps + disclaimer", () => {
    const j = exportEvidenceAsJson({ release: makeRelease(), latestReadiness: makeSnapshot(), evidencePack: makePack() }, NOW);
    expect(j.schemaVersion).toBe(1);
    expect(j.generatedAtIso).toBe(NOW.toISOString());
    expect(j.disclaimer).toBe(EVIDENCE_EXPORT_DISCLAIMER);
  });

  it("release fields round-trip with ISO formatting", () => {
    const j = exportEvidenceAsJson({ release: makeRelease(), latestReadiness: null, evidencePack: null }, NOW);
    expect(j.release.releaseTag).toBe("v2.7.0");
    expect(j.release.commitSha).toBe("deadbeefcafe");
    expect(j.release.scopeFinalizedAtIso).toBe("2026-06-01T20:00:00.000Z");
    expect(j.release.actualDeployStartIso).toBe("2026-06-01T22:05:00.000Z");
    expect(j.release.actualDeployEndIso).toBe("2026-06-01T22:38:00.000Z");
    expect(j.readiness).toBeNull();
    expect(j.evidencePack).toBeNull();
  });

  it("readiness includes all 8 dimensions + blockers", () => {
    const j = exportEvidenceAsJson({ release: makeRelease(), latestReadiness: makeSnapshot(), evidencePack: null }, NOW);
    expect(j.readiness).not.toBeNull();
    expect(j.readiness!.overallScore).toBe(55);
    expect(j.readiness!.riskLevel).toBe("high");
    expect(j.readiness!.branchGovernance).toBe(88);
    expect(j.readiness!.blockers).toHaveLength(1);
    expect(j.readiness!.blockers[0].category).toBe("branch_governance");
  });

  it("evidence pack includes contentHash + signedAt + content", () => {
    const j = exportEvidenceAsJson({ release: makeRelease(), latestReadiness: null, evidencePack: makePack() }, NOW);
    expect(j.evidencePack).not.toBeNull();
    expect(j.evidencePack!.signedAtIso).toBe("2026-06-01T22:39:00.000Z");
    expect(j.evidencePack!.contentHash).toBe("sha256-deadbeef");
    expect(j.evidencePack!.content).toEqual({
      release: { id: "rel_01", tag: "v2.7.0" },
      scope: { prList: [{ number: 482, title: "Retry banner" }] },
    });
    expect(j.evidencePack!.exportRefs).toEqual({ pdf: "/exports/rel_01.pdf" });
  });

  it("unsigned pack shows signedAtIso null", () => {
    const j = exportEvidenceAsJson({
      release: makeRelease(),
      latestReadiness: null,
      evidencePack: makePack({ signedAt: null, contentHash: null }),
    }, NOW);
    expect(j.evidencePack!.signedAtIso).toBeNull();
    expect(j.evidencePack!.contentHash).toBeNull();
  });
});

/* ──────────────────────────────────────────────────────────────────
   Markdown exporter.
   ────────────────────────────────────────────────────────────── */

describe("exportEvidenceAsMarkdown", () => {
  it("contains heading with release tag + ISO generated stamp", () => {
    const md = exportEvidenceAsMarkdown(
      { release: makeRelease(), latestReadiness: makeSnapshot(), evidencePack: makePack() },
      NOW,
    );
    expect(md).toMatch(/^# Release Evidence Pack — v2\.7\.0/m);
    expect(md).toMatch(/_Generated 2026-06-01T22:00:00\.000Z_/);
  });

  it("renders the release section with id, application, status, tag, commit", () => {
    const md = exportEvidenceAsMarkdown(
      { release: makeRelease(), latestReadiness: null, evidencePack: null },
      NOW,
    );
    expect(md).toMatch(/\*\*ID:\*\* `rel_01`/);
    expect(md).toMatch(/\*\*Application:\*\* `app_checkout`/);
    expect(md).toMatch(/\*\*Status:\*\* deployed/);
    expect(md).toMatch(/\*\*Release tag:\*\* v2\.7\.0/);
    expect(md).toMatch(/\*\*Commit SHA:\*\* `deadbeefcafe`/);
  });

  it("renders the 8-dimension readiness table when snapshot present", () => {
    const md = exportEvidenceAsMarkdown(
      { release: makeRelease(), latestReadiness: makeSnapshot(), evidencePack: null },
      NOW,
    );
    expect(md).toMatch(/\| Branch governance/);
    expect(md).toMatch(/\| Change compliance/);
    expect(md).toMatch(/\| Manual reconciliation/);
    expect(md).toMatch(/\*\*Overall score:\*\* 55\/100/);
    expect(md).toMatch(/\*\*risk:\*\* high/);
  });

  it("renders blockers under the readiness section", () => {
    const md = exportEvidenceAsMarkdown(
      { release: makeRelease(), latestReadiness: makeSnapshot(), evidencePack: null },
      NOW,
    );
    expect(md).toMatch(/Missing CODEOWNERS approval/);
    expect(md).toMatch(/_Remediation:_ Get @platform team review/);
  });

  it("renders 'no readiness' marker when snapshot is null", () => {
    const md = exportEvidenceAsMarkdown(
      { release: makeRelease(), latestReadiness: null, evidencePack: null },
      NOW,
    );
    expect(md).toMatch(/No readiness evaluation has been persisted/);
  });

  it("renders signed-state + content hash + JSON content block when pack present", () => {
    const md = exportEvidenceAsMarkdown(
      { release: makeRelease(), latestReadiness: null, evidencePack: makePack() },
      NOW,
    );
    expect(md).toMatch(/\*\*Signed:\*\* 2026-06-01T22:39:00\.000Z/);
    expect(md).toMatch(/\*\*Content hash \(SHA-256\):\*\* `sha256-deadbeef`/);
    expect(md).toMatch(/```json/);
    expect(md).toMatch(/"release": {/);
  });

  it("renders 'unsigned draft' when pack is not yet sealed", () => {
    const md = exportEvidenceAsMarkdown(
      { release: makeRelease(), latestReadiness: null, evidencePack: makePack({ signedAt: null }) },
      NOW,
    );
    expect(md).toMatch(/\*\*Signed:\*\* _unsigned draft_/);
  });

  it("renders pre-generated export refs when present", () => {
    const md = exportEvidenceAsMarkdown(
      { release: makeRelease(), latestReadiness: null, evidencePack: makePack() },
      NOW,
    );
    expect(md).toMatch(/### Pre-generated export refs/);
    expect(md).toMatch(/\*\*pdf:\*\* \/exports\/rel_01\.pdf/);
  });

  it("always ends with the disclaimer", () => {
    const md = exportEvidenceAsMarkdown(
      { release: makeRelease(), latestReadiness: null, evidencePack: null },
      NOW,
    );
    expect(md.trimEnd().endsWith(`_${EVIDENCE_EXPORT_DISCLAIMER}_`)).toBe(true);
  });
});

/* ──────────────────────────────────────────────────────────────────
   Format dispatch.
   ────────────────────────────────────────────────────────────── */

describe("exportEvidence dispatch", () => {
  it("json → content-type application/json + .json filename", () => {
    const out = exportEvidence(
      { release: makeRelease(), latestReadiness: null, evidencePack: null },
      "json",
      NOW,
    );
    expect(out.contentType).toBe("application/json");
    expect(out.filename).toBe("release-evidence-v2.7.0.json");
    expect(JSON.parse(out.body).schemaVersion).toBe(1);
  });

  it("markdown → content-type text/markdown + .md filename", () => {
    const out = exportEvidence(
      { release: makeRelease(), latestReadiness: null, evidencePack: null },
      "markdown",
      NOW,
    );
    expect(out.contentType).toMatch(/text\/markdown/);
    expect(out.filename).toBe("release-evidence-v2.7.0.md");
    expect(out.body).toMatch(/^# Release Evidence Pack/);
  });

  it("falls back to release id when releaseTag is null", () => {
    const out = exportEvidence(
      { release: makeRelease({ releaseTag: null }), latestReadiness: null, evidencePack: null },
      "json",
      NOW,
    );
    expect(out.filename).toBe("release-evidence-rel_01.json");
  });
});
