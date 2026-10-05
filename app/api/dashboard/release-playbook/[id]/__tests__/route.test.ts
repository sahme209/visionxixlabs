/**
 * Locks in honest lifecycle reporting across the full Request -> Closure
 * Playbook for every real release.status value plus the "never
 * evaluated yet" case — no stage may fabricate a score, approval, or
 * closed state that the underlying data doesn't support.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  findRelease: vi.fn(),
  findReadiness: vi.fn(),
  findEvidence: vi.fn(),
  findAuditEvents: vi.fn(),
  findApprovalChain: vi.fn(),
  countPolicyViolations: vi.fn(),
  countCherryPicks: vi.fn(),
  findPullRequests: vi.fn(),
  findWorkflowRuns: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/db", () => ({
  prisma: {
    release: { findUnique: mocks.findRelease },
    releaseReadinessSnapshot: { findFirst: mocks.findReadiness },
    releaseEvidencePack: { findFirst: mocks.findEvidence },
    auditEvent: { findMany: mocks.findAuditEvents },
    axiomApprovalChain: { findFirst: mocks.findApprovalChain },
    policyViolation: { count: mocks.countPolicyViolations },
    cherryPickException: { count: mocks.countCherryPicks },
    pullRequestRecord: { findMany: mocks.findPullRequests },
    workflowRunRecord: { findMany: mocks.findWorkflowRuns },
  },
}));

function baseRelease(overrides: Record<string, unknown> = {}) {
  return {
    id: "rel_1",
    organizationId: "org_1",
    releaseTag: "v1.0.0",
    commitSha: "abc123",
    status: "draft",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    createdByUserId: "user_1",
    scopeFinalizedAt: null,
    actualDeployStart: null,
    actualDeployEnd: null,
    summary: null,
    targetEnvironmentId: null,
    plannedWindowStart: null,
    plannedWindowEnd: null,
    evidenceRepositoryId: null,
    ...overrides,
  };
}

function request() {
  return new NextRequest("https://visionxixlabs.com/api/dashboard/release-playbook/rel_1");
}

function params() {
  return { params: Promise.resolve({ id: "rel_1" }) };
}

describe("GET /api/dashboard/release-playbook/[id] — lifecycle truthfulness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, organizationId: "org_1" });
    mocks.findReadiness.mockResolvedValue(null);
    mocks.findEvidence.mockResolvedValue(null);
    mocks.findAuditEvents.mockResolvedValue([]);
    mocks.findApprovalChain.mockResolvedValue(null);
    mocks.countPolicyViolations.mockResolvedValue(0);
    mocks.countCherryPicks.mockResolvedValue(0);
    mocks.findPullRequests.mockResolvedValue([]);
    mocks.findWorkflowRuns.mockResolvedValue([]);
  });

  it("unscored/pending: no readiness snapshot or approval chain yet — never fabricates a score or approval", async () => {
    mocks.findRelease.mockResolvedValue(baseRelease({ status: "draft" }));
    const { GET } = await import("../route");
    const res = await GET(request(), params());
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.readiness.overallScore).toEqual({ available: false, reason: "No readiness snapshot has been evaluated yet." });
    expect(body.data.readiness.blockerCount).toEqual({ available: false, reason: "No readiness snapshot has been evaluated yet." });
    expect(body.data.approval.status).toBe("not_evaluated");
    expect(body.data.approval.required).toEqual({ available: false, reason: "Approval chain not yet created — readiness or policy evaluation has not run." });
    expect(body.data.execution.status).toBe("not_started");
    expect(body.data.closure.status).toBe("open");
  });

  it("blocked: readiness scored with real blockers, no approval yet", async () => {
    mocks.findRelease.mockResolvedValue(baseRelease({ status: "ready" }));
    mocks.findReadiness.mockResolvedValue({
      overallScore: 42,
      riskLevel: "high",
      driftRisk: 85,
      blockersJson: ["missing_rollback_plan", "no_validation_evidence"],
      evaluatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });
    const { GET } = await import("../route");
    const res = await GET(request(), params());
    const body = await res.json();

    expect(body.data.readiness.overallScore).toBe(42);
    expect(body.data.readiness.blockerCount).toBe(2);
    expect(body.data.risk.blastRadius).toBe("critical");
    expect(body.data.approval.status).toBe("not_evaluated");
  });

  it("pending approval: a chain exists and is genuinely pending — distinct from not_evaluated", async () => {
    mocks.findRelease.mockResolvedValue(baseRelease({ status: "ready" }));
    mocks.findApprovalChain.mockResolvedValue({ requiredCount: 2, status: "pending", votes: [{ decision: "approve" }] });
    const { GET } = await import("../route");
    const res = await GET(request(), params());
    const body = await res.json();

    expect(body.data.approval.status).toBe("pending");
    expect(body.data.approval.required).toBe(2);
    expect(body.data.approval.granted).toBe(1);
  });

  it("failed: execution status reflects a real failed release, closure is terminated", async () => {
    mocks.findRelease.mockResolvedValue(baseRelease({ status: "failed", actualDeployStart: new Date("2026-01-03T00:00:00.000Z") }));
    const { GET } = await import("../route");
    const res = await GET(request(), params());
    const body = await res.json();

    expect(body.data.execution.status).toBe("failed");
    expect(body.data.execution.startedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(body.data.closure.status).toBe("terminated");
  });

  it("rolled_back: execution and closure both reflect the real rollback, never 'closed'", async () => {
    mocks.findRelease.mockResolvedValue(baseRelease({ status: "rolled_back" }));
    const { GET } = await import("../route");
    const res = await GET(request(), params());
    const body = await res.json();

    expect(body.data.execution.status).toBe("rolled_back");
    expect(body.data.closure.status).toBe("terminated");
  });

  it("incomplete/in_progress: deploying status never claims closure", async () => {
    mocks.findRelease.mockResolvedValue(baseRelease({ status: "deploying" }));
    const { GET } = await import("../route");
    const res = await GET(request(), params());
    const body = await res.json();

    expect(body.data.execution.status).toBe("in_progress");
    expect(body.data.closure.status).toBe("open");
  });

  it("successful: deployed with a real approval and evidence pack closes honestly", async () => {
    mocks.findRelease.mockResolvedValue(baseRelease({
      status: "deployed",
      actualDeployStart: new Date("2026-01-04T00:00:00.000Z"),
      actualDeployEnd: new Date("2026-01-04T01:00:00.000Z"),
    }));
    mocks.findApprovalChain.mockResolvedValue({ requiredCount: 1, status: "approved", votes: [{ decision: "approve" }] });
    mocks.findEvidence.mockResolvedValue({ generatedAt: new Date("2026-01-04T00:30:00.000Z"), signedAt: new Date("2026-01-04T00:45:00.000Z") });
    const { GET } = await import("../route");
    const res = await GET(request(), params());
    const body = await res.json();

    expect(body.data.execution.status).toBe("completed");
    expect(body.data.closure.status).toBe("closed");
    expect(body.data.closure.closedAt).toBe("2026-01-04T01:00:00.000Z");
    expect(body.data.evidence.generatedAt).toBe("2026-01-04T00:30:00.000Z");
  });

  it("cross-tenant: a release belonging to another org is never returned", async () => {
    mocks.findRelease.mockResolvedValue(baseRelease({ organizationId: "other_org" }));
    const { GET } = await import("../route");
    const res = await GET(request(), params());
    const body = await res.json();

    expect(body.ok).toBe(false);
    expect(res.status).not.toBe(200);
  });
});
