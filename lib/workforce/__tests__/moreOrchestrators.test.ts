/**
 * Phase 364/365 — orchestrator spec for schema / pipeline / finops /
 * secrets hygiene engineers.
 *
 * Verifies each orchestrator routes its risky action through
 * `recordEngineerActionAttempt` with the right engineerId, risk band,
 * action label, and connector. The recorder + kernels are mocked so
 * we test the orchestrator logic in isolation.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/workforce/engineerActionRecorder", () => ({
  recordEngineerActionAttempt: vi.fn(),
}));

// Mock the kernels so we control their outputs.
vi.mock("@/lib/agents/databaseSchemaReviewer", () => ({
  reviewSchema: vi.fn(),
  summarizeFindings: vi.fn(() => ({ total: 0, byKind: {}, bySeverity: {} })),
}));
vi.mock("@/lib/agents/slowQueryProposer", () => ({
  proposeForSlowQueries: vi.fn(),
}));
vi.mock("@/lib/agents/githubPipelineRepairer", () => ({
  repairPipeline: vi.fn(),
}));
vi.mock("@/lib/agents/idleCloudResourceDetector", () => ({
  detectIdleResources: vi.fn(),
}));
vi.mock("@/lib/agents/secretsHygieneScanner", () => ({
  scanForSecrets: vi.fn(),
}));

import { recordEngineerActionAttempt } from "@/lib/workforce/engineerActionRecorder";
import { reviewSchema } from "@/lib/agents/databaseSchemaReviewer";
import { proposeForSlowQueries } from "@/lib/agents/slowQueryProposer";
import { repairPipeline } from "@/lib/agents/githubPipelineRepairer";
import { detectIdleResources } from "@/lib/agents/idleCloudResourceDetector";
import { scanForSecrets } from "@/lib/agents/secretsHygieneScanner";

import { planAndRequestSchemaApply, planAndRequestIndexApply } from "../orchestrators/schemaEngineerOrchestrator";
import { planAndRequestPipelineFix } from "../orchestrators/pipelineRepairEngineerOrchestrator";
import { planAndRequestFinopsAction } from "../orchestrators/finopsEngineerOrchestrator";
import { planAndRequestSecretRotation, planAndRequestSecretQuarantine } from "../orchestrators/secretsHygieneEngineerOrchestrator";

const mockedRecorder = vi.mocked(recordEngineerActionAttempt);

beforeEach(() => {
  vi.clearAllMocks();
  mockedRecorder.mockResolvedValue({
    verdict: {
      decision: "requires_approval",
      effectiveRule: "two_step_approval",
      policySource: "canonical_default",
      reason: "stub",
      auditTopic: "engineer.action_requires_approval",
      requiredApprovers: 2,
      safeNextStep: "stub",
    },
    attemptId: "att_x",
    correlationId: "corr_x",
    approvalRequestNeeded: true,
    approvalRequestId: "appr_x",
  });
});

// -------- SCHEMA --------

describe("schemaEngineerOrchestrator", () => {
  it("refuses early when the target finding isn't in the review", async () => {
    vi.mocked(reviewSchema).mockReturnValue([]);
    const result = await planAndRequestSchemaApply({
      workspaceId: "ws", requestedBy: "alice",
      snapshot: { dialect: "postgres", tables: [] } as never,
      findingId: "missing",
    });
    expect(result.ok).toBe(false);
    expect(mockedRecorder).not.toHaveBeenCalled();
  });

  it("routes schema apply through the recorder with risk: critical", async () => {
    vi.mocked(reviewSchema).mockReturnValue([
      { id: "sf-1", kind: "missing_index", severity: "warn", table: "users", column: null, message: "" } as never,
    ]);
    const result = await planAndRequestSchemaApply({
      workspaceId: "ws", requestedBy: "alice",
      snapshot: { dialect: "postgres", tables: [] } as never,
      findingId: "sf-1",
      connector: "postgres",
    });
    expect(result.ok).toBe(true);
    const call = mockedRecorder.mock.calls[0]?.[0];
    expect(call?.engineerId).toBe("schema_engineer");
    expect(call?.riskLevel).toBe("critical");
    expect(call?.module).toBe("database");
    expect(call?.action).toMatch(/^apply_schema_change:/);
  });

  it("routes index apply with risk: high", async () => {
    vi.mocked(proposeForSlowQueries).mockReturnValue([
      { id: "sq-1", table: "orders", expectedGain: "high", sql: "", rationale: "", kind: "create_index" } as never,
    ]);
    const result = await planAndRequestIndexApply({
      workspaceId: "ws", requestedBy: "alice",
      slowQueries: [],
      context: { dialect: "postgres" } as never,
      proposalId: "sq-1",
    });
    expect(result.ok).toBe(true);
    const call = mockedRecorder.mock.calls[0]?.[0];
    expect(call?.engineerId).toBe("schema_engineer");
    expect(call?.riskLevel).toBe("high");
    expect(call?.action).toMatch(/^apply_index_change:orders$/);
  });
});

// -------- PIPELINE --------

describe("pipelineRepairEngineerOrchestrator", () => {
  it("maps dual_approval recommendation to risk: high", async () => {
    vi.mocked(repairPipeline).mockReturnValue({
      id: "rp-1",
      category: "secret_exposure",
      proposalKind: "patch",
      riskTier: "high",
      title: "stub",
      rationale: "stub",
      filePath: ".github/workflows/ci.yml",
      patch: "stub",
      recommendedGate: "dual_approval",
      confidence: 0.9,
    } as never);
    const result = await planAndRequestPipelineFix({
      workspaceId: "ws", requestedBy: "alice",
      failedRun: {} as never,
    });
    expect(result.proposal.id).toBe("rp-1");
    const call = mockedRecorder.mock.calls[0]?.[0];
    expect(call?.engineerId).toBe("pipeline_repair_engineer");
    expect(call?.riskLevel).toBe("high");
    expect(call?.connector).toBe("github");
    expect(call?.action).toMatch(/^apply_pipeline_fix:/);
  });

  it("maps auto_retry to risk: low", async () => {
    vi.mocked(repairPipeline).mockReturnValue({
      id: "rp-2", category: "transient", proposalKind: "retry",
      riskTier: "low", title: "", rationale: "", filePath: null, patch: null,
      recommendedGate: "auto_retry", confidence: 0.5,
    } as never);
    await planAndRequestPipelineFix({ workspaceId: "ws", requestedBy: "alice", failedRun: {} as never });
    expect(mockedRecorder.mock.calls[0]?.[0]?.riskLevel).toBe("low");
  });
});

// -------- FINOPS --------

describe("finopsEngineerOrchestrator", () => {
  it("refuses early when finding id is missing", async () => {
    vi.mocked(detectIdleResources).mockReturnValue([]);
    const result = await planAndRequestFinopsAction({
      workspaceId: "ws", requestedBy: "alice", resources: [], findingId: "ghost",
    });
    expect(result.ok).toBe(false);
    expect(mockedRecorder).not.toHaveBeenCalled();
  });

  it("routes the recommendation through the recorder with mapped risk", async () => {
    vi.mocked(detectIdleResources).mockReturnValue([
      {
        id: "idle-1", resourceId: "vol-abc", kind: "ebs_volume_unattached", verdict: "idle",
        riskTier: "medium", monthlySavingsUsd: 42,
        recommendation: { kind: "snapshot_then_delete", snapshotRetentionDays: 30 },
        rationale: "",
      } as never,
    ]);
    const result = await planAndRequestFinopsAction({
      workspaceId: "ws", requestedBy: "alice", resources: [], findingId: "idle-1",
    });
    expect(result.ok).toBe(true);
    const call = mockedRecorder.mock.calls[0]?.[0];
    expect(call?.engineerId).toBe("finops_engineer");
    expect(call?.riskLevel).toBe("medium");
    expect(call?.module).toBe("finops");
    expect(call?.action).toMatch(/^apply_rightsize_action:snapshot_then_delete:/);
  });
});

// -------- SECRETS --------

describe("secretsHygieneEngineerOrchestrator", () => {
  it("rotates with risk: critical for a critical-severity finding", async () => {
    vi.mocked(scanForSecrets).mockReturnValue({
      findings: [{
        kind: "aws_access_key", severity: "critical",
        line: 12, column: 4, redactedPreview: "AKIA***",
        recommendedAction: { kind: "rotate", rationale: "" },
      } as never],
      durationMs: 1, totalScanned: 1,
    } as never);
    const result = await planAndRequestSecretRotation({
      workspaceId: "ws", requestedBy: "alice",
      input: "fake",
      selector: { kind: "aws_access_key", line: 12, column: 4 },
    });
    expect(result.ok).toBe(true);
    const call = mockedRecorder.mock.calls[0]?.[0];
    expect(call?.engineerId).toBe("secrets_hygiene_engineer");
    expect(call?.riskLevel).toBe("critical");
    expect(call?.module).toBe("security");
    expect(call?.action).toMatch(/^rotate_secret:aws_access_key$/);
  });

  it("quarantines with risk: high regardless of severity", async () => {
    vi.mocked(scanForSecrets).mockReturnValue({
      findings: [{
        kind: "private_key_pem", severity: "info",
        line: 1, column: 0, redactedPreview: "---",
        recommendedAction: { kind: "quarantine_file", rationale: "" },
      } as never],
      durationMs: 1, totalScanned: 1,
    } as never);
    const result = await planAndRequestSecretQuarantine({
      workspaceId: "ws", requestedBy: "alice",
      input: "fake",
      selector: { kind: "private_key_pem", line: 1, column: 0 },
    });
    expect(result.ok).toBe(true);
    expect(mockedRecorder.mock.calls[0]?.[0]?.riskLevel).toBe("high");
  });

  it("refuses early when the selector matches no finding", async () => {
    vi.mocked(scanForSecrets).mockReturnValue({ findings: [], durationMs: 1, totalScanned: 0 } as never);
    const result = await planAndRequestSecretRotation({
      workspaceId: "ws", requestedBy: "alice",
      input: "clean",
      selector: { kind: "stripe_key", line: 1, column: 1 },
    });
    expect(result.ok).toBe(false);
    expect(mockedRecorder).not.toHaveBeenCalled();
  });
});
