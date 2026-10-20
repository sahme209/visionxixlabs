import { describe, expect, it } from "vitest";
import { canonicalAuthOrigin, canonicalAuthPageUrl, isCanonicalAuthHost } from "../canonicalAuthOrigin";

describe("canonical authentication origin", () => {
  it.each([undefined, "", "not-url", "https://user:pass@example.test", "https://example.test?x=1", "https://example.test#x", "http://example.test", "javascript:alert(1)"])("refuses unsafe configuration %s", (value) => {
    expect(canonicalAuthOrigin(value)).toBeNull();
  });
  it.each(["http://localhost:3000", "http://127.0.0.1:3000", "http://[::1]:3000", "https://visionxixlabs.com"])("supports an explicitly configured origin %s", (value) => {
    expect(canonicalAuthOrigin(value)).toBe(value);
  });
  it("normalizes configuration to its origin", () => {
    expect(canonicalAuthOrigin("https://VISIONXIXLABS.com:443/api/auth")).toBe("https://visionxixlabs.com");
  });
  it("refuses unsupported custom auth base paths", () => {
    expect(canonicalAuthOrigin("https://visionxixlabs.com/unsupported")).toBeNull();
  });
  it.each([null, "", "visionxixlabs.com,evil.test", "visionxixlabs.com/evil", "evil.test@visionxixlabs.com", "visionxixlabs.com\\evil", "visionxixlabs.com\nevil"])("rejects malformed or missing host %s", (host) => {
    expect(isCanonicalAuthHost(host, "https://visionxixlabs.com")).toBe(false);
  });
  it("normalizes case and the configured default port", () => {
    expect(isCanonicalAuthHost("VISIONXIXLABS.com:443", "https://visionxixlabs.com")).toBe(true);
  });
  it("preserves pairing intent without forwarding OAuth or arbitrary parameters", () => {
    const url = new URL(canonicalAuthPageUrl("https://visionxixlabs.com", "signin", {
      callbackUrl: "/desktop/connect?challenge=pair_123&intent=sign_in", switchAccount: "1", code: "secret-code", state: "secret-state", unknown: "drop",
    }));
    expect(url.origin).toBe("https://visionxixlabs.com");
    expect([...url.searchParams]).toEqual([["callbackUrl", "/desktop/connect?challenge=pair_123&intent=sign_in"], ["switchAccount", "1"]]);
  });
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/\nevil", ["/safe", "//evil.test"]])("drops unsafe/ambiguous return destinations", (callbackUrl) => {
    expect(canonicalAuthPageUrl("https://visionxixlabs.com", "signin", { callbackUrl })).toBe("https://visionxixlabs.com/auth/signin");
  });
  it("preserves the signup internal return only", () => {
    const url = new URL(canonicalAuthPageUrl("https://visionxixlabs.com", "signup", { redirect: "/desktop/connect?challenge=pair_123", switchAccount: "1", code: "drop" }));
    expect([...url.searchParams]).toEqual([["redirect", "/desktop/connect?challenge=pair_123"]]);
  });
});
