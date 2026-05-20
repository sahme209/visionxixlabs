/**
 * Vitest unit tests for the pure PII redactor.
 */

import { describe, it, expect } from "vitest";
import { redactPii, redactText } from "../piiRedactor";

describe("piiRedactor", () => {
  it("clean text → no redactions, identical output", () => {
    const r = redactPii("Hello operator — the deploy looks fine.");
    expect(r.hadRedactions).toBe(false);
    expect(r.redactedText).toBe("Hello operator — the deploy looks fine.");
  });

  it("redacts emails", () => {
    const r = redactPii("Page sam@example.com about the bucket.");
    expect(r.redactedText).toBe("Page <email:1> about the bucket.");
    expect(r.redactions[0].kind).toBe("email");
    expect(r.redactions[0].original).toBe("sam@example.com");
  });

  it("redacts AWS access keys before emails (rule order)", () => {
    const r = redactPii("Key AKIAIOSFODNN7EXAMPLE leaked into a doc.");
    expect(r.redactedText).toBe("Key <aws_access_key:1> leaked into a doc.");
  });

  it("redacts IPv4 + IPv6 (full-form)", () => {
    // Pattern targets the full 8-group IPv6 form. Compressed (::) is out of scope.
    const r = redactPii("Source 192.168.1.50 also 2001:0db8:0000:0000:0000:0000:0000:0001.");
    expect(r.redactions.map((x) => x.kind).sort()).toEqual(["ipv4", "ipv6"]);
  });

  it("redacts JWTs", () => {
    const jwt = "eyJhbGciOi.eyJzdWIiOiIxMjM.SflKxwRJSMeKKF";
    const r = redactPii(`token=${jwt} expires soon`);
    expect(r.redactedText).toContain("<jwt:1>");
  });

  it("numbers each occurrence per kind", () => {
    const r = redactPii("ping a@x.com or b@x.com then c@x.com");
    expect(r.redactedText).toBe("ping <email:1> or <email:2> then <email:3>");
  });

  it("preserves the mapping so caller can un-redact (carefully)", () => {
    const r = redactPii("call 415-555-1212 anytime");
    const phone = r.redactions.find((x) => x.kind === "phone")!;
    expect(phone.original).toBe("415-555-1212");
  });

  it("convenience redactText returns just the text", () => {
    const t = redactText("ping a@x.com");
    expect(t).toBe("ping <email:1>");
  });

  it("supports custom rules", () => {
    const r = redactPii("internal-id ABC-12345", {
      rules: [{ kind: "email", pattern: /ABC-\d+/g }], // intentional mis-tag for the test
    });
    expect(r.redactedText).toBe("internal-id <email:1>");
  });
});
