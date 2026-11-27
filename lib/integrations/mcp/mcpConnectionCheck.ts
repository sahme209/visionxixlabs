/**
 * Checks a hosted MCP server a workspace added from the public registry: initialize, then list its
 * tools. Plugins at scale, layer 2. The server is untrusted third-party code, so the check:
 * - uses https only, refuses redirects and sends no cookies or credentials;
 * - resolves the host first and refuses private, loopback and link-local addresses;
 * - bounds every request (8 seconds) and every response (1 MB);
 * - keeps only tool names (at most 200), never tool output or server text beyond a short detail.
 * It never calls a tool. A server that asks for authentication is recorded as needing credentials.
 */
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";

export type McpCheckOutcome = "ok" | "needs_credentials" | "unreachable" | "refused" | "invalid_response";
export interface McpCheckResult { outcome: McpCheckOutcome; detail: string; serverName: string | null; tools: string[] }

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 1_000_000;
const MAX_TOOLS = 200;
const PROTOCOL_VERSION = "2025-06-18";

/** True for addresses an outside server must never make V19 call: private, loopback, link-local, CGNAT, multicast, unspecified. */
export function isNonPublicAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::1" || x === "::") return true;
    if (x.startsWith("::ffff:")) return isNonPublicAddress(x.slice(7));
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || x.startsWith("ff");
  }
  return true;
}

type Lookup = (host: string) => Promise<Array<{ address: string }>>;
const defaultLookup: Lookup = (host) => dnsLookup(host, { all: true, verbatim: true });

async function readBounded(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel(); throw new Error("too_large"); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** A JSON-RPC response from a JSON body or from the data lines of an event stream. */
export function extractRpcResult(body: string, contentType: string, id: number): { result?: unknown; error?: { message?: string } } | null {
  const candidates: unknown[] = [];
  if (contentType.includes("text/event-stream")) {
    for (const block of body.split(/\r?\n\r?\n/)) {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (data) { try { candidates.push(JSON.parse(data)); } catch { /* skip */ } }
    }
  } else {
    try { const parsed = JSON.parse(body); candidates.push(...(Array.isArray(parsed) ? parsed : [parsed])); } catch { return null; }
  }
  for (const c of candidates) if (c && typeof c === "object" && (c as { id?: unknown }).id === id) return c as { result?: unknown; error?: { message?: string } };
  return null;
}

const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function checkMcpServer(remoteUrl: string, deps: { fetchImpl?: typeof fetch; lookup?: Lookup } = {}): Promise<McpCheckResult> {
  const fetchImpl = deps.fetchImpl ?? fetch; const lookup = deps.lookup ?? defaultLookup;
  let url: URL;
  try { url = new URL(remoteUrl); } catch { return { outcome: "refused", detail: "The address is not a valid URL.", serverName: null, tools: [] }; }
  if (url.protocol !== "https:" || url.username || url.password) return { outcome: "refused", detail: "Only https addresses without credentials are allowed.", serverName: null, tools: [] };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host);
    if (!addrs.length || addrs.some((a) => isNonPublicAddress(a.address))) return { outcome: "refused", detail: "The server resolves to a private or local address.", serverName: null, tools: [] };
  } catch { return { outcome: "unreachable", detail: "The server's name could not be resolved.", serverName: null, tools: [] }; }

  let session: string | null = null;
  const post = async (payload: object) => {
    const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": PROTOCOL_VERSION };
    if (session) headers["mcp-session-id"] = session;
    return fetchImpl(url.toString(), { method: "POST", headers, body: JSON.stringify(payload), redirect: "error", credentials: "omit", signal: AbortSignal.timeout(TIMEOUT_MS) } as RequestInit);
  };
  try {
    const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "V19 connection check", version: "1" } } });
    if (init.status === 401 || init.status === 403) return { outcome: "needs_credentials", detail: "The server asks for sign-in or an API key. Connecting with credentials is not supported yet.", serverName: null, tools: [] };
    if (!init.ok) return { outcome: "unreachable", detail: `The server answered HTTP ${init.status}.`, serverName: null, tools: [] };
    session = init.headers.get("mcp-session-id")?.slice(0, 200) ?? null;
    const initBody = extractRpcResult(await readBounded(init), init.headers.get("content-type") ?? "", 1);
    if (!initBody || initBody.error || !initBody.result) return { outcome: "invalid_response", detail: initBody?.error ? `The server refused initialization: ${clean(initBody.error.message, 160)}` : "The server did not answer initialization as an MCP server.", serverName: null, tools: [] };
    const serverName = clean((initBody.result as { serverInfo?: { name?: unknown } }).serverInfo?.name, 120) || null;
    try { const n = await post({ jsonrpc: "2.0", method: "notifications/initialized" }); await n.body?.cancel(); } catch { /* a server may close this stream; listing still decides */ }
    const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    if (list.status === 401 || list.status === 403) return { outcome: "needs_credentials", detail: "The server needs credentials to list its tools.", serverName, tools: [] };
    if (!list.ok) return { outcome: "unreachable", detail: `Listing tools answered HTTP ${list.status}.`, serverName, tools: [] };
    const listBody = extractRpcResult(await readBounded(list), list.headers.get("content-type") ?? "", 2);
    const tools = (listBody?.result as { tools?: unknown } | undefined)?.tools;
    if (!Array.isArray(tools)) return { outcome: "invalid_response", detail: "The server did not return a tool list.", serverName, tools: [] };
    const names = [...new Set(tools.map((t) => clean((t as { name?: unknown })?.name, 120)).filter((n) => /^[A-Za-z0-9_.:-]{1,120}$/.test(n)))].slice(0, MAX_TOOLS);
    return { outcome: "ok", detail: `${names.length} tool${names.length === 1 ? "" : "s"} listed.`, serverName, tools: names };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { outcome: msg === "too_large" ? "invalid_response" : "unreachable", detail: msg === "too_large" ? "The server's answer was larger than 1 MB." : "The server could not be reached in time.", serverName: null, tools: [] };
  }
}
