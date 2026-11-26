import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { DatadogReadClient, summarizeMonitors } from "../datadogReadClient";
afterEach(() => vi.unstubAllGlobals());
const API = "a".repeat(32), APP = "b".repeat(40);
describe("Datadog read-only client", () => {
  it("reads monitors for a tag on the chosen site and summarizes them", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url).toBe("https://api.datadoghq.eu/api/v1/monitor?monitor_tags=service%3Acheckout&page_size=100&page=0");
      expect(init.method).toBe("GET"); expect(init.headers["dd-api-key"]).toBe(API);
      return Response.json([{ id: 1, name: "Checkout errors", overall_state: "Alert", priority: 1, tags: ["service:checkout"] }, { id: 2, name: "Latency", overall_state: "OK", tags: [] }, { id: 3, name: "Odd", overall_state: "Skipped" }, { id: "x", name: "bad" }]);
    }));
    const monitors = await new DatadogReadClient("datadoghq.eu", API, APP).monitorsTagged("service:checkout");
    expect(monitors.map((m) => [m.id, m.state])).toEqual([[1, "Alert"], [2, "OK"], [3, "Unknown"]]);
    expect(summarizeMonitors(monitors)).toEqual({ alerting: 1, warning: 0, ok: 1, noData: 1 });
  });
  it("refuses unknown sites, malformed keys and tags", async () => {
    expect(() => new DatadogReadClient("evil.example" as never, API, APP)).toThrow("datadog_site_invalid");
    expect(() => new DatadogReadClient("datadoghq.com", "x", APP)).toThrow("datadog_keys_invalid");
    await expect(new DatadogReadClient("datadoghq.com", API, APP).monitorsTagged("a b")).rejects.toThrow("datadog_tag_invalid");
  });
});
