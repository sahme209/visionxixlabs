import { describe, expect, it } from "vitest";
import { verificationDesktopCallback } from "../verificationCallback";
import { emailVerificationUrl } from "../emailVerification";

describe("verification navigation context", () => {
  it("retains the actual pairing start contract and can bind signup to its validated challenge", () => {
    const value = "/desktop/connect?challenge=pair_example-123&intent=sign_up";
    expect(verificationDesktopCallback(value, "pair_example-123")).toBe(value);
    expect(verificationDesktopCallback(value, "another-challenge")).toBeNull();
    expect(verificationDesktopCallback("/desktop/connect?challenge=pair_123&intent=sign_in")).toBe("/desktop/connect?challenge=pair_123&intent=sign_in");
  });
  it.each([
    "https://evil.test/desktop/connect?challenge=x", "//evil.test/desktop/connect?challenge=x", "/\\evil.test/desktop/connect?challenge=x",
    "/desktop/connect?challenge=x\n", "/desktop/connect?challenge=x%0a", "/desktop/connect?challenge=x%5c", "/desktop/connect?challenge=x&challenge=y",
    "/desktop/connect?challenge=x&intent=sign_in&intent=sign_up", "/desktop/connect?challenge=x&redirect=https://evil.test",
    "/desktop/connect?challenge=x#https://evil.test", "/dashboard?challenge=x", "/other/../desktop/connect?challenge=x", "/desktop/connect?challenge=x&intent=approve",
    "/desktop/connect?challenge=", "/desktop/connect?challenge=" + "x".repeat(257), "/desktop/connect?challenge=x&%69ntent=sign_in&intent=sign_up",
  ])("drops hostile or ambiguous navigation %s", (value) => expect(verificationDesktopCallback(value)).toBeNull());
  it("carries an encoded pairing destination alongside the proof, and drops unsafe destinations", () => {
    const callback = "/desktop/connect?challenge=pair_123&intent=sign_in";
    const url = new URL(emailVerificationUrl("proof+value", callback));
    expect(url.searchParams.get("token")).toBe("proof+value");
    expect(url.searchParams.get("callbackUrl")).toBe(callback);
    expect(new URL(emailVerificationUrl("proof", "https://evil.test")).searchParams.has("callbackUrl")).toBe(false);
  });
});
