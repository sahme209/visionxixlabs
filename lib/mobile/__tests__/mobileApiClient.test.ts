/**
 * Vitest unit tests for the MobileApiClient.
 * Uses a fetch stub — no real network. Each call mints a fresh Response.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiClientError, MobileApiClient } from "../mobileApiClient";

const ok = (data: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ ok: true, data }), { status: 200, headers });
const err = (status: number, body = "boom") =>
  new Response(body, { status });

describe("MobileApiClient", () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  function makeClient(fetchImpl: typeof fetch, opts: Partial<ConstructorParameters<typeof MobileApiClient>[0]> = {}) {
    globalThis.fetch = fetchImpl;
    return new MobileApiClient({
      baseUrl: "https://example.com",
      getAccessToken: () => "tok_123",
      timeoutMs: 5000,
      ...opts,
    });
  }

  it("getPublicStatus unwraps {ok,data} envelope", async () => {
    const client = makeClient(vi.fn(async () => ok({ generatedAt: "x", overall: "operational", components: [] })));
    const r = await client.getPublicStatus();
    expect(r.overall).toBe("operational");
    globalThis.fetch = originalFetch;
  });

  it("401 → unauthenticated kind", async () => {
    const client = makeClient(vi.fn(async () => err(401)));
    try {
      await client.getPublicStatus();
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiClientError);
      expect((e as ApiClientError).kind).toBe("unauthenticated");
    }
    globalThis.fetch = originalFetch;
  });

  it("429 → rate_limited kind", async () => {
    const client = makeClient(vi.fn(async () => err(429)));
    try {
      await client.getPublicStatus();
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiClientError).kind).toBe("rate_limited");
    }
    globalThis.fetch = originalFetch;
  });

  it("404 → not_found", async () => {
    const client = makeClient(vi.fn(async () => err(404)));
    try {
      await client.listApprovalPackets();
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiClientError).kind).toBe("not_found");
    }
    globalThis.fetch = originalFetch;
  });

  it("includes bearer token + clientId in headers", async () => {
    const mock = vi.fn<typeof fetch>(async () => ok({ packets: [] }));
    const client = makeClient(mock, { clientId: "ios/1.2.3" });
    await client.listApprovalPackets();
    const callHeaders = new Headers(mock.mock.calls[0]?.[1]?.headers);
    expect(callHeaders.get("authorization")).toBe("Bearer tok_123");
    expect(callHeaders.get("x-client-id")).toBe("ios/1.2.3");
    globalThis.fetch = originalFetch;
  });

  it("uses POST + JSON body for decideApproval", async () => {
    const mock = vi.fn<typeof fetch>(async () => ok({ ok: true }));
    const client = makeClient(mock);
    await client.decideApproval({ packetId: "p1", decision: "approved" });
    const call = mock.mock.calls[0]?.[1];
    expect(call?.method).toBe("POST");
    expect(JSON.parse(String(call?.body))).toEqual({ packetId: "p1", decision: "approved" });
    globalThis.fetch = originalFetch;
  });

  it("non-JSON body → bad_response", async () => {
    const client = makeClient(vi.fn(async () => new Response("not-json", { status: 200 })));
    try {
      await client.getPublicStatus();
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiClientError).kind).toBe("bad_response");
    }
    globalThis.fetch = originalFetch;
  });

  it("network failure → network kind", async () => {
    const client = makeClient(vi.fn(async () => { throw new TypeError("fetch failed"); }));
    try {
      await client.getPublicStatus();
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as ApiClientError).kind).toBe("network");
    }
    globalThis.fetch = originalFetch;
  });

  it("baseUrl trailing slash is normalized", async () => {
    const mock = vi.fn<typeof fetch>(async () => ok({ overall: "ok", components: [], generatedAt: "x" }));
    globalThis.fetch = mock;
    const client = new MobileApiClient({
      baseUrl: "https://example.com///",
      getAccessToken: () => null,
    });
    await client.getPublicStatus();
    expect(mock.mock.calls[0]?.[0]).toBe("https://example.com/api/status");
    globalThis.fetch = originalFetch;
  });
});
