import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn(async () => [{ address: "8.8.8.8" }]) }));
vi.mock("node:dns/promises", () => dns);
vi.mock("server-only", () => ({}));
import { isSignalProvider, publicSignalError, SIGNAL_DESCRIPTORS, SIGNAL_PROVIDERS } from "../signalProviders";
afterEach(() => vi.unstubAllGlobals());

describe("signal providers", () => {
  it("is a closed set with a descriptor each", () => {
    expect(SIGNAL_PROVIDERS).toEqual(["argo_cd", "flux", "pagerduty", "opsgenie", "sentry", "datadog", "launchdarkly", "unleash"]);
    expect(isSignalProvider("sentry")).toBe(true);
    expect(isSignalProvider("__proto__")).toBe(false);
    for (const p of SIGNAL_PROVIDERS) expect(SIGNAL_DESCRIPTORS[p].label).toBeTruthy();
  });
  it("separates non-secret settings from the secret and requires credentials", async () => {
    expect(await SIGNAL_DESCRIPTORS.datadog.parse({ site: "datadoghq.eu", tag: "service:checkout", apiKey: "a".repeat(32), appKey: "b".repeat(40) })).toEqual({ settings: { site: "datadoghq.eu", tag: "service:checkout" }, secret: { apiKey: "a".repeat(32), appKey: "b".repeat(40) } });
    expect(await SIGNAL_DESCRIPTORS.argo_cd.parse({ baseUrl: "https://argocd.example.com", project: "team-a", token: "t" })).toEqual({ settings: { baseUrl: "https://argocd.example.com", project: "team-a" }, secret: { token: "t" } });
    await expect(SIGNAL_DESCRIPTORS.pagerduty.parse({})).rejects.toThrow("credentials_required");
    await expect(SIGNAL_DESCRIPTORS.datadog.parse({ site: "evil.example", tag: "x", apiKey: "a", appKey: "b" })).rejects.toThrow("datadog_site_invalid");
  });
  it("probes with one bounded read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ incidents: [{ id: "PINC01", title: "x", status: "triggered" }] })));
    expect(await SIGNAL_DESCRIPTORS.pagerduty.probe({ region: "us" }, { token: "t" })).toBe(1);
  });
  it("only returns safe error codes", () => {
    expect(publicSignalError("sentry", new Error("sentry_api_failed:401"))).toBe("sentry_api_failed");
    expect(publicSignalError("sentry", new Error("some provider text <html>"))).toBe("sentry_connection_failed");
    expect(publicSignalError("argo_cd", new Error("argocd_private_host_blocked"))).toBe("argocd_private_host_blocked");
    expect(publicSignalError("flux", new Error("credentials_required"))).toBe("credentials_required");
  });
});
