import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  leads: vi.fn(), lead: vi.fn(), due: vi.fn(), claim: vi.fn(), update: vi.fn(),
  plugin: vi.fn(), user: vi.fn(), notify: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: {
  lead: { findMany: mocks.leads, findUnique: mocks.lead },
  recurringAnalysis: { findMany: mocks.due, updateMany: mocks.claim, update: mocks.update },
  user: { findUnique: mocks.user },
} }));
vi.mock("@/lib/plugins/aws", () => ({}));
vi.mock("@/lib/execution/pluginEngine", () => ({ executePlugin: mocks.plugin }));
vi.mock("resend", () => ({ Resend: function () { return { emails: { send: mocks.notify } }; } }));
import { POST } from "../route";

const secret = "fixture-cron-secret";
function request(headers = {}, query = "") {
  return new NextRequest(`http://localhost/api/cloud-operator/run-recurring${query}`, { method: "POST", headers });
}

describe("Cloud Operator recurring job authority", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CRON_SECRET", secret);
    mocks.leads.mockResolvedValue([]);
    mocks.due.mockResolvedValue([]);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("requires configured scheduler credentials before reading any leads or jobs", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(request())).status).toBe(503);
    expect(mocks.leads).not.toHaveBeenCalled();
    expect(mocks.due).not.toHaveBeenCalled();
  });

  it("does not authenticate query-string credentials or malformed authorization", async () => {
    expect((await POST(request({}, `?cronSecret=${secret}`))).status).toBe(401);
    expect((await POST(request({ authorization: "Bearer wrong-credential" }))).status).toBe(401);
    expect(mocks.leads).not.toHaveBeenCalled();
    expect(mocks.plugin).not.toHaveBeenCalled();
  });

  it.each([{ authorization: `Bearer ${secret}` }, { "x-cron-secret": secret }])("preserves an authorized POST with %j", async headers => {
    const result = await POST(request(headers));
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    expect(await result.json()).toEqual({ success: true, processed: 0, notified: 0, failed: 0 });
    expect(mocks.due).toHaveBeenCalledOnce();
  });

  function dueJob() {
    const nextRunAt = new Date("2026-11-01T06:00:00.000Z");
    mocks.due.mockResolvedValue([{ id: "job-fixture", leadId: "lead-fixture", frequency: "daily", jobType: "iam_scan", nextRunAt }]);
    mocks.lead.mockResolvedValue({ id: "lead-fixture", userId: "owner-fixture", source: "cloud-operator",
      fullPayload: { connectors: { aws: { status: "linked", verifiedAccountId: "fixture-account" } } } });
    mocks.user.mockResolvedValue({ plan: "growth" });
    return nextRunAt;
  }

  it("executes the existing dry-run handler once when two requests see the same due job", async () => {
    const nextRunAt = dueJob();
    mocks.claim.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    mocks.plugin.mockResolvedValue({ status: "success", data: { findings: [] } });
    const run = () => POST(request({ authorization: `Bearer ${secret}` }));
    const results = await Promise.all([run(), run()]);
    expect((await Promise.all(results.map(r => r.json()))).map(r => r.processed).sort()).toEqual([0, 1]);
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "job-fixture", leadId: "lead-fixture", enabled: true, nextRunAt },
    }));
    expect(mocks.plugin).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      ctx: expect.objectContaining({ leadId: "lead-fixture", dryRun: true }),
    }));
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("reports an uncertain job failure and does not mark delivery completed", async () => {
    dueJob();
    mocks.claim.mockResolvedValue({ count: 1 });
    mocks.plugin.mockRejectedValue(new Error("simulated interrupted scan"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await POST(request({ authorization: `Bearer ${secret}` }));
    expect(await response.json()).toEqual({ success: false, processed: 0, notified: 0, failed: 1 });
    expect(mocks.claim).toHaveBeenCalledOnce();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
