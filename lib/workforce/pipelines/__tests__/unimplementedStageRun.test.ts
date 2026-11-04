import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  read: vi.fn(), updateRun: vi.fn(), updateStage: vi.fn(), aggregate: vi.fn(), claim: vi.fn(),
  transaction: vi.fn(), lockRun: vi.fn(), calls: vi.fn(), stages: vi.fn(), config: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {
  pipelineRun: { findUnique: m.read, update: m.updateRun },
  pipelineStageRun: { updateMany: m.claim, update: m.updateStage, aggregate: m.aggregate },
  organizationBudgetConfig: { findUnique: m.config },
  $transaction: m.transaction,
} }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../mintPipelineStageApproval", () => ({ mintPipelineStageApproval: vi.fn() }));
import { advancePipelineRun } from "../pipelineRunner";
import { bootstrapStageExecutorRegistry, __resetStageExecutorRegistry, registerStageExecutor } from "../stageExecutorRegistry";

beforeEach(() => vi.clearAllMocks());
afterEach(__resetStageExecutorRegistry);

function setupRun() {
  const stage = { id: "stage", runId: "run", stageId: "notify", stageKind: "notify", ordering: 0, status: "queued", requiresApproval: false, costCents: 0 };
  const run = { id: "run", organizationId: "org", pipelineId: "ai_coding", triggeredBy: "user", correlationId: "correlation", status: "running", startedAt: new Date(), metadata: {}, stages: [stage] };
  m.read.mockImplementation(async () => run);
  m.aggregate.mockResolvedValue({ _sum: { costCents: 0 } });
  m.config.mockResolvedValue(null);
  m.claim.mockImplementation(async () => { stage.status = "running"; return { count: 1 }; });
  m.updateStage.mockImplementation(async ({ data }) => Object.assign(stage, data));
  m.updateRun.mockImplementation(async ({ data }) => Object.assign(run, data));
  // Use the real financial reader with coherent transaction-local zero exposure,
  // rather than mocking its admission result or bypassing ai_coding accounting.
  m.lockRun.mockResolvedValue([{ id: run.id }]);
  m.calls.mockResolvedValue([]);
  m.stages.mockImplementation(async () => [stage]);
  m.transaction.mockImplementation(async (callback) => callback({
    $queryRawUnsafe: m.lockRun,
    pipelineAICallReservation: { findMany: m.calls },
    pipelineStageRun: { findMany: m.stages },
  }));
  return { stage, run };
}

it("records an unavailable notification as failed and never marks the run completed", async () => {
  const { stage, run } = setupRun();
  bootstrapStageExecutorRegistry();
  await advancePipelineRun("run");
  expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  expect(m.lockRun).toHaveBeenCalledWith(expect.any(String), "run", "org");
  expect(m.calls).toHaveBeenCalledWith({ where: { organizationId: "org", runId: "run" }, take: 4097 });
  expect(stage.status).toBe("failed");
  expect(run.status).toBe("failed");
  expect(m.updateRun).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "succeeded" }) }));
  expect(m.updateStage).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ outputDetail: expect.objectContaining({ executorUnavailable: true, externalActionPerformed: false }) }) }));
});

it.each(["missing", "unreadable"])("refuses notification execution when financial proof is %s", async (failure) => {
  const { stage, run } = setupRun();
  if (failure === "missing") m.lockRun.mockResolvedValue([]);
  else m.lockRun.mockRejectedValue(new Error("synthetic financial read refusal"));
  const executor = vi.fn().mockResolvedValue({ ok: true, summary: "must not execute" });
  registerStageExecutor("notify", executor);
  await advancePipelineRun("run");
  expect(executor).not.toHaveBeenCalled();
  expect(stage.status).toBe("failed");
  expect(run.status).toBe("failed");
  expect(m.updateRun).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "succeeded" }) }));
  expect(m.updateStage).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ outputDetail: { budgetUnavailable: true } }) }));
});
