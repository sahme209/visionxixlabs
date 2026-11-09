import { afterEach, describe, expect, it, vi } from "vitest";
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
import { ARGO_PAGE_LIMIT, ArgoWorkflowsClient, validateArgoBaseUrl } from "../argoWorkflowsClient";

const BASE = "https://argo.example.com";
const UID1 = "44444444-4444-4444-8444-444444444444";
const UID2 = "55555555-5555-4555-8555-555555555555";
const client = () => new ArgoWorkflowsClient(BASE, "batch", { authMode: "bearer", token: "fixture-token" });
const reply = (items: unknown) => vi.fn(async () => Response.json({ items }));

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("Argo base URL boundary", () => {
  it.each([BASE, `${BASE}/`, `${BASE}/argo`])("accepts %s", async (url) => {
    dns.lookup.mockResolvedValue([{ address: "8.8.8.8" }]);
    expect(await validateArgoBaseUrl(url)).toBe(url.replace(/\/$/, ""));
  });
  it.each(["http://argo.example.com", `${BASE}/api`, `${BASE}/a/b`, `${BASE}?x=1`, "https://argo.batch.svc", "https://argo.default.svc.cluster.local"])("rejects %s", async (url) => {
    await expect(validateArgoBaseUrl(url)).rejects.toThrow();
    expect(dns.lookup).not.toHaveBeenCalled();
  });
  it("blocks private DNS answers and honours the allowlist", async () => {
    dns.lookup.mockResolvedValue([{ address: "172.16.0.9" }]);
    await expect(validateArgoBaseUrl(BASE)).rejects.toThrow("argo_private_host_blocked");
    vi.stubEnv("ARGO_ALLOWED_HOSTS", "other.example.com");
    await expect(validateArgoBaseUrl(BASE)).rejects.toThrow("argo_host_not_allowed");
  });
});

describe("Argo Workflows read-only client", () => {
  it("is scoped to one valid namespace and has no mutation methods", () => {
    expect(() => new ArgoWorkflowsClient(BASE, "../kube-system", { authMode: "bearer", token: "t" })).toThrow("argo_namespace_invalid");
    expect(() => new ArgoWorkflowsClient(BASE, "Batch", { authMode: "bearer", token: "t" })).toThrow("argo_namespace_invalid");
    expect(Object.getOwnPropertyNames(ArgoWorkflowsClient.prototype).filter((m) => m !== "constructor").sort()).toEqual(["get", "listTemplates", "listWorkflows", "meta"]);
  });

  it("sends only bounded GETs in the namespace with bearer auth and no redirects", async () => {
    const fetcher = vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      expect(url.startsWith(`${BASE}/api/v1/workflow-templates/batch?`)).toBe(true);
      expect(url).toContain(`listOptions.limit=${ARGO_PAGE_LIMIT}`);
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("error");
      expect(init.headers.authorization).toBe("Bearer fixture-token");
      return Response.json({ items: [{ metadata: { name: "nightly", namespace: "batch", creationTimestamp: "2026-11-01T00:00:00Z" } }] });
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await client().listTemplates()).toEqual([{ name: "nightly", createdAt: "2026-11-01T00:00:00Z" }]);
  });

  it("maps workflows and treats a null list as empty", async () => {
    vi.stubGlobal("fetch", reply([
      { metadata: { name: "nightly-abc", namespace: "batch", uid: UID1 }, spec: { workflowTemplateRef: { name: "nightly" } }, status: { phase: "Succeeded", startedAt: "2026-11-08T01:00:00Z", finishedAt: "2026-11-08T01:04:00Z", progress: "3/3" } },
      { metadata: { name: "adhoc", namespace: "batch", uid: UID2 }, status: { phase: "Weird", progress: "x" } },
    ]));
    const wf = await client().listWorkflows();
    expect(wf[0]).toEqual({ name: "nightly-abc", uid: UID1, template: "nightly", phase: "Succeeded", startedAt: "2026-11-08T01:00:00Z", finishedAt: "2026-11-08T01:04:00Z", progress: "3/3" });
    expect(wf[1]).toMatchObject({ template: null, phase: "Unknown", progress: null });
    vi.stubGlobal("fetch", reply(null));
    expect(await client().listWorkflows()).toEqual([]);
  });

  it("refuses items from another namespace, duplicates and oversize pages", async () => {
    vi.stubGlobal("fetch", reply([{ metadata: { name: "x", namespace: "kube-system", uid: UID1 } }]));
    await expect(client().listWorkflows()).rejects.toThrow("argo_response_invalid");
    vi.stubGlobal("fetch", reply([{ metadata: { name: "a", namespace: "batch", uid: UID1 } }, { metadata: { name: "b", namespace: "batch", uid: UID1 } }]));
    await expect(client().listWorkflows()).rejects.toThrow("argo_response_invalid");
    vi.stubGlobal("fetch", reply(Array.from({ length: ARGO_PAGE_LIMIT + 1 }, () => ({}))));
    await expect(client().listTemplates()).rejects.toThrow("argo_response_invalid");
  });

  it("surfaces HTTP failures without the body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret", { status: 403 })));
    await expect(client().listWorkflows()).rejects.toThrow(/^argo_api_failed:403$/);
  });
});
