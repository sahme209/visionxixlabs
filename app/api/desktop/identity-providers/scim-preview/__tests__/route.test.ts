import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveRequestDesktopSession: vi.fn(),
}));

vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({
  resolveRequestDesktopSession: mocks.resolveRequestDesktopSession,
}));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/identity-providers/scim-preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const session = { id: "sess-1", userId: "user-1", organizationId: "org-1", credentialKind: "desktop_session" as const };

describe("POST /api/desktop/identity-providers/scim-preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveRequestDesktopSession.mockResolvedValue(session);
  });

  it("requires a desktop session", async () => {
    mocks.resolveRequestDesktopSession.mockResolvedValue(undefined);
    const { POST } = await import("../route");
    const res = await POST(request({ employees: [], currentGrants: [] }));
    expect(res.status).toBe(401);
  });

  it("computes a real plan for valid input", async () => {
    const { POST } = await import("../route");
    const res = await POST(request({
      employees: [{ id: "e1", email: "a@acme.com", status: "active", desiredRoles: ["admin"] }],
      currentGrants: [],
    }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.joinersCount).toBe(1);
  });

  it("422s on malformed input", async () => {
    const { POST } = await import("../route");
    const res = await POST(request({ employees: "nope", currentGrants: [] }));
    expect(res.status).toBe(422);
  });
});
