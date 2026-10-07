import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runScheduledControlChecks } from "../scheduledControlChecks";

describe("runScheduledControlChecks", () => {
  const original = { credential: process.env.CREDENTIAL_ENCRYPTION_KEY, starter: process.env.STARTER_TOKEN_SECRET };

  beforeEach(() => {
    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.STARTER_TOKEN_SECRET;
  });

  afterEach(() => {
    if (original.credential === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    else process.env.CREDENTIAL_ENCRYPTION_KEY = original.credential;
    if (original.starter === undefined) delete process.env.STARTER_TOKEN_SECRET;
    else process.env.STARTER_TOKEN_SECRET = original.starter;
  });

  it("fails the credential-encryption control when neither secret is set", () => {
    const [result] = runScheduledControlChecks();
    expect(result.controlId).toBe("cs.vault.encryption");
    expect(result.status).toBe("fail");
  });

  it("fails when a secret is set but shorter than 32 characters", () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = "too-short";
    const [result] = runScheduledControlChecks();
    expect(result.status).toBe("fail");
  });

  it("passes when CREDENTIAL_ENCRYPTION_KEY is set and long enough", () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = "a".repeat(32);
    const [result] = runScheduledControlChecks();
    expect(result.status).toBe("pass");
  });

  it("passes on the STARTER_TOKEN_SECRET fallback too, matching credentialVault.ts's own check", () => {
    process.env.STARTER_TOKEN_SECRET = "b".repeat(40);
    const [result] = runScheduledControlChecks();
    expect(result.status).toBe("pass");
  });
});
