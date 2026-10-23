import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopClient } from "../../../desktop/src/lib/desktopClient";
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe("non-mutating recovery credential verification", () => {
  it("sends only the candidate bearer and preserves the active configuration", async () => {
    const client = new DesktopClient({ apiBase: "https://service.example.test", sessionToken: "axm.desk.previous" });
    const config = client.config;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "revoked" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await client.verifyCredentialCandidate("vxlk_candidate")).toMatchObject({ ok: false });
    expect(fetchMock).toHaveBeenCalledWith("https://service.example.test/api/desktop/access", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer vxlk_candidate" }) }));
    expect(client.config).toBe(config);
    expect(client.config.sessionToken).toBe("axm.desk.previous");
  });
  it("does not send the existing credential when the candidate is missing or unsupported", async () => {
    const client = new DesktopClient({ sessionToken: "axm.desk.previous" });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await client.verifyCredentialCandidate(undefined)).toMatchObject({ ok: false });
    expect(await client.verifyCredentialCandidate("unsupported")).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.config.sessionToken).toBe("axm.desk.previous");
  });
});
it.each([[401, "rejected"], [403, "rejected"], [500, "unavailable"], [429, "unavailable"], [404, "invalid"], [200, "invalid"]])("classifies access HTTP %s without leaking response errors", async (status, failureKind) => {
  const client = new DesktopClient();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "private details" }), { status: status as number })));
  const result = await client.verifyCredentialCandidate("vxlk_candidate");
  expect(result).toMatchObject({ ok: false, failureKind });
  expect(JSON.stringify(result)).not.toContain("private details");
});
it("classifies an aborted verification as cancellation rather than unavailable", async () => {
  const client = new DesktopClient(); const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => { controller.abort(); throw new Error("private abort"); }));
  expect(await client.verifyCredentialCandidate("vxlk_candidate", controller.signal)).toMatchObject({ ok: false, failureKind: "canceled" });
});

it.each(["headers", "body"])("bounds stalled credential %s without changing the active credential", async stage => {
  vi.useFakeTimers();
  const client = new DesktopClient({sessionToken: "axm.desk.previous"}); const config = client.config;
  let requestSignal: AbortSignal | undefined;
  const stalled = new Promise<never>(() => {});
  vi.stubGlobal("fetch", vi.fn((_url, init) => {requestSignal = init.signal; return stage === "headers" ? stalled : Promise.resolve({ok: true, json: () => stalled});}));
  let result: unknown;
  const pending = client.verifyCredentialCandidate("vxlk_candidate").then(value => {result = value;});
  await vi.advanceTimersByTimeAsync(15001);
  expect(result).toMatchObject({ok: false, failureKind: "unavailable"});
  await pending;
  expect(requestSignal?.aborted).toBe(true);
  expect(client.config).toBe(config);
  expect(vi.getTimerCount()).toBe(0);
});
it("settles caller cancellation even when transport ignores its signal", async () => {
  vi.useFakeTimers(); const controller = new AbortController();
  vi.stubGlobal("fetch", vi.fn(() => new Promise<never>(() => {})));
  let result: unknown;
  const pending = new DesktopClient().verifyCredentialCandidate("vxlk_candidate", controller.signal).then(value => {result = value;});
  controller.abort(); await vi.advanceTimersByTimeAsync(0);
  expect(result).toMatchObject({ok: false, failureKind: "canceled"}); await pending;
  expect(vi.getTimerCount()).toBe(0);
});

it("ignores a late successful identity after the deadline and clears successful request timers", async () => {
  vi.useFakeTimers();
  let resolveResponse: (value: unknown) => void = () => {};
  const late = new Promise(resolve => {resolveResponse = resolve;});
  const client = new DesktopClient({sessionToken: "axm.desk.previous"}); const config = client.config;
  vi.stubGlobal("fetch", vi.fn(() => late));
  const pending = client.verifyCredentialCandidate("vxlk_candidate");
  await vi.advanceTimersByTimeAsync(15001);
  expect(await pending).toMatchObject({ok: false, failureKind: "unavailable"});
  const json = vi.fn().mockResolvedValue({ok: true});
  resolveResponse({ok: true, json}); await vi.advanceTimersByTimeAsync(0);
  expect(json).not.toHaveBeenCalled(); expect(client.config).toBe(config);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {status: 401})));
  await client.verifyCredentialCandidate("vxlk_candidate");
  expect(vi.getTimerCount()).toBe(0);
});

it("cleans up the deadline and caller listener after verified success", async () => {
  vi.useFakeTimers(); const controller = new AbortController();
  const remove = vi.spyOn(controller.signal, "removeEventListener");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ok: true, data: {
    identity: {kind: "desktop_session", organizationId: "org-1", role: "operator", capabilities: ["pipeline:read"]},
    access: {allowed: true, code: "active", title: "Access active", message: "Workspace connected", planTier: "pilot", billingStatus: "active", accessRequestPath: "/contact", pricingPath: "/plans"},
  }}))));
  expect(await new DesktopClient().verifyCredentialCandidate("axm.desk.fixture", controller.signal)).toMatchObject({ok: true});
  expect(vi.getTimerCount()).toBe(0); expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
});
