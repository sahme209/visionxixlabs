import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../../proxy";
import { aiFetch } from "../../ai/aiFetch";
vi.mock("@/lib/db", () => ({ prisma: {} }));
const original = process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME;
afterEach(() => { vi.unstubAllGlobals(); if (original === undefined) delete process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME; else process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = original; });
describe("isolated application unsupported entry points", () => {
  it.each(["/api/billing/checkout-session", "/api/support/checkout-session", "/api/cron/settle-ai-usage", "/api/desktop/deployments", "/api/axiom/chat", "/api/v1/whoami", "/account"])("denies unsupported isolated route %s", path => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    const response = proxy(new NextRequest(`http://127.0.0.1:3000${path}`, { method: "POST" }));
    expect(response.status).toBe(503);
  });
  it("does not change legacy support payment routing", () => {
    delete process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME;
    expect(proxy(new NextRequest("https://visionxixlabs.com/api/support/checkout-session", { method: "POST" })).status).toBe(200);
  });
  it("blocks direct legacy provider HTTP before any fetch in isolated mode", async () => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    const fetcher = vi.fn(async () => new Response("{}")); vi.stubGlobal("fetch", fetcher);
    await expect(aiFetch({ url: "https://example.invalid/provider", provider: "openai" })).rejects.toThrow("isolated_provider_io_disabled");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("isolated provider denial covers direct SDK and adapter entry points", () => {
  it("denies all legacy direct SDK functions before credentials/SDK loading", async () => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    for (const module of [await import("../../ai/providers/openai"), await import("../../ai/providers/anthropic"), await import("../../ai/providers/gemini")]) {
      await expect(module.generateText({ prompt: "Denied" })).rejects.toThrow("isolated_provider_io_disabled");
    }
  });
  it("denies direct Gateway, configured legacy adapter and model discovery without external fetch", async () => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const { VercelGatewayProvider } = await import("../../ai/providers/VercelGatewayProvider");
    const { OpenAIProvider } = await import("../../ai/providers/OpenAIProvider");
    const { loadGatewayModelCatalog } = await import("../../ai/gatewayModelCatalog");
    await expect(new VercelGatewayProvider("openai/gpt-4o-mini").generateText("Denied")).rejects.toThrow("isolated_provider_io_disabled");
    await expect(new OpenAIProvider({ apiKey: "synthetic-inert" }).generateText("Denied")).rejects.toThrow("isolated_provider_io_disabled");
    await expect(loadGatewayModelCatalog()).rejects.toThrow("isolated_provider_io_disabled");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("denies manager generation and health checks even without operational configuration", async () => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    const { AIProviderManager } = await import("../../ai/AIProviderManager");
    await expect(new AIProviderManager().generateText("Denied")).rejects.toThrow("isolated_provider_io_disabled");
    await expect(new AIProviderManager().healthCheckAll()).rejects.toThrow("isolated_provider_io_disabled");
  });
});

describe("isolated background and legacy authority boundaries", () => {
  it("denies direct autonomy quota, feature entitlement and API-key admissions outside HTTP", async () => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    const { gateAndConsume } = await import("../tierGate");
    const { enforceEntitlement } = await import("../enforceEntitlement");
    const { authenticateApiKey } = await import("../../security/authenticateApiKey");
    await expect(gateAndConsume({ organizationId: "synthetic", capName: "autonomyCyclesPerDay" as any })).rejects.toThrow("isolated_entrypoint_unsupported");
    await expect(enforceEntitlement({ organizationId: "synthetic", dimension: "cloud_accounts" })).rejects.toThrow("isolated_entrypoint_unsupported");
    await expect(authenticateApiKey({ authorizationHeader: "Bearer unsupported", route: "/api/v1/whoami" } as any)).rejects.toThrow("isolated_entrypoint_unsupported");
  });
});

describe("isolated background image and Gateway reconciliation IO", () => {
  it("blocks the direct brand image SDK boundary before configuration/provider work", async () => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    const { generateBrandImage } = await import("../../growth/imageGenerator");
    await expect(generateBrandImage({ category: "product_education", postSummary: "Denied synthetic fixture" })).rejects.toThrow("isolated_provider_io_disabled");
  });
  it("denies direct Gateway reconciliation before lookup, queries or usage/hold writes", async () => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    const { reconcilePendingGatewayUsage } = await import("../reconcileGatewayUsage");
    const query = vi.fn(async () => []), lookup = vi.fn();
    await expect(reconcilePendingGatewayUsage({ usageEvent: { findMany: query } } as any, lookup)).rejects.toThrow("isolated_entrypoint_unsupported");
    expect(query).not.toHaveBeenCalled(); expect(lookup).not.toHaveBeenCalled();
  });
});

describe("isolated HTTP action/method surface", () => {
  it.each(["/api/auth/csrf", "/api/auth/session", "/api/auth/providers"])("does not allow unsupported POST %s", path => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    expect(proxy(new NextRequest(`http://127.0.0.1:3000${path}`, { method: "POST" })).status).toBe(503);
  });
  it("denies server-action transport even on an otherwise allowed read page", () => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    expect(proxy(new NextRequest("http://127.0.0.1:3000/control/usage-billing", { headers: { "next-action": "untrusted-action-id" } })).status).toBe(503);
  });
  it.each(["/control/governance", "/dashboard", "/api/auth/callback/google", "/api/auth/callback/github"])("denies unsupported SSR/OAuth path %s", path => {
    process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME = "true";
    expect(proxy(new NextRequest(`http://127.0.0.1:3000${path}`)).status).toBe(503);
  });
});
