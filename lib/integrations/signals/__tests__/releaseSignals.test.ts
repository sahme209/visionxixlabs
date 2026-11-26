import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readReleaseSignals } from "../releaseSignals";
afterEach(() => vi.unstubAllGlobals());

describe("readReleaseSignals", () => {
  it("reads connected providers independently and combines them into a verdict", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("pagerduty")) return Response.json({ incidents: [{ id: "PINC01", title: "x", status: "triggered" }] });
      if (url.includes("sentry.io")) return Response.json([{ id: "1", title: "TypeError", level: "error", count: "5", permalink: "https://acme.sentry.io/issues/1/" }]);
      if (url.includes("datadoghq")) return Response.json([{ id: 1, name: "Errors", overall_state: "Alert" }]);
      return new Response("no", { status: 500 });
    }));
    const load = vi.fn(async (p: string) => {
      if (p === "pagerduty") return { settings: { region: "us" }, secret: { token: "t" } };
      if (p === "sentry") return { settings: { org: "acme", project: "web", region: "us" }, secret: { token: "t" } };
      if (p === "datadog") return { settings: { site: "datadoghq.com", tag: "service:web" }, secret: { apiKey: "a".repeat(32), appKey: "b".repeat(40) } };
      throw new Error(`${p}_not_connected`);
    });
    const r = await readReleaseSignals(load as never, { release: "web@1.4.0", verifyChecks: [{ key: "smoke", status: "passed" }], now: new Date("2026-11-26T12:00:00Z") });
    expect(r.incidents).toEqual({ pagerduty: 1, opsgenie: null });
    expect(r.newIssues).toEqual([{ title: "TypeError", level: "error", count: 5, url: "https://acme.sentry.io/issues/1/" }]);
    expect(r.monitors).toEqual({ alerting: 1, warning: 0, ok: 0, noData: 0 });
    expect(r.unavailable).toEqual(["launchdarkly", "opsgenie"]);
    expect(r.verification.verdict).toBe("unhealthy");
  });
  it("reports no signals when nothing is connected", async () => {
    const r = await readReleaseSignals(async (p) => { throw new Error(`${p}_not_connected`); }, { release: "1.0", verifyChecks: null, now: new Date() });
    expect(r.verification.verdict).toBe("no_signals");
    expect(r.unavailable).toHaveLength(5);
  });
});
