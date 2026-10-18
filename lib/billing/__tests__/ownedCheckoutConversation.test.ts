import { Duplex } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { sealFrame, packFrame } from "../ownedCheckoutBridge/protocol";
const m = { version: "axiom_owned_checkout_v1", session: "a".repeat(32), runtimeId: "runtime", accountId: "acct-test", organizationId: "org", origin: "http://127.0.0.1:4100", directory: "/tmp/axiom-owned-checkout-" + "b".repeat(32), capability: "c".repeat(64) } as const;
function wires() {
  const a = new Duplex({ read() {}, write(chunk, _, next) { b.push(Buffer.from(chunk)); next(); }, final(next) { b.push(null); next(); }, destroy(_error, next) { if (!b.destroyed) b.push(null); next(); } });
  const b = new Duplex({ read() {}, write(chunk, _, next) { a.push(Buffer.from(chunk)); next(); }, final(next) { a.push(null); next(); }, destroy(_error, next) { if (!a.destroyed) a.push(null); next(); } });
  return { a, b };
}
describe("authenticated private conversations (inert Duplex, no listening socket)", () => {
  it("handshakes with a fresh connection challenge and processes fresh webhook replay twice", async () => {
    const c = await import("../ownedCheckoutBridge/conversation"); let reconciles = 0, owners = 0, completed = 0;
    for (let i = 0; i < 2; i++) {
      const { a, b } = wires();
      const server = c.serveConversation(m, b, async command => command.kind === "hello" ? { kind: "ready" } : (reconciles++, { kind: "reconciled", outcome: "replay" }), () => { owners++; return () => { completed++; }; });
      const result = await c.clientConversation(m, a, { kind: "reconcile", body: Buffer.from("é").toString("base64"), signature: "local-synthetic" });
      expect(result).toEqual({ kind: "reconciled", outcome: "replay" }); await server;
    }
    expect(reconciles).toBe(2); expect(owners).toBe(completed);
  });
  it("refuses a captured base-session command without dispatching financial work", async () => {
    const c = await import("../ownedCheckoutBridge/conversation"); const { a, b } = wires(); let dispatched = 0;
    const server = c.serveConversation(m, b, async () => { dispatched++; return { kind: "ready" }; }, () => () => {});
    a.resume(); a.write(packFrame(sealFrame(m, "request", 1, "d".repeat(32), { kind: "hello" })));
    await server; expect(dispatched).toBe(0); a.destroy();
  });
  it("closes a silent peer at a bounded deadline without sending any payment command", async () => {
    vi.useFakeTimers();
    try {
      const c = await import("../ownedCheckoutBridge/conversation"); const { a, b } = wires(); let bytes = 0; b.on("data", v => { bytes += v.length; });
      const result = c.clientConversation(m, a, { kind: "hello" });
      await vi.advanceTimersByTimeAsync(5001); await expect(result).resolves.toEqual({ kind: "unavailable" }); expect(a.destroyed).toBe(true); expect(bytes).toBe(0); b.destroy();
    } finally { vi.useRealTimers(); }
  });
  it("retains the operation owner after client disconnect until accepted work settles", async () => {
    const c = await import("../ownedCheckoutBridge/conversation"); const { a, b } = wires(); let active = 0, entered = false, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const server = c.serveConversation(m, b, async command => { if (command.kind === "hello") return { kind: "ready" }; entered = true; await gate; return { kind: "reconciled", outcome: "applied" }; }, () => { active++; return () => { active--; }; });
    const client = c.clientConversation(m, a, { kind: "reconcile", body: Buffer.from("signed").toString("base64"), signature: "local" });
    await vi.waitFor(() => expect(entered).toBe(true)); b.destroy(); a.destroy(); expect(await client).toEqual({ kind: "unavailable" }); expect(active).toBe(1);
    release(); await server; expect(active).toBe(0);
  });
  it("cannot replay a captured authenticated connection on a fresh challenge", async () => {
    const c = await import("../ownedCheckoutBridge/conversation"), first = wires(); const captured: Buffer[] = [];
    first.b.on("data", data => captured.push(Buffer.from(data)));
    const initial = c.serveConversation(m, first.b, async () => ({ kind: "ready" }), () => () => {});
    expect(await c.clientConversation(m, first.a, { kind: "hello" })).toEqual({ kind: "ready" }); await initial;
    const second = wires(); let dispatches = 0; second.a.resume();
    const replay = c.serveConversation(m, second.b, async () => { dispatches++; return { kind: "ready" }; }, () => () => {});
    second.a.write(Buffer.concat(captured)); await replay; expect(dispatches).toBe(0); second.a.destroy();
  });

});
