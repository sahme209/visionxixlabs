import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const io = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn(), declarations: vi.fn(), tasks: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: io.session }));
vi.mock("@/lib/integrations/airflow/releaseBatchReadiness", () => ({ readReleaseBatchReadiness: io.read, readReleaseBatchDeclarations: io.declarations, readReleaseBatchTasks: io.tasks }));
import { GET } from "@/app/api/desktop/deployments/[id]/batch-readiness/route";
import { GET as GET_DECLARATIONS } from "@/app/api/desktop/deployments/[id]/batch-declarations/route";
import { GET as GET_TASKS } from "@/app/api/desktop/deployments/[id]/batch-tasks/route";
const context = { params: Promise.resolve({ id: "release" }) };
beforeEach(() => { vi.clearAllMocks(); io.session.mockResolvedValue({ organizationId: "tenant", userId: "member" }); io.read.mockResolvedValue({ ready: true, requestVersion: 3 }); });
it("reads only the paired tenant's stored version without accepting client source or authority", async () => {
  const result = await GET(new NextRequest("https://example.test/api?expectedVersion=3"), context);
  expect(result.status).toBe(200); expect(await result.json()).toEqual({ ok: true, data: { ready: true, requestVersion: 3 } });
  expect(result.headers.get("Cache-Control")).toBe("no-store");
  expect(io.session).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requiredScope: "pipeline:read", requiredCapability: "workspace:read", allowApiKey: false }));
  expect(io.read).toHaveBeenCalledWith(expect.anything(), { organizationId: "tenant", requestId: "release", expectedVersion: 3, signal: expect.any(AbortSignal), includeRuns: true });
});
it("requires a paired session before stored or provider reads", async () => {
  io.session.mockResolvedValue(null); expect((await GET(new NextRequest("https://example.test/api?expectedVersion=3"), context)).status).toBe(401); expect(io.read).not.toHaveBeenCalled();
});
it.each(["", "0", "-1", "3.5", "3x", "10000000000"])("rejects invalid expected version %s", async version => {
  expect((await GET(new NextRequest(`https://example.test/api?expectedVersion=${version}`), context)).status).toBe(400); expect(io.read).not.toHaveBeenCalled();
});
it("does not expose diagnostics on an unexpected read failure", async () => {
  io.read.mockRejectedValue(new Error("private provider diagnostic"));
  const result = await GET(new NextRequest("https://example.test/api?expectedVersion=3"), context);
  expect(result.status).toBe(502); expect(await result.json()).toEqual({ ok: false, error: "release_batch_readiness_unavailable" });
});

it("withholds run identifiers when desktop authority ends during observation", async () => {
  io.session.mockResolvedValueOnce({ organizationId: "tenant", userId: "member" }).mockResolvedValueOnce(null);
  io.read.mockResolvedValueOnce({ ready: true, requestVersion: 3, observations: {
    requestId: "release", version: 3, runs: [{ dagId: "daily", dagRunId: "run-a", state: "success" }],
  } });
  const result = await GET(new NextRequest("https://example.test/api?expectedVersion=3"), context);
  expect(result.status).toBe(401);
  expect(await result.json()).toEqual({ ok: false, error: "desktop_session_required" });
});

it("opts into timing only when the compatible request flag is present", async () => {
  const result = await GET(new NextRequest("https://example.test/api?expectedVersion=3&includeTiming=1"), context);
  expect(result.status).toBe(200);
  expect(io.read).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ includeRuns: true, includeTiming: true }));
  io.read.mockClear();
  const ambiguous = await GET(new NextRequest("https://example.test/api?expectedVersion=3&includeTiming=1&includeTiming=1"), context);
  expect(ambiguous.status).toBe(400);
  expect(io.read).not.toHaveBeenCalled();
});

it("requires a current paired identity at both boundaries of a release task read", async () => {
  const page = {requestId:"release",version:3,dagId:"daily",dagRunId:"selected",offset:0,totalEntries:0,tasks:[]};
  const path = "https://example.test/api?expectedVersion=3&dagId=daily&dagRunId=selected&offset=0";
  io.tasks.mockResolvedValue(page);
  const result=await GET_TASKS(new NextRequest(path),context);
  expect(await result.json()).toEqual({ok:true,data:page});
  expect(io.session).toHaveBeenCalledTimes(2);
  expect(io.session).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({allowApiKey:false,requiredScope:"pipeline:read",requiredCapability:"workspace:read"}));
  expect(io.tasks).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({organizationId:"tenant",requestId:"release",expectedVersion:3,dagRunId:"selected"}));

  io.session.mockResolvedValueOnce({organizationId:"tenant", userId:"member"}).mockResolvedValueOnce({organizationId:"tenant", userId:"different"});
  expect((await GET_TASKS(new NextRequest(path),context)).status).toBe(401);
  io.tasks.mockClear();
  expect((await GET_TASKS(new NextRequest(path+"&dagRunId=other"),context)).status).toBe(400);
  expect(io.tasks).not.toHaveBeenCalled();
});

it("returns saved run identities only on opt-in, without turning an unavailable observation into readiness", async () => {
  const declarations = {requestId:"release",version:3,runs:[{dagId:"daily",dagRunId:"selected"}]};
  const unavailable = {ready:false,reason:"unavailable"};
  io.read.mockImplementation(async () => ({...unavailable}));
  io.declarations.mockResolvedValue(declarations);
  const path = "https://example.test/api?expectedVersion=3";
  expect(await (await GET(new NextRequest(path),context)).json()).toEqual({ok:true,data:unavailable});
  expect(io.declarations).not.toHaveBeenCalled();
  expect(await (await GET(new NextRequest(path+"&includeSavedRuns=1"),context)).json()).toEqual({ok:true,data:{...unavailable,declarations}});
  expect(io.declarations).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.objectContaining({organizationId:"tenant",requestId:"release",expectedVersion:3}));

  io.session.mockResolvedValueOnce({organizationId:"tenant",userId:"member"}).mockResolvedValueOnce(null);
  expect((await GET(new NextRequest(path+"&includeSavedRuns=1"),context)).status).toBe(401);
  io.declarations.mockClear();
  io.read.mockResolvedValue({ready:false,reason:"changed"});
  await GET(new NextRequest(path+"&includeSavedRuns=1"),context);
  expect(io.declarations).not.toHaveBeenCalled();
  expect((await GET(new NextRequest(path+"&includeSavedRuns=1&includeSavedRuns=1"),context)).status).toBe(400);
});

it("rechecks authority before disclosing a changed release and omits fallback declarations", async () => {
  const changed = {ready: false, reason: "changed"};
  io.read.mockResolvedValue(changed);
  const path = "https://example.test/api?expectedVersion=3&includeSavedRuns=1";
  const response = await GET(new NextRequest(path), context);
  expect(await response.json()).toEqual({ok: true, data: changed});
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(io.session).toHaveBeenCalledTimes(2);
  expect(io.declarations).not.toHaveBeenCalled();

  io.session.mockResolvedValueOnce({organizationId: "tenant", userId: "member"}).mockResolvedValueOnce(null);
  expect((await GET(new NextRequest(path), context)).status).toBe(401);
});
it("reads only exact saved declarations and verifies the paired member again before disclosure", async () => {
  const saved = {requestId: "release", version: 3, runs: [{dagId: "daily", dagRunId: "selected"}]};
  io.declarations.mockResolvedValue(saved);
  const path = "https://example.test/api?expectedVersion=3";
  const result = await GET_DECLARATIONS(new NextRequest(path), context);
  expect(await result.json()).toEqual({ok: true, data: saved});
  expect(result.headers.get("Cache-Control")).toBe("no-store");
  expect(io.session).toHaveBeenCalledTimes(2);
  expect(io.session).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    requireWorkspaceMembership: true, requiredScope: "pipeline:read", allowApiKey: false,
  }));
  expect(io.declarations).toHaveBeenCalledExactlyOnceWith(expect.anything(), expect.objectContaining({
    organizationId: "tenant", requestId: "release", expectedVersion: 3,
  }));
  expect(io.read).not.toHaveBeenCalled();
  io.session.mockResolvedValueOnce({organizationId: "tenant", userId: "member"}).mockResolvedValueOnce({organizationId: "other", userId: "member"});
  expect((await GET_DECLARATIONS(new NextRequest(path), context)).status).toBe(401);
  io.declarations.mockClear();
  expect((await GET_DECLARATIONS(new NextRequest(path + "&expectedVersion=4"), context)).status).toBe(400);
  expect(io.declarations).not.toHaveBeenCalled();
});
