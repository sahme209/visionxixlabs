// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { callWorkspaceMcpTool, listAgentMcpTools, validMcpArguments, type McpServerRow } from "../workspaceMcpCall";

const row = (over: Partial<McpServerRow> = {}): McpServerRow => ({ registryName: "com.microsoft/microsoft-learn-mcp", title: "Microsoft Learn MCP", remoteUrl: "https://learn.microsoft.com/api/mcp", transport: "streamable-http", enabled: true, toolNames: ["microsoft_docs_search", "microsoft_docs_fetch"], allowedTools: ["microsoft_docs_search"], ...over });
const repo = (rows: McpServerRow[]) => ({ workspaceMcpServer: { findMany: vi.fn(async (a: { where: { enabled?: boolean } }) => rows.filter((r) => a.where.enabled === undefined || r.enabled === a.where.enabled)) } });
const publicDns = async () => [{ address: "13.107.246.40" }];
type Connect = (url: URL, f: typeof fetch) => Promise<{ callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>; close: () => Promise<void> }>;
const okConnect = () => vi.fn<Connect>(async () => ({ callTool: async () => ({ content: [{ type: "text", text: "result text" }, { type: "image", data: "x" }] }), close: async () => {} }));
const call = (rows: McpServerRow[], args: unknown, connect = okConnect()) => ({ connect, run: callWorkspaceMcpTool(repo(rows), "org_1", args, { lookup: publicDns, connect }) });

describe("workspace MCP tool calls", () => {
  it("lists only approved tools on enabled servers", async () => {
    const r = await listAgentMcpTools(repo([row(), row({ registryName: "x/off", enabled: false }), row({ registryName: "x/none", allowedTools: [] })]), "org_1");
    expect(r).toEqual({ ok: true, result: { servers: [{ server: "com.microsoft/microsoft-learn-mcp", title: "Microsoft Learn MCP", tools: ["microsoft_docs_search"] }] } });
  });
  it("calls an approved tool and returns only text, marked untrusted", async () => {
    const { connect, run } = call([row()], { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search", arguments: { query: "azure app service" } });
    expect(await run).toEqual({ ok: true, result: { kind: "third_party_tool_output", untrusted: true, server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search", text: "result text", truncated: false } });
    expect(String(connect.mock.calls[0][0])).toBe("https://learn.microsoft.com/api/mcp");
  });
  it("refuses unapproved tools, disabled or unknown servers, and other workspaces' rows never match", async () => {
    expect(await call([row()], { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_fetch", arguments: {} }).run).toEqual({ ok: false, error: "mcp_tool_not_approved" });
    expect(await call([row({ enabled: false })], { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search" }).run).toEqual({ ok: false, error: "mcp_server_not_enabled" });
    expect(await call([row()], { server: "other/server", tool: "microsoft_docs_search" }).run).toEqual({ ok: false, error: "mcp_server_not_enabled" });
    expect(await call([row({ allowedTools: ["ghost"], toolNames: [] })], { server: "com.microsoft/microsoft-learn-mcp", tool: "ghost" }).run).toEqual({ ok: false, error: "mcp_tool_not_approved" });
  });
  it("refuses secrets, oversized or malformed arguments before connecting", async () => {
    for (const a of [{ token: "ghp_abcdef123456" }, { q: "Authorization: Bearer x" }, { q: "x".repeat(5000) }, ["array"], "string"]) {
      const c = call([row()], { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search", arguments: a });
      expect((await c.run).ok).toBe(false);
      expect(c.connect).not.toHaveBeenCalled();
    }
    expect((await call([row()], { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search", extra: 1 }).run)).toEqual({ ok: false, error: "invalid_mcp_call" });
    expect(validMcpArguments({ query: "kubernetes rollout" })).toBe(true);
  });
  it("refuses servers that resolve to private addresses and unsupported transports", async () => {
    const connect = vi.fn<Connect>();
    expect(await callWorkspaceMcpTool(repo([row()]), "org_1", { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search" }, { lookup: async () => [{ address: "10.1.2.3" }], connect })).toEqual({ ok: false, error: "mcp_server_address_refused" });
    expect(await callWorkspaceMcpTool(repo([row({ transport: "sse" })]), "org_1", { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search" }, { lookup: publicDns, connect })).toEqual({ ok: false, error: "mcp_transport_unsupported" });
    expect(connect).not.toHaveBeenCalled();
  });
  it("truncates long output and reports tool errors and failures plainly", async () => {
    const long = vi.fn<Connect>(async () => ({ callTool: async () => ({ content: [{ type: "text", text: "y".repeat(9000) }] }), close: async () => {} }));
    const r = await call([row()], { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search" }, long).run;
    expect(r.ok && r.result.text.length).toBe(8000);
    expect(r.ok && r.result.truncated).toBe(true);
    const err = vi.fn<Connect>(async () => ({ callTool: async () => ({ isError: true }), close: async () => {} }));
    expect(await call([row()], { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search" }, err).run).toEqual({ ok: false, error: "mcp_tool_failed" });
    const down = vi.fn<Connect>(async () => { throw new Error("connect"); });
    expect(await call([row()], { server: "com.microsoft/microsoft-learn-mcp", tool: "microsoft_docs_search" }, down).run).toEqual({ ok: false, error: "mcp_server_unreachable" });
  });
});
