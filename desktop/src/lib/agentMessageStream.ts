import { assertDesktopNotAborted } from "./abortSignal";
import { AGENT_STREAM_CONTENT_TYPE, MAX_AGENT_STREAM_BYTES, MAX_AGENT_STREAM_FRAME_BYTES, isAgentMessageReply, isAgentToolActivity, type AgentToolActivity, type AgentMessageReply } from "../../../lib/desktop/agentMessageStreamProtocol";

/** Decode bounded UTF-8 NDJSON; only a validated terminal event grants a reply.
 * No retry or JSON fallback request can duplicate a paid dispatch. */
export async function readAgentMessageStream(response: Response, onDraft: (text: string) => void, signal: AbortSignal, onActivity?: (activity: AgentToolActivity) => void): Promise<AgentMessageReply> {
  if (response.headers.get("content-type")?.split(";")[0] !== AGENT_STREAM_CONTENT_TYPE || !response.body) throw new Error("agent_stream_unavailable");
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  // Native transports and response adapters may not wire a caller's signal to
  // the body. Cancel the owned reader too, so Stop can release a pending read.
  const stopReading = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", stopReading, { once: true });
  let buffer = "", draft = "", bytes = 0, events = 0, terminal: AgentMessageReply | undefined;
  let activityStep = 0, activeTool: string | undefined;
  try {
    while (true) {
      assertDesktopNotAborted(signal);
      const next = await reader.read();
      assertDesktopNotAborted(signal);
      if (next.done) { buffer += decoder.decode(); break; }
      bytes += next.value.byteLength;
      if (bytes > MAX_AGENT_STREAM_BYTES) throw new Error("agent_stream_limit");
      buffer += decoder.decode(next.value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        assertDesktopNotAborted(signal);
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (new TextEncoder().encode(line).byteLength > MAX_AGENT_STREAM_FRAME_BYTES || ++events > 16_384 || terminal) throw new Error("agent_stream_invalid");
        const event = JSON.parse(line);
        if (event?.type === "tool_activity" && isAgentToolActivity(event.activity)) {
          const activity = event.activity;
          if (activity.state === "running") {
            if (activeTool !== undefined || activity.step !== activityStep + 1) throw new Error("agent_stream_invalid");
            activityStep = activity.step; activeTool = activity.toolName;
          } else {
            if (activity.step !== activityStep || activeTool !== activity.toolName) throw new Error("agent_stream_invalid");
            activeTool = undefined;
          }
          onActivity?.(activity);
        } else if (event?.type === "draft_reset") { draft = ""; onDraft(draft); }
        else if (event?.type === "draft_delta" && typeof event.text === "string" && event.text.length > 0) {
          draft += event.text;
          if (draft.length > 131_072) throw new Error("agent_stream_limit");
          onDraft(draft);
        } else if (event?.type === "result" && isAgentMessageReply(event.data)) terminal = event.data;
        else throw new Error("agent_stream_interrupted");
      }
      if (buffer.length > MAX_AGENT_STREAM_FRAME_BYTES) throw new Error("agent_stream_limit");
    }
    if (buffer !== "" || !terminal) throw new Error("agent_stream_interrupted");
    return terminal;
  } finally {
    signal.removeEventListener("abort", stopReading);
    // Closing the reader releases queued reads synchronously. The underlying
    // transport's cleanup acknowledgement can remain pending indefinitely.
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
