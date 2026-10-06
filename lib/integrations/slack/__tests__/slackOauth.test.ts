/**
 * Vitest unit tests for the Slack OAuth helpers.
 */

import { describe, it, expect } from "vitest";
import { buildSlackInstallUrl, decodeSlackState, encodeSlackState, redactSlackToken } from "../slackOauth";

describe("slackOauth.buildSlackInstallUrl", () => {
  it("includes required params + default scopes", () => {
    const url = buildSlackInstallUrl({
      clientId: "abc.123", redirectUri: "https://app.example.com/cb", state: "state-x",
    });
    expect(url).toContain("client_id=abc.123");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fapp.example.com%2Fcb");
    expect(url).toContain("state=state-x");
    expect(url).toContain("chat%3Awrite");
  });

  it("honours custom scopes when supplied", () => {
    const url = buildSlackInstallUrl({
      clientId: "x", redirectUri: "https://example.com/cb", state: "s",
      scopes: ["chat:write", "commands"],
    });
    expect(url).toContain("scope=chat%3Awrite%2Ccommands");
  });
});

describe("slackOauth.encode/decode state", () => {
  it("round-trips tenantId + nonce", () => {
    const encoded = encodeSlackState({ tenantId: "tenant-1", nonce: "n", secret: "test-secret", nowSec: 100 });
    const r = decodeSlackState({ state: encoded, secret: "test-secret", nowSec: 200 });
    expect(r.ok).toBe(true);
    expect(r.state?.tenantId).toBe("tenant-1");
    expect(r.state?.nonce).toBe("n");
  });

  it("rejects a state string with no signature segment", () => {
    const r = decodeSlackState({ state: "not-base64-json-blob", secret: "test-secret" });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("tampered");
  });

  it("rejects expired state (>10min)", () => {
    const encoded = encodeSlackState({ tenantId: "t", nonce: "n", secret: "test-secret", nowSec: 0 });
    const r = decodeSlackState({ state: encoded, secret: "test-secret", nowSec: 11 * 60 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("expired");
  });

  it("rejects a tenant substitution or changed signature", () => {
    const encoded = encodeSlackState({ tenantId: "tenant-a", nonce: "n", secret: "test-secret", nowSec: 100 });
    const [payload, signature] = encoded.split(".");
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const swappedPayload = Buffer.from(JSON.stringify({ ...json, tenantId: "tenant-b" })).toString("base64url");

    expect(decodeSlackState({ state: `${swappedPayload}.${signature}`, secret: "test-secret", nowSec: 200 })).toEqual({ ok: false, reason: "tampered" });
    expect(decodeSlackState({ state: encoded, secret: "other-secret", nowSec: 200 })).toEqual({ ok: false, reason: "tampered" });
  });

  it("never creates state without a signing secret", () => {
    expect(() => encodeSlackState({ tenantId: "tenant-a", nonce: "n", secret: "", nowSec: 100 })).toThrow("signing secret");
  });
});

describe("slackOauth.redactSlackToken", () => {
  it("returns (unset) for falsy", () => {
    expect(redactSlackToken(undefined)).toBe("(unset)");
    expect(redactSlackToken("")).toBe("(unset)");
    expect(redactSlackToken(null)).toBe("(unset)");
  });

  it("redacts short tokens fully", () => {
    expect(redactSlackToken("short")).toBe("***");
  });

  it("keeps only prefix + last 4 of long tokens", () => {
    const t = "xoxb-1234-abcdefg";
    const r = redactSlackToken(t);
    expect(r).toContain("xoxb-12");
    expect(r).toContain("defg");
    expect(r).not.toContain("abcdef"); // middle redacted
  });
});
