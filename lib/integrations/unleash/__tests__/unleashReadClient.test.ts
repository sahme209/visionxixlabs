import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn(async () => [{ address: "8.8.8.8" }]) }));
vi.mock("node:dns/promises", () => dns);
vi.mock("server-only", () => ({}));
import { UnleashReadClient, validateUnleashBaseUrl } from "../unleashReadClient";
afterEach(() => vi.unstubAllGlobals());
describe("Unleash read-only client", () => {
  it("validates the base URL", async () => {
    expect(await validateUnleashBaseUrl("https://flags.example.com/api/")).toBe("https://flags.example.com/api");
    await expect(validateUnleashBaseUrl("http://flags.example.com")).rejects.toThrow("unleash_https_url_required");
    dns.lookup.mockResolvedValueOnce([{ address: "10.1.1.1" }]);
    await expect(validateUnleashBaseUrl("https://flags.example.com")).rejects.toThrow("unleash_private_host_blocked");
  });
  it("reads flags with the client token and drops malformed entries", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url).toBe("https://flags.example.com/api/client/features");
      expect(init.method).toBe("GET"); expect(init.headers.authorization).toBe("*:production.token");
      return Response.json({ features: [{ name: "new-checkout", enabled: true, type: "release", stale: true, strategies: [{}, {}] }, { name: "bad name!", enabled: true }, { name: "x" }] });
    }));
    expect(await new UnleashReadClient("https://flags.example.com", "*:production.token").listFlags()).toEqual([{ name: "new-checkout", enabled: true, type: "release", stale: true, strategies: 2 }]);
  });
});
