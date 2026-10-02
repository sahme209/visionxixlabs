import { describe, expect, it } from "vitest";
import { trustedAxiomUrlFromAppUrl } from "../trustedCallbackUrl";

describe("trusted Axiom callback returns", () => {
  it("keeps a valid internal return on the configured HTTPS origin", () => {
    expect(trustedAxiomUrlFromAppUrl("/auth/success?integration=github", "https://app.axiom.example"))
      .toBe("https://app.axiom.example/auth/success?integration=github");
  });

  it("allows local loopback during development but rejects plain HTTP elsewhere", () => {
    expect(trustedAxiomUrlFromAppUrl("/auth/success", "http://localhost:3000"))
      .toBe("http://localhost:3000/auth/success");
    expect(trustedAxiomUrlFromAppUrl("/auth/success", "http://axiom.example"))
      .toBeNull();
  });

  it("rejects external, protocol-relative, and backslash-escaped destinations", () => {
    expect(trustedAxiomUrlFromAppUrl("https://other.example", "https://app.axiom.example")).toBeNull();
    expect(trustedAxiomUrlFromAppUrl("//other.example", "https://app.axiom.example")).toBeNull();
    expect(trustedAxiomUrlFromAppUrl("/\\other.example", "https://app.axiom.example")).toBeNull();
  });
});
