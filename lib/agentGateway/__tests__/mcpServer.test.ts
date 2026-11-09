import { describe, expect, it, vi } from "vitest";
import { MCP_TOOLS, dispatchMcp, parseRpc, requiredScope } from "../mcpServer";

const ops = () => ({ check: vi.fn().mockReturnValue({ ok: true, policy: { decision: "allow" } }), request: vi.fn().mockResolvedValue({ ok: true, request: { id: "r1" } }), get: vi.fn().mockResolvedValue({ ok: true, request: { id: "r1", mayProceed: false } }), outcome: vi.fn().mockResolvedValue({ ok: true }) });
const rpc = (method: string, params?: Record<string, unknown>, id: number | undefined = 1) => parseRpc({ jsonrpc: "2.0", ...(id === undefined ? {} : { id }), method, ...(params ? { params } : {}) })!;

describe("Axiom MCP governance server", () => {
  it("rejects malformed JSON-RPC", () => {
    expect(parseRpc(null)).toBeNull();
    expect(parseRpc([{ jsonrpc: "2.0", id: 1, method: "x" }])).toBeNull();
    expect(parseRpc({ jsonrpc: "1.0", id: 1, method: "x" })).toBeNull();
    expect(parseRpc({ jsonrpc: "2.0", id: {}, method: "x" })).toBeNull();
  });

  it("initializes and lists exactly the four governance tools", async () => {
    const init = await dispatchMcp(rpc("initialize", { protocolVersion: "2025-06-18" }), ops());
    expect((init.body as { result: { serverInfo: { name: string }; capabilities: unknown } }).result.serverInfo.name).toBe("axiom-governance-gateway");
    const list = await dispatchMcp(rpc("tools/list"), ops());
    const names = (list.body as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);
    expect(names).toEqual(["axiom_check_policy", "axiom_request_approval", "axiom_get_approval", "axiom_record_outcome"]);
  });

  it("acknowledges notifications with 202 and no body", async () => {
    expect(await dispatchMcp(rpc("notifications/initialized", undefined, undefined), ops())).toEqual({ status: 202, body: null });
  });

  it("maps each tool to the least scope it needs", () => {
    expect(requiredScope(rpc("tools/list"))).toBe("governance:read");
    expect(requiredScope(rpc("tools/call", { name: "axiom_check_policy" }))).toBe("governance:read");
    expect(requiredScope(rpc("tools/call", { name: "axiom_request_approval" }))).toBe("governance:request");
    expect(requiredScope(rpc("tools/call", { name: "axiom_record_outcome" }))).toBe("governance:request");
    expect(MCP_TOOLS.every((t) => t.scope.startsWith("governance:"))).toBe(true);
  });

  it("calls tools and returns MCP text and structured content", async () => {
    const o = ops();
    const res = await dispatchMcp(rpc("tools/call", { name: "axiom_request_approval", arguments: { actionKind: "deploy" } }), o);
    expect(o.request).toHaveBeenCalledWith({ actionKind: "deploy" });
    const result = (res.body as { result: { content: { type: string; text: string }[]; isError: boolean; structuredContent: unknown } }).result;
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0].text)).toEqual({ ok: true, request: { id: "r1" } });
  });

  it("returns tool errors in-band and hides internal failures", async () => {
    const o = ops(); o.get.mockResolvedValue(null); o.outcome.mockRejectedValue(new Error("db password=secret"));
    const missing = await dispatchMcp(rpc("tools/call", { name: "axiom_get_approval", arguments: { requestId: "nope" } }), o);
    expect((missing.body as { result: { isError: boolean } }).result.isError).toBe(true);
    const failed = await dispatchMcp(rpc("tools/call", { name: "axiom_record_outcome", arguments: { requestId: "r1", outcome: "succeeded" } }), o);
    expect(JSON.stringify(failed.body)).not.toContain("secret");
    expect(JSON.stringify(failed.body)).toContain("gateway_unavailable");
    const unknown = await dispatchMcp(rpc("tools/call", { name: "rm_rf" }), o);
    expect((unknown.body as { error: { code: number } }).error.code).toBe(-32602);
    const nomethod = await dispatchMcp(rpc("resources/list"), o);
    expect((nomethod.body as { error: { code: number } }).error.code).toBe(-32601);
  });
});
