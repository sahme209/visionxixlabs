import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { afterEach, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const transport = require("../../scripts/fixtures/ownedWebsiteSession.cjs");
const sessions: Array<{ stop: () => void }> = [];
afterEach(() => { for (const session of sessions.splice(0)) session.stop(); vi.useRealTimers(); });

class Socket extends EventTarget {
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
}
async function channel(duration = 120000) {
  vi.useFakeTimers();
  const session = transport.createSession({ duration }); sessions.push(session);
  const socket = new Socket();
  const opening = transport.openChannel({ session, endpoint: "unused-local-fixture", createSocket: () => socket, proveEndpoint: () => {} });
  socket.dispatchEvent(new Event("open"));
  return { session, socket, channel: await opening };
}

it("identifies the timed-out CDP command without changing its 15-second deadline", async () => {
  const state = await channel();
  let settled = false;
  const outcome = state.channel.send("Page.navigate", { url: "private-url-not-for-receipts" }).then(() => { settled = true; return null; }, (error: Error) => { settled = true; return error; });
  await vi.advanceTimersByTimeAsync(14999);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect((await outcome)?.message).toBe("website_driver_operation_timeout");
  expect(state.session.report()).toEqual({ timedOutOperation: "cdp.Page.navigate" });
  expect(JSON.stringify(state.session.report())).not.toContain("private-url");
});

it("retains the first timeout when concurrent intercepted-request commands also expire", async () => {
  const state = await channel();
  const navigation = expect(state.channel.send("Page.navigate")).rejects.toThrow("website_driver_operation_timeout");
  const intercepted = expect(state.channel.send("Fetch.continueRequest", { requestId: "private-id" })).rejects.toThrow("website_driver_operation_timeout");
  await vi.advanceTimersByTimeAsync(15000); await navigation; await intercepted;
  state.session.stop();
  expect(state.session.report()).toEqual({ timedOutOperation: "cdp.Page.navigate" });
});

it("does not mislabel a completed command or socket-close cancellation as an operation timeout", async () => {
  const state = await channel();
  const completed = state.channel.send("Runtime.enable");
  state.socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ id: 1, result: {} }) }));
  await completed;
  const cancelled = expect(state.channel.send("Page.navigate")).rejects.toThrow("website_cdp_closed");
  state.socket.dispatchEvent(new Event("close")); await cancelled;
  await vi.advanceTimersByTimeAsync(15000);
  expect(state.session.report()).toEqual({ timedOutOperation: null });
});

it("keeps an absolute driver deadline distinct from a per-operation timeout", async () => {
  const state = await channel(1000);
  const rejected = expect(state.channel.send("Page.navigate")).rejects.toThrow("website_driver_deadline");
  await vi.advanceTimersByTimeAsync(1000); await rejected;
  expect(state.session.report()).toEqual({ timedOutOperation: null });
});

it("reports WebSocket setup separately without retaining its endpoint", async () => {
  vi.useFakeTimers();
  const session = transport.createSession(); sessions.push(session);
  const opening = transport.openChannel({ session, endpoint: "private-endpoint", createSocket: () => new Socket(), proveEndpoint: () => {} });
  const rejected = expect(opening).rejects.toThrow("website_driver_operation_timeout");
  await vi.advanceTimersByTimeAsync(15000); await rejected;
  expect(session.report()).toEqual({ timedOutOperation: "websocket.open" });
});

it.each(["http.targets", "sleep"])("retains only the closed %s operation label", async label => {
  vi.useFakeTimers();
  const session = transport.createSession(); sessions.push(session);
  const rejected = expect(session.operation(() => {}, 10, label)).rejects.toThrow("website_driver_operation_timeout");
  await vi.advanceTimersByTimeAsync(10); await rejected;
  expect(session.report()).toEqual({ timedOutOperation: label });
});

it("maps unknown methods and arbitrary diagnostic values to an unclassified label", async () => {
  const state = await channel();
  const rejected = expect(state.channel.send("Private.unknown-secret", { secret: "private-value" })).rejects.toThrow("website_driver_operation_timeout");
  await vi.advanceTimersByTimeAsync(15000); await rejected;
  expect(state.session.report()).toEqual({ timedOutOperation: "unclassified" });
});

it("does not invoke an accessor or coercion hook supplied as a diagnostic label", async () => {
  vi.useFakeTimers(); let reads = 0;
  const session = transport.createSession(); sessions.push(session);
  const label = { toString: () => { reads++; return "private-value"; } };
  const rejected = expect(session.operation(() => {}, 10, label)).rejects.toThrow("website_driver_operation_timeout");
  await vi.advanceTimersByTimeAsync(10); await rejected;
  expect(session.report()).toEqual({ timedOutOperation: "unclassified" }); expect(reads).toBe(0);
});

it("includes the closed timeout label in the actual driver's final receipt", async () => {
  const state = await channel();
  const rejected = expect(state.channel.send("Page.navigate", { url: "private-url-not-for-receipts" })).rejects.toThrow("website_driver_operation_timeout");
  await vi.advanceTimersByTimeAsync(15000); await rejected;
  // Exercise the executable driver's pure receipt construction without starting
  // its HTTP/CDP recipe or importing any application/browser entry point.
  const source = readFileSync(`${process.cwd()}/scripts/capture-owned-website.mjs`, "utf8");
  const start = source.lastIndexOf("    const result = { success, failure,");
  const end = source.indexOf("\n    writeFileSync", start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const receipt = vm.compileFunction(`${source.slice(start, end)}; return result;`, ["success", "failure", "session", "preImageWait", "evidence", "images", "denied", "consoleErrors", "evaluationExceptionClass", "homeCapturePhase", "scriptRequests", "currentInteraction", "lastInteraction"])(false, "website_driver_operation_timeout", state.session, null, [], [], 0, [], null, null, { allowed: 0, denied: 0 }, "setup", null);
  expect(receipt.timedOutOperation).toBe("cdp.Page.navigate");
  expect(receipt.preImageWait).toBeNull();
  expect(receipt.evaluationExceptionClass).toBeNull();
  expect(receipt.homeCapturePhase).toBeNull();
  expect(receipt.runtimeExceptionCount).toBe(0);
  expect(JSON.stringify(receipt)).not.toContain("private-url");
});
