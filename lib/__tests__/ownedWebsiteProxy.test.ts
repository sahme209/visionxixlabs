import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const proxy = require("../../scripts/fixtures/ownedWebsiteProxyTransport.cjs");
class Stream extends EventEmitter {
  destroyed = false; writableEnded = false; complete = true; aborted = false;
  writeHead = vi.fn(() => this); end = vi.fn(() => { this.writableEnded = true; return this; });
  pipe = vi.fn(); setTimeout = vi.fn((duration: number, callback: () => void) => { void duration; void callback; });
  destroy = vi.fn(() => { if (!this.destroyed) { this.destroyed = true; this.emit("close"); } return this; });
}
function fixture(isStopping = () => false) {
  const upstream = new Stream(); let reply: (stream: Stream) => void = () => {};
  const request = vi.fn((_options: Record<string, unknown>, callback: (stream: Stream) => void) => { reply = callback; return upstream; });
  const events: string[] = [];
  const handler = proxy.createProxyTransport({ origin: "http://127.0.0.1:38001", appPort: 38001, assets: [], request, isStopping, onEvent: (event: string) => events.push(event) });
  const req = Object.assign(new Stream(), { method: "GET", url: "http://127.0.0.1:38001/product", headers: {} }); const res = new Stream();
  return { handler, req, res, upstream, request, events, reply: (value: Stream) => reply(value) };
}

describe("owned proxy stream lifecycle", () => {
  it("refuses otherwise allowed forwarding after the child enters stopping", () => {
    let stopping = false; const f = fixture(() => stopping);
    stopping = true; f.handler.request(f.req, f.res);
    expect(f.request).not.toHaveBeenCalled(); expect(f.res.writeHead).toHaveBeenCalledWith(403);
  });
  it("handles reset after CONNECT refusal without forwarding or throwing", () => {
    const f = fixture(); const socket = new Stream(); f.handler.connect(f.req, socket);
    expect(socket.end).toHaveBeenCalledWith("HTTP/1.1 403 Forbidden\r\n\r\n"); expect(() => socket.emit("error", Error("ECONNRESET"))).not.toThrow();
    expect(socket.destroy).toHaveBeenCalledOnce(); expect(f.request).not.toHaveBeenCalled();
  });
  it("does not write a denial after connection reset", () => {
    const f = fixture(); const socket = new Stream(); f.handler.connection(socket); socket.emit("error", Error("ECONNRESET")); f.handler.connect(f.req, socket);
    expect(socket.end).not.toHaveBeenCalled(); expect(f.request).not.toHaveBeenCalled();
  });
  it("handles upgrade/client-parser errors on only the owned socket", () => {
    const f = fixture(); const socket = new Stream(); f.handler.upgrade(f.req, socket); socket.emit("error", Error("ECONNRESET"));
    expect(socket.destroy).toHaveBeenCalledOnce(); f.handler.clientError(Error("parse"), socket); expect(f.request).not.toHaveBeenCalled();
  });
  it.each(["aborted", "error"])("client %s destroys both directions once and refuses late reply writes", event => {
    const f = fixture(); f.handler.request(f.req, f.res); f.req.emit(event, Error("reset")); f.req.emit(event, Error("again"));
    const response = new Stream(); f.reply(response);
    expect(f.upstream.destroy).toHaveBeenCalledOnce(); expect(f.res.destroy).toHaveBeenCalledOnce(); expect(response.destroy).toHaveBeenCalledOnce();
    expect(f.res.writeHead).not.toHaveBeenCalled(); expect(response.pipe).not.toHaveBeenCalled();
  });
  it.each(["error", "aborted"])("upstream %s during piping cancels owned streams", event => {
    const f = fixture(); f.handler.request(f.req, f.res); const response = Object.assign(new Stream(), { statusCode: 200, headers: {} }); f.reply(response);
    expect(response.pipe).toHaveBeenCalledWith(f.res); response.emit(event, Error("reset")); f.res.emit("error", Error("again"));
    expect(f.req.destroy).toHaveBeenCalledOnce(); expect(f.res.destroy).toHaveBeenCalledOnce(); expect(f.upstream.destroy).toHaveBeenCalledOnce(); expect(response.destroy).toHaveBeenCalledOnce();
  });
  it("treats an unfinished response close as cancellation without affecting completed request close", () => {
    const f = fixture(); f.handler.request(f.req, f.res); f.req.emit("close"); expect(f.upstream.destroy).not.toHaveBeenCalled();
    f.res.emit("close"); expect(f.upstream.destroy).toHaveBeenCalledOnce();
  });
  it("denies external/API/mutation requests before any upstream creation", () => {
    for (const change of [{ url: "https://external.invalid/" }, { url: "http://127.0.0.1:38001/api/auth/session" }, { method: "POST" }]) {
      const f = fixture(); Object.assign(f.req, change); f.handler.request(f.req, f.res); expect(f.request).not.toHaveBeenCalled(); expect(f.res.writeHead).toHaveBeenCalledWith(403);
      expect(() => f.res.emit("error", Error("ECONNRESET"))).not.toThrow();
    }
  });
});

it("forwards only the fixed app endpoint with no client credential headers", () => {
  const f = fixture(); f.req.headers = { authorization: "private", cookie: "private", host: "external.invalid" }; f.handler.request(f.req, f.res);
  expect(f.request.mock.calls[0][0]).toEqual({ hostname: "127.0.0.1", port: 38001, path: "/product", method: "GET", agent: false, headers: { host: "127.0.0.1:38001", accept: "*/*" } });
});
it("cancels premature upstream close whether before or after response headers", () => {
  const f = fixture(); f.handler.request(f.req, f.res); f.upstream.emit("close"); expect(f.res.destroy).toHaveBeenCalledOnce();
  const second = fixture(); second.handler.request(second.req, second.res); const response = Object.assign(new Stream(), { complete: false, statusCode: 200, headers: {} }); second.reply(response); response.emit("close"); expect(second.res.destroy).toHaveBeenCalledOnce();
});

it("counts accepted static JavaScript delivery without persisting request identity", () => {
  const f = fixture(); f.req.url = 'http://127.0.0.1:38001/_next/static/chunks/main-app.js?v=private';
  f.handler.request(f.req, f.res); const response = Object.assign(new Stream(), { statusCode: 200, headers: {} }); f.reply(response);
  f.res.writableEnded = true; f.res.emit('finish'); f.res.emit('finish'); f.res.emit('close');
  expect(f.events).toEqual(['script_accepted', 'script_response', 'script_complete']);
  expect(JSON.stringify(f.events)).not.toContain('private');
  expect(f.upstream.setTimeout.mock.calls[0][0]).toBe(30000);
});

it("counts upstream timeout and cancellation once and distinguishes it from reset", () => {
  const f = fixture(); f.req.url = 'http://127.0.0.1:38001/_next/static/chunks/main-app.js'; f.handler.request(f.req, f.res);
  const timeout = f.upstream.setTimeout.mock.calls[0][1] as () => void; timeout(); timeout(); f.req.emit('error', Error('private'));
  expect(f.events).toEqual(['script_accepted', 'upstream_timeout', 'script_upstream_timeout', 'request_cancelled', 'script_cancelled']);
  expect(f.upstream.destroy).toHaveBeenCalledOnce();
  const g = fixture(); g.req.url = f.req.url; g.handler.request(g.req, g.res); g.req.emit('aborted');
  expect(g.events).toEqual(['script_accepted', 'request_cancelled', 'script_cancelled']);
});

it("does not classify CSS, pages or denied scripts as accepted JavaScript", () => {
  for (const path of ['/product', '/_next/static/css/app.css', '/_next/static/chunks/app.js?unsupported=1']) {
    const f = fixture(); f.req.url = `http://127.0.0.1:38001${path}`; f.handler.request(f.req, f.res);
    expect(f.events).not.toContain('script_accepted');
  }
});
