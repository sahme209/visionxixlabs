import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/billing/isolatedApplication/runtime", () => ({ denyIsolatedExternalIO: vi.fn() }));
import { isConcreteGatewayModelId, loadGatewayModelCatalog } from "../gatewayModelCatalog";

describe("current dispatch catalog versus existing UI catalog", () => {
  const original = process.env.AI_GATEWAY_MODEL_ALLOWLIST;
  afterEach(() => { vi.unstubAllGlobals(); if (original === undefined) delete process.env.AI_GATEWAY_MODEL_ALLOWLIST; else process.env.AI_GATEWAY_MODEL_ALLOWLIST = original; });
  it("uses no-store for current dispatch and retains the existing900-second UI cache", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: "vendor/approved", type: "language" }] }) }));
    vi.stubGlobal("fetch", fetch); delete process.env.AI_GATEWAY_MODEL_ALLOWLIST;
    await loadGatewayModelCatalog({ freshness: "current" }); await loadGatewayModelCatalog();
    expect(fetch.mock.calls).toEqual([["https://ai-gateway.vercel.sh/v1/models", { cache: "no-store" }], ["https://ai-gateway.vercel.sh/v1/models", { next: { revalidate: 900 } }]]);
  });
  it("applies the current service allowlist on each fresh read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: "vendor/approved" }, { id: "vendor/retired" }, { id: "vendor/image", type: "image" }] }) })));
    process.env.AI_GATEWAY_MODEL_ALLOWLIST = "vendor/approved";
    expect((await loadGatewayModelCatalog({ freshness: "current" })).map(model => model.id)).toEqual(["vendor/approved"]);
    process.env.AI_GATEWAY_MODEL_ALLOWLIST = "vendor/retired";
    expect((await loadGatewayModelCatalog({ freshness: "current" })).map(model => model.id)).toEqual(["vendor/retired"]);
  });
  it.each(["service-default", "vmc/private", "vendor/with space", "", "vendor/" + "x".repeat(200)])("does not treat %s as an explicit concrete choice", id => {
    expect(isConcreteGatewayModelId(id)).toBe(false);
  });
});
