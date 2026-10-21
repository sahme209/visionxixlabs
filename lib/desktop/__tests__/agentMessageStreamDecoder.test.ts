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
