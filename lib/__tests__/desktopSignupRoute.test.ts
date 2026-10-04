import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findPairing: vi.fn(),
  findUser: vi.fn(),
  createUser: vi.fn(),
  upsertMembership: vi.fn(),
  rateLimit: vi.fn(() => true),
  hash: vi.fn(async () => "hashed-password"),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    desktopPairingChallengeRecord: { findUnique: mocks.findPairing },
    user: { findUnique: mocks.findUser, create: mocks.createUser },
    orgMembership: { upsert: mocks.upsertMembership },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock("bcryptjs", () => ({ hash: mocks.hash }));

function request(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/auth/signup", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.8" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  email: " New.User@Example.test ",
  password: "twelve-char-password",
  name: "New Operator",
  desktopChallenge: "pairing-123",
  acceptedTerms: true,
};

describe("desktop-initiated signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", "postgresql://test.invalid/axiom");
    mocks.rateLimit.mockReturnValue(true);
    mocks.findPairing.mockResolvedValue({ status: "pending", consumedAt: null, expiresAt: new Date("2030-01-01T00:00:00.000Z") });
    mocks.findUser.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({ id: "user-1", email: "new.user@example.test", name: "New Operator" });
    mocks.upsertMembership.mockResolvedValue({});
  });

  it("requires explicit terms acceptance before database access", async () => {
    const { POST } = await import("../../app/api/auth/signup/route");
    const response = await POST(request({ ...validBody, acceptedTerms: false }));
    expect(response.status).toBe(400);
    expect(mocks.findPairing).not.toHaveBeenCalled();
  });

  it("rejects an expired or unknown desktop pairing request", async () => {
    mocks.findPairing.mockResolvedValue(null);
    const { POST } = await import("../../app/api/auth/signup/route");
    const response = await POST(request(validBody));
    expect(response.status).toBe(400);
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("creates an identity without granting a free plan", async () => {
    const { POST } = await import("../../app/api/auth/signup/route");
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(mocks.createUser).toHaveBeenCalledWith({
      data: {
        email: "new.user@example.test",
        passwordHash: "hashed-password",
        name: "New Operator",
      },
    });
    expect(JSON.stringify(mocks.createUser.mock.calls)).not.toContain("starter");
  });

  it("still returns the created identity when workspace membership bootstrap fails (self-heals on next sign-in)", async () => {
    mocks.upsertMembership.mockRejectedValue(new Error("unique constraint race"));
    const { POST } = await import("../../app/api/auth/signup/route");
    const response = await POST(request(validBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("user-1");
  });

  it("rate-limits repeated account creation attempts", async () => {
    mocks.rateLimit.mockReturnValue(false);
    const { POST } = await import("../../app/api/auth/signup/route");
    const response = await POST(request(validBody));
    expect(response.status).toBe(429);
    expect(mocks.findPairing).not.toHaveBeenCalled();
  });
});
