import { describe, expect, it } from "vitest";
import { inviteRevokedBy, MAX_INVITE_TTL_MS, type InviteTokenPayload } from "../inviteLinks";

const issued = Date.UTC(2026, 10, 1);
const payload = (over: Partial<InviteTokenPayload> = {}): InviteTokenPayload => ({ organizationId: "org", email: "Pat@Example.com", role: "operator", invitedByUserId: "admin", expiresAt: issued + 7 * 86_400_000, nonce: "n1", issuedAt: issued, ...over });
const ev = (kind: string, subjectId: string, at: number) => ({ kind, subjectId, createdAt: new Date(at) });

describe("invite revocation (A7.21)", () => {
  it("voids an invite when the email was removed after it was issued", () => {
    expect(inviteRevokedBy(payload(), [ev("member.removed", "pat@example.com", issued + 1000)])).toBe("member_removed");
  });
  it("ignores removals that happened before the invite was issued (a fresh re-invite works)", () => {
    expect(inviteRevokedBy(payload(), [ev("member.removed", "pat@example.com", issued - 1000)])).toBeNull();
  });
  it("voids an invite whose nonce was revoked", () => {
    expect(inviteRevokedBy(payload(), [ev("invite.revoked", "n1", issued + 5)])).toBe("invite_revoked");
    expect(inviteRevokedBy(payload(), [ev("invite.revoked", "other", issued + 5)])).toBeNull();
  });
  it("treats legacy tokens without issuedAt conservatively (expiry minus the 30-day maximum)", () => {
    const legacy = payload({ issuedAt: undefined });
    const before = legacy.expiresAt - MAX_INVITE_TTL_MS - 1;
    expect(inviteRevokedBy(legacy, [ev("member.removed", "pat@example.com", before)])).toBeNull();
    expect(inviteRevokedBy(legacy, [ev("member.removed", "pat@example.com", issued - 1000)])).toBe("member_removed");
  });
});
