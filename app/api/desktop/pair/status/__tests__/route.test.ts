/**
 * Locks in the one-time pairing-consumption handshake between the
 * browser-approved pairing record and the desktop's poll loop:
 * - a matching, approved, unexpired, unconsumed challenge mints a token
 *   and atomically consumes the record (replay-proof);
 * - a device-fingerprint mismatch (someone else's browser URL / captured
 *   link used from a different device) is rejected, never silently
 *   accepted;
 * - an expired challenge is rejected regardless of approval state;
 * - replaying an already-consumed challenge is rejected, not re-served.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findPairing: vi.fn(),
  updateManyPairing: vi.fn(),
  getDesktopSession: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { $transaction: mocks.transaction, desktopPairingChallengeRecord: { findUnique: mocks.findPairing } },
}));
vi.mock("@/lib/desktop/privateDesktopSessionStore.prisma", () => ({
  createPrivatePrismaDesktopSessionStore: () => ({ getById: mocks.getDesktopSession }),
}));

function postRequest(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/pair/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const FP = "f".repeat(20);
const baseRecord = {
  id: "challenge-1",
  deviceFingerprint: FP,
  expiresAt: new Date(Date.now() + 60_000),
  consumedAt: null,
  status: "approved",
  sessionId: "sess-1",
  approvedByUserId: "fixture-user",
  approvedOrganizationId: "fixture-org",
};
const activeSession = {
  id: "sess-1",
  userId: "fixture-user",
  organizationId: "fixture-org",
  deviceFingerprint: FP,
  deviceLabel: "Sam's Mac",
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  lastSeenAt: new Date().toISOString(),
};

describe("POST /api/desktop/pair/status", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(callback => callback({
      $queryRaw: async () => [{ id: "sess-1" }],
      desktopPairingChallengeRecord: { updateMany: mocks.updateManyPairing },
    }));
    vi.stubEnv("DESKTOP_SESSION_SIGNING_KEY", "a".repeat(32));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("mints a token and atomically consumes the record on first successful poll", async () => {
    mocks.findPairing.mockResolvedValue({ ...baseRecord });
    mocks.getDesktopSession.mockResolvedValue(activeSession);
    mocks.updateManyPairing.mockResolvedValue({ count: 1 });

    const { POST } = await import("../route");
    const res = await POST(postRequest({ challenge: "challenge-1", deviceFingerprint: FP }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("approved");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.token).toMatch(/^axm\.desk\.sess-1\./);
    expect(mocks.updateManyPairing).toHaveBeenCalledWith({
      where: { id: "challenge-1", deviceFingerprint: FP, status: "approved", sessionId: "sess-1", approvedByUserId: "fixture-user", approvedOrganizationId: "fixture-org", consumedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { consumedAt: expect.any(Date), status: "consumed" },
    });
  });

  it("rejects a device-fingerprint mismatch instead of serving the approval", async () => {
    mocks.findPairing.mockResolvedValue({ ...baseRecord });
    const { POST } = await import("../route");
    const res = await POST(postRequest({ challenge: "challenge-1", deviceFingerprint: "g".repeat(20) }));
    expect(res.status).toBe(403);
    expect(mocks.updateManyPairing).not.toHaveBeenCalled();
  });

  it("rejects an expired challenge even if it was approved", async () => {
    mocks.findPairing.mockResolvedValue({ ...baseRecord, expiresAt: new Date(Date.now() - 1000) });
    const { POST } = await import("../route");
    const res = await POST(postRequest({ challenge: "challenge-1", deviceFingerprint: FP }));
    expect(res.status).toBe(410);
    expect(mocks.updateManyPairing).not.toHaveBeenCalled();
  });

  it("does not claim an approval when session lookup crosses the challenge deadline", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      mocks.findPairing.mockResolvedValue({ ...baseRecord, expiresAt: new Date(now + 1) });
      mocks.getDesktopSession.mockImplementationOnce(async () => {
        clock.mockReturnValue(now + 1);
        return activeSession;
      });
      mocks.updateManyPairing.mockResolvedValue({ count: 1 });

      const { POST } = await import("../route");
      const res = await POST(postRequest({ challenge: "challenge-1", deviceFingerprint: FP }));

      expect(res.status).toBe(410);
      expect(await res.json()).not.toHaveProperty("token");
      expect(mocks.updateManyPairing).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

  it("rejects replaying an already-consumed challenge", async () => {
    mocks.findPairing.mockResolvedValue({ ...baseRecord, consumedAt: new Date() });
    const { POST } = await import("../route");
    const res = await POST(postRequest({ challenge: "challenge-1", deviceFingerprint: FP }));
    expect(res.status).toBe(409);
    expect(mocks.updateManyPairing).not.toHaveBeenCalled();
  });

  it("rejects a concurrent double-consume race (updateMany claims zero rows)", async () => {
    mocks.findPairing.mockResolvedValue({ ...baseRecord });
    mocks.getDesktopSession.mockResolvedValue(activeSession);
    mocks.updateManyPairing.mockResolvedValue({ count: 0 });
    const { POST } = await import("../route");
    const res = await POST(postRequest({ challenge: "challenge-1", deviceFingerprint: FP }));
    expect(res.status).toBe(409);
  });

  it.each([
    { userId: "different-user" }, { organizationId: "different-org" }, { deviceFingerprint: "different-device" },
    { revokedAt: new Date().toISOString() }, { expiresAt: "invalid" },
  ])("withholds a token when the approved session cannot be verified (%j)", async fields => {
    mocks.findPairing.mockResolvedValue({ ...baseRecord });
    mocks.getDesktopSession.mockResolvedValue({ ...activeSession, ...fields });
    const { POST } = await import("../route");
    const res = await POST(postRequest({ challenge: "challenge-1", deviceFingerprint: FP }));
    expect(res.status).toBe(410);
    expect(await res.json()).not.toHaveProperty("token");
    expect(mocks.updateManyPairing).not.toHaveBeenCalled();
  });

  it("keeps the approval available after a signing configuration failure", async () => {
    vi.stubEnv("DESKTOP_SESSION_SIGNING_KEY", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    mocks.findPairing.mockResolvedValue({ ...baseRecord });
    mocks.getDesktopSession.mockResolvedValue(activeSession);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { POST } = await import("../route");
      const res = await POST(postRequest({ challenge: "challenge-1", deviceFingerprint: FP }));
      expect(res.status).toBe(503);
      expect(await res.json()).not.toHaveProperty("token");
      expect(mocks.updateManyPairing).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("reports pending while no session has been approved yet", async () => {
    mocks.findPairing.mockResolvedValue({ ...baseRecord, status: "pending", sessionId: null });
    const { POST } = await import("../route");
    const res = await POST(postRequest({ challenge: "challenge-1", deviceFingerprint: FP }));
    expect(res.status).toBe(202);
  });
});
