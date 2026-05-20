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
    const encoded = encodeSlackState({ tenantId: "tenant-1", nonce: "n", nowSec: 100 });
    const r = decodeSlackState(encoded, 200);
    expect(r.ok).toBe(true);
    expect(r.state?.tenantId).toBe("tenant-1");
    expect(r.state?.nonce).toBe("n");
  });

  it("rejects malformed state", () => {
    const r = decodeSlackState("not-base64-json-blob");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("malformed");
  });

  it("rejects expired state (>10min)", () => {
    const encoded = encodeSlackState({ tenantId: "t", nonce: "n", nowSec: 0 });
    const r = decodeSlackState(encoded, 11 * 60);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("expired");
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
