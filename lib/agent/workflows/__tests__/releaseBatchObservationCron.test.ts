import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ env: vi.fn(), tick: vi.fn() }));
vi.mock("@/lib/config/env", () => ({ loadAppEnv: m.env }));
vi.mock("../releaseBatchObservationTick", () => ({ runReleaseBatchObservationTick: m.tick }));
import { GET, POST } from "@/app/api/cron/release-batch-observation-tick/route";
const request = (token?: string) => new NextRequest("https://axiom.invalid/api/cron/release-batch-observation-tick", { headers: token ? { authorization: `Bearer ${token}` } : {} });
describe("observation cron authority", () => {
 beforeEach(() => { vi.clearAllMocks(); m.env.mockReturnValue({ cronSecret: "fixture-cron-secret" }); m.tick.mockResolvedValue({ enabled: false, inspected: 0, observed: 0, errors: 0 }); });
 it("refuses missing configuration and wrong credentials without ticking", async () => {
  expect((await GET(request("wrong"))).status).toBe(401); m.env.mockReturnValue({}); expect((await GET(request())).status).toBe(503); expect(m.tick).not.toHaveBeenCalled();
 });
 it("uses only the existing server cron authority and returns no-store counts", async () => {
  const response = await POST(request("fixture-cron-secret")); expect(response.status).toBe(200); expect(m.tick).toHaveBeenCalledTimes(1); expect(response.headers.get("cache-control")).toBe("no-store");
 });
 it("sanitizes storage failures", async () => { m.tick.mockRejectedValue(new Error("private storage detail")); const response = await GET(request("fixture-cron-secret")); expect(response.status).toBe(502); expect(JSON.stringify(await response.json())).not.toContain("private"); });
});
