import { describe, it, expect } from "vitest";
import { scanForSecrets } from "../secretsHygieneScanner";

describe("scanForSecrets", () => {
  it("empty input → empty result", () => {
    const r = scanForSecrets("");
    expect(r.findings).toEqual([]);
    expect(r.hasCritical).toBe(false);
    expect(r.bytesScanned).toBe(0);
  });

  it("detects AWS access key as critical", () => {
    const r = scanForSecrets("AWS_ACCESS_KEY_ID=AKIAABCDEFGHIJKLMNOP");
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.findings[0].kind).toBe("aws_access_key");
    expect(r.findings[0].severity).toBe("critical");
    expect(r.hasCritical).toBe(true);
  });

  it("detects Stripe live key", () => {
    const r = scanForSecrets("STRIPE=sk_live_51T4nMIABCDEFghijklmnop");
    expect(r.findings.some((f) => f.kind === "stripe_key")).toBe(true);
  });

  it("detects GitHub PAT", () => {
    const r = scanForSecrets("GH=ghp_AbCdEfGhIjKlMnOpQrStUvWxYz0123");
    expect(r.findings.some((f) => f.kind === "github_token")).toBe(true);
  });

  it("detects OpenAI key", () => {
    const r = scanForSecrets("OPENAI=sk-proj-abcdef0123456789abcdef0123456789");
    expect(r.findings.some((f) => f.kind === "openai_key")).toBe(true);
  });

  it("detects Anthropic key", () => {
    const r = scanForSecrets("ANT=sk-ant-api03_abcdefghijklmnopqrst-uvwx");
    expect(r.findings.some((f) => f.kind === "anthropic_key")).toBe(true);
  });

  it("detects a PEM private key", () => {
    const r = scanForSecrets("-----BEGIN RSA PRIVATE KEY-----\nMIICX...\n-----END RSA PRIVATE KEY-----");
    expect(r.findings.some((f) => f.kind === "private_key_pem")).toBe(true);
  });

  it("detects email as info-tier PII", () => {
    const r = scanForSecrets("Reach sam@example.com about the bug.");
    const email = r.findings.find((f) => f.kind === "email");
    expect(email).toBeDefined();
    expect(email?.severity).toBe("warn");
  });

  it("never includes the raw secret in redactedPreview", () => {
    const secret = "AKIAABCDEFGHIJKLMNOP";
    const r = scanForSecrets(`AWS=${secret}`);
    for (const f of r.findings) {
      expect(f.redactedPreview).not.toContain(secret);
    }
  });

  it("redacts email preserving domain", () => {
    const r = scanForSecrets("sam@example.com");
    const email = r.findings.find((f) => f.kind === "email")!;
    expect(email.redactedPreview).toContain("@example.com");
    expect(email.redactedPreview).not.toBe("sam@example.com");
  });

  it("allowlist suppresses matches", () => {
    const r = scanForSecrets("test@example.com", { allowlist: ["test@example.com"] });
    expect(r.findings.some((f) => f.kind === "email")).toBe(false);
  });

  it("line + column are reported correctly", () => {
    const input = "line1\nline2 sam@example.com\n";
    const r = scanForSecrets(input);
    const email = r.findings.find((f) => f.kind === "email");
    expect(email?.line).toBe(2);
    expect(email?.column).toBeGreaterThan(0);
  });

  it("findings sorted by line + column", () => {
    const r = scanForSecrets("first@x.com second@y.com\nthird@z.com");
    for (let i = 1; i < r.findings.length; i++) {
      const prev = r.findings[i - 1];
      const cur  = r.findings[i];
      const ordered = cur.line > prev.line || (cur.line === prev.line && cur.column >= prev.column);
      expect(ordered).toBe(true);
    }
  });

  it("recommendedAction kind matches secret kind", () => {
    const r = scanForSecrets("AKIAABCDEFGHIJKLMNOP");
    expect(r.findings[0].recommendedAction.kind).toBe("rotate");
  });

  it("PEM key recommends remove_from_history", () => {
    const r = scanForSecrets("-----BEGIN PRIVATE KEY-----");
    const pem = r.findings.find((f) => f.kind === "private_key_pem");
    expect(pem?.recommendedAction.kind).toBe("remove_from_history");
  });

  it("AWS access key reports once, not as both aws_access_key and another kind", () => {
    const r = scanForSecrets("AKIAABCDEFGHIJKLMNOP");
    const matches = r.findings.filter((f) => f.kind === "aws_access_key");
    expect(matches.length).toBe(1);
  });

  it("bytesScanned reflects input length", () => {
    const input = "hello world";
    const r = scanForSecrets(input);
    expect(r.bytesScanned).toBe(input.length);
  });
});
