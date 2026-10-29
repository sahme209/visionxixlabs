import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const io = vi.hoisted(() => ({ session: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: io.session }));
vi.mock("@/lib/integrations/airflow/releaseBatchReadiness", () => ({ readReleaseBatchReadiness: io.read }));
import { GET } from "@/app/api/desktop/deployments/[id]/batch-readiness/route";
const context = { params: Promise.resolve({ id: "release" }) };
beforeEach(() => { vi.clearAllMocks(); io.session.mockResolvedValue({ organizationId: "tenant" }); io.read.mockResolvedValue({ ready: true, requestVersion: 3 }); });
it("reads only the paired tenant's stored version without accepting client source or authority", async () => {
  const result = await GET(new NextRequest("https://example.test/api?expectedVersion=3"), context);
  expect(result.status).toBe(200); expect(await result.json()).toEqual({ ok: true, data: { ready: true, requestVersion: 3 } });
  expect(result.headers.get("Cache-Control")).toBe("no-store");
  expect(io.session).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requiredScope: "pipeline:read", requiredCapability: "workspace:read", allowApiKey: false }));
  expect(io.read).toHaveBeenCalledWith(expect.anything(), { organizationId: "tenant", requestId: "release", expectedVersion: 3 });
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
