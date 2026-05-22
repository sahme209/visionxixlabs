/**
 * Migration Engineer orchestrator — gated-apply spec.
 *
 * Mocks the recorder + the kernel so we test the orchestrator's
 * decision logic in isolation. Verifies the early-refuse path for
 * blocked runbooks and the typed result shape for the happy path.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/workforce/engineerActionRecorder", () => ({
  recordEngineerActionAttempt: vi.fn(),
}));

vi.mock("@/lib/agents/migrationCoordinator", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents/migrationCoordinator")>("@/lib/agents/migrationCoordinator");
  return {
    ...actual,
    buildRunbook: vi.fn(),
  };
});

import { recordEngineerActionAttempt } from "@/lib/workforce/engineerActionRecorder";
import { buildRunbook } from "@/lib/agents/migrationCoordinator";
import { planAndRequestMigrationApply } from "../orchestrators/migrationEngineerOrchestrator";
import type { MigrationRunbook, MigrationDescriptor } from "@/lib/agents/migrationCoordinator";

const mockedRecorder = vi.mocked(recordEngineerActionAttempt);
const mockedBuild = vi.mocked(buildRunbook);

const descriptor: MigrationDescriptor = {
  id: "mig_test",
  kind: "add_column",
  target: "users",
  rationale: "test",
  hasReverseScript: true,
  hasActiveWriters: false,
  estimatedRowCount: 1000,
  windowHours: 24,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("planAndRequestMigrationApply", () => {
  it("refuses early when the runbook is blocked, never touching the recorder", async () => {
    const blockedRunbook: MigrationRunbook = {
      descriptor,
      stages: [],
      overallVerdict: "blocked",
      errors: ["missing reverse script"],
    };
    mockedBuild.mockReturnValue(blockedRunbook);

    const result = await planAndRequestMigrationApply({
      workspaceId: "ws_test",
      requestedBy: "user_alice",
      descriptor,
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.reason).toBe("runbook_blocked");
      expect(result.runbook.overallVerdict).toBe("blocked");
    }
    expect(mockedRecorder).not.toHaveBeenCalled();
  });

  it("records the gated apply attempt when the runbook is ready", async () => {
    const readyRunbook: MigrationRunbook = {
      descriptor,
      stages: [
        { order: 0, kind: "preflight", description: "dry-run", verdict: "ready", rollback: "rerun", gateChecks: [] },
      ],
      overallVerdict: "ready",
      errors: [],
    };
    mockedBuild.mockReturnValue(readyRunbook);

    mockedRecorder.mockResolvedValue({
      verdict: {
        decision: "requires_approval",
        effectiveRule: "two_step_approval",
        policySource: "canonical_default",
        reason: "Action requires two approvals per workspace policy.",
        auditTopic: "engineer.action_requires_approval",
        requiredApprovers: 2,
        safeNextStep: "Approval request created.",
      },
      attemptId: "att_1",
      correlationId: "corr_1",
      approvalRequestNeeded: true,
      approvalRequestId: "appr_1",
    });

    const result = await planAndRequestMigrationApply({
      workspaceId: "ws_test",
      requestedBy: "user_alice",
      descriptor,
      connector: "postgres",
    });

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.verdict.decision).toBe("requires_approval");
      expect(result.verdict.requiredApprovers).toBe(2);
      expect(result.approvalRequestId).toBe("appr_1");
      expect(result.attemptId).toBe("att_1");
    }

    expect(mockedRecorder).toHaveBeenCalledTimes(1);
    const call = mockedRecorder.mock.calls[0]?.[0];
    expect(call?.engineerId).toBe("migration_engineer");
    expect(call?.riskLevel).toBe("critical");
    expect(call?.isReadOnly).toBe(false);
    expect(call?.action).toMatch(/^apply_migration:add_column:users$/);
    expect(call?.connector).toBe("postgres");
  });

  it("propagates blocked verdicts unchanged", async () => {
    const readyRunbook: MigrationRunbook = {
      descriptor,
      stages: [{ order: 0, kind: "preflight", description: "ok", verdict: "ready", rollback: "rerun", gateChecks: [] }],
      overallVerdict: "ready",
      errors: [],
    };
    mockedBuild.mockReturnValue(readyRunbook);

    mockedRecorder.mockResolvedValue({
      verdict: {
        decision: "blocked",
        effectiveRule: "blocked_always",
        policySource: "engineer_disabled",
        reason: "Engineer disabled in this workspace.",
        auditTopic: "engineer.action_blocked",
        requiredApprovers: 0,
        safeNextStep: "Workspace admin can re-enable.",
      },
      attemptId: "att_2",
      correlationId: "corr_2",
      approvalRequestNeeded: false,
    });

    const result = await planAndRequestMigrationApply({
      workspaceId: "ws_test",
      requestedBy: "user_alice",
      descriptor,
    });

    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.verdict.decision).toBe("blocked");
      expect(result.approvalRequestId).toBeUndefined();
    }
  });
});
