import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const state = vi.hoisted(() => ({ fork: vi.fn(), deleted: [] as string[], sent: [] as unknown[] }));
vi.mock("node:child_process", () => ({ fork: state.fork }));
vi.mock("node:fs", () => ({ mkdirSync: () => {}, readFileSync: () => "safe", symlinkSync: () => {}, rmSync: (path: string) => state.deleted.push(path), lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => false, uid: process.getuid?.(), mode: 0o700 }), realpathSync: (path: string) => path }));
vi.mock("./fixtures/newTestChildEnvironment", () => ({ checkedChildEnvironment: () => ({ NODE_ENV: "development" }), newTestPrismaEnvironment: () => ({}) }));
vi.mock("./fixtures/ownedCheckoutWorkerBundle", () => ({ assertSyntheticSupervisor: () => {}, verifyOwnedBytes: () => {}, verifyOwnedOutputTree: () => {}, buildOwnedWorker: async () => ({ entry: "/owned/compiled/entry.js", output: "/owned/compiled", outputDigest: "synthetic", receipt: { sources: [{ path: "lib/entry.ts", sha256: "synthetic" }], outputs: [{ path: "lib/entry.js", sha256: "synthetic" }] } }) }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); state.deleted = []; state.sent = []; });
describe("owned supervisor process ownership (literal child stub; no spawn/build/socket)", () => {
  it("sends bootstrap before waiting for ready and awaits exact child exit before deleting its directory", async () => {
    vi.useFakeTimers(); const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null as number | null, signalCode: null as string | null, stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => { child.exitCode = 0; child.emit("exit", 0); return true; }, send: (message: {env: {AXIOM_OWNED_CHECKOUT_SESSION: string}}) => { state.sent.push(message); child.emit("message", { kind: "owned_worker_ready", session: message.env.AXIOM_OWNED_CHECKOUT_SESSION, pid: 12345 }); return true; } }); state.fork.mockReturnValue(child);
    const { startOwnedCheckoutWorker } = await import("./fixtures/ownedCheckoutWorkerSupervisor");
    const input = { db: { $queryRawUnsafe: async () => [{ id: "runtime" }] }, databaseUrl: "postgresql://owned", runtimeId: "runtime", organizationId: "org", origin: "http://127.0.0.1:4100", reviewed: { sources: [], compiler: { version: "", sha256: "", integrity: "" }, externalGraphs: [] } };
    const pending = startOwnedCheckoutWorker(input as Parameters<typeof startOwnedCheckoutWorker>[0]); const outcome = pending.then(value => ({ value }), error => ({ error })); await vi.advanceTimersByTimeAsync(12001);
    const result = await outcome; expect(result).toHaveProperty("value"); if (!("value" in result)) throw new Error("bootstrap_not_sent_before_wait");
    expect(state.sent).toHaveLength(1); expect(state.deleted).toHaveLength(0); await result.value.stop(); expect(child.exitCode).toBe(0); expect(state.deleted).toHaveLength(1);
  });
});
