import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { afterEach, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const transport = require("../../scripts/fixtures/ownedWebsiteSession.cjs");
const policy = require("../../scripts/fixtures/ownedWebsitePolicy.cjs");
const source = readFileSync(`${process.cwd()}/scripts/capture-owned-website.mjs`, "utf8");
const start = source.indexOf("onEvent: (data, send) => {");
const end = source.indexOf("\n  } });", start);
if (start < 0 || end < start) throw Error("website_interception_callback_missing");
// Importing the driver would execute its owned-browser recipe. Exercise its
// actual callback body and actual channel with in-process synthetic messages.
const callback = source.slice(start + "onEvent: ".length, end + 4);
const origin = "http://127.0.0.1:38001";
it("counts console errors without reading arguments and maps Log sources to closed categories", () => {
  const state = vm.compileFunction(`const consoleErrors = []; return { callback: ${callback}, categories: consoleErrors };`, [])();
  let reads = 0;
  const params = Object.defineProperty({ type: 'error' }, 'args', { get() { reads++; throw Error('PRIVATE'); } });
  state.callback({ method: 'Runtime.consoleAPICalled', params }, () => {});
  state.callback({ method: 'Runtime.consoleAPICalled', params: { type: 'log', args: ['PRIVATE'] } }, () => {});
  state.callback({ method: 'Log.entryAdded', params: { entry: { level: 'error', source: 'PRIVATE', text: 'PRIVATE' } } }, () => {});
  expect(state.categories).toEqual(['console_error', 'other']); expect(reads).toBe(0);
  for (let i = 0; i < 150; i++) state.callback({ method: 'Runtime.consoleAPICalled', params }, () => {});
  expect(state.categories).toHaveLength(128); expect(JSON.stringify(state.categories)).not.toContain('PRIVATE');
});
type Command = { id: number; method: string; params: Record<string, unknown> };
const sessions: Array<{ stop: () => void }> = [];
afterEach(() => { for (const session of sessions.splice(0)) session.stop(); vi.useRealTimers(); });

class Socket extends EventTarget {
  readyState = 1;
  commands: Command[] = [];
  onSend: (command: Command) => void = () => {};
  close = vi.fn();
  send(text: string) { const command = JSON.parse(text); this.commands.push(command); this.onSend(command); }
  message(value: unknown) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) })); }
  paused(url: string) { this.message({ method: "Fetch.requestPaused", params: { requestId: "fixture-request", request: { url, method: "GET" } } }); }
}

async function fixture() {
  vi.useFakeTimers();
  const session = transport.createSession({ duration: 120000 }); sessions.push(session);
  const state = vm.compileFunction(`let denied = 0; const consoleErrors = []; const scriptRequests = { allowed: 0, denied: 0 }; const initialNavigation = { issued: true, requestPaused: false, requestContinued: false, requestDenied: false, navigationAcknowledged: false, mainFrameCommitted: false }; return { initialNavigation, scriptRequests, callback: ${callback}, denied: () => denied };`, ["windowState", "config", "policy", "session"])({ origin }, { assets: [] }, policy, session);
  const socket = new Socket();
  const opening = transport.openChannel({ session, endpoint: "unused-synthetic-endpoint", createSocket: () => socket, proveEndpoint: () => {}, onEvent: state.callback });
  socket.dispatchEvent(new Event("open"));
  return { session, socket, state, channel: await opening };
}

it.each(["synchronous", "asynchronous"])("continues an intercepted request during pending navigation with %s delivery", async delivery => {
  const f = await fixture();
  f.socket.onSend = command => {
    if (command.method !== "Page.navigate") return;
    if (delivery === "synchronous") f.socket.paused(`${origin}/`);
    else queueMicrotask(() => f.socket.paused(`${origin}/`));
  };
  let navigationSettled = false;
  const navigation = f.channel.send("Page.navigate", { url: `${origin}/` }).then((result: unknown) => { navigationSettled = true; return result; });
  void navigation.catch(() => {}); // Keep teardown rejection observed if an earlier assertion fails.
  await vi.advanceTimersByTimeAsync(0);
  expect(f.socket.commands.map(command => command.method)).toEqual(["Page.navigate", "Fetch.continueRequest"]);
  expect(f.socket.commands[1].params).toEqual({ requestId: "fixture-request" });
  expect(navigationSettled).toBe(false);
  f.socket.message({ id: 2, result: {} });
  await vi.advanceTimersByTimeAsync(0);
  expect(navigationSettled).toBe(false);
  f.socket.message({ id: 1, result: { frameId: "fixture-frame" } });
  expect(await navigation).toEqual({ frameId: "fixture-frame" });
  expect(f.state.denied()).toBe(0);
  expect(f.session.report()).toEqual({ timedOutOperation: null });
});

it.each(["https://unapproved.example.test/", `${origin}/api/auth/session`])("rejects intercepted disallowed request %s while navigation is pending", async url => {
  const f = await fixture();
  const navigation = f.channel.send("Page.navigate", { url: `${origin}/` });
  void navigation.catch(() => {});
  f.socket.paused(url);
  expect(f.socket.commands.map(command => command.method)).toEqual(["Page.navigate", "Fetch.failRequest"]);
  expect(f.socket.commands[1].params).toEqual({ requestId: "fixture-request", errorReason: "BlockedByClient" });
  expect(f.state.denied()).toBe(1);
  f.socket.message({ id: 2, result: {} });
  f.socket.message({ id: 1, result: { frameId: "fixture-frame" } });
  await navigation;
  expect(f.session.report()).toEqual({ timedOutOperation: null });
});

it.each(["continue", "deny"])("cancels navigation when the %s interception command fails", async action => {
  const f = await fixture();
  const rejected = expect(f.channel.send("Page.navigate", { url: `${origin}/` })).rejects.toThrow("website_cdp_protocol:-32000");
  f.socket.paused(action === "continue" ? `${origin}/` : "https://unapproved.example.test/");
  f.socket.message({ id: 2, error: { code: -32000, message: "synthetic protocol failure" } });
  await rejected;
  expect(f.socket.close).toHaveBeenCalledOnce();
  await expect(f.channel.send("Runtime.evaluate")).rejects.toThrow("website_cdp_protocol:-32000");
  expect(f.socket.commands).toHaveLength(2);
  await vi.advanceTimersByTimeAsync(15000);
  expect(f.session.report()).toEqual({ timedOutOperation: null });
});

it("retains the 15-second navigation bound after the main request was already continued", async () => {
  const f = await fixture();
  const rejected = expect(f.channel.send("Page.navigate", { url: `${origin}/` })).rejects.toThrow("website_driver_operation_timeout");
  f.socket.paused(`${origin}/`); f.socket.message({ id: 2, result: {} });
  await vi.advanceTimersByTimeAsync(14999);
  expect(f.session.report()).toEqual({ timedOutOperation: null });
  await vi.advanceTimersByTimeAsync(1); await rejected;
  expect(f.session.report()).toEqual({ timedOutOperation: "cdp.Page.navigate" });
  expect(f.socket.commands.map(command => command.method)).toEqual(["Page.navigate", "Fetch.continueRequest"]);
});

it.each([
  { url: `${origin}/_next/static/chunks/app.js`, decision: "Fetch.continueRequest", counts: { allowed: 1, denied: 0 } },
  { url: "https://unapproved.example.test/private.js", decision: "Fetch.failRequest", counts: { allowed: 0, denied: 1 } },
])("counts script decisions without broadening the request policy ($decision)", async ({ url, decision, counts }) => {
  const f = await fixture();
  f.socket.message({ method: "Fetch.requestPaused", params: { resourceType: "Script", requestId: "script", request: { url, method: "GET" } } });
  expect(f.socket.commands.map(command => command.method)).toEqual([decision]);
  expect(f.state.scriptRequests).toEqual(counts);
  f.socket.message({ id: 1, result: {} });
});

it("records initial document interception only after the continue acknowledgment", async () => {
 const f = await fixture();
 f.socket.message({ method: "Fetch.requestPaused", params: { resourceType: "Document", requestId: "home", request: { url: `${origin}/`, method: "GET" } } });
 expect(f.state.initialNavigation.requestPaused).toBe(true);
 expect(f.state.initialNavigation.requestContinued).toBe(false);
 f.socket.message({ id: 1, result: {} }); await Promise.resolve(); await Promise.resolve();
 expect(f.state.initialNavigation.requestContinued).toBe(true);
 expect(f.state.initialNavigation.requestDenied).toBe(false);
});

it("retains initial navigation intent when CDP navigation never acknowledges", async () => {
 const begin = source.indexOf('async function navigate(path, preImagePhase = undefined)');
 const finish = source.indexOf('\n', begin);
 expect(begin).toBeGreaterThan(0);
 const initialNavigation = { issued: false, navigationAcknowledged: false };
 const navigate = vm.compileFunction(`${source.slice(begin, finish)}; return navigate;`, ['assert', 'send', 'waitFor', 'windowState', 'initialNavigation'])({ ok: (ok: boolean) => { if (!ok) throw Error('bad path'); } }, async () => { throw Error('website_driver_operation_timeout'); }, () => { throw Error('unexpected DOM wait'); }, { origin }, initialNavigation);
 await expect(navigate('/')).rejects.toThrow('website_driver_operation_timeout');
 expect(initialNavigation).toEqual({ issued: true, navigationAcknowledged: false });
});
