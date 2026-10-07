import { describe, expect, it } from "vitest";
import { decodeIdTokenClaims } from "../decodeIdTokenClaims";

function fakeJwt(payload: Record<string, unknown>): string {
  const base64url = (s: string) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe("decodeIdTokenClaims", () => {
  it("decodes a well-formed token's payload claims", () => {
    const token = fakeJwt({ email: "a@acme.com", amr: ["mfa"], "cognito:groups": ["admins"] });
    const claims = decodeIdTokenClaims(token);
    expect(claims).toMatchObject({ email: "a@acme.com", amr: ["mfa"], "cognito:groups": ["admins"] });
  });

  it("returns null for a malformed token", () => {
    expect(decodeIdTokenClaims("not-a-jwt")).toBeNull();
  });

  it("returns null for a token whose payload isn't valid base64/JSON", () => {
    expect(decodeIdTokenClaims("header.!!!not-base64!!!.sig")).toBeNull();
  });

  it("handles base64url padding correctly regardless of payload length", () => {
    // Different payload sizes exercise different padding lengths.
    for (const extra of ["a", "ab", "abc", "abcd"]) {
      const token = fakeJwt({ pad_check: extra });
      expect(decodeIdTokenClaims(token)).toMatchObject({ pad_check: extra });
    }
  });
});
