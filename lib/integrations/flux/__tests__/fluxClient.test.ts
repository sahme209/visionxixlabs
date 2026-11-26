import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
vi.mock("server-only", () => ({}));
import { FluxClient, validateFluxApiBaseUrl } from "../fluxClient";

const BASE = "https://k8s.example.com";
const SHA = "a".repeat(40);
const ks = (over: Record<string, unknown> = {}) => ({
  metadata: { name: "apps", namespace: "flux-system" },
  spec: { path: "./clusters/prod", sourceRef: { kind: "GitRepository", name: "flux-system" }, suspend: false, postBuild: { substitute: { SECRET: "x" } } },
  status: { lastAppliedRevision: `main@sha1:${SHA}`, lastAttemptedRevision: `main@sha1:${SHA}`, conditions: [{ type: "Ready", status: "True", reason: "ReconciliationSucceeded", lastTransitionTime: "2026-11-26T10:00:00Z" }] },
  ...over,
});
const client = () => new FluxClient(BASE, "flux-system", { authMode: "bearer", token: "fixture" });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("Flux API base URL boundary", () => {
  it("accepts a public https API root and refuses paths, http and private hosts", async () => {
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8" }]);
    expect(await validateFluxApiBaseUrl(`${BASE}/`)).toBe(BASE);
    for (const bad of ["http://k8s.example.com", `${BASE}/apis`, "https://kubernetes.default.svc"]) await expect(validateFluxApiBaseUrl(bad)).rejects.toThrow();
    dns.lookup.mockResolvedValue([{ address: "192.168.1.4" }]);
    await expect(validateFluxApiBaseUrl(BASE)).rejects.toThrow("flux_private_host_blocked");
  });
});

describe("Flux read-only client", () => {
  it("is namespace-scoped and exposes no mutation methods", () => {
    expect(() => new FluxClient(BASE, "Bad/NS", { authMode: "bearer", token: "t" })).toThrow("flux_namespace_invalid");
    expect(Object.getOwnPropertyNames(FluxClient.prototype).filter((m) => m !== "constructor")).toEqual(["listKustomizations"]);
  });
  it("sends one bounded GET and maps readiness without leaking substitutions", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url).toBe(`${BASE}/apis/kustomize.toolkit.fluxcd.io/v1/namespaces/flux-system/kustomizations?limit=100`);
      expect(init.method).toBe("GET"); expect(init.redirect).toBe("error"); expect(init.headers.authorization).toBe("Bearer fixture");
      return Response.json({ items: [ks(), ks({ metadata: { name: "infra", namespace: "flux-system" }, spec: { suspend: true }, status: { conditions: [{ type: "Ready", status: "Unknown", reason: "Progressing" }], lastAppliedRevision: "<script>" } })] });
    });
    vi.stubGlobal("fetch", fetcher);
    const out = await client().listKustomizations();
    expect(out[0]).toEqual({ name: "apps", namespace: "flux-system", path: "./clusters/prod", sourceKind: "GitRepository", sourceName: "flux-system", suspended: false, ready: "Ready", reason: "ReconciliationSucceeded", appliedRevision: `main@sha1:${SHA}`, attemptedRevision: `main@sha1:${SHA}`, lastTransition: "2026-11-26T10:00:00Z" });
    expect(JSON.stringify(out)).not.toContain("SECRET");
    expect(out[1]).toMatchObject({ name: "infra", suspended: true, ready: "Progressing", appliedRevision: null, sourceKind: null });
  });
  it("refuses items from another namespace, malformed bodies and failed calls", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [ks({ metadata: { name: "apps", namespace: "other" } })] })));
    await expect(client().listKustomizations()).rejects.toThrow("flux_response_invalid");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ kind: "Status" })));
    await expect(client().listKustomizations()).rejects.toThrow("flux_response_invalid");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));
    await expect(client().listKustomizations()).rejects.toThrow("flux_api_failed:403");
  });
});
