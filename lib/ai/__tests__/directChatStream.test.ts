import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider } from "../providers/OpenAIProvider";
import { XAIProvider } from "../providers/XAIProvider";
const packet = (text: string) => new TextEncoder().encode(text);
const delta = (text: string) => `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] })}\r\n\r\n`;
const end = 'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}\n\ndata: [DONE]\n\n';
afterEach(() => vi.unstubAllGlobals());
describe.each([OpenAIProvider, XAIProvider])("direct streaming %s", Provider => {
  it("yields before later bytes arrive, preserves usage, and closes transport", async () => {
    let body!: ReadableStreamDefaultController<Uint8Array>;
    const cancel = vi.fn();
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ start(c) { body = c; }, cancel }), { headers: { 'content-type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', fetcher);
    const stream = new Provider({ apiKey: 'synthetic' }).streamText('test')[Symbol.asyncIterator]();
    const first = stream.next();
    await Promise.resolve();
    body.enqueue(packet(delta('one')));
    expect(await first).toEqual({ value: { text: 'one', done: false }, done: false });
    body.enqueue(packet(delta('two') + end));
    expect((await stream.next()).value).toEqual({ text: 'two', done: false });
    expect((await stream.next()).value).toEqual({ text: '', done: true, finishReason: 'stop', usage: { promptTokens: 2, completionTokens: 1, totalTokens: 3 } });
    await stream.next();
    expect(cancel).toHaveBeenCalled();
    const init = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init[1].redirect).toBe('error');
    expect(JSON.parse(init[1].body as string).stream).toBe(true);
  });
  it.each([delta('one') + delta('two') + end, delta('one') + end])('does not yield buffered deltas or terminal success after abort', async bytes => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(packet(bytes)); }, cancel }), { headers: { 'content-type': 'text/event-stream' } })));
    const controller = new AbortController();
    const stream = new Provider({ apiKey: 'synthetic' }).streamText('test', { abortSignal: controller.signal })[Symbol.asyncIterator]();
    expect((await stream.next()).value).toEqual({ text: 'one', done: false });
    controller.abort();
    await expect(stream.next()).rejects.toMatchObject({ kind: 'timeout', message: 'provider stream aborted' });
    expect((await stream.next()).done).toBe(true);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("aborts a pending body read and sanitizes errors", async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), { headers: { 'content-type': 'text/event-stream' } })));
    const controller = new AbortController();
    const stream = new Provider({ apiKey: 'synthetic' }).streamText('test', { abortSignal: controller.signal })[Symbol.asyncIterator]();
    const next = stream.next(); await Promise.resolve(); await Promise.resolve();
    controller.abort();
    await expect(next).rejects.toMatchObject({ kind: 'timeout', message: 'provider stream aborted' });
    expect(cancel).toHaveBeenCalled();
  });
  it.each(['data: nope\n\n', 'data: {"error":{"message":"secret"}}\n\n', delta('partial'), 'data: [DONE]\n\n', 'data: ' + 'x'.repeat(65537)])('rejects malformed, error, truncated and oversized streams', async bytes => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(packet(bytes)); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } })));
    await expect((async () => { for await (const _ of new Provider({ apiKey: 'synthetic' }).streamText('test')) { /* drain */ } })()).rejects.toMatchObject({ kind: 'bad_response' });
  });
  it('handles fragmented UTF-8 and SSE delimiters', async () => {
    const bytes = packet(delta('λ') + end);
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(new Uint8Array([byte])); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } })));
    const chunks = [];
    for await (const chunk of new Provider({ apiKey: 'synthetic' }).streamText('test')) chunks.push(chunk);
    expect(chunks[0]).toEqual({ text: 'λ', done: false });
    expect(chunks.at(-1)).toMatchObject({ done: true, finishReason: 'stop' });
  });
  it('times out after headers while waiting for body bytes', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), { headers: { 'content-type': 'text/event-stream' } })));
    const stream = new Provider({ apiKey: 'synthetic' }).streamText('test', { timeoutMs: 10 })[Symbol.asyncIterator]();
    await expect(stream.next()).rejects.toMatchObject({ kind: 'timeout' });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it.each([401, 429, 503])('classifies HTTP %s and cancels unread response', async status => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ cancel }), { status })));
    const stream = new Provider({ apiKey: 'synthetic' }).streamText('test')[Symbol.asyncIterator]();
    await expect(stream.next()).rejects.toMatchObject({ kind: status === 401 ? 'invalid_key' : status === 429 ? 'rate_limited' : 'network' });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('cancels on consumer early return', async () => {
    const cancel = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(c) { c.enqueue(packet(delta('first'))); }, cancel }), { headers: { 'content-type': 'text/event-stream' } })));
    for await (const _ of new Provider({ apiKey: 'synthetic' }).streamText('test')) break;
    expect(cancel).toHaveBeenCalledOnce();
  });
});
