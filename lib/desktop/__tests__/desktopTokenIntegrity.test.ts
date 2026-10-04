/**
 * Locks in the cryptographic half of the pairing handshake: a desktop
 * token is only valid for the exact sessionId it was minted for, and any
 * tampering (swapping sessionId to impersonate a different user/tenant's
 * session — the "wrong user" / "wrong tenant" replay scenario) is
 * rejected by signature verification before any DB lookup happens.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("desktop token mint/verify integrity", () => {
  beforeEach(() => {
    vi.stubEnv("DESKTOP_SESSION_SIGNING_KEY", "a".repeat(32));
  });

  it("round-trips a freshly minted token back to its sessionId", async () => {
    const { mintDesktopToken, verifyDesktopToken } = await import("../../desktop/desktopToken");
    const token = mintDesktopToken("dsk_abc123");
    expect(token.startsWith("axm.desk.dsk_abc123.")).toBe(true);
    const { sessionId } = verifyDesktopToken(token);
    expect(sessionId).toBe("dsk_abc123");
  });

  it("rejects a token whose sessionId was swapped to another session (forged cross-session/cross-tenant token)", async () => {
    const { mintDesktopToken, verifyDesktopToken } = await import("../../desktop/desktopToken");
    const legit = mintDesktopToken("dsk_mine");
    const signature = legit.split(".").pop();
    const forged = `axm.desk.dsk_someone_elses_session.${signature}`;
    expect(() => verifyDesktopToken(forged)).toThrow(/signature/i);
  });

  it("rejects malformed and wrong-prefix tokens", async () => {
    const { verifyDesktopToken } = await import("../../desktop/desktopToken");
    expect(() => verifyDesktopToken("not-a-token")).toThrow();
    expect(() => verifyDesktopToken("axm.desk.")).toThrow();
    expect(() => verifyDesktopToken("vxlk_live_something")).toThrow();
  });

  it("rejects a token signed under a different key (e.g. a stale key rotation)", async () => {
    vi.stubEnv("DESKTOP_SESSION_SIGNING_KEY", "a".repeat(32));
    const { mintDesktopToken } = await import("../../desktop/desktopToken");
    const token = mintDesktopToken("dsk_rotated");

    vi.resetModules();
    vi.stubEnv("DESKTOP_SESSION_SIGNING_KEY", "b".repeat(32));
    const { verifyDesktopToken: verifyWithNewKey } = await import("../../desktop/desktopToken");
    expect(() => verifyWithNewKey(token)).toThrow(/signature/i);
  });
});
