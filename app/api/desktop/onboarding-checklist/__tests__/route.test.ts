import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), build: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mocks.resolve }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/releaseops/onboardingChecklistResponder", () => ({ buildOnboardingChecklistResponse: mocks.build }));

describe("GET /api/desktop/onboarding-checklist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue({ id: "session-1", organizationId: "org-1", credentialKind: "desktop_session" });
    mocks.build.mockResolvedValue({ status: 200, body: { ok: true, data: { checklist: {} } } });
  });

  it("requires a paired desktop session", async () => {
    mocks.resolve.mockResolvedValue(undefined);
    const { GET } = await import("../route");
    expect((await GET(new NextRequest("https://app.test/api/desktop/onboarding-checklist"))).status).toBe(401);
    expect(mocks.build).not.toHaveBeenCalled();
  });

  it("uses the paired workspace and rejects API-key fallback", async () => {
    const { GET } = await import("../route");
    expect((await GET(new NextRequest("https://app.test/api/desktop/onboarding-checklist"))).status).toBe(200);
    expect(mocks.build.mock.calls[0][1]).toBe("org-1");
    expect(mocks.resolve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      requiredScope: "pipeline:read", allowApiKey: false,
    }));
  });
});
