import { describe, expect, it, vi } from "vitest";
import { readAgentMessageStream } from "../../../desktop/src/lib/agentMessageStream";
import { AGENT_STREAM_CONTENT_TYPE } from "../agentMessageStreamProtocol";

function response(events: unknown[], splitBytes = false) {
  const bytes = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join("\n") + "\n");
  return new Response(new ReadableStream({ start(output) {
    if (splitBytes) for (const byte of bytes) output.enqueue(new Uint8Array([byte]));
    else output.enqueue(bytes);
    output.close();
  } }), { headers: { "content-type": AGENT_STREAM_CONTENT_TYPE } });
}
const terminal = { type: "result", data: { reply: "done", proposal: null, usage: null } };
describe("desktop Agent stream decoder", () => {
  it("preserves split UTF-8, escapes and per-decision draft resets", async () => {
    const seen: string[] = [];
    const result = await readAgentMessageStream(response([
      { type: "draft_reset" }, { type: "draft_delta", text: "hé🙂\n" },
      { type: "draft_reset" }, { type: "draft_delta", text: "final draft" }, terminal,
    ], true), text => seen.push(text), new AbortController().signal);
    expect(seen).toEqual(["", "hé🙂\n", "", "final draft"]); expect(result.reply).toBe("done");
  });
  it.each([
    [{ type: "draft_delta", text: "unfinished" }],
    [{ type: "error", error: "agent_stream_interrupted" }],
    [terminal, terminal],
    [{ type: "result", data: { reply: "fake", proposal: { status: "executed" } } }],
    [{ type: "unknown" }],
  ].map(events => ({ events })))("refuses missing, duplicate or invalid completion %#", async ({ events }) => {
    await expect(readAgentMessageStream(response(events), () => undefined, new AbortController().signal)).rejects.toThrow();
  });
});

it("decodes without a native abort-check method and refuses aborted signals without a reason", async () => {
  const controller = new AbortController();
  Object.defineProperty(controller.signal, "throwIfAborted", { value: undefined });
  expect(await readAgentMessageStream(response([terminal]), vi.fn(), controller.signal)).toEqual(terminal.data);
  controller.abort(); Object.defineProperty(controller.signal, "reason", { value: undefined });
  await expect(readAgentMessageStream(response([terminal]), vi.fn(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
});
it("preserves a supplied cancellation reason instead of replacing it with the compatibility fallback", async () => {
  const controller = new AbortController(), reason = { code: "synthetic-user-cancellation" };
  Object.defineProperty(controller.signal, "throwIfAborted", { value: undefined });
  controller.abort(reason);
  await expect(readAgentMessageStream(response([terminal]), vi.fn(), controller.signal)).rejects.toBe(reason);
});

it("reports ordered tool activity without treating progress as a result or approval", async () => {
  const seen = vi.fn();
  const result = await readAgentMessageStream(response([
    {type: "tool_activity", activity: {step: 1, toolName: "read_github_file", state: "running"}},
    {type: "tool_activity", activity: {step: 1, toolName: "read_github_file", state: "completed"}},
    terminal,
  ]), vi.fn(), new AbortController().signal, seen);
  expect(seen.mock.calls.map(([event]) => event.state)).toEqual(["running", "completed"]);
  expect(result).toEqual(terminal.data);
});
it.each([
  [{step: 1, toolName: "read_github_file", state: "completed"}],
  [{step: 2, toolName: "read_github_file", state: "running"}],
  [{step: 1, toolName: "read_github_file", state: "running", args: {secret: "must not cross wire"}}],
  [{step: 1, toolName: "read_github_file", state: "running"}, {step: 1, toolName: "other_tool", state: "completed"}],
  [{step: 1, toolName: "read_github_file", state: "running"}, {step: 1, toolName: "read_github_file", state: "running"}],
].map(events => ({events})))("rejects malformed or reordered activity %#", async ({events}) => {
  await expect(readAgentMessageStream(response([...events.map(activity => ({type: "tool_activity", activity})), terminal]), vi.fn(), new AbortController().signal, vi.fn())).rejects.toThrow();
});

it("limits activity presentation to the registered read-only surface", async () => {
  const {AGENT_TOOL_ACTIVITY_LABELS, isAgentToolActivity} = await import("../agentMessageStreamProtocol");
  const {TOOL_REGISTRY} = await import("../../axiom/agentRuntime/tools");
  expect(Object.keys(AGENT_TOOL_ACTIVITY_LABELS).sort()).toEqual(TOOL_REGISTRY.filter(tool => tool.riskLevel === "low").map(tool => tool.name).sort());
  expect(isAgentToolActivity({step: 1, toolName: "trigger_aws_deploy", state: "running"})).toBe(false);
  expect(isAgentToolActivity({step: 9, toolName: "read_github_file", state: "running"})).toBe(false);
  expect(isAgentToolActivity({step: 1, toolName: "__proto__", state: "running"})).toBe(false);
});
