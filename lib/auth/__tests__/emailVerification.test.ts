import { describe, expect, it } from "vitest";
import { emailVerificationUrl, hashEmailVerificationToken, issueEmailVerificationToken } from "../emailVerification";

describe("email verification tokens", () => {
  it("creates distinct opaque tokens with deterministic hashes and a 24-hour expiry", () => {
    const now = new Date("2026-10-14T12:00:00.000Z");
    const first = issueEmailVerificationToken(now);
    const second = issueEmailVerificationToken(now);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashEmailVerificationToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
    expect(first.expiresAt.toISOString()).toBe("2026-10-15T12:00:00.000Z");
  });

  it("keeps the raw token out of the base URL and URL-encodes it as a query value", () => {
    const original = process.env.NEXT_PUBLIC_BASE_URL;
    process.env.NEXT_PUBLIC_BASE_URL = "https://example.test/";
    expect(emailVerificationUrl("a+b/c")).toBe("https://example.test/api/auth/verify-email?token=a%2Bb%2Fc");
    process.env.NEXT_PUBLIC_BASE_URL = original;
  });
});
