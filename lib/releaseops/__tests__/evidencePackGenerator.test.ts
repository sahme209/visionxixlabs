import { describe, expect, it } from "vitest";
import {
  generateEvidencePack,
  sha256OfCanonicalJson,
  type EvidencePackGeneratorInput,
} from "../evidencePackGenerator";

const NOW = new Date("2026-05-25T12:00:00Z");

function baseInput(over: Partial<EvidencePackGeneratorInput> = {}): EvidencePackGeneratorInput {
  return {
    release: {
      id: "rel_1",
      organizationId: "o",
      applicationId: "app_checkout",
      status: "ready",
      releaseTag: "v2.4.0",
      commitSha: "abc123",
      scopeFinalizedAt: new Date("2026-05-23T10:00:00Z"),
      scopeFinalizedByUserId: "u_captain",
      plannedWindowStart: new Date("2026-05-24T16:00:00Z"),
      plannedWindowEnd: new Date("2026-05-24T18:00:00Z"),
      actualDeployStart: null,
      actualDeployEnd: null,
      summary: "Security patch + perf",
      createdAt: new Date("2026-05-20T10:00:00Z"),
    },
    repository: null,
    latestReadiness: null,
    prs: [],
    cherryPicks: [],
    linkedTickets: [],
    branchChecks: [],
    ...over,
  };
}

describe("generateEvidencePack", () => {
  it("base pack — empty sections, release metadata propagated", () => {
    const r = generateEvidencePack(baseInput(), { now: NOW });
    expect(r.content.schemaVersion).toBe(2);
    expect(r.content.generatedAtIso).toBe(NOW.toISOString());
    expect(r.content.release.releaseTag).toBe("v2.4.0");
    expect(r.content.release.scopeFinalizedByUserId).toBe("u_captain");
    expect(r.content.branchValidation).toEqual({
      total: 0, passing: 0, failing: 0, notApplicable: 0, unknown: 0, checks: [],
    });
    expect(r.content.pullRequests.count).toBe(0);
    expect(r.content.cherryPicks.count).toBe(0);
    expect(r.content.changeTickets.count).toBe(0);
  });

  it("repository populated → displayName built from owner/name", () => {
    const r = generateEvidencePack(baseInput({
      repository: { id: "repo_1", provider: "github", remoteOwner: "acme", remoteName: "checkout", defaultBranch: "main" },
    }), { now: NOW });
    expect(r.content.repository).toEqual({
      id: "repo_1", provider: "github", displayName: "acme/checkout", defaultBranch: "main",
    });
  });

  it("branch validation summary buckets by check state", () => {
    const r = generateEvidencePack(baseInput({
      branchChecks: [
        { key: "c1" as never, state: "pass", detail: "ok" },
        { key: "c2" as never, state: "pass", detail: "ok" },
        { key: "c3" as never, state: "fail", detail: "missing approval" },
        { key: "c4" as never, state: "not_applicable", detail: "n/a" },
        { key: "c5" as never, state: "unknown", detail: "no data" },
      ],
    }), { now: NOW });
    expect(r.content.branchValidation.total).toBe(5);
    expect(r.content.branchValidation.passing).toBe(2);
    expect(r.content.branchValidation.failing).toBe(1);
    expect(r.content.branchValidation.notApplicable).toBe(1);
    expect(r.content.branchValidation.unknown).toBe(1);
  });

  it("PR summary buckets by state", () => {
    const r = generateEvidencePack(baseInput({
      prs: [
        { id: "pr_1", number: 1, title: "A", state: "merged", mergedAt: new Date("2026-05-22T10:00:00Z"), mergedByUserId: "u_a", approvalsRequiredCount: 2, approvalsObservedCount: 2, codeownersApproved: true, ciStatus: "passing", linkedStories: ["PROJ-1"], linkedTickets: [], webUrl: "https://x/1" },
        { id: "pr_2", number: 2, title: "B", state: "open", mergedAt: null, mergedByUserId: null, approvalsRequiredCount: 1, approvalsObservedCount: 0, codeownersApproved: false, ciStatus: "pending", linkedStories: [], linkedTickets: [], webUrl: null },
        { id: "pr_3", number: 3, title: "C", state: "closed", mergedAt: null, mergedByUserId: null, approvalsRequiredCount: 0, approvalsObservedCount: 0, codeownersApproved: false, ciStatus: "not_run", linkedStories: [], linkedTickets: [], webUrl: null },
      ],
    }), { now: NOW });
    expect(r.content.pullRequests.count).toBe(3);
    expect(r.content.pullRequests.merged).toBe(1);
    expect(r.content.pullRequests.open).toBe(1);
    expect(r.content.pullRequests.closed).toBe(1);
    expect(r.content.pullRequests.items[0].mergedAtIso).toBe("2026-05-22T10:00:00.000Z");
  });

  it("cherry-pick + ticket sections aggregate by status / provider", () => {
    const r = generateEvidencePack(baseInput({
      cherryPicks: [
        { id: "cp_1", status: "approved", rationale: "hotfix CVE", approvedPrIds: ["pr_1"], excludedPrIds: [], hasFinalCommitValidation: true, requestedByUserId: "u_op", requestedAt: new Date("2026-05-22T10:00:00Z"), decidedByUserId: "u_app", decidedAt: new Date("2026-05-22T12:00:00Z"), decisionReason: "scope ok" },
        { id: "cp_2", status: "denied", rationale: "too broad", approvedPrIds: ["pr_x"], excludedPrIds: [], hasFinalCommitValidation: false, requestedByUserId: "u_op", requestedAt: new Date(), decidedByUserId: "u_app", decidedAt: new Date(), decisionReason: "split it" },
      ],
      linkedTickets: [
        { id: "t_1", provider: "jira", externalKey: "PROJ-1", title: "x", ticketType: "story", status: "implemented", priority: "normal", webUrl: null },
        { id: "t_2", provider: "linear", externalKey: "ENG-1", title: "y", ticketType: "task", status: "implemented", priority: "high", webUrl: null },
        { id: "t_3", provider: "jira", externalKey: "PROJ-2", title: "z", ticketType: "bug", status: "in_progress", priority: "critical", webUrl: null },
      ],
    }), { now: NOW });
    expect(r.content.cherryPicks.count).toBe(2);
    expect(r.content.cherryPicks.byStatus).toEqual({ approved: 1, denied: 1 });
    expect(r.content.changeTickets.count).toBe(3);
    expect(r.content.changeTickets.byProvider).toEqual({ jira: 2, linear: 1 });
  });

  it("contentHash is deterministic across reorderings", () => {
    const a = generateEvidencePack(baseInput({
      prs: [
        { id: "pr_1", number: 1, title: "A", state: "merged", mergedAt: NOW, mergedByUserId: "u", approvalsRequiredCount: 1, approvalsObservedCount: 1, codeownersApproved: true, ciStatus: "passing", linkedStories: [], linkedTickets: [], webUrl: null },
        { id: "pr_2", number: 2, title: "B", state: "merged", mergedAt: NOW, mergedByUserId: "u", approvalsRequiredCount: 1, approvalsObservedCount: 1, codeownersApproved: true, ciStatus: "passing", linkedStories: [], linkedTickets: [], webUrl: null },
      ],
    }), { now: NOW });
    // Same inputs, same generation moment → same hash.
    const b = generateEvidencePack(baseInput({
      prs: [
        { id: "pr_1", number: 1, title: "A", state: "merged", mergedAt: NOW, mergedByUserId: "u", approvalsRequiredCount: 1, approvalsObservedCount: 1, codeownersApproved: true, ciStatus: "passing", linkedStories: [], linkedTickets: [], webUrl: null },
        { id: "pr_2", number: 2, title: "B", state: "merged", mergedAt: NOW, mergedByUserId: "u", approvalsRequiredCount: 1, approvalsObservedCount: 1, codeownersApproved: true, ciStatus: "passing", linkedStories: [], linkedTickets: [], webUrl: null },
      ],
    }), { now: NOW });
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.contentHash).toHaveLength(64);
  });
});

describe("sha256OfCanonicalJson", () => {
  it("key order doesn't affect the hash", () => {
    const h1 = sha256OfCanonicalJson({ a: 1, b: 2 });
    const h2 = sha256OfCanonicalJson({ b: 2, a: 1 });
    expect(h1).toBe(h2);
  });
  it("changing a value changes the hash", () => {
    expect(sha256OfCanonicalJson({ a: 1 })).not.toBe(sha256OfCanonicalJson({ a: 2 }));
  });
  it("nested objects sort recursively", () => {
    const h1 = sha256OfCanonicalJson({ x: { a: 1, b: [3, 2, 1] } });
    const h2 = sha256OfCanonicalJson({ x: { b: [3, 2, 1], a: 1 } });
    expect(h1).toBe(h2);
  });
});
