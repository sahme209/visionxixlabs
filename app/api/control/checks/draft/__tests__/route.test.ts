// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ ctx: vi.fn(), extract: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: m.ctx }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: () => true }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: () => true }));
vi.mock("@/lib/axiom/agentRuntime/governedAiCall", () => ({ resolveGovernedAiCall: m.resolve }));
vi.mock("@/lib/axiom/agentRuntime/governedAiCallRefusal", () => ({ GovernedAiCallRefusal: class extends Error {} }));
import { POST } from "../route";

const call = (description: unknown) => POST(new NextRequest("http://localhost/api/control/checks/draft", { method: "POST", body: JSON.stringify({ description }) }));
beforeEach(() => {
  vi.clearAllMocks();
  m.ctx.mockResolvedValue({ isAuthenticated: true, organizationId: "org1", sessionUserId: "u1", email: "a@example.invalid", roles: ["owner"] });
  m.resolve.mockResolvedValue({ ok: true, extract: m.extract });
});
describe("POST /api/control/checks/draft", () => {
  it("returns a validated draft without saving anything", async () => {
    m.extract.mockResolvedValue({ data: { key: "health", name: "Health", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "https://a.example.invalid/h", expectStatus: 200, maxLatencyMs: 500 } } });
    const body = await (await call("probe /health under 500ms after deploy")).json();
    expect(body).toMatchObject({ ok: true, draft: { key: "health", kind: "smoke_test" } });
  });
  it("discards invalid drafts, passes governance refusals through, and requires an admin", async () => {
    m.extract.mockResolvedValue({ data: { key: "x", name: "x", kind: "smoke_test", stage: "verify", mode: "blocking", spec: { url: "http://insecure" } } });
    expect((await (await call("x")).json()).error).toBe("draft_invalid");
    m.resolve.mockResolvedValueOnce({ ok: false, error: "ai_not_enabled" });
    expect((await (await call("x")).json()).error).toBe("ai_not_enabled");
    m.ctx.mockResolvedValueOnce({ isAuthenticated: true, organizationId: "org1", sessionUserId: "u1", email: "a@example.invalid", roles: ["viewer"] });
    expect((await call("x")).status).toBe(403);
    expect((await call("")).status).toBe(400);
  });
});
