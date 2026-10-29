import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), verify: vi.fn(), create: vi.fn(), revise: vi.fn(), parse: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { tauriPlaybook: { findMany: async () => [] } } }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.session }));
vi.mock("@/lib/tauri/intakeWorkflowSource", () => ({ verifyIntakeWorkflowSource: mocks.verify }));
vi.mock("@/lib/tauri/deploymentIntakeSchema", () => ({ parseDeploymentIntake: mocks.parse }));
vi.mock("@/lib/tauri/deploymentRequestRepo", () => ({ createDeploymentRequest: mocks.create, reviseDeploymentRequest: mocks.revise, listDeploymentRequests: mocks.list }));
import { GET, POST } from "@/app/api/desktop/deployments/route";
import { PUT } from "@/app/api/desktop/deployments/[id]/route";
const intake = { workflowSource: { blobSha: "a".repeat(40) }, tenantId: "tenant" };
beforeEach(() => {
  vi.clearAllMocks(); mocks.session.mockResolvedValue({ organizationId: "tenant", userId: "actor" });
  mocks.parse.mockReturnValue({ ok: true, intake }); mocks.verify.mockResolvedValue(false);
});
const request = () => new NextRequest("https://example.test/api/desktop/deployments", { method: "POST", body: JSON.stringify({ expectedVersion: 1 }), headers: { "Content-Type": "application/json" } });
it.each(["create", "revise"])("blocks %s persistence when fresh workflow source verification fails", async mode => {
  const req = request(); const result = mode === "create" ? await POST(req) : await PUT(req, { params: Promise.resolve({ id: "request" }) });
  expect(result.status).toBe(409);
  expect(await result.json()).toMatchObject({ ok: false, error: "workflow_source_unverified" });
  expect(mocks.verify).toHaveBeenCalledWith("tenant", intake, req.signal);
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.revise).not.toHaveBeenCalled();
});
it.each(["create", "revise"])("requires a session before %s source reads", async mode => {
  mocks.session.mockResolvedValue(null); const req = request();
  const result = mode === "create" ? await POST(req) : await PUT(req, { params: Promise.resolve({ id: "request" }) });
  expect(result.status).toBe(401); expect(mocks.verify).not.toHaveBeenCalled();
});
it.each(["create", "revise"])("allows %s persistence only after successful verification", async mode => {
  mocks.verify.mockResolvedValue(true);
  const row = { id: "request", title: "release", status: "submitted", version: 2, correlationId: "correlation", submittedAt: new Date() };
  mocks.create.mockResolvedValue({ ok: true, request: row, replayed: false });
  mocks.revise.mockResolvedValue({ ok: true, request: row, changed: true });
  const req = request(); const result = mode === "create" ? await POST(req) : await PUT(req, { params: Promise.resolve({ id: "request" }) });
  expect(result.status).toBe(mode === "create" ? 201 : 200);
  const persist = mode === "create" ? mocks.create : mocks.revise;
  expect(persist).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ organizationId: "tenant", intake }));
  expect(mocks.verify.mock.invocationCallOrder[0]).toBeLessThan(persist.mock.invocationCallOrder[0]);
});

it("summarizes selected batch count without exposing connection or run identities", async () => {
 const airflowDependency={connectionId:'private-connection',connectionUpdatedAt:'2026-10-24T00:00:00.000Z',runs:[{dagId:'private-dag',dagRunId:'private-run',logicalDate:'2026-10-24T00:00:00Z'}]};
 mocks.list.mockResolvedValue([{id:'request',title:'release',version:1,status:'submitted',correlationId:'c',submittedAt:null,closedAt:null,updatedAt:new Date(),intakeJson:{airflowDependency}}]);
 const response=await GET(new NextRequest('https://example.test/api'));const body=await response.json();
 expect(body.data[0].releaseContext.batches).toEqual({selectedRunCount:1});expect(JSON.stringify(body)).not.toContain('private-');
});
