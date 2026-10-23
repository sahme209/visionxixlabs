import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { realpathSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
const f = vi.hoisted(() => ({ client: undefined as unknown as PrismaClient, execute: vi.fn() }));
vi.mock("@/lib/db", () => ({ get prisma() { return f.client; } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: vi.fn() }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: vi.fn() }));
vi.mock("../stageExecutorRegistry", () => ({ bootstrapStageExecutorRegistry: vi.fn(), getStageExecutor: () => f.execute }));
vi.mock("../mintPipelineStageApproval", () => ({ mintPipelineStageApproval: vi.fn() }));
import { advancePipelineRun } from "../pipelineRunner";
const socket = process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
describe.skipIf(!socket)("saved budget authority through the runner and actual PostgreSQL", () => {
  beforeAll(async () => {
    if (!socket || !/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0 || (process.getuid && statSync(socket).uid !== process.getuid())) throw Error("owned_private_socket_required");
    f.client = new PrismaClient({ datasources: { db: { url: `postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}` } } });
    const [binding] = await f.client.$queryRawUnsafe<Array<{ private: boolean }>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);
    if (!binding?.private) throw Error("owned_fixture_binding_required");
  });
  afterAll(async () => { await f.client?.$disconnect(); });
  async function fixture(metadata: Record<string, unknown>, cap: number | null, overrides: Prisma.InputJsonValue = []) {
    f.execute.mockReset().mockResolvedValue({ ok: true, summary: "Synthetic zero-cost executor; no external action" });
    const organizationId = `budget_org_${randomUUID()}`;
    await f.client.organizationBudgetConfig.create({ data: { organizationId, defaultMaxCostCents: cap, pipelineOverrides: overrides, updatedBy: "synthetic_admin" } });
    const run = await f.client.pipelineRun.create({ data: { organizationId, pipelineId: "ai_coding", triggeredBy: "synthetic_member", correlationId: randomUUID(), status: "running", metadata: metadata as object,
      stages: { create: [
        { stageId: "prior", stageKind: "code_read", ordering: 0, status: "succeeded", requiresApproval: false, costCents: 100 },
        { stageId: "next", stageKind: "notify", ordering: 1, status: "queued", requiresApproval: false },
      ] } }, include: { stages: true } });
    return run;
  }
  async function outcome(runId: string) {
    await advancePipelineRun(runId);
    return f.client.pipelineStageRun.findFirstOrThrow({ where: { runId, ordering: 1 } });
  }
  it.each([{ unlimitedBudget: true }, { maxCostCents: 99_999 }])("refuses request metadata %j at an exhausted saved cap", async metadata => {
    const run = await fixture(metadata, 100); const stage = await outcome(run.id);
    expect(stage.status).toBe("failed"); expect(stage.outputDetail).toMatchObject({ capSource: "org_default" }); expect(f.execute).not.toHaveBeenCalled();
    expect((await f.client.pipelineRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("failed");
  });
  it("uses the saved per-pipeline cap even if the workspace default is unlimited", async () => {
    const run = await fixture({ unlimitedBudget: true }, null, [{ pipelineId: "ai_coding", maxCostCents: 100 }]);
    expect(await outcome(run.id)).toMatchObject({ status: "failed", outputDetail: { capSource: "org_pipeline_override" } }); expect(f.execute).not.toHaveBeenCalled();
  });
  it("refuses a malformed saved override instead of dropping it into unlimited", async () => {
    const run = await fixture({}, null, [{ pipelineId: "ai_coding", maxCostCents: "100" }]);
    expect(await outcome(run.id)).toMatchObject({ status: "failed", outputDetail: { budgetUnavailable: true } }); expect(f.execute).not.toHaveBeenCalled();
  });
  it.each([
    { overrides: { malformed: true } },
    { overrides: [{ pipelineId: "ai_coding", maxCostCents: 20 }, { pipelineId: "ai_coding", maxCostCents: null }] },
    { overrides: [null] },
  ])("refuses malformed stored JSON %j through the real database", async ({ overrides }) => {
    const run = await fixture({}, null, overrides);
    expect(await outcome(run.id)).toMatchObject({ status: "failed", outputDetail: { budgetUnavailable: true } }); expect(f.execute).not.toHaveBeenCalled();
  });
  it("refuses a saved zero cap instead of falling back to the platform default", async () => {
    const run = await fixture({}, 0);
    expect(await outcome(run.id)).toMatchObject({ status: "failed", outputDetail: { budgetUnavailable: true } }); expect(f.execute).not.toHaveBeenCalled();
  });
  it("preserves administrator-approved unlimited policy for a zero-cost fixture stage", async () => {
    const run = await fixture({}, null); expect((await outcome(run.id)).status).toBe("succeeded"); expect(f.execute).toHaveBeenCalledOnce();
  });
  it("allows request metadata to tighten a larger saved allowance", async () => {
    const run = await fixture({ maxCostCents: 100 }, 1000);
    expect(await outcome(run.id)).toMatchObject({ status: "failed", outputDetail: { capSource: "metadata_explicit_cap" } }); expect(f.execute).not.toHaveBeenCalled();
  });
});
