/** Direct server adapter transport only. This grants no governed admission. */
import "server-only";
import { denyIsolatedExternalIO } from "@/lib/billing/isolatedApplication/runtime";
import { AIProviderError, type AIRequestOptions, type AIStreamChunk, type AITextResponse } from "../AIProvider";
import { classifyHttpError } from "../aiFetch";
import { OpenAICompatProvider } from "./openaiCompat";

/** Deliberately restricted to the two fixed vendor origins; other compatible
 * providers retain their buffered transport and configuration behavior. */
export class DirectChatStreamProvider extends OpenAICompatProvider {
  override async *streamText(prompt: string, options?: AIRequestOptions): AsyncGenerator<AIStreamChunk> {
    denyIsolatedExternalIO();
    const fail = (message: string) => new AIProviderError({ provider: this.name, kind: "bad_response", message, retryable: false });
    const origin = this.name === "openai" ? "https://api.openai.com/v1" : this.name === "xai" ? "https://api.x.ai/v1" : null;
    if (!origin || this.cfg.baseUrl !== origin) throw fail("unsupported direct stream endpoint");
    if (!this.isConfigured()) throw new AIProviderError({ provider: this.name, kind: "not_configured", message: "provider not configured" });
    const controller = new AbortController();
    const abort = () => controller.abort();
    const timeout = setTimeout(abort, options?.timeoutMs ?? 30_000);
    options?.abortSignal?.addEventListener("abort", abort, { once: true });
    if (options?.abortSignal?.aborted) abort();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const cancel = () => { void reader?.cancel().catch(() => {}); };
    controller.signal.addEventListener("abort", cancel);
    let finish: AITextResponse["finishReason"] | undefined;
    let usage: AITextResponse["usage"] = null;
    let total = 0, output = 0, eventSize = 0, pending = "", data: string[] = [];
    const decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      controller.signal.throwIfAborted();
      const res = await fetch(`${origin}/chat/completions`, {
        method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
        headers: { "content-type": "application/json", accept: "text/event-stream", ...this.buildHeaders() },
        body: JSON.stringify({ ...this.chatBody(prompt, options), stream: true, stream_options: { include_usage: true } }),
      });
      reader = res.body?.getReader();
      controller.signal.throwIfAborted();
      if (!res.ok) throw classifyHttpError({ provider: this.name, status: res.status, latencyMs: 0 });
      if (!reader || res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/event-stream") throw fail("expected SSE response");
      while (true) {
        const part = await reader.read();
        controller.signal.throwIfAborted();
        if (part.done) throw fail("truncated provider stream");
        total += part.value.byteLength;
        if (total > 8 * 1024 * 1024) throw fail("provider stream too large");
        try { pending += decoder.decode(part.value, { stream: true }).replace(/\r\n/g, "\n"); }
        catch { throw fail("invalid stream encoding"); }
        let boundary: number;
        while ((boundary = pending.indexOf("\n")) !== -1) {
          controller.signal.throwIfAborted();
          const line = pending.slice(0, boundary).replace(/\r$/, "");
          pending = pending.slice(boundary + 1);
          if (line.length > 64 * 1024) throw fail("SSE line too large");
          if (line.startsWith("data:")) {
            const value = line.slice(5).replace(/^ /, "");
            data.push(value); eventSize += value.length + 1;
          }
          if (eventSize > 64 * 1024) throw fail("SSE event too large");
          if (line !== "" || !data.length) continue;
          const payload = data.join("\n"); data = []; eventSize = 0;
          if (payload === "[DONE]") {
            if (!finish) throw fail("missing stream finish reason");
            controller.signal.throwIfAborted();
            yield { text: "", done: true, finishReason: finish, usage };
            return;
          }
          let event;
          try { event = JSON.parse(payload); } catch { throw fail("malformed SSE JSON"); }
          if (!event || typeof event !== "object" || event.error || !Array.isArray(event.choices)) throw fail("invalid provider event");
          if (event.usage != null) {
            const u = event.usage;
            if (![u.prompt_tokens, u.completion_tokens, u.total_tokens].every(v => Number.isSafeInteger(v) && v >= 0)) throw fail("invalid provider usage");
            usage = { promptTokens: u.prompt_tokens, completionTokens: u.completion_tokens, totalTokens: u.total_tokens };
          }
          for (const choice of event.choices) {
            if (!choice || typeof choice !== "object" || !choice.delta || typeof choice.delta !== "object") throw fail("invalid stream choice");
            if (choice.index !== 0) throw fail("unexpected stream choice");
            const text = choice.delta?.content;
            if (text != null && typeof text !== "string") throw fail("invalid text delta");
            if (finish && (text || choice.finish_reason)) throw fail("delta after finish");
            if (text) {
              output += text.length;
              if (output > 1024 * 1024) throw fail("stream output too large");
              controller.signal.throwIfAborted();
              yield { text, done: false };
              // next() resumes inside this event; buffered bytes must not
              // outlive cancellation while the consumer held the delta.
              controller.signal.throwIfAborted();
            }
            if (choice.finish_reason != null) {
              finish = ({ stop: "stop", length: "length", content_filter: "filter", tool_calls: "stop", function_call: "stop" } as const)[choice.finish_reason as "stop"] ?? "unknown";
            }
          }
        }
        if (pending.length > 64 * 1024) throw fail("SSE line too large");
      }
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError({ provider: this.name, kind: controller.signal.aborted ? "timeout" : "network", message: controller.signal.aborted ? "provider stream aborted" : "provider stream failed", retryable: false });
    } finally {
      clearTimeout(timeout);
      options?.abortSignal?.removeEventListener("abort", abort);
      controller.signal.removeEventListener("abort", cancel);
      controller.abort();
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
  }
}
