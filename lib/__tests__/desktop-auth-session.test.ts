import { describe, expect, it } from "vitest";
import { validateAuthSession, type PairedSession } from "../../desktop/src/lib/authSession";

const validSession: PairedSession = {
  id: "session-1",
  deviceLabel: "Test Mac",
  expiresAt: "2030-01-01T00:00:00.000Z",
};

describe("desktop auth session validation", () => {
  it("accepts an unexpired signed desktop token", () => {
    expect(validateAuthSession("axm.desk.session-1.signature_123", validSession, Date.parse("2029-01-01"))).toBeNull();
  });

  it("rejects malformed tokens and incomplete metadata", () => {
    expect(validateAuthSession("not-a-token", validSession, Date.parse("2029-01-01"))).toMatch(/invalid format/i);
    expect(validateAuthSession("axm.desk.id.sig", { ...validSession, deviceLabel: "" }, Date.parse("2029-01-01"))).toMatch(/device label/i);
  });

  it("rejects expired and malformed expiry dates", () => {
    expect(validateAuthSession("axm.desk.id.sig", validSession, Date.parse("2031-01-01"))).toMatch(/expired/i);
    expect(validateAuthSession("axm.desk.id.sig", { ...validSession, expiresAt: "later" })).toMatch(/expiry/i);
  });
});

