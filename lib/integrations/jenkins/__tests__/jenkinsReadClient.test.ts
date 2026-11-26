import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn(async () => [{ address: "8.8.8.8" }]) }));
vi.mock("node:dns/promises", () => dns);
vi.mock("server-only", () => ({}));
import { JenkinsReadClient, validateJenkinsBaseUrl } from "../jenkinsReadClient";
afterEach(() => vi.unstubAllGlobals());
describe("Jenkins read-only client", () => {
  it("validates the base URL", async () => {
    expect(await validateJenkinsBaseUrl("https://ci.example.com/jenkins/")).toBe("https://ci.example.com/jenkins");
    await expect(validateJenkinsBaseUrl("https://ci.example.com/a/b")).rejects.toThrow("jenkins_base_url_invalid");
    dns.lookup.mockResolvedValueOnce([{ address: "172.16.0.2" }]);
    await expect(validateJenkinsBaseUrl("https://ci.example.com")).rejects.toThrow("jenkins_private_host_blocked");
  });
  it("lists jobs with their last build using one GET with basic auth", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url.startsWith("https://ci.example.com/api/json?tree=")).toBe(true);
      expect(init.method).toBe("GET"); expect(init.headers.authorization).toBe(`Basic ${Buffer.from("bot:tok").toString("base64")}`);
      return Response.json({ jobs: [{ name: "web", url: "https://ci.example.com/job/web/", lastBuild: { number: 42, result: "FAILURE", building: false, timestamp: 1764100000000 } }, { name: "api", url: "https://evil.example/x", lastBuild: { number: 7, result: null, building: true } }, { name: "" }] });
    }));
    expect(await new JenkinsReadClient("https://ci.example.com", "bot", "tok").listJobs()).toEqual([
      { name: "web", url: "https://ci.example.com/job/web/", lastBuild: { number: 42, result: "FAILURE", at: new Date(1764100000000).toISOString() } },
      { name: "api", url: null, lastBuild: { number: 7, result: "IN_PROGRESS", at: null } },
    ]);
  });
});
