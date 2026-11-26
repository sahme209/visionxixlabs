import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { LaunchDarklyReadClient, staleTemporaryFlags } from "../launchDarklyReadClient";
afterEach(() => vi.unstubAllGlobals());
describe("LaunchDarkly read-only client", () => {
  it("reads flag state for one project and environment", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url).toBe("https://app.launchdarkly.com/api/v2/flags/web?env=production&summary=true&limit=100");
      expect(init.method).toBe("GET"); expect(init.headers.authorization).toBe("api-fixture");
      return Response.json({ items: [
        { key: "new-checkout", name: "New checkout", kind: "boolean", temporary: true, archived: false, tags: ["checkout"], creationDate: 1764000000000, environments: { production: { on: true, lastModified: 1761000000000 }, staging: { on: false } } },
        { key: "bad key!", name: "x" },
      ] });
    }));
    const flags = await new LaunchDarklyReadClient("web", "production", { token: "api-fixture" }).listFlags();
    expect(flags).toEqual([{ key: "new-checkout", name: "New checkout", kind: "boolean", on: true, temporary: true, archived: false, tags: ["checkout"], lastModified: new Date(1761000000000).toISOString(), createdAt: new Date(1764000000000).toISOString() }]);
    expect(staleTemporaryFlags(flags, new Date("2026-11-26T00:00:00Z")).map((f) => f.key)).toEqual(["new-checkout"]);
    expect(staleTemporaryFlags(flags, new Date(1761000000000 + 86_400_000))).toEqual([]);
  });
  it("refuses bad scope and surfaces failures", async () => {
    expect(() => new LaunchDarklyReadClient("../x", "prod", { token: "t" })).toThrow("launchdarkly_scope_invalid");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("x", { status: 403 })));
    await expect(new LaunchDarklyReadClient("web", "prod", { token: "t" }).listFlags()).rejects.toThrow("launchdarkly_api_failed:403");
  });
});
