import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const io = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { tenantIntegrationConnection: { findUnique: io.find } } }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: io.session }));
import { GET } from "@/app/api/desktop/airflow/connection/route";
beforeEach(() => { vi.clearAllMocks(); io.session.mockResolvedValue({ organizationId: "tenant" }); });
it("exposes only the tenant's safe connection revision for exact run selections", async () => {
  io.find.mockResolvedValue({ id: "connection", status: "active", updatedAt: new Date("2026-10-24T00:00:00Z"), scopesJson: { baseUrl: "https://airflow.example.test" }, encryptedCredential: "private-not-returned" });
  const response = await GET(new NextRequest("https://example.test/api"));
  const body = await response.json(); expect(body.data).toMatchObject({ connectionId: "connection", connectionUpdatedAt: "2026-10-24T00:00:00.000Z", connected: true });
  expect(JSON.stringify(body)).not.toContain("private-not-returned"); expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(io.find).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId_provider: { organizationId: "tenant", provider: "airflow" } } }));
});
it("does not invent connection identity when disconnected", async () => {
  io.find.mockResolvedValue(null); const response = await GET(new NextRequest("https://example.test/api"));
  expect((await response.json()).data).toEqual({ connected: false, status: "not_connected" });
});
