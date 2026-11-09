/**
 * MCP (Model Context Protocol) server for the agent governance gateway (A10).
 * JSON-RPC 2.0 over HTTP POST (single JSON response). Any MCP-capable agent
 * (Cursor, Claude Code, Codex, ...) can add Axiom as a server and call these
 * tools before acting. The dispatcher is pure: it receives the gateway
 * operations as dependencies, so it can be tested without I/O.
 */
import { ACTION_KINDS, ENVIRONMENTS, OUTCOMES } from "./policyKernel";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export type GatewayScope = "governance:read" | "governance:request";

const actionSchema = {
  type: "object",
  properties: {
    actionKind: { type: "string", enum: [...ACTION_KINDS], description: "What the agent wants to do." },
    environment: { type: "string", enum: [...ENVIRONMENTS], description: "Where. Use unknown if unsure; unknown is treated as riskier." },
    target: { type: "string", description: "Repository, service or resource, e.g. acme/web or prod-db." },
    summary: { type: "string", description: "One or two sentences describing the exact change." },
    agentName: { type: "string", description: "Your agent's name, e.g. cursor or claude-code." },
    changedFiles: { type: "array", items: { type: "string" }, description: "Optional: file paths the change touches. Sensitive or wide changes always need approval." },
  },
  required: ["actionKind", "target", "summary"],
} as const;

export const MCP_TOOLS = [
  { name: "axiom_check_policy", scope: "governance:read" as GatewayScope, description: "Ask Axiom whether an action is allowed, needs human approval, or is denied. Stores nothing. Call this before any consequential action.", inputSchema: actionSchema },
  { name: "axiom_request_approval", scope: "governance:request" as GatewayScope, description: "Request approval for one exact action. Low-risk actions are allowed at once; others wait for a workspace admin. Do not proceed until axiom_get_approval returns mayProceed=true.", inputSchema: actionSchema },
  { name: "axiom_get_approval", scope: "governance:read" as GatewayScope, description: "Get the status of an approval request. Proceed only when mayProceed is true.", inputSchema: { type: "object", properties: { requestId: { type: "string" } }, required: ["requestId"] } },
  { name: "axiom_record_outcome", scope: "governance:request" as GatewayScope, description: "After acting on an allowed or approved request, report what happened so Axiom keeps an audit record.", inputSchema: { type: "object", properties: { requestId: { type: "string" }, outcome: { type: "string", enum: [...OUTCOMES] }, detail: { type: "string" } }, required: ["requestId", "outcome"] } },
] as const;
export type McpToolName = (typeof MCP_TOOLS)[number]["name"];

export interface GatewayOps {
  check(args: unknown): Promise<unknown> | unknown;
  request(args: unknown): Promise<unknown>;
  get(requestId: string): Promise<unknown>;
  outcome(requestId: string, args: unknown): Promise<unknown>;
}

type JsonRpcId = string | number | null;
type Rpc = { jsonrpc: "2.0"; id?: JsonRpcId; method: string; params?: Record<string, unknown> };
export type McpReply = { status: 200; body: unknown } | { status: 202; body: null };

const ok = (id: JsonRpcId, result: unknown): McpReply => ({ status: 200, body: { jsonrpc: "2.0", id, result } });
const err = (id: JsonRpcId, code: number, message: string): McpReply => ({ status: 200, body: { jsonrpc: "2.0", id, error: { code, message } } });
const toolText = (id: JsonRpcId, value: unknown, isError = false) => ok(id, { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value, isError });

export function parseRpc(raw: unknown): Rpc | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.jsonrpc !== "2.0" || typeof r.method !== "string") return null;
  if (r.id !== undefined && r.id !== null && typeof r.id !== "string" && typeof r.id !== "number") return null;
  if (r.params !== undefined && (typeof r.params !== "object" || r.params === null || Array.isArray(r.params))) return null;
  return r as Rpc;
}

/** Which scope a JSON-RPC message needs, so the route can authenticate before dispatch. */
export function requiredScope(rpc: Rpc): GatewayScope {
  if (rpc.method === "tools/call") {
    const tool = MCP_TOOLS.find((t) => t.name === rpc.params?.name);
    return tool?.scope ?? "governance:read";
  }
  return "governance:read";
}

export async function dispatchMcp(rpc: Rpc, ops: GatewayOps): Promise<McpReply> {
  const id = rpc.id ?? null;
  if (rpc.id === undefined) return { status: 202, body: null }; // notification (e.g. notifications/initialized)
  switch (rpc.method) {
    case "initialize":
      return ok(id, { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "axiom-governance-gateway", version: "1.0.0" },
        instructions: "Axiom governs consequential actions. Before deploying, merging, changing infrastructure, migrating data or touching secrets, call axiom_request_approval and wait for mayProceed=true. Report the outcome afterwards." });
    case "ping": return ok(id, {});
    case "tools/list": return ok(id, { tools: MCP_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const name = rpc.params?.name; const args = (rpc.params?.arguments ?? {}) as Record<string, unknown>;
      if (typeof args !== "object" || args === null || Array.isArray(args)) return err(id, -32602, "arguments must be an object");
      try {
        if (name === "axiom_check_policy") { const r = await ops.check(args); return toolText(id, r, !(r as { ok?: boolean }).ok); }
        if (name === "axiom_request_approval") { const r = await ops.request(args); return toolText(id, r, !(r as { ok?: boolean }).ok); }
        if (name === "axiom_get_approval") {
          if (typeof args.requestId !== "string") return toolText(id, { ok: false, error: "invalid_request_id" }, true);
          const r = await ops.get(args.requestId); return toolText(id, r ?? { ok: false, error: "not_found" }, !r);
        }
        if (name === "axiom_record_outcome") {
          if (typeof args.requestId !== "string") return toolText(id, { ok: false, error: "invalid_request_id" }, true);
          const r = await ops.outcome(args.requestId, args); return toolText(id, r, !(r as { ok?: boolean }).ok);
        }
        return err(id, -32602, "unknown tool");
      } catch { return toolText(id, { ok: false, error: "gateway_unavailable" }, true); }
    }
    default: return err(id, -32601, "method not found");
  }
}
