import { describe, expect, it } from "vitest";
import { redactSecrets } from "../contextRedaction";

describe("AI context redaction (A7.16)", () => {
  it.each([
    ["vxlk_live_abcdefgh12345678", "axiom_key"],
    ["AKIAABCDEFGHIJKLMNOP", "aws_access_key"],
    ["ghp_" + "a".repeat(36), "github_token"],
    ["github_pat_" + "b".repeat(30), "github_token"],
    ["sk-ant-" + "c".repeat(30), "anthropic_key"],
    ["sk-proj-" + "d".repeat(30), "openai_key"],
    ["xoxb-1234567890-abcdef", "slack_token"],
    ["sk_live_" + "e".repeat(24), "stripe_key"],
    ["eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", "jwt"],
  ])("redacts %s", (secret, kind) => {
    const r = redactSecrets(`config: ${secret} end`);
    expect(r.text).not.toContain(secret);
    expect(r.text).toContain(`[REDACTED:${kind}]`);
    expect(r.redactions[kind]).toBe(1);
  });

  it("keeps the shape of assignments and connection strings", () => {
    expect(redactSecrets("DB_PASSWORD=hunter2hunter2").text).toBe("DB_PASSWORD=[REDACTED:assigned_secret]");
    expect(redactSecrets("STRIPE_SECRET_KEY: abcdefghij").text).toBe("STRIPE_SECRET_KEY: [REDACTED:assigned_secret]");
    expect(redactSecrets("password: hunter2hunter2").text).toBe("password: [REDACTED:assigned_secret]");
    expect(redactSecrets("postgres://app:s3cretpw@db.internal:5432/x").text).toBe("postgres://app:[REDACTED]@db.internal:5432/x");
    expect(redactSecrets("-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----").text).toBe("[REDACTED:private_key]");
  });

  it("leaves ordinary text alone and is idempotent", () => {
    const plain = "Deploy acme/web to staging after the tests pass. Ticket CHG0030002.";
    expect(redactSecrets(plain)).toEqual({ text: plain, redactions: {} });
    const once = redactSecrets("token sk-ant-" + "x".repeat(30)).text;
    expect(redactSecrets(once).text).toBe(once);
  });
});
