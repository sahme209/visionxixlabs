import { createHmac } from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-starter-secret";

async function load() {
  vi.resetModules();
  vi.stubEnv("STARTER_TOKEN_SECRET", SECRET);
  return import("@/lib/starterToken");
}

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("starter token expiry", () => {
  it("accepts a fresh current-format token", async () => {
    const { createStarterToken, verifyStarterToken } = await load();
    expect(verifyStarterToken(createStarterToken("lead_1"))).toEqual({ leadId: "lead_1" });
  });

  it("rejects a correctly signed legacy two-part token as expired", async () => {
    const { verifyStarterToken } = await load();
    const lead = Buffer.from("lead_1", "utf8").toString("base64url");
    const sig = createHmac("sha256", SECRET).update("lead_1").digest("base64url");
    expect(verifyStarterToken(`${lead}.${sig}`)).toEqual({ error: "expired" });
  });

  it("expires a current-format token after 7 days", async () => {
    const { createStarterToken, verifyStarterToken } = await load();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const token = createStarterToken("lead_1");
    vi.setSystemTime(new Date("2026-11-08T00:00:01Z"));
    expect(verifyStarterToken(token)).toEqual({ error: "expired" });
  });

  it("rejects a tampered signature", async () => {
    const { createStarterToken, verifyStarterToken } = await load();
    const token = createStarterToken("lead_1");
    expect(verifyStarterToken(token.slice(0, -2) + "xx")).toEqual({ error: "invalid" });
  });
});
