import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
afterEach(() => vi.useRealTimers());
function fixture() {
  const journal: unknown[] = [], signals: unknown[] = [];
  const owner = { pid: 10101, group: 10101, start: "100", state: "S", executable: "/owned/node" };
  let members = [owner];
  const child = Object.assign(new EventEmitter(), { pid: owner.pid as number | undefined, exitCode: null as number | null, signalCode: null as string | null, stdout: new EventEmitter(), stderr: new EventEmitter() });
  const io = { parentGroup: () => 999, canonical: () => "/owned/node", snapshot: () => owner, members: () => members, persist: (_directory: string, _role: string, row: unknown) => journal.push(structuredClone(row)), signal: (group: number, signal: string) => { signals.push([group, signal]); members = []; child.exitCode = 0; child.emit("exit", 0, null); } };
  return { child: child as unknown as ChildProcess, raw: child, io, owner, journal, signals, setMembers: (rows: typeof members) => { members = rows; } };
}
describe("bounded owned checkout process lifecycle (literal child and identity IO only)", () => {
  it("journals pending then registered, shares cleanup and stops descendants after leader exit", async () => {
    const h = await import("./fixtures/ownedCheckoutProcess"); const f = fixture(), control = h.ownedCheckoutControl(10000);
    f.setMembers([f.owner, { ...f.owner, pid: 10102 }]);
    const process = h.ownedCheckoutChild("worker", "/private", () => f.child, control, f.io); f.raw.emit("spawn"); await process.ready;
    expect(f.journal).toMatchObject([{ state: "pending", pid: null }, { state: "pending", pid: 10101 }, { state: "registered" }]);
    f.raw.emit("exit", 0); f.setMembers([{ ...f.owner, pid: 10102 }]);
    const first = process.stop(); expect(process.stop()).toBe(first); await first;
    expect(f.signals).toEqual([[-10101, "SIGTERM"]]); control.dispose();
  });
  it("handles positively never-spawned/no-PID without waiting for an exit that cannot arrive", async () => {
    const h = await import("./fixtures/ownedCheckoutProcess"); const f = fixture(), control = h.ownedCheckoutControl(10000); f.raw.pid = undefined;
    const process = h.ownedCheckoutChild("worker", "/private", () => f.child, control, f.io); f.raw.emit("error", Error("inert"));
    await expect(process.ready).rejects.toThrow(); await process.stop(); expect(f.signals).toEqual([]); expect(f.journal.at(-1)).toMatchObject({ state: "never_spawned" }); control.dispose();
  });
  it("keeps an unproved no-PID pending launch unknown and bounds cleanup", async () => {
    vi.useFakeTimers(); const h = await import("./fixtures/ownedCheckoutProcess"), f = fixture(), control = h.ownedCheckoutControl(10000); f.raw.pid = undefined;
    const process = h.ownedCheckoutChild("worker", "/private", () => f.child, control, f.io);
    const outcome = process.stop().catch(e => e); await vi.advanceTimersByTimeAsync(2100); expect(await outcome).toBeInstanceOf(Error); expect(f.signals).toEqual([]); control.dispose();
  });
  it.each(["error", "stdout", "stderr"])("sticky-cancels current and future work on post-ready %s", async kind => {
    const h = await import("./fixtures/ownedCheckoutProcess"), f = fixture(), control = h.ownedCheckoutControl(10000);
    const process = h.ownedCheckoutChild("worker", "/private", () => f.child, control, f.io); f.raw.emit("spawn"); await process.ready;
    const work = control.run(() => new Promise(() => {})).catch(e => e);
    if (kind === "error") f.raw.emit("error", Error("inert")); else f.raw[kind as "stdout" | "stderr"].emit("error", Error("inert"));
    expect(await work).toBeInstanceOf(Error); await expect(control.run(async () => 1)).rejects.toThrow(); await process.stop(); control.dispose();
  });
  it("never signals substituted identity or parent group, and refuses artifact cleanup authority", async () => {
    const h = await import("./fixtures/ownedCheckoutProcess"), f = fixture(), control = h.ownedCheckoutControl(10000);
    const process = h.ownedCheckoutChild("worker", "/private", () => f.child, control, f.io); f.raw.emit("spawn"); await process.ready;
    f.setMembers([{ ...f.owner, executable: "/foreign" }]); await expect(process.stop()).rejects.toThrow(); expect(f.signals).toEqual([]); control.dispose();
  });
  it("refuses an unseen group after leader exit instead of mistaking a reused group for owned descendants", async () => {
    const h = await import("./fixtures/ownedCheckoutProcess"), f = fixture(), control = h.ownedCheckoutControl(10000);
    const process = h.ownedCheckoutChild("worker", "/private", () => f.child, control, f.io); f.raw.emit("spawn"); await process.ready;
    f.raw.emit("exit", 0); f.setMembers([{ ...f.owner, pid: 10103, start: "200" }]);
    await expect(process.stop()).rejects.toThrow(); expect(f.signals).toEqual([]); control.dispose();
  });
  it("refuses the parent group even if a substituted child handle names its leader", async () => {
    const h = await import("./fixtures/ownedCheckoutProcess"), f = fixture(), control = h.ownedCheckoutControl(10000); f.io.parentGroup = () => f.owner.group;
    const process = h.ownedCheckoutChild("worker", "/private", () => f.child, control, f.io); f.raw.emit("spawn"); await expect(process.ready).rejects.toThrow();
    f.raw.emit("exit", 0); await expect(process.stop()).rejects.toThrow(); expect(f.signals).toEqual([]); control.dispose();
  });
  it("bounds missing SIGKILL/exit proof and attempts both cleanup owners independently", async () => {
    vi.useFakeTimers(); const h = await import("./fixtures/ownedCheckoutProcess"), f = fixture(), control = h.ownedCheckoutControl(10000); f.io.signal = (_group, signal) => { f.signals.push(signal); };
    const process = h.ownedCheckoutChild("next", "/private", () => f.child, control, f.io); f.raw.emit("spawn"); await process.ready;
    const other = vi.fn(async () => {}); const outcome = h.cleanupOwnedCheckout([() => process.stop(), other]).catch(e => e);
    await vi.advanceTimersByTimeAsync(6100); expect(await outcome).toBeInstanceOf(Error); expect(other).toHaveBeenCalledOnce(); expect(f.signals).toEqual(["SIGTERM", "SIGKILL"]); control.dispose();
  });
  it("uses one absolute monotonic deadline to abort held readiness/body work", async () => {
    vi.useFakeTimers(); const h = await import("./fixtures/ownedCheckoutProcess"), control = h.ownedCheckoutControl(1000);
    const abort = vi.fn(); control.signal.addEventListener("abort", abort);
    const first = control.run(() => new Promise(() => {})).catch(e => e); await vi.advanceTimersByTimeAsync(900);
    const second = control.run(() => new Promise(() => {})).catch(e => e); await vi.advanceTimersByTimeAsync(101);
    expect(await first).toBeInstanceOf(Error); expect(await second).toBeInstanceOf(Error); expect(abort).toHaveBeenCalledOnce(); control.dispose();
  });
});
