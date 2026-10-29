import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ decide: vi.fn(), notify: vi.fn(), record: vi.fn(), stored: undefined as unknown }));
vi.mock("../../../desktop/src/lib/desktopClient", () => ({ desktopClient: { hasAuth: () => true, v1DecideApproval: m.decide } }));
vi.mock("../../../desktop/src/lib/notifications", () => ({ notifyResult: m.notify }));
vi.mock("../../../desktop/src/lib/voteHistory", () => ({ recordVote: m.record }));
vi.mock("@tauri-apps/plugin-store", () => ({ load: async () => ({ get: async () => m.stored, set: async (_: string, value: unknown) => { m.stored = value; }, save: async () => undefined }) }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); m.stored = []; vi.stubGlobal("window", { __TAURI_INTERNALS__: {} }); });
afterEach(() => vi.unstubAllGlobals());
const vote = (runId: string) => ({ runId, decision: "approved" as const, approverUserId: "synthetic_actor", source: "tray" as const });
const delivered = { ok: true, data: { isTerminal: false, snapshotStatus: "pending", approvedCount: 1, rejectedCount: 0, requiredApprovers: 2 } };
function deferred() { let resolve!: (value: unknown) => void; const promise = new Promise(resolveValue => { resolve = resolveValue; }); return { promise, resolve }; }
it("retains a newly enqueued vote while a prior drain is awaiting the service", async () => {
 const { enqueueVote, drainVoteQueue } = await import("../../../desktop/src/lib/voteQueue");
 await enqueueVote(vote("first")); const started = deferred(), reply = deferred();
 m.decide.mockImplementation(() => { started.resolve(undefined); return reply.promise; });
 const draining = drainVoteQueue(); await started.promise; await enqueueVote(vote("second")); reply.resolve(delivered); await draining;
 expect((m.stored as Array<{runId:string}>).map(v => v.runId)).toEqual(["second"]);
 expect(m.decide).toHaveBeenCalledTimes(1);
});
it("coalesces concurrent ambient drains into one in-flight submission", async () => {
 const { enqueueVote, drainVoteQueue } = await import("../../../desktop/src/lib/voteQueue");
 await enqueueVote(vote("first")); const started = deferred(), reply = deferred();
 m.decide.mockImplementation(() => { started.resolve(undefined); return reply.promise; });
 const first = drainVoteQueue(); await started.promise; const second = drainVoteQueue(); await Promise.resolve();
 reply.resolve(delivered); await Promise.all([first, second]); expect(m.decide).toHaveBeenCalledTimes(1); expect(m.stored).toEqual([]);
});

it("keeps transient failures with backoff while preserving newly queued work", async () => {
 const { enqueueVote, drainVoteQueue } = await import("../../../desktop/src/lib/voteQueue");
 await enqueueVote(vote("first")); const started = deferred(), reply = deferred();
 m.decide.mockImplementation(() => { started.resolve(undefined); return reply.promise; });
 const draining = drainVoteQueue(); await started.promise; await enqueueVote(vote("second")); reply.resolve({ok:false,error:"synthetic_offline"}); await draining;
 expect(m.stored).toMatchObject([{runId:"second",attempts:0},{runId:"first",attempts:1,lastError:"synthetic_offline"}]);
});
it("does not collide identities for repeated clicks in the same millisecond", async () => {
 const { enqueueVote } = await import("../../../desktop/src/lib/voteQueue");
 const clock = vi.spyOn(Date,"now").mockReturnValue(123);try {await enqueueVote(vote("first"));await enqueueVote(vote("first"));}finally{clock.mockRestore();}
 expect(new Set((m.stored as Array<{localId:string}>).map(v=>v.localId)).size).toBe(2);
});
it("releases the drain lock after an unexpected client rejection",async()=>{
 const {enqueueVote,drainVoteQueue}=await import("../../../desktop/src/lib/voteQueue");await enqueueVote(vote("first"));m.decide.mockRejectedValueOnce(new Error("synthetic transport"));
 await expect(drainVoteQueue()).rejects.toThrow("synthetic transport");m.decide.mockResolvedValue(delivered);await drainVoteQueue();expect(m.decide).toHaveBeenCalledTimes(2);expect(m.stored).toEqual([]);
});
