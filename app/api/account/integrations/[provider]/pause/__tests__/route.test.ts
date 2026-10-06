/**
 * Non-destructive pause/resume for Slack/Teams. Covers the auth/role/origin
 * gates (same shape as ../disconnect), the suspend->active status floor
 * (only active/needs_attention rows are eligible), the resume->active floor
 * (only suspended rows are eligible), and that a resumed connection comes
 * back through needs_attention (lastValidatedAt cleared), not straight to
 * active, since the pause window means its last validation is stale.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  isSameOriginRequest: vi.fn(() => true),
  isAdminOrOwner: vi.fn(() => true),
  updateMany: vi.fn(),
  recordAudit: vi.fn(async () => {}),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.isSameOriginRequest }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.isAdminOrOwner }));
vi.mock("@/lib/db", () => ({ prisma: { tenantIntegrationConnection: { updateMany: mocks.updateMany } } }));
vi.mock("@/lib/audit/secureAudit", () => ({ record: mocks.recordAudit }));

function request(provider: string, body: object) {
  return {
    req: new NextRequest(`https://visionxixlabs.com/api/account/integrations/${provider}/pause`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ provider }),
  };
}

const authedCtx = { isAuthenticated: true, organizationId: "org-1", userId: "user-1", email: "owner@example.test", roles: ["owner"] };

describe("POST /api/account/integrations/[provider]/pause", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.currentContext.mockResolvedValue(authedCtx);
  });

  it("rejects a cross-origin request before touching auth or the DB", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const { POST } = await import("../route");
    const { req, params } = request("slack", { action: "suspend" });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(mocks.currentContext).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mocks.currentContext.mockResolvedValue({ isAuthenticated: false, roles: [] });
    const { POST } = await import("../route");
    const { req, params } = request("slack", { action: "suspend" });
    const res = await POST(req, { params });
    expect(res.status).toBe(401);
  });

  it("requires owner/admin", async () => {
    mocks.isAdminOrOwner.mockReturnValue(false);
    const { POST } = await import("../route");
    const { req, params } = request("slack", { action: "suspend" });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an unsupported provider", async () => {
    const { POST } = await import("../route");
    const { req, params } = request("aws", { action: "suspend" });
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it("rejects an invalid action", async () => {
    const { POST } = await import("../route");
    const { req, params } = request("slack", { action: "delete" });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
  });

  it("suspends an active connection and audits connector.pause", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const { POST } = await import("../route");
    const { req, params } = request("slack", { action: "suspend" });
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", provider: "slack", status: { in: ["active", "needs_attention"] } },
      data: { status: "suspended", lastValidatedAt: null },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "connector.pause", entityRef: "connector:slack" }));
  });

  it("resumes a suspended connection into needs_attention, not straight to active", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const { POST } = await import("../route");
    const { req, params } = request("teams", { action: "resume" });
    const res = await POST(req, { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe("needs_attention");
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", provider: "teams", status: { in: ["suspended"] } },
      data: { status: "needs_attention", lastValidatedAt: null },
    });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "connector.resume", entityRef: "connector:teams" }));
  });

  it("returns 409 when no row is eligible for the transition (e.g. suspend on an already-revoked connection)", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const { POST } = await import("../route");
    const { req, params } = request("slack", { action: "suspend" });
    const res = await POST(req, { params });
    expect(res.status).toBe(409);
    expect(mocks.recordAudit).not.toHaveBeenCalled();
  });

  it("a best-effort audit failure does not break the response", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.recordAudit.mockRejectedValueOnce(new Error("audit store down"));
    const { POST } = await import("../route");
    const { req, params } = request("slack", { action: "suspend" });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
  });

  it("returns 503 when the DB update itself fails", async () => {
    mocks.updateMany.mockRejectedValue(new Error("db unavailable"));
    const { POST } = await import("../route");
    const { req, params } = request("slack", { action: "suspend" });
    const res = await POST(req, { params });
    expect(res.status).toBe(503);
  });
});
