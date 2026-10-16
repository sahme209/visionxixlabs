/* eslint-disable @typescript-eslint/no-require-imports -- synchronous fixture-only process guard */
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const { syncBuiltinESMExports } = require('node:module');
const { urlToHttpOptions } = require('node:url');
function origin(value) { const u = new URL(value); assert.ok(u.protocol === 'http:' && u.hostname === '127.0.0.1' && u.port && u.pathname === '/' && !u.username && !u.password && !u.search && !u.hash, 'owned_azure_http_origin_required'); return u; }
function installOwnedAzureHttpGuard({ origins, azureOrigin, databaseUrl, proof }) {
  const targets = origins.map(origin); const azure = origin(azureOrigin);
  assert.ok(targets.some(u => u.origin === azure.origin) && /^[a-f0-9]{32}$/.test(proof));
  const db = new URL(databaseUrl); assert.ok(['postgres:', 'postgresql:'].includes(db.protocol) && db.hostname === '127.0.0.1' && db.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(db.pathname) && !db.search && !db.hash);
  const allowed = new Set(targets.map(u => u.origin)), ports = new Set([...targets.map(u => Number(u.port)), Number(db.port)]);
  const original = { request: http.request, get: http.get, secureRequest: https.request, secureGet: https.get, connect: net.Socket.prototype.connect, fetch: globalThis.fetch };
  let sequence = 0, denied = 0;
  const reject = () => { denied++; throw new Error('owned_azure_egress_denied'); };
  function optionsFrom(args) { const first = args[0]; if (typeof first === 'string' || first instanceof URL) return { ...urlToHttpOptions(new URL(first)), ...(args[1] && typeof args[1] === 'object' ? args[1] : {}) }; if (!first || typeof first !== 'object') return reject(); return { ...first }; }
  function requestFor(protocol, args) {
    const options = optionsFrom(args), hostname = options.hostname ?? options.host;
    const callback = args.findLast(value => typeof value === 'function');
    if (options.socketPath || options.createConnection || options.lookup || options.auth || options._defaultAgent) return reject();
    if (protocol === 'https:' && ['login.microsoftonline.com', 'management.azure.com'].includes(hostname) && Number(options.port ?? 443) === 443) {
      // Only product-validated explicit public Azure traffic is remapped, never proxied to real Azure.
      sequence++;
      const mapped = { ...options, protocol: 'http:', hostname: '127.0.0.1', host: '127.0.0.1', port: Number(azure.port), agent: false, headers: { ...options.headers, host: '127.0.0.1', 'x-axiom-fixture-guard': proof, 'x-axiom-fixture-process': String(process.pid), 'x-axiom-fixture-sequence': String(sequence), 'x-axiom-original-host': hostname } };
      return callback ? original.request(mapped, callback) : original.request(mapped);
    }
    if (protocol !== 'http:' || hostname !== '127.0.0.1' || !allowed.has(`http://${hostname}:${options.port}`)) return reject();
    options.agent = false;
    return callback ? original.request(options, callback) : original.request(options);
  }
  http.request = function (...args) { return requestFor('http:', args); };
  https.request = function (...args) { return requestFor('https:', args); };
  http.get = function (...args) { const request = http.request(...args); request.end(); return request; };
  https.get = function (...args) { const request = https.request(...args); request.end(); return request; };
  net.Socket.prototype.connect = function (...args) { let options = args[0]; if (Array.isArray(options)) options = options[0]; if (!options || typeof options !== 'object' || (options.host ?? options.hostname) !== '127.0.0.1' || !ports.has(Number(options.port))) return reject(); return original.connect.apply(this, args); };
  globalThis.fetch = function (input, init) { const u = new URL(input instanceof Request ? input.url : String(input)); if (!allowed.has(u.origin)) return reject(); return original.fetch(input, init); };
  syncBuiltinESMExports();
  const ready = original.request({ hostname: '127.0.0.1', port: Number(azure.port), path: '/__fixture_guard_ready', method: 'POST', agent: false, headers: { 'content-type': 'application/json', 'x-axiom-fixture-guard': proof } }, response => response.resume());
  ready.once('error', () => { process.stderr.write('owned_azure_guard_ready_failed\n'); process.exitCode = 1; }); ready.end(JSON.stringify({kind:'azure_builtin_guard_ready',pid:process.pid}));
  return { report: () => ({ requests: sequence, denied }) };
}
module.exports = { installOwnedAzureHttpGuard };
if (process.env.AXIOM_OWNED_AZURE_WIRE === '1') installOwnedAzureHttpGuard({ origins: JSON.parse(process.env.AXIOM_OWNED_AZURE_HTTP_ORIGINS || 'null'), azureOrigin: process.env.AXIOM_OWNED_AZURE_ORIGIN, databaseUrl: process.env.DATABASE_URL, proof: process.env.AXIOM_OWNED_AZURE_PROOF });
