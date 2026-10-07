import { describe, expect, it } from "vitest";
import { linearCredentialRefreshDue, parseStoredLinearCredential } from "../linearCredential";

describe("Linear OAuth credential", () => {
  it("parses the encrypted payload only after decryption", () => {
    expect(parseStoredLinearCredential(JSON.stringify({ accessToken: "token", refreshToken: "refresh", expiresAt: 2_000 }))).toEqual({
      accessToken: "token", refreshToken: "refresh", expiresAt: 2_000,
    });
    expect(parseStoredLinearCredential("not-json")).toBeNull();
  });

  it("refreshes shortly before expiry only when a refresh token exists", () => {
    expect(linearCredentialRefreshDue({ accessToken: "token", refreshToken: "refresh", expiresAt: 10_000 }, 9_500, 1_000)).toBe(true);
    expect(linearCredentialRefreshDue({ accessToken: "token", refreshToken: null, expiresAt: 10_000 }, 9_500, 1_000)).toBe(false);
  });
});
