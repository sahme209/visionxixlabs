import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const state = vi.hoisted(() => ({ fork: vi.fn(), deleted: [] as string[], sent: [] as unknown[], child: null as null | { exitCode: number | null; kill(signal: string): boolean }, journal: [] as unknown[] }));
vi.mock("node:child_process", () => ({ fork: state.fork }));
vi.mock("node:fs", () => ({ mkdirSync: () => {}, readFileSync: () => "safe", symlinkSync: () => {}, rmSync: (path: string) => state.deleted.push(path), lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => false, uid: process.getuid?.(), mode: 0o700 }), realpathSync: (path: string) => path }));
vi.mock("./fixtures/newTestChildEnvironment", () => ({ newTestPrismaEnvironment: () => ({}) }));
vi.mock("./fixtures/ownedCheckoutLaunchPolicy", () => ({ ownedCheckoutLaunchPolicy: () => ({ env: { NODE_ENV: "development" }, revalidate: () => {} }) }));
vi.mock("./fixtures/ownedCheckoutProcess", async original => {
  const actual = await original<typeof import("./fixtures/ownedCheckoutProcess")>();
  const owner = { pid: 12345, group: 12345, start: "100", state: "S", executable: "/inert/node" };
  return { ...actual, ownedCheckoutChild: (...args: Parameters<typeof actual.ownedCheckoutChild>) => actual.ownedCheckoutChild(...args.slice(0, 4) as [typeof args[0], typeof args[1], typeof args[2], typeof args[3]], {
    canonical: () => owner.executable, parentGroup: () => 1, snapshot: () => owner, members: () => state.child?.exitCode === null ? [owner] : [], signal: (_group, signal) => { state.child!.kill(signal); }, persist: (_directory, _role, row) => { state.journal.push(structuredClone(row)); },
  }) };
});
vi.mock("./fixtures/ownedCheckoutWorkerBundle", () => ({ assertSyntheticSupervisor: () => {}, verifyOwnedBytes: () => {}, verifyOwnedOutputTree: () => {}, buildOwnedWorker: async () => ({ entry: "/owned/compiled/entry.js", output: "/owned/compiled", outputDigest: "synthetic", receipt: { sources: [{ path: "lib/entry.ts", sha256: "synthetic" }], outputs: [{ path: "lib/entry.js", sha256: "synthetic" }] } }) }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); state.deleted = []; state.sent = []; state.journal = []; state.child = null; });
describe("owned supervisor process ownership (literal child stub; no spawn/build/socket)", () => {
  it("registers an isolated group, sends bootstrap before ready, shares stop and awaits exact exit before deleting artifacts", async () => {
    const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null as number | null, signalCode: null as string | null, stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => { child.exitCode = 0; child.emit("exit", 0); return true; }, send: (message: {env: {AXIOM_OWNED_CHECKOUT_SESSION: string}}) => { state.sent.push(message); child.emit("message", { kind: "owned_worker_ready", session: message.env.AXIOM_OWNED_CHECKOUT_SESSION, pid: 12345 }); return true; } }); state.child = child;
    state.fork.mockImplementation(() => { queueMicrotask(() => child.emit("spawn")); return child; });
    const { startOwnedCheckoutWorker } = await import("./fixtures/ownedCheckoutWorkerSupervisor");
    const query = vi.fn<Parameters<typeof startOwnedCheckoutWorker>[0]["db"]["$queryRawUnsafe"]>(); query.mockResolvedValue([{ id: "runtime" }]);
    const input: Parameters<typeof startOwnedCheckoutWorker>[0] = { db: { $queryRawUnsafe: query }, databaseUrl: "postgresql://owned", runtimeId: "runtime", organizationId: "org", origin: "http://127.0.0.1:4100", reviewed: { sources: [], tooling: [], configuration: [], compiler: { version: "", sha256: "", integrity: "" }, externalGraphs: [] } };
    const result = await startOwnedCheckoutWorker(input);
    expect(state.fork.mock.calls[0][2].detached).toBe(true); expect(state.sent).toHaveLength(1); expect(state.journal).toMatchObject([{ state: "pending" }, { state: "pending" }, { state: "registered" }]); expect(state.deleted).toHaveLength(0);
    const first = result.stop(); expect(result.stop()).toBe(first); await first; expect(child.exitCode).toBe(0); expect(state.deleted).toHaveLength(1);
  });
});
