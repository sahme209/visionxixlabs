import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  loadAppEnv: vi.fn(),
  createMany: vi.fn(),
}));

vi.mock("@/lib/config/env", () => ({ loadAppEnv: mocks.loadAppEnv }));
vi.mock("@/lib/db", () => ({ prisma: { complianceControlCheckRun: { createMany: mocks.createMany } } }));

function request(authHeader?: string) {
  return new NextRequest("https://visionxixlabs.com/api/cron/compliance-control-check", {
    method: "GET",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cron/compliance-control-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMany.mockResolvedValue({ count: 1 });
  });

  it("503s when CRON_SECRET isn't configured — refuses to run as a public endpoint", async () => {
    mocks.loadAppEnv.mockReturnValue({ cronSecret: undefined });
    const { GET } = await import("../route");
    const res = await GET(request());
    expect(res.status).toBe(503);
  });

  it("401s on a missing or wrong bearer token", async () => {
    mocks.loadAppEnv.mockReturnValue({ cronSecret: "real-secret" });
    const { GET } = await import("../route");
    const res = await GET(request("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("runs the checks and persists a row per result on a valid request", async () => {
    mocks.loadAppEnv.mockReturnValue({ cronSecret: "real-secret" });
    const { GET } = await import("../route");
    const res = await GET(request("Bearer real-secret"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.checked).toBeGreaterThan(0);
    expect(mocks.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([expect.objectContaining({ controlId: "cs.vault.encryption" })]),
    }));
  });

  it("500s honestly when persisting the results fails, rather than reporting success", async () => {
    mocks.loadAppEnv.mockReturnValue({ cronSecret: "real-secret" });
    mocks.createMany.mockRejectedValue(new Error("db unavailable"));
    const { GET } = await import("../route");
    const res = await GET(request("Bearer real-secret"));
    expect(res.status).toBe(500);
  });
});
