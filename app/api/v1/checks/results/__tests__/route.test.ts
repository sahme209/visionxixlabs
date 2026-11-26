// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@/lib/prismaClient";
const m = vi.hoisted(() => ({ auth: vi.fn(), findFirst: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: m.auth }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentCheck: { findFirst: m.findFirst }, deploymentCheckResult: { create: m.create } } }));
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
});
