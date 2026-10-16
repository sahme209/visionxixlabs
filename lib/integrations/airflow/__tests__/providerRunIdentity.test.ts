import { beforeEach, describe, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ load: vi.fn(), audit: vi.fn(), execute: vi.fn(), propose: vi.fn(), rules: vi.fn(), update: vi.fn() }));
vi.mock("../connection", () => ({ loadAirflowClient: io.load }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: async () => ({ organizationId: "tenant", userId: "owner" }) }));
vi.mock("@/lib/db", () => ({ prisma: {
  airflowAutomation: { groupBy: async () => [{ organizationId: "tenant" }], findMany: io.rules, update: io.update },
  airflowDagRunSnapshot: { upsert: vi.fn() },
  airflowAutomationExecution: { create: io.propose, findUnique: async () => null, findMany: async () => [] },
} }));
vi.mock("../automationExecutor", () => ({ executeAirflowAutomation: io.execute }));
vi.mock("@/lib/releaseops/auditEventResponder", () => ({ appendAuditEvent: io.audit }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: async () => undefined }));
import { AirflowClient } from "../airflowClient";
import { GET, POST } from "@/app/api/desktop/airflow/dags/[dagId]/runs/route";
import { runAirflowAutomationTick } from "../automationTick";
import { NextRequest } from "next/server";
const params = { params: Promise.resolve({ dagId: "daily" }) };
const client = () => new AirflowClient("https://airflow.example.test", { authMode: "token", token: "synthetic-token" });
const run = (dag_id = "daily", dag_run_id = "source") => ({ dag_id, dag_run_id, state: "success", logical_date: "2026-10-15T10:00:00Z" });
beforeEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); io.load.mockResolvedValue({ client: client(), connectionId: "fixture" }); });
describe("provider run identity at real client/consumer boundaries", () => {
  it("does not return another DAG's runs through the desktop route", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ dag_runs: [run("other")] })));
    expect((await GET(new NextRequest("https://app.example.test/api/desktop/airflow/dags/daily/runs"), params)).status).toBe(502);
  });
  it("never proposes from a foreign-DAG dependency success", async () => {
    io.rules.mockResolvedValue([{ id: "rule", dagId: "daily", dependencyDagIds: ["dependency"], triggerMode: "completion", requiredDagState: "success", createdAt: new Date(0), actionType: "open_pull_request", approvalRequired: false }]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ dag_runs: [run()] })).mockResolvedValueOnce(Response.json({ dag_runs: [run("unrelated")] })));
    expect(await runAirflowAutomationTick()).toMatchObject({ proposals: 0, actions: 0, errors: 1 });
    expect(io.propose).not.toHaveBeenCalled(); expect(io.execute).not.toHaveBeenCalled();
  });
  it("does not claim a successful trigger or emit triggered audit when HTTP200 returns the wrong identity", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(run("other", "unrelated"))); vi.stubGlobal("fetch", fetcher);
    const response = await POST(new NextRequest("https://app.example.test/api/desktop/airflow/dags/daily/runs", { method: "POST", body: "{}" }), params);
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe("airflow_trigger_outcome_unknown");
    expect(io.audit).not.toHaveBeenCalled(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([{}, null, { dag_runs: {} }, { dag_runs: [run("daily", "")] }])("refuses malformed run-list identity instead of reporting safe emptiness: %j", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    await expect(client().listDagRuns("daily")).rejects.toThrow("airflow_run_response_invalid");
  });
  it.each([null, {}, { dag_id: "daily" }, run("daily", "wrong")])("keeps a malformed trigger response unknown and does not replay: %j", async (body) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(body)); vi.stubGlobal("fetch", fetcher);
    await expect(client().triggerDag("daily", {}, "expected")).rejects.toThrow("airflow_trigger_outcome_unknown");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it("retains an unknown scheduled occurrence identity until exact conflict reconciliation confirms it", async () => {
  io.rules.mockResolvedValue([{ id: "rule", name: "Fixture", dagId: "daily", dependencyDagIds: [], triggerMode: "schedule", scheduleCron: "0 * * * *", nextScheduledAt: new Date("2026-10-15T10:00:00Z"), createdAt: new Date(0), requiredDagState: "success" }]);
  const submitted: string[] = [];
  const accepted = new Set<string>();
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
    if (init.method === "POST") {
      const identity = JSON.parse(String(init.body)).dag_run_id;
      submitted.push(identity);
      if (accepted.has(identity)) return new Response("{}", { status: 409 });
      accepted.add(identity);
      return Response.json(run("unrelated", "misrouted-receipt"));
    }
    if (url.includes("/dagRuns/")) return Response.json({ ...run("daily", submitted[0]), state: "queued", logical_date: null });
    return Response.json({ dag_runs: [] });
  }));
  expect(await runAirflowAutomationTick(new Date("2026-10-15T10:01:00Z"))).toMatchObject({ errors: 1, proposals: 0 });
  expect(io.update).not.toHaveBeenCalled();
  expect(await runAirflowAutomationTick(new Date("2026-10-15T10:02:00Z"))).toMatchObject({ errors: 0, proposals: 0 });
  expect(submitted).toHaveLength(2); expect(submitted[0]).toBe(submitted[1]); expect(accepted.size).toBe(1);
  expect(io.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nextScheduledAt: expect.any(Date) }) }));
});
it("retains valid null-date manual runs and empty run collections", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ dag_runs: [{ ...run(), logical_date: null }] })).mockResolvedValueOnce(Response.json({ dag_runs: [] })));
  expect(await client().listDagRuns("daily")).toEqual([expect.objectContaining({ dagId: "daily", dagRunId: "source", logicalDate: null })]);
  expect(await client().listDagRuns("daily")).toEqual([]);
});
