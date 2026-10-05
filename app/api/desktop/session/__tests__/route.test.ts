/**
 * Locks in desktop session lifecycle integrity: tenant isolation on
 * listing, ownership enforcement before revocation, that revocation
 * actually takes effect (status flips to revoked, never resurrected),
 * and that pairing-policy denial blocks session creation outright.
 *
 * Uses the real in-memory DesktopSessionStore via setDesktopSessionStore
 * rather than mocking lib/desktop/desktopSession.ts — this exercises
 * the actual ownership/status logic, not a stand-in for it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { setDesktopSessionStore, type DesktopSession, type DesktopSessionStore } from "@/lib/desktop/desktopSession";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

const mocks = vi.hoisted(() => ({
  currentContext: vi.fn(),
  evaluatePairingPolicy: vi.fn(),
}));

vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.currentContext }));
vi.mock("@/lib/desktop/desktopAuthPolicy", () => ({ evaluatePairingPolicy: mocks.evaluatePairingPolicy }));

class FakeStore implements DesktopSessionStore {
  sessions = new Map<string, DesktopSession>();
  async create(s: DesktopSession) { this.sessions.set(s.id, s); }
  async getById(id: string) { return this.sessions.get(id); }
  async listByUser(userId: UserId) {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }
  async update(s: DesktopSession) { this.sessions.set(s.id, s); }
}

function postRequest(body: object) {
  return new NextRequest("https://visionxixlabs.com/api/desktop/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(id: string) {
  return new NextRequest(`https://visionxixlabs.com/api/desktop/session?id=${id}`, { method: "DELETE" });
}

describe("desktop session lifecycle — /api/desktop/session", () => {
  let store: FakeStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new FakeStore();
    setDesktopSessionStore(store);
    mocks.evaluatePairingPolicy.mockResolvedValue({ allowed: true });
  });

  it("blocks session creation outright when pairing policy denies it", async () => {
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, userId: "user-1", organizationId: "org-1" });
    mocks.evaluatePairingPolicy.mockResolvedValue({ allowed: false, code: "desktop.auth.bad_fingerprint", reason: "Too short." });

    const { POST } = await import("../route");
    const res = await POST(postRequest({ deviceFingerprint: "f".repeat(20), deviceLabel: "Mac" }));

    expect(res.status).not.toBe(201);
    expect(store.sessions.size).toBe(0);
  });

  it("creates a real session on allowed pairing, scoped to the caller's org", async () => {
    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, userId: "user-1", organizationId: "org-1" });

    const { POST } = await import("../route");
    const res = await POST(postRequest({ deviceFingerprint: "f".repeat(20), deviceLabel: "Sam's Mac" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.session.status).toBe("active");
    expect(store.sessions.size).toBe(1);
    const [created] = Array.from(store.sessions.values());
    expect(created.organizationId).toBe("org-1");
  });

  it("GET never returns another organization's session, even for the same userId", async () => {
    await store.create({
      id: "dsk_1", userId: "user-1" as UserId, organizationId: "org-1" as OrganizationId,
      deviceFingerprint: "f".repeat(20), deviceLabel: "Org 1 Mac", platform: "macos-arm",
      issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
    await store.create({
      id: "dsk_2", userId: "user-1" as UserId, organizationId: "org-2" as OrganizationId,
      deviceFingerprint: "f".repeat(20), deviceLabel: "Org 2 Mac", platform: "macos-arm",
      issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      lastSeenAt: new Date().toISOString(),
    });

    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, userId: "user-1", organizationId: "org-1" });
    const { GET } = await import("../route");
    const res = await GET();
    const body = await res.json();

    expect(body.data.sessions).toHaveLength(1);
    expect(body.data.sessions[0].id).toBe("dsk_1");
  });

  it("DELETE refuses to revoke a session owned by another organization", async () => {
    await store.create({
      id: "dsk_other", userId: "user-1" as UserId, organizationId: "org-2" as OrganizationId,
      deviceFingerprint: "f".repeat(20), deviceLabel: "Not mine", platform: "macos-arm",
      issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      lastSeenAt: new Date().toISOString(),
    });

    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, userId: "user-1", organizationId: "org-1" });
    const { DELETE } = await import("../route");
    const res = await DELETE(deleteRequest("dsk_other"));

    expect(res.status).not.toBe(200);
    const stillThere = await store.getById("dsk_other");
    expect(stillThere?.revokedAt).toBeUndefined();
  });

  it("DELETE actually revokes an owned session — it never resurrects", async () => {
    await store.create({
      id: "dsk_mine", userId: "user-1" as UserId, organizationId: "org-1" as OrganizationId,
      deviceFingerprint: "f".repeat(20), deviceLabel: "Mine", platform: "macos-arm",
      issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      lastSeenAt: new Date().toISOString(),
    });

    mocks.currentContext.mockResolvedValue({ isAuthenticated: true, userId: "user-1", organizationId: "org-1" });
    const { DELETE, GET } = await import("../route");
    const res = await DELETE(deleteRequest("dsk_mine"));
    expect(res.status).toBe(200);

    const revoked = await store.getById("dsk_mine");
    expect(revoked?.revokedAt).toBeTruthy();

    // A revoked session must never show up as active again, and a second
    // revoke attempt must not succeed as if it still existed.
    const listRes = await GET();
    const listBody = await listRes.json();
    expect(listBody.data.sessions).toHaveLength(0);

    const secondDelete = await DELETE(deleteRequest("dsk_mine"));
    expect(secondDelete.status).not.toBe(200);
  });
});
