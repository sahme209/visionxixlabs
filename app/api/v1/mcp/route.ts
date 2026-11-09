/**
 * POST /api/v1/mcp — Axiom agent governance gateway as an MCP server (A10).
 *
 * Add to an MCP client (Cursor, Claude Code, Codex, ...) as a remote HTTP
 * server with header `Authorization: Bearer vxlk_live_...`. Tools:
 * axiom_check_policy, axiom_request_approval, axiom_get_approval,
 * axiom_record_outcome. Read tools need governance:read; request tools need
 * governance:request. Batch JSON-RPC arrays are not supported.
 */
import { NextResponse, type NextRequest } from "next/server";
import { gatewayAuth } from "@/lib/agentGateway/apiAuth";
import { checkPolicy, createGatewayRequest, getGatewayRequest, recordGatewayOutcome } from "@/lib/agentGateway/gatewayService";
import { dispatchMcp, parseRpc, requiredScope } from "@/lib/agentGateway/mcpServer";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rpc = parseRpc(await req.json().catch(() => null));
  if (!rpc) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "invalid request" } }, { status: 400 });
  const auth = await gatewayAuth(req, requiredScope(rpc), "POST /api/v1/mcp");
  if ("response" in auth) return auth.response;
  const { caller } = auth;
  const reply = await dispatchMcp(rpc, {
    check: (args) => checkPolicy(args),
    request: (args) => createGatewayRequest(caller, args),
    get: async (id) => { const r = await getGatewayRequest(caller, id); return r ? { ok: true, request: r } : null; },
    outcome: async (id, args) => { const r = await recordGatewayOutcome(caller, id, args); return r.ok ? { ok: true, request: r.request } : { ok: false, error: r.error }; },
  });
  if (reply.status === 202) return new NextResponse(null, { status: 202 });
  return NextResponse.json(reply.body, { headers: { "Cache-Control": "no-store" } });
}

/** MCP clients may probe with GET for a server-sent stream; this server answers only POST. */
export function GET() {
  return NextResponse.json({ ok: false, error: "use_post" }, { status: 405, headers: { Allow: "POST" } });
}
