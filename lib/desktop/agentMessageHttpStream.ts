import "server-only";
import { AGENT_STREAM_CONTENT_TYPE, MAX_AGENT_STREAM_FRAME_BYTES, isAgentMessageReply, type AgentMessageStreamEvent } from "./agentMessageStreamProtocol";

/** Authentication/tenant/body validation occurs before this is constructed.
 * A slow/disconnected reader aborts inference; uncertainty never releases holds.
 * No underlying exception, prompt, provider metadata or tool argument is emitted
 * as a draft. Final proposals retain the existing persisted approval boundary. */
export function agentMessageHttpStream(
  requestSignal: AbortSignal,
  execute: (streaming: { abortSignal: AbortSignal; onDraft: (text: string) => void }) => Promise<Response>,
): Response {
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, requestSignal]);
  const encoder = new TextEncoder();
  let stopped = false;
  const body = new ReadableStream<Uint8Array>({
    start(output) {
      const send = (event: AgentMessageStreamEvent) => {
        signal.throwIfAborted();
        const bytes = encoder.encode(JSON.stringify(event) + "\n");
        if (bytes.byteLength > MAX_AGENT_STREAM_FRAME_BYTES || bytes.byteLength > (output.desiredSize ?? 0)) {
          controller.abort(); throw new Error("agent_stream_backpressure");
        }
        output.enqueue(bytes);
      };
      let draft = "";
      void execute({ abortSignal: signal, onDraft(text) {
        signal.throwIfAborted();
        if (text === "") { draft = ""; send({ type: "draft_reset" }); }
        else if (text.startsWith(draft)) {
          const delta = text.slice(draft.length); draft = text;
          if (delta) send({ type: "draft_delta", text: delta });
        }
      } }).then(async response => {
        signal.throwIfAborted();
        const value = await response.json();
        if (!response.ok || value?.ok !== true || !isAgentMessageReply(value.data)) throw new Error("agent_stream_invalid_result");
        send({ type: "result", data: value.data });
      }).catch(() => {
        if (!stopped && !signal.aborted) {
          try { send({ type: "error", error: "agent_stream_interrupted" }); } catch { /* already canceled/overflowed */ }
        }
      }).finally(() => {
        if (!stopped) { stopped = true; output.close(); }
        controller.abort();
      });
    },
    cancel() { stopped = true; controller.abort(); },
  }, { highWaterMark: MAX_AGENT_STREAM_FRAME_BYTES, size: chunk => chunk.byteLength });
  return new Response(body, { headers: {
    "content-type": `${AGENT_STREAM_CONTENT_TYPE}; charset=utf-8`,
    "cache-control": "no-store, no-transform", "x-content-type-options": "nosniff",
  } });
}
