/**
 * Lets a workspace's agents use tools on hosted MCP servers the workspace added and approved
 * (plugins at scale, layer 3). Rules, all enforced here at call time:
 * - the server must belong to the workspace, be enabled, and use streamable HTTP;
 * - the tool must be one an owner or admin approved for agents (allowedTools);
 * - arguments are a JSON object of at most 4 KB with no secrets or credentials in them;
 * - the call goes only to the stored https address, after the host resolves to public addresses,
 *   with no cookies or credentials, no redirects, 20 seconds and 1 MB at most;
 * - only text content comes back, truncated to 8,000 characters and labelled untrusted.
 */
import "server-only";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { isNonPublicAddress } from "./mcpConnectionCheck";

const MAX_ARGS_BYTES = 4_096;
const MAX_RESPONSE_BYTES = 1_048_576;
const MAX_TEXT = 8_000;
const DEADLINE_MS = 20_000;
const SECRET = /(?:-----BEGIN|authorization\s*:|bearer\s+|(?:sk|rk|pk)_(?:live|test)_|gh[pousr]_[A-Za-z0-9]|github_pat_|AKIA[A-Z0-9]{8}|xox[baprs]-|password\s*["']?\s*[=:]|client_secret|api[_-]?key\s*["']?\s*[=:])/i;

export interface McpServerRow { registryName: string; title: string; remoteUrl: string; transport: string; enabled: boolean; toolNames: string[]; allowedTools: string[] }
export interface WorkspaceMcpRepo { workspaceMcpServer: { findMany(args: { where: { organizationId: string; enabled?: boolean }; select: Record<string, true>; take: number }): Promise<McpServerRow[]> } }
export type McpCallResult = { ok: true; result: { kind: "third_party_tool_output"; untrusted: true; server: string; tool: string; text: string; truncated: boolean } } | { ok: false; error: string };

const select = { registryName: true, title: true, remoteUrl: true, transport: true, enabled: true, toolNames: true, allowedTools: true } as const;

/** Enabled servers and the tools agents may call on each. */
export async function listAgentMcpTools(repo: WorkspaceMcpRepo, organizationId: string): Promise<{ ok: true; result: { servers: Array<{ server: string; title: string; tools: string[] }> } } | { ok: false; error: string }> {
  try {
    const rows = await repo.workspaceMcpServer.findMany({ where: { organizationId, enabled: true }, select, take: 50 });
    return { ok: true, result: { servers: rows.map((r) => ({ server: r.registryName, title: r.title, tools: r.allowedTools.filter((t) => r.toolNames.includes(t)) })).filter((s) => s.tools.length > 0) } };
  } catch { return { ok: false, error: "mcp_servers_unavailable" }; }
}

/** Validates arguments: a plain object, small, and free of anything that looks like a secret. */
export function validMcpArguments(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  let text: string; try { text = JSON.stringify(value); } catch { return false; }
  return Buffer.byteLength(text) <= MAX_ARGS_BYTES && !SECRET.test(text);
}

type Lookup = (host: string) => Promise<Array<{ address: string }>>;
export interface CallDeps { lookup?: Lookup; connect?: (url: URL, fetchImpl: typeof fetch) => Promise<{ callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>; close: () => Promise<void> }> }

async function defaultConnect(url: URL, fetchImpl: typeof fetch) {
  const client = new Client({ name: "v19-workspace-agent", version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(url, { requestInit: { redirect: "error", credentials: "omit", cache: "no-store" }, reconnectionOptions: { maxRetries: 0, maxReconnectionDelay: 1000, initialReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 }, fetch: fetchImpl });
  await client.connect(transport, { timeout: DEADLINE_MS });
  return { callTool: (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args }, undefined, { timeout: DEADLINE_MS, maxTotalTimeout: DEADLINE_MS }), close: () => client.close() };
}

/** A fetch that only reaches the one stored address, strips credentials and bounds the body. */
function guardedFetch(endpoint: string, deadline: AbortSignal): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = String(input instanceof Request ? input.url : input);
    if (new URL(target).origin !== new URL(endpoint).origin) throw new Error("mcp_endpoint_changed");
    const headers = new Headers(init?.headers); headers.delete("authorization"); headers.delete("cookie");
    const res = await fetch(target, { ...init, headers, redirect: "error", credentials: "omit", cache: "no-store", signal: AbortSignal.any([deadline, ...(init?.signal ? [init.signal] : [])]) });
    if (!res.body) return res;
    const reader = res.body.getReader(); let bytes = 0;
    return new Response(new ReadableStream({
      async pull(c) { const chunk = await reader.read(); if (chunk.done) { c.close(); return; } bytes += chunk.value.byteLength; if (bytes > MAX_RESPONSE_BYTES) { await reader.cancel(); c.error(new Error("mcp_response_too_large")); return; } c.enqueue(chunk.value); },
      cancel(reason) { return reader.cancel(reason); },
    }), { status: res.status, statusText: res.statusText, headers: res.headers });
  }) as typeof fetch;
}

export async function callWorkspaceMcpTool(repo: WorkspaceMcpRepo, organizationId: string, args: unknown, deps: CallDeps = {}): Promise<McpCallResult> {
  if (!args || typeof args !== "object" || Array.isArray(args)) return { ok: false, error: "invalid_mcp_call" };
  const { server, tool, arguments: toolArgs = {} } = args as { server?: unknown; tool?: unknown; arguments?: unknown };
  if (Object.keys(args).some((k) => !["server", "tool", "arguments"].includes(k)) || typeof server !== "string" || typeof tool !== "string" || server.length > 200 || tool.length > 120) return { ok: false, error: "invalid_mcp_call" };
  if (!validMcpArguments(toolArgs)) return { ok: false, error: "mcp_arguments_refused" };
  let row: McpServerRow | undefined;
  try { row = (await repo.workspaceMcpServer.findMany({ where: { organizationId }, select, take: 50 })).find((r) => r.registryName === server); } catch { return { ok: false, error: "mcp_servers_unavailable" }; }
  if (!row || !row.enabled) return { ok: false, error: "mcp_server_not_enabled" };
  if (!row.allowedTools.includes(tool) || !row.toolNames.includes(tool)) return { ok: false, error: "mcp_tool_not_approved" };
  if (row.transport !== "streamable-http") return { ok: false, error: "mcp_transport_unsupported" };
  let url: URL; try { url = new URL(row.remoteUrl); } catch { return { ok: false, error: "mcp_server_not_enabled" }; }
  if (url.protocol !== "https:" || url.username || url.password) return { ok: false, error: "mcp_server_not_enabled" };
  try {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const addrs = isIP(host) ? [{ address: host }] : await (deps.lookup ?? ((h: string) => dnsLookup(h, { all: true, verbatim: true })))(host);
    if (!addrs.length || addrs.some((a) => isNonPublicAddress(a.address))) return { ok: false, error: "mcp_server_address_refused" };
  } catch { return { ok: false, error: "mcp_server_unreachable" }; }
  const deadline = AbortSignal.timeout(DEADLINE_MS);
  let session: Awaited<ReturnType<NonNullable<CallDeps["connect"]>>> | null = null;
  try {
    session = await (deps.connect ?? defaultConnect)(url, guardedFetch(url.toString(), deadline));
    const out = await session.callTool(tool, toolArgs as Record<string, unknown>) as { isError?: boolean; content?: Array<{ type?: string; text?: unknown }> };
    if (out?.isError) return { ok: false, error: "mcp_tool_failed" };
    const text = (Array.isArray(out?.content) ? out.content : []).filter((c) => c?.type === "text" && typeof c.text === "string").map((c) => c.text as string).join("\n");
    return { ok: true, result: { kind: "third_party_tool_output", untrusted: true, server: row.registryName, tool, text: text.slice(0, MAX_TEXT), truncated: text.length > MAX_TEXT } };
  } catch { return { ok: false, error: "mcp_server_unreachable" }; }
  finally { await session?.close().catch(() => undefined); }
}
