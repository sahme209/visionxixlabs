import { describe, expect, it, vi } from "vitest";
import { fetchRegistryPage, parseRegistryPage, registryUrl } from "../mcpRegistry";

const entry = (server: Record<string, unknown>, status = "active") => ({ server, _meta: { "io.modelcontextprotocol.registry/official": { status } } });
describe("MCP registry catalog", () => {
  it("keeps only safe display fields and classifies how each server is reached", () => {
    const out = parseRegistryPage({ servers: [
      entry({ name: "io.example/db", title: "Example DB", description: "Query\u0007 a database", version: "1.2.0", websiteUrl: "https://example.io", repository: { url: "https://github.com/example/db" }, remotes: [{ type: "streamable-http", url: "https://mcp.example.io/mcp" }, { type: "streamable-http", url: "http://insecure.example.io" }], packages: [{ registryType: "npm", identifier: "@example/db" }] }),
      entry({ name: "io.example/local", packages: [{ registryType: "pypi" }], websiteUrl: "javascript:alert(1)" }),
      { server: { description: "no name" } },
    ], metadata: { nextCursor: "io.example/local:1.0.0" } });
    expect(out.dropped).toBe(1);
    expect(out.nextCursor).toBe("io.example/local:1.0.0");
    expect(out.servers[0]).toEqual({ name: "io.example/db", title: "Example DB", description: "Query a database", version: "1.2.0", websiteUrl: "https://example.io/", repositoryUrl: "https://github.com/example/db", connections: ["remote", "local_package"], remoteHosts: ["mcp.example.io"], remotes: [{ type: "streamable-http", url: "https://mcp.example.io/mcp" }], packageTypes: ["npm"], status: "active" });
    expect(out.servers[1]).toMatchObject({ title: "io.example/local", websiteUrl: null, connections: ["local_package"], remoteHosts: [] });
  });
  it("rejects a malformed page", () => {
    expect(() => parseRegistryPage({ nope: true })).toThrow("registry_response_invalid");
  });
  it("builds bounded queries against the fixed registry host", () => {
    const u = new URL(registryUrl({ search: "  postgres ", cursor: "a:1" }));
    expect(u.origin).toBe("https://registry.modelcontextprotocol.io");
    expect(Object.fromEntries(u.searchParams)).toEqual({ limit: "30", version: "latest", search: "postgres", cursor: "a:1" });
  });
  it("fetches without credentials or redirects and fails on errors", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ servers: [], metadata: {} }), { status: 200 }));
    await fetchRegistryPage({}, f as unknown as typeof fetch);
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1]).toMatchObject({ redirect: "error", credentials: "omit" });
    await expect(fetchRegistryPage({}, (async () => new Response("x", { status: 503 })) as unknown as typeof fetch)).rejects.toThrow("registry_http_503");
  });
});
