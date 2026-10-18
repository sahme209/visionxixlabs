import { afterEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
const require = createRequire(import.meta.url), helper = () => require("../../scripts/fixtures/ownedEcsCompletion.cjs");
const proof = "a".repeat(32), sourceCommit = "b".repeat(40);
const receipt = { kind: "owned_ecs_checked_inputs", sourceCommit, qualification: "synthetic_no_send_only" };
const frame = (receiptJson = JSON.stringify(receipt)) => ({ kind: "owned_ecs_control", proof, id: 3, command: "complete", sourceCommit, receiptJson });
const receiver = () => helper().createCompletionReceiver({ proof, sourceCommit });
afterEach(() => vi.useRealTimers());
it("roundtrips terminal completion independently of prefixed or short/chunked raw stdout and waits for close", () => {
  const current = receiver(); current.observeBytes(Buffer.byteLength("fixed_logger_canary\n")); current.observeBytes(8192); current.accept(frame(), 3);
  current.exit(0, null); expect(() => current.result()).toThrow("owned_ecs_completion_close_required"); current.close(); expect(current.result()).toEqual(receipt);
});
it.each(["proof", "sourceCommit", "id", "kind", "command", "extra", "missing", "pending", "unsolicited"])("rejects %s terminal binding and preserves fatal even after zero exit", mode => {
  const current = receiver(), message: Record<string, unknown> = frame(); let expected = 3, pending = 0;
  if (mode === "proof") message.proof = "c".repeat(32); if (mode === "sourceCommit") message.sourceCommit = "d".repeat(40); if (mode === "id") message.id = 4; if (mode === "kind") message.kind = "other"; if (mode === "command") message.command = "summary"; if (mode === "extra") message.secret = "DO_NOT_SERIALIZE"; if (mode === "missing") delete message.proof; if (mode === "pending") pending = 1; if (mode === "unsolicited") expected = 4;
  expect(() => current.accept(message, expected, pending)).toThrow(/^owned_ecs_completion_/); current.exit(0, null); current.close(); expect(() => current.result()).toThrow(/^owned_ecs_completion_/);
});
it.each(["null", "[]", "1", '"text"', "{", JSON.stringify({ ...receipt, kind: "wrong" }), JSON.stringify({ ...receipt, sourceCommit: "c".repeat(40) })])("rejects malformed/truncated/wrong bound receipt without disclosing content", value => {
  const current = receiver(); expect(() => current.accept(frame(value), 3)).toThrow(/^owned_ecs_completion_/); current.exit(0, null); current.close(); expect(() => current.result()).toThrow(/^owned_ecs_completion_/);
});
it("rejects duplicate or any postcompletion message and cannot erase its first fatal", () => {
  const current = receiver(); current.accept(frame(), 3); expect(() => current.assertCanReceive()).toThrow("owned_ecs_completion_terminal_message"); expect(() => current.fail("owner_aborted")).toThrow("owned_ecs_completion_terminal_message"); current.exit(0, null); current.close(); expect(() => current.result()).toThrow("owned_ecs_completion_terminal_message");
});
it("enforces UTF8 and combined stream/frame bytes and retains null versus observed lifecycle", () => {
  const current = receiver(); const value = JSON.stringify({ ...receipt, pad: "€".repeat(50_000) }); expect(value.length).toBeLessThan(128 * 1024); expect(() => current.accept(frame(value), 3)).toThrow("owned_ecs_completion_byte_limit");
  const combined = receiver(); combined.observeBytes(128 * 1024); expect(() => combined.accept(frame(), 3)).toThrow("owned_ecs_completion_byte_limit");
  const missing = receiver(); missing.exit(0, null); missing.close(); expect(() => missing.result()).toThrow("owned_ecs_completion_missing");
});
it.each(["exit", "signal", "abort", "send_failure"])("cannot accept completion after %s and preserves failure", mode => {
  const current = receiver(); current.accept(frame(), 3); current.exit(mode === "exit" ? 1 : 0, mode === "signal" ? "SIGTERM" : null); current.close(); if (mode === "send_failure") expect(() => current.fail("send_failed")).toThrow(); expect(() => current.result({ aborted: mode === "abort" })).toThrow(/^owned_ecs_completion_/);
});
function channel() { return Object.assign(new EventEmitter(), { send: vi.fn<(message: object, callback: (error?: Error | null) => void) => boolean>(() => true) }); }
const ack = () => ({ kind: "owned_ecs_completion_ack", proof, sourceCommit, id: 3, ok: true });
it("sender waits for send callback AND exact bounded ACK before allowing disconnect", async () => {
  const child = channel(); let callback: (error?: Error | null) => void = () => {}; child.send.mockImplementation((_message, done) => { callback = done; return false; });
  let finished = false; const pending = helper().sendCompletion(child, frame()).then(() => { finished = true; }); child.emit("message", ack()); await Promise.resolve(); expect(finished).toBe(false); callback(); await pending; expect(finished).toBe(true); expect(child.listenerCount("message")).toBe(0);
});
it.each(["throw", "throw_after_sync_ack", "callback_error", "callback_timeout", "ack_timeout", "wrong_ack", "disconnect", "oversized"])("sender fails closed on %s without exposing raw error or sending unbounded bytes", async mode => {
  vi.useFakeTimers(); const child = channel(); child.send.mockImplementation((_message, done) => { if (mode === "throw_after_sync_ack") { done(); child.emit("message", ack()); throw new Error("SECRET after ACK"); } if (mode === "throw") throw new Error("SECRET https://secret.invalid"); if (mode === "callback_error") done(new Error("SECRET")); else if (mode !== "callback_timeout") done(); if (["callback_timeout", "wrong_ack"].includes(mode)) child.emit("message", mode === "wrong_ack" ? { ...ack(), proof: "wrong" } : ack()); if (mode === "disconnect") child.emit("disconnect"); return true; });
  const pending = helper().sendCompletion(child, frame(mode === "oversized" ? "€".repeat(50_000) : undefined)); const checked = expect(pending).rejects.toThrow(/^owned_ecs_completion_/); await vi.advanceTimersByTimeAsync(7001); await checked;
  if (mode === "oversized") expect(child.send).not.toHaveBeenCalled(); expect(child.listenerCount("message")).toBe(0); expect(child.listenerCount("disconnect")).toBe(0);
});

it("accepts the exact128KiB combined UTF8 boundary and rejects further output after completion", () => {
  const current = receiver(), bytes = Buffer.byteLength(frame().receiptJson); current.observeBytes(128 * 1024 - bytes); current.accept(frame(), 3); current.exit(0, null); current.close(); expect(current.result()).toEqual(receipt);
  expect(() => current.observeBytes(1)).toThrow("owned_ecs_completion_byte_limit"); expect(() => current.result()).toThrow("owned_ecs_completion_byte_limit");
});
it.each(["success", "source_failure", "second_disconnect", "client_disconnect", "send_failure"])("exact probe cleanup body enforces %s before terminal delivery without imports/IO", async mode => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../scripts/fixtures/ecsCheckedInputSourceProbe.cjs"), "utf8"), marker = ".finally(async () => {";
  const start = source.lastIndexOf(marker); expect(start > 0).toBe(true); const body = source.slice(start + marker.length, source.lastIndexOf("});"));
  const events: string[] = [], extensions: Record<string, unknown> = { ".ts": "temporary_loader" }, priorLoader = () => {};
  const context = { pending: new Map(), phase: (stage: string) => events.push(stage), second: { $disconnect: async () => { events.push("second_disconnect"); if (mode === "second_disconnect") throw new Error("owned_canary_disconnect"); } }, client: { $disconnect: async () => { events.push("client_disconnect"); if (mode === "client_disconnect") throw new Error("owned_canary_disconnect"); } }, priorLoader, require: { extensions }, completedReceipt: mode === "source_failure" ? undefined : JSON.stringify(receipt), commandId: 0,
    diagnostic: { update() {}, write() {}, fail() {} }, process: { exitCode: mode === "source_failure" ? 1 : 0, connected: true, env: { AXIOM_OWNED_ECS_PROOF: proof, AXIOM_OWNED_ECS_SOURCE_COMMIT: sourceCommit }, disconnect: () => events.push("ipc_disconnect") }, sendCompletion: async () => { expect(events).toContain("second_disconnect"); expect(events).toContain("client_disconnect"); expect(extensions[".ts"]).toBe(priorLoader); events.push("send"); if (mode === "send_failure") throw new Error("owned_canary_send"); }, clearTimeout };
  const pending = vm.runInNewContext("(async () => {" + body + "})()", context);
  if (["second_disconnect", "client_disconnect", "send_failure"].includes(mode)) await expect(pending).rejects.toThrow(/^owned_canary_/); else await pending;
  expect(events.includes("send")).toBe(mode === "success" || mode === "send_failure"); if (mode === "success") expect(events.indexOf("send")).toBeLessThan(events.indexOf("ipc_disconnect"));
});
