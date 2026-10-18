/* eslint-disable @typescript-eslint/no-require-imports -- synchronous fixture-only preload before application/SDK imports */
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http'), https = require('node:https'), net = require('node:net');
const dns = require('node:dns'), dgram = require('node:dgram'), tls = require('node:tls'), http2 = require('node:http2');
const childProcess = require('node:child_process'), workerThreads = require('node:worker_threads');
const { syncBuiltinESMExports } = require('node:module');
const { urlToHttpOptions } = require('node:url');
const API = 'api.github.com', BUNDLE = 'owned-ecs-bundle.invalid';
const REPO = '/repos/github/artifact-attestations-workflows';
const SHA = 'cc78c9cd50c7bace6c3be36bbd22f2f1b5f8182b';
const SUBJECT = '06e6818324cb20e1ea6f22da7fb925323fb57251c98768c88b93872b50590f92';
const githubPaths = new Set([REPO, `${REPO}/actions/runs/10782915115`, `${REPO}/actions/runs/10782915115/attempts/1`, `${REPO}/contents/.github/workflows/ghcr-publish.yml?ref=${SHA}`, `${REPO}/attestations/sha256%3A${SUBJECT}?per_page=5`]);
const awsHosts = new Set(['sts.us-east-1.amazonaws.com', 'ecs.us-east-1.amazonaws.com', 'api.ecr.us-east-1.amazonaws.com']);
const guardSymbol = Symbol.for('axiom.owned.ecs.checked-input.guard');
function installOwnedEcsCheckedInputGuard({ origin, proof, announce = false }) {
  const owned = new URL(origin);
  assert.ok(owned.protocol === 'http:' && owned.hostname === '127.0.0.1' && /^[1-9][0-9]{0,4}$/.test(owned.port) && Number(owned.port) <= 65535 && owned.pathname === '/' && !owned.username && !owned.password && !owned.search && !owned.hash && /^[a-f0-9]{32}$/.test(proof), 'owned_ecs_guard_config_required');
  assert.ok(!globalThis[guardSymbol], 'owned_ecs_guard_already_installed');
  // Initialize only the process-owned standard streams before denying new pipe opens.
  void process.stdout; void process.stderr; void process.stdin;
  const originalRequest = http.request, originalFetch = globalThis.fetch, originalConnect = net.Socket.prototype.connect;
  let granted = 0, sequence = 0, denied = 0;
  const sockets = new WeakSet();
  function reject() { denied++; throw new Error('owned_ecs_egress_denied'); }
  function patch(object, names, replacement = reject) { for (const name of names) if (typeof object[name] === 'function') object[name] = replacement; }
  // Captured public DNS/Resolver/UDP calls still reach these lower native methods.
  // This is a trusted child, not an arbitrary-native-code/OS network sandbox.
  const cares = process.binding('cares_wrap'), udp = process.binding('udp_wrap').UDP.prototype, tcp = process.binding('tcp_wrap').TCP.prototype, pipe = process.binding('pipe_wrap').Pipe.prototype;
  patch(cares, ['getaddrinfo', 'getnameinfo']);
  // Promise DNS captures native functions lexically; reject request-wrap completion
  // registration before those captured functions can submit a native query.
  for (const name of ['GetAddrInfoReqWrap', 'GetNameInfoReqWrap', 'QueryReqWrap']) Object.defineProperty(cares[name].prototype, 'oncomplete', { configurable: false, set: reject, get: reject });
  patch(cares.ChannelWrap.prototype, Object.getOwnPropertyNames(cares.ChannelWrap.prototype).filter(name => name.startsWith('query') || name === 'getHostByAddr' || name === 'setServers' || name === 'setLocalAddress'));
  for (const object of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) patch(object, Object.getOwnPropertyNames(object).filter(name => /^(lookup|resolve|reverse|setServers)/.test(name)));
  patch(dgram, ['createSocket']); patch(dgram.Socket.prototype, ['send', 'bind', 'connect', 'addMembership', 'addSourceSpecificMembership']);
  patch(udp, ['send', 'send6', 'bind', 'bind6', 'connect', 'connect6', 'open', 'recvStart', 'addMembership', 'addSourceSpecificMembership']);
  const nativeTcpConnect = tcp.connect;
  tcp.connect = function (request, address, port) {
    if (address !== '127.0.0.1' || Number(port) !== Number(owned.port) || !sockets.has(this.owner)) { denied++; return process.binding('uv').UV_EPERM; }
    return nativeTcpConnect.call(this, request, address, port);
  };
  patch(tcp, ['connect6', 'open', 'bind', 'bind6', 'listen']); patch(pipe, ['connect', 'open', 'bind', 'listen']);
  net.Socket.prototype.connect = function (...args) {
    const first = Array.isArray(args[0]) ? args[0][0] : args[0];
    if (!granted || !first || typeof first !== 'object' || (first.host ?? first.hostname) !== '127.0.0.1' || Number(first.port) !== Number(owned.port) || first.path || first.lookup) return reject();
    sockets.add(this); return originalConnect.apply(this, args);
  };
  patch(tls, ['connect']); patch(http2, ['connect']); patch(net, ['createServer']);
  patch(childProcess, ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);
  patch(process.binding('process_wrap').Process.prototype, ['spawn']);
  patch(process.binding('spawn_sync'), ['spawn']);
  patch(workerThreads, ['Worker']);
  function headers(value) {
    const result = new Headers(value);
    for (const name of result.keys()) if (name.startsWith('x-axiom-') || ['cookie', 'proxy-authorization', 'proxy-connection'].includes(name)) return reject();
    return result;
  }
  function stamp(value, host) {
    const result = new Headers(value); result.set('x-axiom-fixture-guard', proof); result.set('x-axiom-original-host', host);
    result.set('x-axiom-fixture-process', String(process.pid)); result.set('x-axiom-fixture-sequence', String(++sequence));
    return Object.fromEntries(result);
  }
  function invoke(options, callback) {
    granted++;
    try { return originalRequest({ ...options, protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1', port: Number(owned.port), agent: false }, callback); }
    finally { granted--; }
  }
  function awsRequest(...args) {
    const first = args[0]; let options;
    if (typeof first === 'string' || first instanceof URL) {
      const url = new URL(first);
      if (String(first) !== url.href || url.username || url.password || url.hash || !awsHosts.has(url.hostname) || url.hostname !== url.host.replace(/:443$/, '')) return reject();
      options = { ...urlToHttpOptions(url), ...(args[1] && typeof args[1] === 'object' ? args[1] : {}) };
    } else if (first && typeof first === 'object' && !Array.isArray(first)) options = { ...first }; else return reject();
    const host = options.hostname ?? options.host;
    if (!awsHosts.has(host) || (options.host && options.host !== host) || (options.protocol && options.protocol !== 'https:') || Number(options.port ?? 443) !== 443 || options.method !== 'POST' || (options.path ?? '/') !== '/' || options.auth || options.socketPath || options.createConnection || options.lookup || options._defaultAgent || options.rejectUnauthorized === false || options.ca || options.cert || options.key || options.pfx || options.localAddress || options.family || options.servername && options.servername !== host) return reject();
    if (options.agent && (Object.getPrototypeOf(options.agent) !== https.Agent.prototype || ['addRequest', 'createSocket', 'createConnection'].some(name => Object.hasOwn(options.agent, name)) || ['host', 'hostname', 'port', 'path', 'lookup', 'createConnection'].some(name => options.agent.options?.[name] != null))) return reject();
    const checked = headers(options.headers);
    if (!/^AWS4-HMAC-SHA256 Credential=(AKIDOWNED|ASIAOWNED)[A-Z0-9]+\//.test(checked.get('authorization') ?? '') || checked.get('host') !== host) return reject();
    return invoke({ ...options, path: '/', headers: stamp(checked, host) }, args.findLast(value => typeof value === 'function'));
  }
  http.request = http.get = reject;
  https.request = awsRequest; https.get = reject;
  // A private dispatcher uses real native HTTP/IncomingMessage streaming. No SDK handler/Response mock.
  const privateDispatcher = { dispatch(options, handler) {
    if (String(options.origin) !== owned.origin || options.method !== 'GET' && options.method !== 'POST' || options.maxRedirections || options.upgrade) return reject();
    const pairs = Array.isArray(options.headers) && typeof options.headers[0] === 'string' ? Array.from({ length: options.headers.length / 2 }, (_, i) => [options.headers[i * 2], options.headers[i * 2 + 1]]) : options.headers;
    const h = new Headers(pairs);
    if (h.get('x-axiom-fixture-guard') !== proof || ![API, BUNDLE].includes(h.get('x-axiom-original-host'))) return reject();
    let request;
    try {
      request = invoke({ method: options.method, path: options.path, headers: Object.fromEntries(h) }, response => {
        response.pause();
        try {
          const resume = handler.onHeaders(response.statusCode, response.rawHeaders.map(value => Buffer.from(value)), () => response.resume(), response.statusMessage);
          response.on('data', chunk => { if (handler.onData(chunk) === false) response.pause(); });
          response.once('end', () => handler.onComplete([])); response.once('error', () => handler.onError(new Error('owned_ecs_fixture_stream_failed')));
          if (resume !== false) response.resume();
        } catch { response.destroy(); handler.onError(new Error('owned_ecs_fixture_headers_failed')); }
      });
      handler.onConnect(() => request.destroy(new Error('owned_ecs_fixture_aborted')), null);
      request.once('error', () => handler.onError(new Error('owned_ecs_fixture_transport_failed')));
      if (options.body == null) request.end();
      else if (typeof options.body === 'string' || Buffer.isBuffer(options.body) || options.body instanceof Uint8Array) request.end(options.body);
      else if (options.body[Symbol.asyncIterator]) void (async () => { try { for await (const chunk of options.body) { if (!Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array)) return reject(); request.write(chunk); } request.end(); } catch { request.destroy(new Error('owned_ecs_fixture_body_failed')); } })();
      else return reject();
      return true;
    } catch { request?.destroy(); return reject(); }
  }, close: async () => {}, destroy: async () => {} };
  const blockedDispatcher = Object.freeze({ dispatch: reject, close: async () => {}, destroy: async () => {} });
  for (const version of [1, 2]) Object.defineProperty(globalThis, Symbol.for(`undici.globalDispatcher.${version}`), { configurable: false, value: blockedDispatcher, writable: false });
  globalThis.fetch = async function (input, init = {}) {
    if (typeof input !== 'string' && !(input instanceof URL) || init.dispatcher || init.agent || init.redirect !== 'error' || init.credentials !== 'omit' || init.mode === 'no-cors' || init.referrer) return reject();
    const raw = String(input), url = new URL(raw), method = init.method ?? 'GET';
    if (raw !== url.href || url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443') || raw.includes('\\') || url.hostname !== url.host.replace(/:443$/, '')) return reject();
    const h = headers(init.headers), path = url.pathname + url.search;
    if (url.hostname === API) {
      if (method === 'POST' && path === '/app/installations/19/access_tokens') {
        if (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(h.get('authorization') ?? '')) return reject();
        const body = JSON.parse(init.body);
        if (JSON.stringify(body) !== JSON.stringify({ repositories: ['artifact-attestations-workflows'], permissions: { contents: 'read', actions: 'read', attestations: 'read' } })) return reject();
      } else if (method !== 'GET' || !githubPaths.has(path) || h.get('authorization') !== 'Bearer owned-ecs-installation-token') return reject();
    } else if (url.hostname !== BUNDLE || method !== 'GET' || path !== '/attestations/804468129/bundle.json' || h.has('authorization')) return reject();
    if (h.has('host') || [...h.keys()].some(name => /^(x-amz-|x-goog-|x-azure-)/.test(name)) || h.has('x-api-key') || h.has('api-key')) return reject();
    return originalFetch(owned.origin + path, { ...init, headers: stamp(h, url.hostname), dispatcher: privateDispatcher, redirect: 'error', credentials: 'omit' });
  };
  syncBuiltinESMExports();
  const report = () => ({ mappedRequests: sequence, denied });
  let ready = Promise.resolve();
  if (announce) ready = new Promise((resolve, rejectReady) => {
    const request = invoke({ method: 'POST', path: '/__fixture_guard_ready', headers: { 'x-axiom-fixture-guard': proof, 'x-axiom-fixture-process': String(process.pid) } }, response => { response.resume(); response.once('end', () => response.statusCode === 200 ? resolve() : rejectReady(new Error('owned_ecs_guard_ready_failed'))); });
    request.once('error', () => rejectReady(new Error('owned_ecs_guard_ready_failed'))); request.end('{}');
  });
  const result = Object.freeze({ report, ready }); Object.defineProperty(globalThis, guardSymbol, { value: result }); return result;
}
module.exports = { installOwnedEcsCheckedInputGuard };
if (process.env.AXIOM_OWNED_ECS_CHECKED_INPUTS === '1') installOwnedEcsCheckedInputGuard({ origin: process.env.AXIOM_OWNED_ECS_ORIGIN, proof: process.env.AXIOM_OWNED_ECS_PROOF, announce: true });
