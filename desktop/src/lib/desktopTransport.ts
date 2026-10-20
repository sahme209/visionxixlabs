import { Channel, invoke } from "@tauri-apps/api/core";
import { MAX_AGENT_STREAM_BYTES } from "../../../lib/desktop/agentMessageStreamProtocol";

const API_ORIGIN = "https://visionxixlabs.com";
const nativeFetch = globalThis.fetch.bind(globalThis);
let bearerToken: string | undefined;
const activeStreamCancels = new Set<() => void>();

interface NativeHttpResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function apiPath(input: RequestInfo | URL): string | null {
  const raw = input instanceof Request ? input.url : String(input);
  if (raw.startsWith("/api/")) return raw;
  try {
    const url = new URL(raw);
    return url.origin === API_ORIGIN && url.pathname.startsWith("/api/")
      ? `${url.pathname}${url.search}`
      : null;
  } catch {
    return null;
  }
}

type NativeStreamEvent =
  | { kind: "headers"; status: number; headers: Record<string, string> }
  | { kind: "chunk"; sequence: number; bytes: number[] }
  | { kind: "end" }
  | { kind: "error" };
const MAX_STREAM_CHUNK_BYTES = 16 * 1024;
const MESSAGE_STREAM_PATH = /^\/api\/desktop\/agent\/conversations\/[A-Za-z0-9_-]{1,200}\/messages$/;

/** IPC provides one acknowledged chunk at a time. An acknowledgement is sent
 * only when the ReadableStream has capacity, so an unread response cannot grow
 * an unbounded JavaScript queue. Native cancellation is independent of reads. */
async function streamingFetch(request: { method: string; path: string; headers: Record<string, string>; body?: string }, signal?: AbortSignal | null): Promise<Response> {
  if (signal?.aborted) throw new DOMException("The request was canceled.", "AbortError");
  if (request.method !== "POST" || !MESSAGE_STREAM_PATH.test(request.path) || typeof request.body !== "string" || new TextEncoder().encode(request.body).byteLength > 512 * 1024) {
    throw new TypeError("The desktop app blocked an unsupported streaming request.");
  }
  const requestId = crypto.randomUUID();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let resolveHeaders!: (response: Response) => void;
  let rejectHeaders!: (reason: Error) => void;
  const response = new Promise<Response>((resolve, reject) => { resolveHeaders = resolve; rejectHeaders = reject; });
  let closed = false;
  let headersReceived = false;
  let registered = false;
  let cancellationRequested = false;
  let nextSequence = 0;
  let pendingAck: number | undefined;
  let totalBytes = 0;
  const cancelNative = () => {
    cancellationRequested = true;
    if (registered) void invoke("desktop_http_stream_cancel", { requestId }).catch(() => { /* native deadline remains a final bound */ });
  };
  const cleanup = () => { signal?.removeEventListener("abort", onAbort); activeStreamCancels.delete(onAbort); };
  const fail = (error = new Error("The Agent stream ended without a verified response.")) => {
    if (closed) return;
    closed = true;
    cleanup();
    cancelNative();
    if (!headersReceived) rejectHeaders(error);
    controller.error(error);
  };
  const onAbort = () => fail(new DOMException("The request was canceled.", "AbortError"));
  const acknowledge = () => {
    if (closed || pendingAck === undefined || (controller.desiredSize ?? 0) <= 0) return;
    const sequence = pendingAck;
    pendingAck = undefined;
    void invoke("desktop_http_stream_ack", { requestId, sequence }).catch(() => fail());
  };
  const body = new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
    pull() { acknowledge(); },
    cancel() {
      if (closed) return;
      closed = true;
      cleanup();
      cancelNative();
    },
  }, { highWaterMark: 1 });
  const onEvent = new Channel<NativeStreamEvent>(event => {
    if (closed) return;
    try {
      if (event.kind === "headers") {
        if (headersReceived || !Number.isInteger(event.status) || event.status < 200 || event.status > 599 || [204, 205, 304].includes(event.status)) { fail(); return; }
        const headers = new Headers(event.headers);
        const type = headers.get("content-type")?.split(";")[0]?.trim();
        if (type !== "application/x-ndjson" && type !== "application/json") { fail(); return; }
        const value = new Response(body, { status: event.status, headers });
        headersReceived = true;
        resolveHeaders(value);
      } else if (event.kind === "chunk") {
        if (!headersReceived || event.sequence !== nextSequence || pendingAck !== undefined || !Array.isArray(event.bytes) || !event.bytes.length || event.bytes.length > MAX_STREAM_CHUNK_BYTES || !event.bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) { fail(); return; }
        totalBytes += event.bytes.length;
        if (totalBytes > MAX_AGENT_STREAM_BYTES) { fail(); return; }
        nextSequence++;
        pendingAck = event.sequence;
        controller.enqueue(Uint8Array.from(event.bytes));
        acknowledge();
      } else if (event.kind === "end") {
        if (!headersReceived || pendingAck !== undefined) { fail(); return; }
        closed = true;
        cleanup();
        controller.close();
      } else { fail(); }
    } catch { fail(); }
  });
  activeStreamCancels.add(onAbort);
  signal?.addEventListener("abort", onAbort, { once: true });
  // Registration returns before native I/O starts. If abort arrives while IPC
  // registration is pending, repeat cancellation once its acknowledgement lands.
  void invoke("desktop_http_stream", { request, requestId, onEvent }).then(() => {
    registered = true;
    if (cancellationRequested) cancelNative();
  }).catch(() => fail());
  if (signal?.aborted) onAbort();
  return response;
}

export async function desktopFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const path = apiPath(input);
  if (!isTauriRuntime()) return nativeFetch(input, init);
  if (!path) {
    throw new TypeError("The desktop app blocked a request outside the approved product API origin.");
  }

  const sourceHeaders = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => sourceHeaders.set(key, value));
  const headers: Record<string, string> = {};
  sourceHeaders.forEach((value, key) => { headers[key] = value; });
  if (bearerToken && !sourceHeaders.has("authorization")) {
    headers.authorization = `Bearer ${bearerToken}`;
  }
  const body = typeof init.body === "string" ? init.body : undefined;
  const request = {
    method: init.method ?? (input instanceof Request ? input.method : "GET"),
    path, headers, body,
  };
  if (sourceHeaders.get("accept") === "application/x-ndjson") {
    return streamingFetch(request, init.signal ?? (input instanceof Request ? input.signal : undefined));
  }
  const result = await invoke<NativeHttpResponse>("desktop_http_request", { request });
  return new Response(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

export function setDesktopTransportCredential(token: string | undefined): void {
  if (token !== bearerToken) for (const cancel of activeStreamCancels) cancel();
  bearerToken = token;
}

/**
 * Legacy desktop screens still call browser-relative /api paths. Install one
 * narrow bridge at boot so those requests use the native allow-listed client
 * instead of resolving against tauri://localhost and throwing a URL error.
 */
export function installDesktopFetchBridge(): void {
  if (!isTauriRuntime()) return;
  globalThis.fetch = desktopFetch;
}
