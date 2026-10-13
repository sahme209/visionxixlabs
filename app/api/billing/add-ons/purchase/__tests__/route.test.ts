import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  isAdminOrOwner: vi.fn(),
  isSameOriginRequest: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/auth/platformAdmin", () => ({ isAdminOrOwner: mocks.isAdminOrOwner }));
vi.mock("@/lib/auth/requestOrigin", () => ({ isSameOriginRequest: mocks.isSameOriginRequest }));

import { POST } from "../route";

function request() {
  return new Request("https://visionxixlabs.com/api/billing/add-ons/purchase", { method: "POST" });
}

describe("AI credit checkout lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isAdminOrOwner.mockReturnValue(true);
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, organizationId: "org-1", userId: "user-1", email: "owner@example.com", roles: ["owner"] });
  });

  it("rejects cross-origin requests", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    expect((await POST(request() as never)).status).toBe(403);
  });

  it("requires an organization administrator", async () => {
    mocks.isAdminOrOwner.mockReturnValue(false);
    expect((await POST(request() as never)).status).toBe(403);
  });

  it("never creates a placeholder checkout", async () => {
    const response = await POST(request() as never);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "ai_credit_checkout_not_ready" });
  });
});
