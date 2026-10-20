/* eslint-disable @typescript-eslint/no-require-imports -- Fixed loopback proxy policy; transport is injected for tests. */
'use strict';
const { allowedRequest, endpoint } = require('./ownedWebsitePolicy.cjs');
/** Preserve every present hash input, or refuse the whole request. No partial
 * fallback, credentials, arbitrary headers or destination selectors. */
function frameworkHeaders(headers) {
  const limits = { rsc: 1, 'next-router-state-tree': 40000, 'next-router-prefetch': 1, 'next-router-segment-prefetch': 4096, 'next-url': 128 };
  const result = {};
  for (const [key, limit] of Object.entries(limits)) {
    const descriptor = Object.getOwnPropertyDescriptor(headers, key);
    if (!descriptor) { if (key in headers) throw Error('website_proxy_framework_header'); continue; }
    const value = descriptor.value;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || typeof value !== 'string' || value.length === 0 || value.length > limit || /[\x00-\x1f\x7f]/.test(value)) throw Error('website_proxy_framework_header');
    if (key === 'rsc' && value !== '1' || key === 'next-router-prefetch' && !['1', '2', '3'].includes(value) || key === 'next-url' && !['/', '/product', '/docs/approval-workflow'].includes(value)) throw Error('website_proxy_framework_header');
    Object.defineProperty(result, key, { value, enumerable: true });
  }
  if (Object.keys(result).length && result.rsc !== '1') throw Error('website_proxy_framework_header');
  return result;
}
function createProxyTransport({ origin, appPort, assets, request, isStopping = () => false, onEvent = () => {} }) {
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
    let closed = false, upstream, response, script = false, scriptComplete = false, scriptCategory = 'other', successfulJavaScript = false;
    const scriptEvent = name => { if (script) onEvent(`script_${scriptCategory}_${name}`); };
    function cancel() {
      if (closed) return; closed = true; onEvent('request_cancelled');
      if (script) { onEvent('script_cancelled'); if (!scriptComplete) { scriptEvent('cancelled'); scriptEvent(successfulJavaScript ? 'cancelled_successful_js' : 'cancelled_other'); } }
      for (const stream of [upstream, response, req, res]) destroy(stream);
    }
    for (const stream of [req, res]) stream.on('error', cancel);
    req.on('aborted', cancel);
    req.on('close', () => { if (req.aborted || !req.complete) cancel(); });
    res.on('close', () => { if (!res.writableEnded) cancel(); });
    res.on('finish', () => { if (script && !closed && !scriptComplete) { scriptComplete = true; onEvent('script_complete'); scriptEvent('complete'); } });
    let url, framework;
    try { url = new URL(req.url); framework = frameworkHeaders(req.headers); } catch { /* denied below */ }
    if (isStopping() || !framework || !url || url.origin !== origin || url.username || url.password || url.hash || !allowedRequest({ method: req.method, raw: `${url.pathname}${url.search}`, origin, assets })) {
      onEvent('denied');
      if (!closed && !res.destroyed) { try { res.writeHead(403).end(); } catch { cancel(); } }
      return;
    }
    try {
      if (closed || req.destroyed || res.destroyed) { cancel(); return; }
      script = url.pathname.startsWith('/_next/static/') && url.pathname.endsWith('.js');
      if (script) {
        scriptCategory = ({ '/_next/static/chunks/webpack.js': 'webpack', '/_next/static/chunks/main-app.js': 'main_app', '/_next/static/chunks/app/page.js': 'app_page', '/_next/static/chunks/app/layout.js': 'app_layout' })[url.pathname] ?? 'other';
        onEvent('script_accepted'); scriptEvent('accepted');
      }
      upstream = request({ hostname: '127.0.0.1', port: appPort, path: `${url.pathname}${url.search}`, method: req.method, agent: false, headers: { host: `127.0.0.1:${appPort}`, accept: req.headers.accept ?? '*/*', ...framework } }, reply => {
        response = reply;
        if (script) {
          onEvent('script_response'); scriptEvent('response');
          const statusClass = Number.isInteger(reply.statusCode) && reply.statusCode >= 200 && reply.statusCode <= 599 ? `${Math.floor(reply.statusCode / 100)}xx` : 'other';
          const contentType = reply.headers?.['content-type'];
          const javascript = typeof contentType === 'string' && ['application/javascript', 'text/javascript', 'application/ecmascript', 'text/ecmascript'].includes(contentType.split(';')[0].trim().toLowerCase());
          successfulJavaScript = statusClass === '2xx' && javascript;
          scriptEvent(`status_${statusClass}`); scriptEvent(javascript ? 'mime_js' : 'mime_other');
        }
        reply.on('error', cancel); reply.on('aborted', cancel);
        reply.on('close', () => { if (!reply.complete) cancel(); });
        if (closed || res.destroyed) { destroy(reply); return; }
        try { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); } catch { cancel(); }
      });
      upstream.on('error', cancel);
      upstream.on('close', () => { if (!response) cancel(); });
      upstream.setTimeout(30_000, () => { if (!closed) { onEvent('upstream_timeout'); if (script) onEvent('script_upstream_timeout'); } cancel(); });
      if (closed) destroy(upstream); else upstream.end();
    } catch { cancel(); }
  }
  return { request: handle, connection, connect: (_req, socket) => refuseSocket(socket, true), upgrade: (_req, socket) => refuseSocket(socket, false), clientError: (_error, socket) => { onEvent('client_parse_error'); refuseSocket(socket, false); } };
}
module.exports = { createProxyTransport, frameworkHeaders };
