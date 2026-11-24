import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

async function diagnose(session: { user: { email: string } } | null, adminEmails = " owner@example.test, reviewer@example.test ") {
  vi.resetModules();
  vi.stubEnv("ADMIN_EMAILS", adminEmails);
  getServerSession.mockResolvedValue(session);
  const { GET } = await import("../route");
  return GET(new NextRequest("https://example.test/api/admin/whoami"));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("admin identity diagnostic", () => {
  it("returns the ordinary sign-in requirement without configuration details", async () => {
    const response = await diagnose(null);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Unauthorized. Please sign in." });
  });

  it("returns the ordinary admin denial for a signed-in non-admin", async () => {
    const response = await diagnose({ user: { email: "member@example.test" } });
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "Access denied. Admin required." });
  });

  it("keeps configuration details private when no admins are configured", async () => {
    const response = await diagnose({ user: { email: "owner@example.test" } }, "");
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Access denied. Admin required." });
  });

  it("returns the diagnostic for the currently authorized admin", async () => {
    const response = await diagnose({ user: { email: "OWNER@example.test" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      signedIn: true, email: "OWNER@example.test", adminListCount: 2, adminListEmpty: false,
      isAdmin: true, nextStep: "OK — admin endpoints should work.",
    });
  });
});
