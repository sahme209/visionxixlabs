'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const { syncBuiltinESMExports } = require('node:module');
const { urlToHttpOptions } = require('node:url');

function ownedOrigin(value) {
  const url = new URL(value);
  assert.ok(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash, 'owned_http_fixture_origin_required');
  return url.origin;
}
function installOwnedAwsHttpGuard({ origins, awsOrigin, proof, announceReady = false }) {
  const allowed = new Set(origins.map(ownedOrigin));
  awsOrigin = ownedOrigin(awsOrigin);
  assert.ok(allowed.has(awsOrigin) && typeof proof === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(proof), 'owned_http_fixture_configuration_required');
  const originals = { request: http.request, get: http.get, secureRequest: https.request, secureGet: https.get };
  const agents = { 'http:': new http.Agent({ keepAlive: false, maxSockets: 5 }), 'https:': new https.Agent({ keepAlive: false, maxSockets: 5 }) };
  const counts = { allowed: 0, sdkRequests: 0, blocked: 0 };
  function guarded(original, protocol) {
    return function (...args) {
      let options;
      try {
        const first = args[0];
        if (typeof first === 'string' || first instanceof URL) {
          const url = new URL(first);
          if (url.username || url.password || url.hash) throw new Error();
          options = { ...urlToHttpOptions(url), ...(args[1] && typeof args[1] === 'object' ? args[1] : {}) };
        } else {
          if (!first || typeof first !== 'object' || Array.isArray(first)) throw new Error();
          options = { ...first };
        }
        const hostname = options.hostname ?? options.host;
        if (hostname !== '127.0.0.1' || (options.host && options.host !== hostname) || (options.protocol && options.protocol !== protocol) ||
            !/^\d{1,5}$/.test(String(options.port)) || options.socketPath || options.createConnection || options.lookup || options.auth || options._defaultAgent) throw new Error();
        const destination = `${protocol}//${hostname}:${options.port}`;
        if (!allowed.has(destination)) throw new Error();
        // Caller/SDK agent customizations cannot redirect a checked destination.
        options.agent = agents[protocol];
        options.headers = { ...(options.headers ?? {}) };
        counts.allowed += 1;
        if (destination === awsOrigin) { counts.sdkRequests += 1; options.headers['x-axiom-fixture-guard'] = proof; options.headers['x-axiom-fixture-sequence'] = String(counts.sdkRequests); options.headers['x-axiom-fixture-process'] = String(process.pid); }
      } catch {
        counts.blocked += 1;
        throw new Error('fixture_http_egress_denied');
      }
      const callback = args.findLast(arg => typeof arg === 'function');
      return callback ? original.call(this, options, callback) : original.call(this, options);
    };
  }
  const wrapped = { request: guarded(originals.request, 'http:'), get: guarded(originals.get, 'http:'), secureRequest: guarded(originals.secureRequest, 'https:'), secureGet: guarded(originals.secureGet, 'https:') };
  Object.assign(http, { request: wrapped.request, get: wrapped.get });
  Object.assign(https, { request: wrapped.secureRequest, get: wrapped.secureGet });
  syncBuiltinESMExports();
  if (announceReady) {
    // The only deliberate delegate bypass has an already validated owned IP/port.
    const target = new URL(awsOrigin);
    const ready = originals.request({ hostname: '127.0.0.1', port: Number(target.port), path: '/__fixture_guard_ready', method: 'POST', agent: false, headers: { 'content-type': 'application/json', 'x-axiom-fixture-guard': proof } }, response => response.resume());
    ready.once('error', () => { process.stderr.write('fixture_guard_announce_failed\n'); process.exitCode = 1; });
    ready.end(JSON.stringify({ kind: 'builtin_http_guard_ready', pid: process.pid }));
  }
  return { report: () => ({ ...counts }), restore() {
    assert.ok(http.request === wrapped.request && http.get === wrapped.get && https.request === wrapped.secureRequest && https.get === wrapped.secureGet, 'fixture_http_guard_ownership_changed');
    Object.assign(http, { request: originals.request, get: originals.get });
    Object.assign(https, { request: originals.secureRequest, get: originals.secureGet });
    syncBuiltinESMExports();
    for (const agent of Object.values(agents)) agent.destroy();
  } };
}
module.exports = { installOwnedAwsHttpGuard };
if (process.env.AXIOM_OWNED_AWS_WIRE === '1') {
  assert.equal(process.env.AWS_CONFIG_FILE, '/dev/null');
  assert.equal(process.env.AWS_SHARED_CREDENTIALS_FILE, '/dev/null');
  assert.equal(process.env.AWS_EC2_METADATA_DISABLED, 'true');
  const origins = JSON.parse(process.env.AXIOM_OWNED_HTTP_ORIGINS || 'null');
  installOwnedAwsHttpGuard({ origins, awsOrigin: process.env.AXIOM_OWNED_AWS_ORIGIN, proof: process.env.AXIOM_OWNED_AWS_PROOF, announceReady: true });
}
