// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { checkMcpServer, extractRpcResult, isNonPublicAddress } from "../mcpConnectionCheck";

const publicDns = async () => [{ address: "93.184.216.34" }];
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...(init.headers as object) }, ...init });

describe("isNonPublicAddress", () => {
  it("refuses private, loopback, link-local, CGNAT, multicast and mapped addresses", () => {
    for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:10.0.0.1", "not-an-ip"]) expect(isNonPublicAddress(ip)).toBe(true);
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111", "172.32.0.1"]) expect(isNonPublicAddress(ip)).toBe(false);
  });
});

describe("extractRpcResult", () => {
  it("reads a JSON body or event-stream data lines, matching the request id", () => {
    expect(extractRpcResult(JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [] } }), "application/json", 2)).toEqual({ jsonrpc: "2.0", id: 2, result: { tools: [] } });
    const sse = 'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/x"}\n\nevent: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"serverInfo":{"name":"x"}}}\n\n';
    expect(extractRpcResult(sse, "text/event-stream", 1)?.result).toEqual({ serverInfo: { name: "x" } });
    expect(extractRpcResult("not json", "application/json", 1)).toBeNull();
  });
});

describe("checkMcpServer", () => {
  it("initializes, lists tools and keeps only valid names, sending no credentials", async () => {
    const fetchImpl = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init!.body));
      if (body.method === "initialize") return json({ jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "Docs" } } }, { headers: { "mcp-session-id": "s-1" } });
      if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
      return json({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "search_docs" }, { name: "fetch" }, { name: "bad name; rm" }, { name: "search_docs" }] } });
    });
    const r = await checkMcpServer("https://mcp.example.com/mcp", { fetchImpl: fetchImpl as unknown as typeof fetch, lookup: publicDns });
    expect(r).toEqual({ outcome: "ok", detail: "2 tools listed.", serverName: "Docs", tools: ["search_docs", "fetch"] });
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init).toMatchObject({ method: "POST", redirect: "error", credentials: "omit" });
      expect(Object.keys(init!.headers as object).map((h) => h.toLowerCase())).not.toContain("authorization");
    }
    expect((fetchImpl.mock.calls[2][1]!.headers as Record<string, string>)["mcp-session-id"]).toBe("s-1");
    expect(fetchImpl.mock.calls.map(([, i]) => JSON.parse(String(i!.body)).method)).toEqual(["initialize", "notifications/initialized", "tools/list"]);
  });
  it("refuses non-https, credentials in the URL and hosts that resolve to private addresses, without connecting", async () => {
    const fetchImpl = vi.fn();
    for (const url of ["http://mcp.example.com/mcp", "https://user:pw@mcp.example.com/mcp", "nope"]) expect((await checkMcpServer(url, { fetchImpl, lookup: publicDns })).outcome).toBe("refused");
    expect((await checkMcpServer("https://internal.example.com/mcp", { fetchImpl, lookup: async () => [{ address: "93.184.216.34" }, { address: "10.0.0.5" }] })).outcome).toBe("refused");
    expect((await checkMcpServer("https://169.254.169.254/mcp", { fetchImpl, lookup: publicDns })).outcome).toBe("refused");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("records servers that ask for sign-in as needing credentials", async () => {
    const r = await checkMcpServer("https://mcp.example.com/mcp", { fetchImpl: (async () => new Response("", { status: 401 })) as unknown as typeof fetch, lookup: publicDns });
    expect(r.outcome).toBe("needs_credentials");
  });
  it("reports non-MCP answers, oversized answers and network failures plainly", async () => {
    expect((await checkMcpServer("https://x.example.com/", { fetchImpl: (async () => new Response("<html>", { status: 200, headers: { "content-type": "text/html" } })) as unknown as typeof fetch, lookup: publicDns })).outcome).toBe("invalid_response");
    const big = "x".repeat(1_100_000);
    expect((await checkMcpServer("https://x.example.com/", { fetchImpl: (async () => new Response(big, { status: 200 })) as unknown as typeof fetch, lookup: publicDns })).detail).toBe("The server's answer was larger than 1 MB.");
    expect((await checkMcpServer("https://x.example.com/", { fetchImpl: (async () => { throw new Error("timeout"); }) as unknown as typeof fetch, lookup: publicDns })).outcome).toBe("unreachable");
    expect((await checkMcpServer("https://x.example.com/", { fetchImpl: vi.fn() as unknown as typeof fetch, lookup: async () => { throw new Error("ENOTFOUND"); } })).outcome).toBe("unreachable");
  });
});
