import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const lifecycle = require("../../scripts/fixtures/ownedWebsiteLifecycle.cjs");
const transport = require("../../scripts/fixtures/ownedWebsiteSession.cjs");
const policy = require("../../scripts/fixtures/ownedWebsitePolicy.cjs");
const paths = { directory: "/tmp/axiom-website-test", configPath: "/tmp/axiom-website-test/config.json" };
const owner = { pid: 42, group: 42, start: "100", executable: "/owned/node", state: "S" };
function child() { return Object.assign(new EventEmitter(), { pid: 42, exitCode: null as number | null, signalCode: null as string | null }); }

describe("spawn ledger covers failures before ownership registration", () => {
  it("retains an unregistered live handle without signalling or certifying empty", async () => {
    const handle = child(); const stop = vi.fn();
    const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => { throw Error("denied"); }, canonical: (v: string) => v, stopGroup: stop, groupMembers: () => [], waitExit: async () => {} });
    const launch = ledger.launch("/owned/node", [], {}); handle.emit("spawn");
    await expect(launch).rejects.toThrow("denied"); expect(ledger.records).toHaveLength(1);
    expect(await ledger.cleanup()).toEqual(["website_pending_child_unresolved"]); expect(stop).not.toHaveBeenCalled();
  });
  it("positive exit plus an empty group closes pending ownership without signalling", async () => {
    const handle = child(); const stop = vi.fn();
    const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => { throw Error("denied"); }, canonical: (v: string) => v, stopGroup: stop, groupMembers: () => [], waitExit: async () => {} });
    const launch = ledger.launch("/owned/node", [], {}); handle.emit("spawn"); await expect(launch).rejects.toThrow();
    handle.emit("exit", 1, null); expect(await ledger.cleanup()).toEqual([]); expect(stop).not.toHaveBeenCalled();
  });
  it("pending descendants or reused identity prevent cleanup success", async () => {
    const handle = child(); const stop = vi.fn(async () => { throw Error("identity_changed"); });
    const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => owner, canonical: (v: string) => v, stopGroup: stop, groupMembers: () => [owner], waitExit: async () => {} });
    const launch = ledger.launch("/owned/node", [], {}); handle.emit("spawn"); await launch;
    handle.emit("exit", 0, null); expect(await ledger.cleanup()).toEqual(["identity_changed"]);
  });
  it("spawn error without a PID is closed, but error with a PID is not exit proof", async () => {
    for (const pid of [undefined, 42]) {
      const handle = Object.assign(new EventEmitter(), { pid });
      const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => owner, canonical: (v: string) => v, stopGroup: vi.fn(), groupMembers: () => [], waitExit: async () => {} });
      const launch = ledger.launch("/owned/node", [], {}); handle.emit("error", Error("spawn_failed")); await expect(launch).rejects.toThrow();
      expect(await ledger.cleanup()).toEqual(pid ? ["website_pending_child_unresolved"] : []);
    }
  });
});

describe("environment refuses unsupported inherited guards before launch", () => {
  it.each([{ NODE_OPTIONS: "--require=/managed/guard.cjs" }, { NODE_TLS_REJECT_UNAUTHORIZED: "1" }, { OPENSSL_CONF: "/managed/config" }, { LD_PRELOAD: "/managed/guard.so" }, { NODE_USE_SYSTEM_CA: "1" }])("refuses without echoing selector values %o", env => {
    expect(() => policy.childEnvironment(env, paths, [])).toThrow("website_child_options_unsupported");
  });
  it("preserves supported proxy/CA selectors and heap options opaquely", () => {
    const selectors = { NODE_USE_ENV_PROXY: "1", AWS_CA_BUNDLE: "/managed/aws", REQUESTS_CA_BUNDLE: "/managed/requests", CURL_CA_BUNDLE: "/managed/curl", SSL_CERT_FILE: "/managed/ssl", NODE_OPTIONS: "--max-old-space-size=4096" };
    expect(policy.childEnvironment(selectors, paths, [])).toMatchObject(selectors);
    expect(() => policy.childEnvironment({}, paths, ["--require", "/managed/guard.cjs"])).toThrow("website_child_options_unsupported");
  });
});

function listenerIO(change: Record<string, unknown> = {}) {
  return { snapshot: () => owner, listeners: () => [{ address: "0100007F", port: 38003, inode: "99", family: "tcp" }], descriptors: () => ["socket:[99]"], ...change };
}
describe("CDP listener belongs to the recorded Chromium process", () => {
  it("accepts the exact loopback inode with stable process identity", () => expect(policy.proveListener(owner, 38003, listenerIO())).toEqual({ inode: "99", owner }));
  it.each([
    { descriptors: () => ["socket:[88]"] },
    { snapshot: () => ({ ...owner, start: "101" }) },
    { listeners: () => [{ address: "00000000", port: 38003, inode: "99", family: "tcp" }] },
    { listeners: () => [{ address: "0100007F", port: 38003, inode: "99", family: "tcp" }, { address: "00000000000000000000000000000000", port: 38003, inode: "100", family: "tcp6" }] },
  ])("refuses collisions, wildcard sockets and PID reuse before transport", io => expect(() => policy.proveListener(owner, 38003, listenerIO(io))).toThrow());
  it("rechecks identity after descriptor resolution", () => { let reads = 0; expect(() => policy.proveListener(owner, 38003, listenerIO({ snapshot: () => ++reads === 1 ? owner : { ...owner, start: "101" } }))).toThrow(); });
});

describe("driver absolute deadline and close cancel all outstanding operations", () => {
  it("bounds setup and prevents later commands/writes after deadline", async () => {
    vi.useFakeTimers();
    try {
      const session = transport.createSession({ duration: 120000 }); const close = vi.fn(); session.onStop(close);
      const setup = session.operation(() => {}, 120001); const rejected = expect(setup).rejects.toThrow("website_driver_deadline");
      await vi.advanceTimersByTimeAsync(120000); await rejected; expect(close).toHaveBeenCalledOnce();
      expect(() => session.assertActive()).toThrow("website_driver_deadline");
      const send = vi.fn(); await expect(session.operation(send)).rejects.toThrow("website_driver_deadline"); expect(send).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("socket closure rejects pending operations and cancels timers", async () => {
    const session = transport.createSession({ duration: 120000 }); const cleanup = vi.fn();
    const command = session.operation((_resolve: unknown, _reject: unknown, onCancel: (fn: () => void) => void) => onCancel(cleanup));
    const rejected = expect(command).rejects.toThrow("website_cdp_closed"); session.stop(Error("website_cdp_closed")); await rejected; expect(cleanup).toHaveBeenCalledOnce();
    expect(() => session.assertActive()).toThrow("website_cdp_closed");
  });
});

it("registered cleanup still requires a positive child exit event", async () => {
  const handle = child();
  const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => owner, canonical: (v: string) => v, stopGroup: async () => {}, groupMembers: () => [], waitExit: async () => {} });
  const launch = ledger.launch("/owned/node", [], {}); handle.emit("spawn"); await launch;
  expect(await ledger.cleanup()).toEqual(["website_pending_child_unresolved"]);
});

class Socket extends EventTarget {
  readyState = 1;
  send = vi.fn();
  close = vi.fn();
}
it("never creates a socket when the listener collides", async () => {
  const session = transport.createSession(); const createSocket = vi.fn();
  try {
    await expect(transport.openChannel({ session, endpoint: "unused", createSocket, proveEndpoint: () => { throw Error("collision"); } })).rejects.toThrow("collision");
    expect(createSocket).not.toHaveBeenCalled();
  } finally { session.stop(); }
});
it("actual channel rejects commands on socket close and refuses later actions", async () => {
  const session = transport.createSession(); const socket = new Socket(); const proof = vi.fn();
  try {
    const opening = transport.openChannel({ session, endpoint: "unused", createSocket: () => socket, proveEndpoint: proof }); socket.dispatchEvent(new Event("open"));
    const channel = await opening; const pending = channel.send("Page.navigate"); const rejected = expect(pending).rejects.toThrow("website_cdp_closed");
    socket.dispatchEvent(new Event("close")); await rejected;
    await expect(channel.send("Input.dispatchKeyEvent")).rejects.toThrow("website_cdp_closed");
    expect(socket.send).toHaveBeenCalledOnce(); expect(socket.close).toHaveBeenCalledOnce(); expect(proof).toHaveBeenCalledTimes(3);
  } finally { session.stop(); }
});
it("socket setup is cancelled and closed within the absolute driver lifetime", async () => {
  vi.useFakeTimers(); const session = transport.createSession({ duration: 1000 }); const socket = new Socket();
  try {
    const opening = transport.openChannel({ session, endpoint: "unused", createSocket: () => socket, proveEndpoint: () => {} });
    const rejected = expect(opening).rejects.toThrow("website_driver_deadline"); await vi.advanceTimersByTimeAsync(1000); await rejected;
    socket.dispatchEvent(new Event("open")); expect(socket.send).not.toHaveBeenCalled(); expect(socket.close).toHaveBeenCalledOnce();
  } finally { session.stop(); vi.useRealTimers(); }
});
it("listener identity is checked again before every browser command", async () => {
  const session = transport.createSession(); const socket = new Socket(); let valid = true;
  try {
    const opening = transport.openChannel({ session, endpoint: "unused", createSocket: () => socket, proveEndpoint: () => { if (!valid) throw Error("changed"); } }); socket.dispatchEvent(new Event("open"));
    const channel = await opening; valid = false;
    await expect(channel.send("Page.navigate")).rejects.toThrow("changed"); expect(socket.send).not.toHaveBeenCalled();
  } finally { session.stop(); }
});

it("retains artifacts eligibility when an unregistered exited child has descendants", async () => {
  const handle = child(); const stop = vi.fn();
  const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => { throw Error("denied"); }, canonical: (v: string) => v, stopGroup: stop, groupMembers: () => [owner], waitExit: async () => {} });
  const launch = ledger.launch("/owned/node", [], {}); handle.emit("spawn"); await expect(launch).rejects.toThrow(); handle.emit("exit", 1, null);
  expect(await ledger.cleanup()).toEqual([expect.stringContaining("website_child_group_not_empty")]); expect(stop).not.toHaveBeenCalled();
});
it("distinguishes an absent listener from a collision without any network probe", () => {
  expect(() => policy.proveListener(owner, 38003, listenerIO({ listeners: () => [] }))).toThrow("website_listener_not_ready");
});

describe("coordinator signals cancel active work through owned cleanup", () => {
  it("interrupts pending registration promptly and cleans the subsequently verified child", async () => {
    const signals = new EventEmitter(); const control = lifecycle.createCoordinator({ signals }); const handle = child();
    const stop = vi.fn(async () => { handle.emit("exit", null, "SIGTERM"); });
    const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => owner, canonical: (v: string) => v, stopGroup: stop, groupMembers: () => [], waitExit: async () => {} });
    try {
      const pending = control.run(() => ledger.launch("/owned/node", [], {}));
      const rejected = expect(pending).rejects.toThrow("website_coordinator_SIGTERM"); signals.emit("SIGTERM"); await rejected;
      const cleanup = ledger.cleanup(); handle.emit("spawn"); expect(await cleanup).toEqual([]); expect(stop).toHaveBeenCalledOnce();
      const late = vi.fn(); await expect(control.run(late)).rejects.toThrow("website_coordinator_SIGTERM"); expect(late).not.toHaveBeenCalled();
      expect(control.report()).toMatchObject({ signal: "SIGTERM", interrupted: true });
    } finally { control.dispose(); }
    expect(signals.listenerCount("SIGTERM")).toBe(0); expect(signals.listenerCount("SIGINT")).toBe(0);
  });
  it("interrupts a driver wait without waiting its 120 seconds and preserves the first signal", async () => {
    const signals = new EventEmitter(); const control = lifecycle.createCoordinator({ signals });
    try {
      const pending = control.run(() => new Promise(() => {})); const rejected = expect(pending).rejects.toThrow("website_coordinator_SIGINT");
      signals.emit("SIGINT"); signals.emit("SIGTERM"); await rejected;
      expect(control.report()).toMatchObject({ signal: "SIGINT", interrupted: true, failure: "website_coordinator_SIGINT" });
    } finally { control.dispose(); }
  });
  it("signals during cleanup neither abort cleanup nor replace an earlier failure", async () => {
    const signals = new EventEmitter(); const control = lifecycle.createCoordinator({ signals }); const handle = child();
    const stop = vi.fn(async () => { signals.emit("SIGTERM"); signals.emit("SIGINT"); handle.emit("exit", 1, null); });
    const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => owner, canonical: (v: string) => v, stopGroup: stop, groupMembers: () => [], waitExit: async () => {} });
    try {
      const launch = ledger.launch("/owned/node", [], {}); handle.emit("spawn"); await launch;
      control.cancel(Error("original_failure")); expect(await ledger.cleanup()).toEqual([]); expect(stop).toHaveBeenCalledOnce();
      expect(control.report()).toMatchObject({ signal: "SIGTERM", interrupted: true, failure: "original_failure" });
      expect(() => control.check()).toThrow("original_failure");
    } finally { control.dispose(); }
  });
  it("absolute parent deadline cancels pending waits and refuses later launches", async () => {
    vi.useFakeTimers(); const control = lifecycle.createCoordinator({ signals: new EventEmitter(), duration: 1000 });
    try {
      const pending = control.run(() => new Promise(() => {})); const rejected = expect(pending).rejects.toThrow("website_coordinator_deadline");
      await vi.advanceTimersByTimeAsync(1000); await rejected;
      expect(() => control.check()).toThrow("website_coordinator_deadline");
    } finally { control.dispose(); vi.useRealTimers(); }
  });
});

it("unverified registration after interruption stays bounded and cannot become a late cleanup success", async () => {
  vi.useFakeTimers(); const control = lifecycle.createCoordinator({ signals: new EventEmitter() }); const handle = child(); const stop = vi.fn();
  const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => owner, canonical: (v: string) => v, stopGroup: stop, groupMembers: () => [], waitExit: async () => {} });
  try {
    const launch = control.run(() => ledger.launch("/owned/node", [], {})); const rejected = expect(launch).rejects.toThrow("cancelled"); control.cancel(Error("cancelled")); await rejected;
    const cleanup = ledger.cleanup(); await vi.advanceTimersByTimeAsync(2000);
    expect(await cleanup).toEqual(["website_pending_child_unresolved"]);
    handle.emit("spawn"); await Promise.resolve(); expect(ledger.owners()).toEqual([]); expect(stop).not.toHaveBeenCalled();
  } finally { control.dispose(); vi.useRealTimers(); }
});

it("a signal during otherwise successful cleanup prevents a success report", async () => {
  const signals = new EventEmitter(); const control = lifecycle.createCoordinator({ signals }); const handle = child();
  const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => owner, canonical: (v: string) => v, stopGroup: async () => { signals.emit("SIGTERM"); handle.emit("exit", 0, null); }, groupMembers: () => [], waitExit: async () => {} });
  try {
    const launch = control.run(() => ledger.launch("/owned/node", [], {})); handle.emit("spawn"); await launch;
    expect(await ledger.cleanup()).toEqual([]);
    expect(control.report()).toMatchObject({ interrupted: true, failure: "website_coordinator_SIGTERM" });
    expect(() => control.check()).toThrow("website_coordinator_SIGTERM");
  } finally { control.dispose(); }
});

it("persists pending, registered and exited driver identity before launch progresses", async () => {
  const handle = child(); const writes: Array<Array<{ state: string; role: string; owner: unknown }>> = [];
  const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => owner, canonical: (v: string) => v, stopGroup: async () => {}, groupMembers: () => [], waitExit: async () => {}, onChange: (rows: typeof writes[number]) => writes.push(rows) });
  const launch = ledger.launch("/owned/node", [], {}, () => {}, "capture");
  expect(writes[0][0]).toMatchObject({ role: "capture", state: "pending", pid: 42, owner: null });
  handle.emit("spawn"); await launch; expect(writes[1][0]).toMatchObject({ state: "registered", owner });
  handle.emit("exit", 0, null); expect(writes[2][0]).toMatchObject({ state: "exited", exitCode: 0, owner });
});
it.each(["pending", "registered", "exited"])("journal failure in %s retains cleanup failure without losing the child", async state => {
  const handle = child(); const failure = vi.fn();
  const ledger = lifecycle.createLedger({ spawn: () => handle, snapshot: () => owner, canonical: (v: string) => v, stopGroup: async () => { handle.emit("exit", 0, null); }, groupMembers: () => [], waitExit: async () => {}, onFailure: failure, onChange: (rows: Array<{ state: string }>) => { if (rows[0].state === state) throw Error("disk"); } });
  const launch = ledger.launch("/owned/node", [], {});
  const result = launch.catch((error: Error) => error.message); handle.emit("spawn"); await result;
  if (state === "exited") handle.emit("exit", 0, null);
  expect(await ledger.cleanup()).toContain("website_ledger_persistence_failed"); expect(ledger.records).toHaveLength(1); expect(failure).toHaveBeenCalled();
});
it("supervisor cancels driver wait on proxy crash and cleans all directly owned children", async () => {
  const control = lifecycle.createCoordinator({ signals: new EventEmitter() }); let cleaning = false;
  const handles = [42, 43, 44, 45].map(pid => Object.assign(child(), { pid })); let next = 0;
  const stop = vi.fn(async (row: { pid: number }) => { const h = handles.find(item => item.pid === row.pid)!; if (h.exitCode === null) { h.exitCode = 0; h.emit("exit", 0, null); } });
  const ledger = lifecycle.createLedger({ spawn: () => handles[next++], snapshot: (pid: number) => ({ ...owner, pid, group: pid }), canonical: (v: string) => v, stopGroup: stop, groupMembers: () => [], waitExit: async () => {} });
  try {
    for (const [index, role] of ["server", "proxy", "browser", "capture"].entries()) {
      const launch = ledger.launch("/owned/node", [], {}, (h: EventEmitter) => lifecycle.observeOwnedChild(h, { critical: role !== "capture", isCleaning: () => cleaning, onFailure: control.cancel, onData: () => {} }), role);
      handles[index].emit("spawn"); await launch;
    }
    const wait = control.run(() => new Promise(() => {})); const rejected = expect(wait).rejects.toThrow("website_critical_child_exited");
    handles[1].emit("exit", 1, null); await rejected; cleaning = true;
    expect(await ledger.cleanup()).toEqual([]); expect(stop).toHaveBeenCalledTimes(4);
  } finally { control.dispose(); }
});
it("owned child pipe errors cancel instead of becoming unhandled supervisor socket errors", () => {
  const handle = Object.assign(child(), { stdout: new EventEmitter(), stderr: new EventEmitter() }); const cancel = vi.fn();
  lifecycle.observeOwnedChild(handle, { critical: true, isCleaning: () => false, onFailure: cancel, onData: () => {} });
  expect(() => handle.stdout.emit("error", Error("ECONNRESET"))).not.toThrow(); expect(() => handle.stderr.emit("error", Error("ECONNRESET"))).not.toThrow(); expect(cancel).toHaveBeenCalledTimes(2);
});

it("persists a bounded nonce-bound journal by flushed temporary write before atomic rename", () => {
  const calls: string[] = []; let content = "";
  const io = { writeFileSync: (path: string, value: string, options: object) => { calls.push(path); content = value; expect(options).toEqual({ mode: 0o600, flush: true }); }, renameSync: (from: string, to: string) => { calls.push(`${from}->${to}`); } };
  lifecycle.persistLedger("/tmp/axiom-website-test", "a".repeat(32), [{ role: "capture", pid: 42, state: "pending" }], io);
  expect(JSON.parse(content)).toMatchObject({ nonce: "a".repeat(32), children: [{ role: "capture", pid: 42, state: "pending" }] });
  expect(calls).toEqual(["/tmp/axiom-website-test/ledger.pending.json", "/tmp/axiom-website-test/ledger.pending.json->/tmp/axiom-website-test/ledger.json"]);
});
it("journal write failure never replaces the preceding durable ledger", () => {
  const renameSync = vi.fn();
  expect(() => lifecycle.persistLedger("/tmp/axiom-website-test", "a".repeat(32), [], { writeFileSync: () => { throw Error("disk"); }, renameSync })).toThrow("disk"); expect(renameSync).not.toHaveBeenCalled();
});
