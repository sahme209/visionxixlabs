import { AGENT_STREAM_CONTENT_TYPE, MAX_AGENT_STREAM_BYTES, MAX_AGENT_STREAM_FRAME_BYTES, isAgentMessageReply, type AgentMessageReply } from "../../../lib/desktop/agentMessageStreamProtocol";

/** Decode bounded UTF-8 NDJSON; only a validated terminal event grants a reply.
 * No retry or JSON fallback request can duplicate a paid dispatch. */
export async function readAgentMessageStream(response: Response, onDraft: (text: string) => void, signal: AbortSignal): Promise<AgentMessageReply> {
  if (response.headers.get("content-type")?.split(";")[0] !== AGENT_STREAM_CONTENT_TYPE || !response.body) throw new Error("agent_stream_unavailable");
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  let buffer = "", draft = "", bytes = 0, events = 0, terminal: AgentMessageReply | undefined;
  try {
    while (true) {
      signal.throwIfAborted();
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) { buffer += decoder.decode(); break; }
      bytes += next.value.byteLength;
      if (bytes > MAX_AGENT_STREAM_BYTES) throw new Error("agent_stream_limit");
      buffer += decoder.decode(next.value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        if (new TextEncoder().encode(line).byteLength > MAX_AGENT_STREAM_FRAME_BYTES || ++events > 16_384 || terminal) throw new Error("agent_stream_invalid");
        const event = JSON.parse(line);
        if (event?.type === "draft_reset") { draft = ""; onDraft(draft); }
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
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
