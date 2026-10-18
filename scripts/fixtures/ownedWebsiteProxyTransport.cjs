/* eslint-disable @typescript-eslint/no-require-imports -- Fixed loopback proxy policy; transport is injected for tests. */
'use strict';
const { allowedRequest, endpoint } = require('./ownedWebsitePolicy.cjs');
function createProxyTransport({ origin, appPort, assets, request, onEvent = () => {} }) {
  if (origin !== endpoint(appPort)) throw Error('website_proxy_origin');
  const watched = new WeakSet();
  const destroy = stream => { if (stream && !stream.destroyed) stream.destroy(); };
  function connection(socket) {
    if (watched.has(socket)) return;
    watched.add(socket);
    socket.on('error', () => { onEvent('socket_error'); destroy(socket); });
  }
  function refuseSocket(socket, reply) {
    connection(socket); onEvent('denied');
    if (socket.destroyed) return;
    try { if (reply) socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); else destroy(socket); }
    catch { onEvent('socket_write_error'); destroy(socket); }
  }
  function handle(req, res) {
    let closed = false, upstream, response;
    function cancel() {
      if (closed) return; closed = true; onEvent('request_cancelled');
      for (const stream of [upstream, response, req, res]) destroy(stream);
    }
    for (const stream of [req, res]) stream.on('error', cancel);
    req.on('aborted', cancel);
    req.on('close', () => { if (req.aborted || !req.complete) cancel(); });
    res.on('close', () => { if (!res.writableEnded) cancel(); });
    let url;
    try { url = new URL(req.url); } catch { /* denied below */ }
    if (!url || url.origin !== origin || url.username || url.password || url.hash || !allowedRequest({ method: req.method, raw: `${url.pathname}${url.search}`, origin, assets })) {
      onEvent('denied');
      if (!closed && !res.destroyed) { try { res.writeHead(403).end(); } catch { cancel(); } }
      return;
    }
    try {
      if (closed || req.destroyed || res.destroyed) { cancel(); return; }
      upstream = request({ hostname: '127.0.0.1', port: appPort, path: `${url.pathname}${url.search}`, method: req.method, agent: false, headers: { host: `127.0.0.1:${appPort}`, accept: req.headers.accept ?? '*/*', ...(req.headers.rsc === '1' ? { rsc: '1' } : {}) } }, reply => {
        response = reply;
        reply.on('error', cancel); reply.on('aborted', cancel);
        reply.on('close', () => { if (!reply.complete) cancel(); });
        if (closed || res.destroyed) { destroy(reply); return; }
        try { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); } catch { cancel(); }
      });
      upstream.on('error', cancel);
      upstream.on('close', () => { if (!response) cancel(); });
      upstream.setTimeout(30_000, cancel);
      if (closed) destroy(upstream); else upstream.end();
    } catch { cancel(); }
  }
  return { request: handle, connection, connect: (_req, socket) => refuseSocket(socket, true), upgrade: (_req, socket) => refuseSocket(socket, false), clientError: (_error, socket) => { onEvent('client_parse_error'); refuseSocket(socket, false); } };
}
module.exports = { createProxyTransport };
