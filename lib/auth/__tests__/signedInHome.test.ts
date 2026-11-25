import { describe, expect, it } from "vitest";
import { isSignedInHomeToken } from "../signedInHome";

describe("root entry signed-in check", () => {
  it("accepts only the canonical identity the session callback requires", () => {
    expect(isSignedInHomeToken({ identityVersion: 1, id: "user_1", email: "a@example.test" })).toBe(true);
  });
  it.each([
    null, undefined, "token", {},
    { identityVersion: 2, id: "user_1", email: "a@example.test" },
    { identityVersion: 1, id: "", email: "a@example.test" },
    { identityVersion: 1, id: "  ", email: "a@example.test" },
    { identityVersion: 1, id: "user_1" },
    { identityVersion: 1, id: "user_1", email: " " },
    { identityVersion: 1, id: 7, email: "a@example.test" },
  ])("treats %j as signed out", token => {
    expect(isSignedInHomeToken(token)).toBe(false);
  });
});
