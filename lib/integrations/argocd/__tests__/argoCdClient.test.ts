import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
vi.mock("server-only", () => ({}));
import { ArgoCdClient, validateArgoCdBaseUrl } from "../argoCdClient";

const BASE = "https://argocd.example.com";
const app = (over: Record<string, unknown> = {}) => ({
  metadata: { name: "payments-api" },
  spec: { project: "team-a", destination: { namespace: "payments", server: "https://kubernetes.default.svc" }, source: { repoURL: "https://github.com/acme/deploy", targetRevision: "main" } },
  status: { sync: { status: "Synced", revision: "ABCDEF1234567890ABCDEF1234567890ABCDEF12" }, health: { status: "Healthy" }, operationState: { phase: "Succeeded" }, reconciledAt: "2026-11-26T10:00:00Z" },
  ...over,
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Argo CD base URL boundary", () => {
  it("accepts public https roots and rejects private or malformed ones", async () => {
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8" }]);
    expect(await validateArgoCdBaseUrl(`${BASE}/`)).toBe(BASE);
    for (const bad of ["http://argocd.example.com", `${BASE}/api`, "https://argocd.argocd.svc"]) await expect(validateArgoCdBaseUrl(bad)).rejects.toThrow();
    dns.lookup.mockResolvedValue([{ address: "10.0.0.5" }]);
    await expect(validateArgoCdBaseUrl(BASE)).rejects.toThrow("argocd_private_host_blocked");
  });
});

describe("Argo CD read-only client", () => {
  it("is scoped to one project and exposes no mutation methods", () => {
    expect(() => new ArgoCdClient(BASE, "../x", { authMode: "bearer", token: "t" })).toThrow("argocd_project_invalid");
    expect(Object.getOwnPropertyNames(ArgoCdClient.prototype).filter((m) => m !== "constructor")).toEqual(["listApplications"]);
  });
  it("sends one bounded GET with bearer auth and maps sync, health and revision", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url).toBe(`${BASE}/api/v1/applications?projects=team-a`);
      expect(init.method).toBe("GET"); expect(init.redirect).toBe("error"); expect(init.headers.authorization).toBe("Bearer fixture");
      return Response.json({ items: [app(), app({ metadata: { name: "web" }, status: { sync: { status: "Weird" }, health: {} } })] });
    });
    vi.stubGlobal("fetch", fetcher);
    const out = await new ArgoCdClient(BASE, "team-a", { authMode: "bearer", token: "fixture" }).listApplications();
    expect(out[0]).toEqual({ name: "payments-api", project: "team-a", destinationNamespace: "payments", destinationServer: "https://kubernetes.default.svc", repoUrl: "https://github.com/acme/deploy", targetRevision: "main", sync: "Synced", health: "Healthy", observedRevision: "abcdef1234567890abcdef1234567890abcdef12", operationPhase: "Succeeded", reconciledAt: "2026-11-26T10:00:00Z" });
    expect(out[1]).toMatchObject({ name: "web", sync: "Unknown", health: "Unknown", observedRevision: null });
  });
  it("refuses applications outside the configured project and malformed responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [app({ spec: { project: "other" } })] })));
    await expect(new ArgoCdClient(BASE, "team-a", { authMode: "bearer", token: "t" }).listApplications()).rejects.toThrow("argocd_response_invalid");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: null })));
    expect(await new ArgoCdClient(BASE, "team-a", { authMode: "bearer", token: "t" }).listApplications()).toEqual([]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    await expect(new ArgoCdClient(BASE, "team-a", { authMode: "bearer", token: "t" }).listApplications()).rejects.toThrow("argocd_api_failed:403");
  });
});
