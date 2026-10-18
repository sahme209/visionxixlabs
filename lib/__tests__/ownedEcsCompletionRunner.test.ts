import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const seam = vi.hoisted(() => ({ mode: "success", sourceReads: 0, closed: 0, containerCleanup: 0 }));
const sourceCommit = "a".repeat(40);
vi.mock("../../scripts/fixtures/ecsCheckedInputDiagnostics.cjs", () => ({ default: { createDiagnostics: () => ({ directory: null, update() {}, write() {}, fail() {}, bindSource() {}, wireSummary() {}, containerFailure() {} }) } }));
vi.mock("../../scripts/rehearse-local-auth-http.mjs", () => ({ validateLocalAuthHttpTarget: (value: string) => value, assertNoRuntimeDotenv() {}, assertCommittedApplicationSource: () => { seam.sourceReads++; return seam.mode === "source_changed" && seam.sourceReads > 1 ? "b".repeat(40) : "a".repeat(40); } }));
vi.mock("../../scripts/run-owned-local-auth-http.mjs", () => ({ runOwnedLocalAuthHttp: async (_env: object, options: { signal: AbortSignal; rehearse(url: string): Promise<object> }) => {
  try { return { ...await options.rehearse("postgresql://fixture:owned@127.0.0.1:34568/axiom_auth_http_123456789abc"), fixtureCleanup: "owned_disposable_container_removed" }; }
  finally { seam.containerCleanup++; if (seam.mode === "container_cleanup_failure") throw new Error("owned_canary_container_cleanup"); }
} }));
vi.mock("../../scripts/fixtures/ownedEcsCheckedInputWire.mjs", () => ({ ECS_WIRE: { appId: 42, brokerKey: "AKIDOWNEDFIXTURE0001", secret: "owned-no-send" }, startOwnedEcsCheckedInputWire: async () => ({ origin: "http://127.0.0.1:34567", bindProcess() {}, control: async () => ({}), summary: () => ({ requests: [], guardProcesses: 1, violation: seam.mode === "wire_violation", pendingResponses: seam.mode === "pending_response" ? 1 : 0 }), close: async () => { seam.closed++; if (seam.mode === "wire_cleanup_failure") throw new Error("owned_canary_wire_cleanup"); } }) }));
vi.mock("node:child_process", () => ({ spawnSync: () => ({ status: 0 }), spawn: (_exe: string, _args: string[], options: { env: Record<string, string> }) => {
  const child = Object.assign(new EventEmitter(), { pid: 9001, connected: true, stdout: new EventEmitter(), stderr: new EventEmitter(), send: vi.fn(), finish() { child.emit("exit", seam.mode === "nonzero" ? 1 : 0, seam.mode === "signal" ? "SIGTERM" : null); child.stdout.emit("data", Buffer.from("late_stdout_canary")); child.emit("close", 0, null); } });
  const frame = { kind: "owned_ecs_control", proof: options.env.AXIOM_OWNED_ECS_PROOF, id: 1, command: "complete", sourceCommit: options.env.AXIOM_OWNED_ECS_SOURCE_COMMIT, receiptJson: JSON.stringify({ kind: "owned_ecs_checked_inputs", sourceCommit: options.env.AXIOM_OWNED_ECS_SOURCE_COMMIT }) };
  child.send.mockImplementation((_value: object, callback: (error?: Error) => void) => { if (seam.mode === "ack_throw") throw new Error("SECRET send error"); callback(seam.mode === "ack_callback_failure" ? new Error("SECRET callback") : undefined); });
  queueMicrotask(() => {
    child.stdout.emit("data", Buffer.from("structured_logger_canary\n"));
    if (["with_control", "pending_control_completion"].includes(seam.mode)) {
      const complete = { ...frame, id: 2 };
      if (seam.mode === "with_control") child.send.mockImplementation((value: { kind: string }, callback: (error?: Error) => void) => { callback(); if (value.kind === "owned_ecs_control_reply") queueMicrotask(() => { child.emit("message", complete); child.finish(); }); });
      child.emit("message", { kind: "owned_ecs_control", proof: frame.proof, id: 1, command: "summary" });
      if (seam.mode === "pending_control_completion") { child.emit("message", complete); child.finish(); }
      return;
    }
    if (seam.mode === "large_stream") child.stderr.emit("data", Buffer.alloc(128 * 1024));
    if (seam.mode !== "no_frame") child.emit("message", seam.mode === "bad_frame" ? { ...frame, extra: true } : seam.mode === "wrong_source" ? { ...frame, sourceCommit: "b".repeat(40) } : frame);
    if (seam.mode === "duplicate") child.emit("message", frame);
    if (seam.mode === "post_completion") child.emit("message", { kind: "owned_ecs_control", proof: frame.proof, id: 2, command: "summary" });
    if (seam.mode === "owner_abort") process.emit("SIGTERM");
    if (seam.mode !== "close_timeout") child.finish(); else child.emit("exit", 0, null);
    if (seam.mode === "late_protocol_after_close") child.emit("message", frame);
  }); return child;
} }));
import { runOwnedEcsCheckedInputs } from "../../scripts/run-owned-ecs-checked-inputs.mjs";
beforeEach(() => { seam.mode = "success"; seam.sourceReads = 0; seam.closed = 0; seam.containerCleanup = 0; vi.spyOn(process, "kill").mockImplementation(() => true); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it.each(["success", "with_control"])("actual owner wiring accepts %s only after complete/zeroexit/close/source/wire/container checks, ignoring raw stdout", async mode => {
  seam.mode = mode;
  const value = await runOwnedEcsCheckedInputs({ AXIOM_RUN_OWNED_ECS_CHECKED_INPUTS: "1" }); expect(value.kind).toBe("owned_ecs_checked_inputs"); expect(value.sourceCommit).toBe(sourceCommit); expect(seam.sourceReads).toBe(2); expect(seam.closed).toBe(1); expect(seam.containerCleanup).toBe(1);
});
it.each(["no_frame", "bad_frame", "duplicate", "post_completion", "wrong_source", "large_stream", "nonzero", "signal", "source_changed", "wire_violation", "pending_response", "owner_abort", "ack_callback_failure", "ack_throw", "late_protocol_after_close", "pending_control_completion", "wire_cleanup_failure", "container_cleanup_failure"])("actual owner wiring rejects %s even if child otherwise exits zero and always enters owned cleanup", async mode => {
  seam.mode = mode; await expect(runOwnedEcsCheckedInputs({ AXIOM_RUN_OWNED_ECS_CHECKED_INPUTS: "1" })).rejects.toThrow(); expect(seam.closed).toBe(1); expect(seam.containerCleanup).toBe(1);
});
it("bounds child-close wait once and retains cleanup failure rather than accepting a completed candidate", async () => {
  vi.useFakeTimers(); seam.mode = "close_timeout"; const pending = runOwnedEcsCheckedInputs({ AXIOM_RUN_OWNED_ECS_CHECKED_INPUTS: "1" }); const checked = expect(pending).rejects.toThrow("owned_ecs_child_cleanup_unverified"); await vi.advanceTimersByTimeAsync(3001); await checked; expect(seam.closed).toBe(1); expect(seam.containerCleanup).toBe(1);
});
