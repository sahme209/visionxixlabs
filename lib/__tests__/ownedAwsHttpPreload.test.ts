import { createRequire, syncBuiltinESMExports } from "node:module";
import http from "node:http";
import https from "node:https";
import { afterEach, describe, expect, it, vi } from "vitest";
const { installOwnedAwsHttpGuard } = createRequire(import.meta.url)("../../scripts/fixtures/ownedAwsHttpPreload.cjs");
const originals = { request: http.request, get: http.get, secureRequest: https.request, secureGet: https.get };
afterEach(() => { Object.assign(http, { request: originals.request, get: originals.get }); Object.assign(https, { request: originals.secureRequest, get: originals.secureGet }); syncBuiltinESMExports(); });
const configuration = { origins: ["http://127.0.0.1:34567", "http://127.0.0.1:34568"], awsOrigin: "http://127.0.0.1:34567", proof: "fixture-proof-only", announceReady: false };
function setup() {
  const delegated = vi.fn<(...args: unknown[]) => { fixture: boolean }>(() => ({ fixture: true }));
  http.request = delegated as never; http.get = delegated as never; https.request = delegated as never; https.get = delegated as never;
  const guard = installOwnedAwsHttpGuard(configuration);
  return { delegated, guard };
}
describe("owned AWS fixture preloaded built-in HTTP boundary", () => {
  it.each([
    ["http://sts.amazonaws.com"],
    ["http://127.0.0.1:34569"],
    [{ host: "localhost", port: 34567 }],
    [{ hostname: "127.0.0.1", host: "sts.amazonaws.com", port: 34567 }],
    ["http://127.0.0.1:34567", { hostname: "sts.amazonaws.com" }],
    [{ host: "127.0.0.1", port: 34567, socketPath: "/tmp/not-owned" }],
    [{ host: "127.0.0.1", port: 34567, createConnection: () => {} }],
  ])("denies unsafe destination/options before any underlying delegate: %j", (...args) => {
    const { delegated, guard } = setup();
    try { expect(() => (http.request as (...args: unknown[]) => unknown)(...args)).toThrow("fixture_http_egress_denied"); expect(delegated).not.toHaveBeenCalled(); }
    finally { guard.restore(); }
  });
  it.each([
    ["http://127.0.0.1:34567/path"],
    [new URL("http://127.0.0.1:34567/path")],
    [{ host: "127.0.0.1", port: 34567, method: "POST", path: "/" }],
    ["http://127.0.0.1:34568", { port: 34567 }],
  ])("preserves supported request variants and stamps only SDK-port observations: %j", (...args) => {
    const { delegated, guard } = setup();
    try { (http.request as (...args: unknown[]) => unknown)(...args); expect(delegated).toHaveBeenCalledTimes(1); expect(delegated.mock.calls[0][0]).toMatchObject({ headers: { "x-axiom-fixture-guard": "fixture-proof-only" } }); expect(guard.report().sdkRequests).toBe(1); }
    finally { guard.restore(); }
  });
  it("updates ESM built-in references and protects get/https variants", async () => {
    const { delegated, guard } = setup();
    try {
      const builtin = await import("node:http");
      expect(builtin.request).toBe(http.request);
      expect(() => http.get("http://other.example.test")).toThrow("fixture_http_egress_denied");
      expect(() => https.request("https://sts.amazonaws.com")).toThrow("fixture_http_egress_denied");
      expect(delegated).not.toHaveBeenCalled();
    } finally { guard.restore(); }
  });
});
it.each(["addRequest", "createSocket", "routingOptions"])("replaces a caller agent whose %s could redirect with an owned routing-free native agent", mode => {
  const { delegated, guard } = setup();
  const agent = new http.Agent() as http.Agent & { options: Record<string, unknown> };
  if (mode === "routingOptions") agent.options.host = "other.example.test";
  else Object.assign(agent, { [mode]: () => {} });
  try {
    http.request({ host: "127.0.0.1", port: 34567, agent });
    const forwarded = delegated.mock.calls[0][0] as { agent: http.Agent & { options: Record<string, unknown>; addRequest: unknown; createSocket: unknown } };
    expect(forwarded.agent).not.toBe(agent);
    expect(Object.getPrototypeOf(forwarded.agent)).toBe(http.Agent.prototype);
    expect(forwarded.agent.options.host).toBeUndefined();
    expect(forwarded.agent.addRequest).toBe((http.Agent.prototype as unknown as { addRequest: unknown }).addRequest);
    expect(forwarded.agent.createSocket).toBe((http.Agent.prototype as unknown as { createSocket: unknown }).createSocket);
  }
  finally { guard.restore(); agent.destroy(); }
});
it("denies an alternative default agent hook before delegation", () => {
  const { delegated, guard } = setup();
  try { expect(() => http.request({ host: "127.0.0.1", port: 34567, _defaultAgent: { addRequest() {} } } as never)).toThrow("fixture_http_egress_denied"); expect(delegated).not.toHaveBeenCalled(); }
  finally { guard.restore(); }
});
