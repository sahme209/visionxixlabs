// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@/lib/prismaClient";
const m = vi.hoisted(() => ({ auth: vi.fn(), findFirst: vi.fn(), create: vi.fn(), previous: vi.fn() }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: m.auth }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentCheck: { findFirst: m.findFirst }, deploymentCheckResult: { create: m.create, findFirst: m.previous } } }));
import { POST } from "../route";

const body = { checkKey: "health-probe", checkVersion: 2, stage: "verify", status: "passed", durationMs: 812, runUrl: "https://github.com/acme/app/actions/runs/1", idempotencyKey: "123-1-health-probe" };
const call = (b: unknown) => POST(new NextRequest("http://localhost/api/v1/checks/results", { method: "POST", body: JSON.stringify(b), headers: { authorization: "Bearer k" } }));
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ ok: true, apiKeyId: "key1", organizationId: "org1", scopes: ["checks:report"], env: "live" }); m.findFirst.mockResolvedValue({ version: 3, stage: "verify" }); m.create.mockResolvedValue({}); });

describe("POST /api/v1/checks/results", () => {
  it("requires checks:report", async () => {
    m.auth.mockResolvedValueOnce({ ok: false, reason: "insufficient_scope", httpStatus: 403, requiredScope: "checks:report" });
    expect((await call(body)).status).toBe(403);
    expect(m.auth).toHaveBeenCalledWith(expect.objectContaining({ requiredScope: "checks:report" }));
  });
  it("records the reported result with the reporting key and flags a stale check version", async () => {
    const r = await call(body);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ ok: true, recorded: true, currentVersion: 3, stale: true });
    expect(m.create).toHaveBeenCalledWith({ data: { organizationId: "org1", apiKeyId: "key1", ...body } });
  });
  it("is idempotent on the run key and refuses unknown checks and bad payloads", async () => {
    m.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }));
    expect(await (await call(body)).json()).toEqual({ ok: true, recorded: false, duplicate: true });
    m.findFirst.mockResolvedValueOnce(null);
    expect((await call(body)).status).toBe(404);
    expect((await call({ ...body, status: "skipped" })).status).toBe(422);
    expect((await call({ ...body, runUrl: "http://insecure.example.invalid" })).status).toBe(422);
    expect((await call({ ...body, extra: 1 })).status).toBe(422);
  });
  it("lets V19, not CI, fail a cost estimate whose increase is over the limit", async () => {
    m.findFirst.mockResolvedValue({ version: 1, stage: "validate", kind: "cost_estimate", spec: { tool: "infracost", path: "infra", maxMonthlyIncreaseUsd: 100 } });
    m.previous.mockResolvedValue({ monthlyCostCents: 50_000 });
    const cost = { ...body, checkKey: "infra-cost", checkVersion: 1, stage: "validate", releaseRef: "abc123", monthlyCostUsd: 650.5 };
    const r = await call(cost);
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ recordedStatus: "failed", statusReason: "over_cost_limit", monthlyCostDeltaCents: 15_050 });
    expect(m.create.mock.calls[0][0].data).toMatchObject({ status: "failed", statusReason: "over_cost_limit", monthlyCostCents: 65_050 });
    expect(m.previous.mock.calls[0][0].where).toMatchObject({ organizationId: "org1", checkKey: "infra-cost", NOT: { releaseRef: "abc123" } });
  });
  it("records the first estimate as a passing baseline and refuses a cost on other check kinds", async () => {
    m.findFirst.mockResolvedValue({ version: 1, stage: "validate", kind: "cost_estimate", spec: { tool: "infracost", path: "infra", maxMonthlyIncreaseUsd: 0 } });
    m.previous.mockResolvedValue(null);
    expect(await (await call({ ...body, checkKey: "infra-cost", checkVersion: 1, stage: "validate", monthlyCostUsd: 10 })).json()).toMatchObject({ recordedStatus: "passed", statusReason: null, monthlyCostDeltaCents: null });
    m.findFirst.mockResolvedValue({ version: 3, stage: "verify", kind: "smoke_test", spec: {} });
    expect((await call({ ...body, monthlyCostUsd: 10 })).status).toBe(422);
  });
});
