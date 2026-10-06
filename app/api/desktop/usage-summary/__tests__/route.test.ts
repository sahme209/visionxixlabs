import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
  aggregate: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));
vi.mock("@/lib/db", () => ({
  prisma: { usageEvent: { aggregate: mocks.aggregate } },
}));

function request() {
  return new NextRequest("https://visionxixlabs.com/api/desktop/usage-summary", { method: "GET" });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("GET /api/desktop/usage-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it("returns the aggregated usage for the session's org", async () => {
    mocks.aggregate.mockResolvedValue({
      _sum: { inputTokens: 1000, outputTokens: 200, costCents: 50 },
      _count: { _all: 3 },
    });
    const { GET } = await import("../route");
    const res = await GET(request());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.aiInvocationCount).toBe(3);
    expect(body.data.aiInputTokens).toBe(1000);
    expect(mocks.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: "org-1", eventKind: "ai_invocation" }),
    }));
  });
});
