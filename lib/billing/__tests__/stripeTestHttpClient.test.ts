import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ClientRequest, IncomingMessage } from "node:http";
import { Agent, type RequestOptions } from "node:https";
import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBoundedStripeHttpClient } from "../newTestSubscription/stripeHttpClient";
import { withOwnedStripeDeadline, stripeDeadlineOptions, currentStripeDeadline } from "../newTestSubscription/stripeDeadline";

function wire(configuredTransportKeys: readonly string[] = []) {
  const response = Object.assign(new PassThrough(), { statusCode: 200, headers: { "content-type": "application/json", "request-id": "req_owned_fixture" } });
  response.on("error", () => {});
  let deliver!: (response: IncomingMessage) => void;
  const request = new EventEmitter() as EventEmitter & { end: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };
  request.end = vi.fn(); request.destroy = vi.fn((error?: Error) => { response.destroy(error); queueMicrotask(() => { if (error) request.emit("error", error); request.emit("close"); }); return request; });
  const factory = vi.fn((_options: RequestOptions, callback: (response: IncomingMessage) => void) => { deliver = callback; return request as unknown as ClientRequest; });
  const client = createBoundedStripeHttpClient({ syntheticRequest: factory, configuredTransportKeys });
  const run = (timeout = 10000, headers: Record<string, string> = { Authorization: "Bearer sk_test_synthetic" }) => {
    const execute = () => client.makeRequest("api.stripe.com", 443, "/v1/account", "GET", { ...headers, ...stripeDeadlineOptions(timeout).additionalHeaders }, null, "https", timeout);
    return currentStripeDeadline() ? execute() : withOwnedStripeDeadline(performance.now() + timeout, execute);
  };
  return { client, request, response, factory, run, headers: () => deliver(response as unknown as IncomingMessage) };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("owned Stripe HTTPS transport (synthetic native wire, no network)", () => {
  it.each(["before_headers", "hung_body", "trickling_body"])("hard-aborts %s at the whole-request deadline and destroys owned resources", async stage => {
    vi.useFakeTimers(); const destroyed = vi.spyOn(Agent.prototype, "destroy"); const f = wire();
    const pending = f.run(); const rejected = expect(pending).rejects.toThrow("stripe_hard_deadline");
    if (stage !== "before_headers") { f.headers(); f.response.write('{"id":"'); }
    if (stage === "trickling_body") for (let n = 0; n < 9; n++) { await vi.advanceTimersByTimeAsync(1000); f.response.write("x"); }
    await vi.advanceTimersByTimeAsync(stage === "trickling_body" ? 1000 : 10000); await rejected;
    expect(f.request.destroy).toHaveBeenCalled(); expect(f.response.destroyed).toBe(true); expect(destroyed).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("uses the shorter remaining total deadline rather than renewing ten seconds", async () => {
    vi.useFakeTimers(); const f = wire(); const pending = f.run(37); const rejected = expect(pending).rejects.toThrow("stripe_hard_deadline");
    f.headers(); f.response.write("{"); await vi.advanceTimersByTimeAsync(37); await rejected;
    expect(f.response.destroyed).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it("absolute SDK scope cancels an active owned request and blocks delayed native starts", async () => {
    vi.useFakeTimers(); const f = wire();
    const pending = withOwnedStripeDeadline(performance.now() + 37, () => f.run()); const rejected = expect(pending).rejects.toThrow("stripe_hard_deadline");
    f.headers(); f.response.write("{"); await vi.advanceTimersByTimeAsync(37); await rejected;
    expect(f.request.destroy).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    const late = wire(); let lateResult: Promise<unknown> | undefined;
    const preparation = withOwnedStripeDeadline(performance.now() + 37, () => new Promise<never>(() => { const headers = stripeDeadlineOptions(10000).additionalHeaders!; setTimeout(() => { lateResult = late.client.makeRequest("api.stripe.com", 443, "/v1/account", "GET", headers, null, "https", 10000).catch(error => error); }, 50); }));
    const expired = expect(preparation).rejects.toThrow("stripe_hard_deadline"); await vi.advanceTimersByTimeAsync(50); await expired;
    expect(await lateResult).toBeInstanceOf(Error); expect(late.factory).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("buffers only bounded complete JSON and clears all timers on success", async () => {
    vi.useFakeTimers(); const f = wire(); const pending = f.run(); f.headers(); f.response.end('{"id":"acct_test"}');
    const response = await pending; expect(await response.toJSON()).toEqual({ id: "acct_test" }); expect(response.getHeaders()["request-id"]).toBe("req_owned_fixture");
    expect(f.request.destroy).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["oversized", "redirect", "aborted"])("destroys %s response without following or retaining IO", async invalid => {
    const f = wire(); if (invalid === "redirect") f.response.statusCode = 302;
    const pending = f.run(); const rejected = expect(pending).rejects.toThrow(); f.headers();
    if (invalid === "oversized") f.response.write("x".repeat(262145));
    if (invalid === "aborted") f.response.emit("aborted");
    await rejected; expect(f.request.destroy).toHaveBeenCalled(); expect(f.response.destroyed).toBe(true); expect(f.factory).toHaveBeenCalledTimes(1);
  });
  it("fixes endpoint and headers without replacing CA roots or disabling trust", async () => {
    const f = wire();
    await expect(f.client.makeRequest("foreign.invalid", 443, "/v1/account", "GET", {}, null, "https", 10000)).rejects.toThrow("stripe_endpoint_unsupported"); expect(f.factory).not.toHaveBeenCalled();
    const pending = f.run(10000, { host: "foreign.invalid", "Proxy-Authorization": "synthetic" });
    f.headers(); f.response.end("{}"); await pending;
    expect(f.factory.mock.calls[0][0]).toMatchObject({ hostname: "api.stripe.com", port: 443, protocol: "https:", rejectUnauthorized: true, headers: { host: "api.stripe.com", "accept-encoding": "identity", connection: "close" } });
    const options = f.factory.mock.calls[0][0]; expect(options.headers).not.toHaveProperty("Proxy-Authorization"); expect(options.ca).toBeUndefined(); expect(options.headers).not.toHaveProperty("X-Axiom-Internal-Deadline"); expect(options.agent).toBeInstanceOf(Agent);
  });
  it.each(["HTTPS_PROXY", "NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED"])("refuses unsupported managed %s configuration before a socket is created", async key => {
    const f = wire([key]); await expect(f.run()).rejects.toThrow("stripe_managed_transport_unsupported"); expect(f.factory).not.toHaveBeenCalled();
  });
  it("preserves provider denial before transport construction and during body consumption", async () => {
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true"); expect(() => wire()).toThrow("isolated_provider_io_disabled");
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "false"); const f = wire(); const pending = f.run(); const rejected = expect(pending).rejects.toThrow("isolated_provider_io_disabled"); f.headers();
    vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true"); f.response.write("{}"); await rejected; expect(f.response.destroyed).toBe(true);
  });
  it("actual Stripe SDK parsing uses the owned whole-body timeout with zero retries", async () => {
    vi.useFakeTimers(); const f = wire(); const sdk = new Stripe("sk_test_synthetic", { httpClient: f.client, timeout: 10000, maxNetworkRetries: 0 });
    const pending = withOwnedStripeDeadline(performance.now() + 10000, () => sdk.accounts.retrieve({}, stripeDeadlineOptions(10000))); const rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(f.factory).toHaveBeenCalledTimes(1)); f.headers(); f.response.write('{"id":"'); await vi.advanceTimersByTimeAsync(10000); await rejected;
    expect(f.factory).toHaveBeenCalledTimes(1); expect(f.response.destroyed).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });
  it("actual SDK preserves synthetic response receipt after owned cleanup", async () => {
    const f = wire(); const sdk = new Stripe("sk_test_synthetic", { httpClient: f.client, timeout: 10000, maxNetworkRetries: 0 });
    const pending = withOwnedStripeDeadline(performance.now() + 10000, () => sdk.accounts.retrieve({}, stripeDeadlineOptions(10000)));
    await vi.waitFor(() => expect(f.factory).toHaveBeenCalledTimes(1)); f.headers(); f.response.end('{"id":"acct_test"}');
    const account = await pending; expect(account.id).toBe("acct_test");
    expect(account.lastResponse).toMatchObject({ requestId: "req_owned_fixture", statusCode: 200 });
    expect(Object.getOwnPropertyDescriptor(account, "lastResponse")?.enumerable).toBe(false);
    expect(f.request.destroy).toHaveBeenCalled(); expect(f.response.destroyed).toBe(true);
  });
});
