/**
 * Locks in: desktop pairing approval records desktop.pair audit events —
 * for success, policy denial, and infrastructure failure — each carrying
 * the same request-scoped correlation ID that is also returned to the
 * (already-authenticated) caller. Previously this action was defined in
 * the audit taxonomy but never called at all.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { configureAuditStore, type AuditRecord, type SecureAuditStore } from "@/lib/audit/secureAudit";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  findPairing: vi.fn(),
  updateManyPairing: vi.fn(),
  transaction: vi.fn(),
  createDesktopSession: vi.fn(),
  evaluatePairingPolicy: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    desktopPairingChallengeRecord: {
      findUnique: mocks.findPairing,
      updateMany: mocks.updateManyPairing,

    },
  },
}));
vi.mock("@/lib/desktop/privateDesktopSession", () => ({
  createPrivateDesktopSessionService: () => ({ createDesktopSession: mocks.createDesktopSession }),
}));
vi.mock("@/lib/desktop/desktopAuthPolicy", () => ({ evaluatePairingPolicy: mocks.evaluatePairingPolicy }));

class MemoryAuditStore implements SecureAuditStore {
  records: AuditRecord[] = [];
  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }
  async query(): Promise<AuditRecord[]> {
    return this.records;
  }
}

const pendingRecord = {
  id: "challenge-1",
  deviceFingerprint: "f".repeat(20),
  deviceLabel: "Sam's Mac",
  platform: "macos-arm",
  desktopVersion: "0.1.13",
  expiresAt: new Date(Date.now() + 60_000),
  sessionId: null,
  status: "pending",
};

function postRequest() {
  return new NextRequest("https://visionxixlabs.com/api/desktop/pair/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ challenge: "challenge-1" }),
  });
}

describe("POST /api/desktop/pair/approve — audit coverage", () => {
  let store: MemoryAuditStore;

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(callback => callback({
      desktopPairingChallengeRecord: { updateMany: mocks.updateManyPairing },
    }));
    store = new MemoryAuditStore();
    configureAuditStore(store);
    mocks.currentContext.mockResolvedValue({
      isAuthenticated: true,
      userId: "user-1",
      organizationId: "org-1",
      email: "pilot@example.test",
    });
    mocks.findPairing.mockResolvedValue({ ...pendingRecord });
  });

  it("records a success audit with a correlation id when pairing is approved", async () => {
    mocks.evaluatePairingPolicy.mockResolvedValue({ allowed: true });
    mocks.updateManyPairing.mockResolvedValue({ count: 1 });
    mocks.createDesktopSession.mockResolvedValue({ id: "sess-1" });


    const { POST } = await import("../route");
    // Next.js's route-handler type plugin widens the dynamically-imported
    // POST's inferred return type in a way plain `tsc` can't narrow back
    // down here — every branch in route.ts unconditionally returns a
    // NextResponse (verified by inspection), so this is a type-checker
    // limitation around dynamic imports of route modules, not a real
    // possibility of undefined at runtime.
    const response = (await POST(postRequest()))!;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    const success = store.records.find((r) => r.action === "desktop.pair" && r.outcome === "success");
    expect(success).toBeDefined();
    expect(success?.correlationId).toBeTruthy();
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.updateManyPairing).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "approving", expiresAt: { gt: expect.any(Date) } }),
      data: expect.objectContaining({ status: "approved", sessionId: "sess-1" }),
    }));
  });

  it("does not claim or create a session after policy evaluation crosses expiration", async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    try {
      mocks.findPairing.mockResolvedValue({ ...pendingRecord, expiresAt: new Date(now + 1) });
      mocks.evaluatePairingPolicy.mockImplementationOnce(async () => {
        clock.mockReturnValue(now + 1);
        return { allowed: true };
      });
      mocks.updateManyPairing.mockResolvedValue({ count: 1 });
      mocks.createDesktopSession.mockResolvedValue({ id: "sess-1" });

      const { POST } = await import("../route");
      const res = await POST(new NextRequest("https://visionxixlabs.com/api/desktop/pair/approve", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challenge: pendingRecord.id }),
      }));

      if (!res) throw new Error("Pairing approval did not return a response");
      expect(res.status).toBe(410);
      expect(await res.json()).toEqual({ error: "pairing_expired" });
      expect(mocks.updateManyPairing).not.toHaveBeenCalled();
      expect(mocks.createDesktopSession).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });

  it("refuses finalization when the claim expires while the session is being saved", async () => {
    mocks.evaluatePairingPolicy.mockResolvedValue({ allowed: true });
    mocks.updateManyPairing.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    mocks.createDesktopSession.mockResolvedValue({ id: "sess-1" });

    const { POST } = await import("../route");
    const response = (await POST(postRequest()))!;
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "pairing_expired" });
    expect(mocks.updateManyPairing).toHaveBeenCalledTimes(2);
    expect(store.records.some(record => record.outcome === "success")).toBe(false);
  });

  it("records a blocked audit with a safe reason code when policy denies pairing", async () => {
    mocks.evaluatePairingPolicy.mockResolvedValue({
      allowed: false,
      code: "desktop.auth.bad_fingerprint",
      reason: "Device fingerprint must be >= 16 characters.",
    });

    const { POST } = await import("../route");
    // Next.js's route-handler type plugin widens the dynamically-imported
    // POST's inferred return type in a way plain `tsc` can't narrow back
    // down here — every branch in route.ts unconditionally returns a
    // NextResponse (verified by inspection), so this is a type-checker
    // limitation around dynamic imports of route modules, not a real
    // possibility of undefined at runtime.
    const response = (await POST(postRequest()))!;
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.correlationId).toBeTruthy();
    expect(mocks.createDesktopSession).not.toHaveBeenCalled();
    const blocked = store.records.find((r) => r.action === "desktop.pair" && r.outcome === "blocked");
    expect(blocked).toBeDefined();
    expect(blocked?.errorCode).toBe("desktop.auth.bad_fingerprint");
    expect(blocked?.correlationId).toBe(body.correlationId);
  });

  it("records a failure audit with a correlation id when session creation fails", async () => {
    mocks.evaluatePairingPolicy.mockResolvedValue({ allowed: true });
    mocks.updateManyPairing.mockResolvedValue({ count: 1 });
    mocks.createDesktopSession.mockRejectedValue(new Error("store unavailable"));

    const { POST } = await import("../route");
    // Next.js's route-handler type plugin widens the dynamically-imported
    // POST's inferred return type in a way plain `tsc` can't narrow back
    // down here — every branch in route.ts unconditionally returns a
    // NextResponse (verified by inspection), so this is a type-checker
    // limitation around dynamic imports of route modules, not a real
    // possibility of undefined at runtime.
    const response = (await POST(postRequest()))!;
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.correlationId).toBeTruthy();
    const failure = store.records.find((r) => r.action === "desktop.pair" && r.outcome === "failure");
    expect(failure).toBeDefined();
    expect(failure?.errorCode).toBe("pairing_approval_failed");
    expect(failure?.correlationId).toBe(body.correlationId);
  });
});
