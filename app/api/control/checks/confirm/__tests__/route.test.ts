// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@/lib/prismaClient";
const m = vi.hoisted(() => ({ ctx: vi.fn(), sameOrigin: vi.fn(() => true), audit: vi.fn(), findFirst: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: m.sameOrigin }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: m.audit }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentCheck: { findFirst: m.findFirst }, deploymentCheckResult: { create: m.create } } }));
import { POST } from "../route";

const sha = "a".repeat(40);
const body = { checkKey: "status-page", checkVersion: 2, commitSha: sha, confirmedItems: ["Post update", "Notify on-call"] };
const call = (b: unknown) => POST(new NextRequest("http://localhost/api/control/checks/confirm", { method: "POST", body: JSON.stringify(b) }));
beforeEach(() => {
  vi.clearAllMocks(); m.sameOrigin.mockReturnValue(true);
  m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@example.invalid", roles: ["operator"] });
  m.findFirst.mockResolvedValue({ kind: "manual_checklist", stage: "deploy", version: 2, enabled: true, spec: { items: ["Post update", "Notify on-call"] } });
  m.create.mockResolvedValue({});
});
describe("POST /api/control/checks/confirm", () => {
  it("records a passed result for the exact commit, attributed to the person", async () => {
    expect((await call(body)).status).toBe(201);
    expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ checkKey: "status-page", checkVersion: 2, stage: "deploy", status: "passed", releaseRef: sha, apiKeyId: "user:u1", idempotencyKey: `manual:${sha}:status-page:v2` }) });
  });
  it("requires every current item, the current version, a full SHA and an approver role", async () => {
    expect((await call({ ...body, confirmedItems: ["Post update"] })).status).toBe(422);
    expect((await call({ ...body, checkVersion: 1 })).status).toBe(409);
    expect((await call({ ...body, commitSha: "abc1234" })).status).toBe(400);
    m.ctx.mockResolvedValueOnce({ isAuthenticated: true, organizationId: "org1", userId: "u1", email: "a@example.invalid", roles: ["viewer"] });
    expect((await call(body)).status).toBe(403);
    m.findFirst.mockResolvedValueOnce({ kind: "smoke_test", stage: "verify", version: 2, enabled: true, spec: {} });
    expect((await call(body)).status).toBe(404);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("treats a repeat confirmation as a duplicate", async () => {
    m.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "x" }));
    expect(await (await call(body)).json()).toEqual({ ok: true, recorded: false, duplicate: true });
  });
});
