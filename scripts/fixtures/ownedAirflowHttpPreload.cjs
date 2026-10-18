/* eslint-disable @typescript-eslint/no-require-imports -- synchronous test-only preload, before application imports. */
'use strict';
const assert = require('node:assert/strict');
const dns = require('node:dns');
const dgram = require('node:dgram');
const net = require('node:net');
const { syncBuiltinESMExports } = require('node:module');
const { installOwnedAwsHttpGuard } = require('./ownedAwsHttpPreload.cjs');
const syntheticOrigin = 'https://airflow.fixture.example.test';
function origin(value) {
  const url = new URL(value);
  assert.ok(url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port && url.pathname === '/' && !url.username && !url.password && !url.search && !url.hash, 'owned_airflow_origin_required');
  return url.origin;
}
function makeOwnedAirflowFetch({ origins, wireOrigin, proof }, delegate) {
  const allowed = new Set(origins.map(origin)); wireOrigin = origin(wireOrigin);
  assert.ok(!allowed.has(wireOrigin) && /^[a-f0-9]{32}$/.test(proof), 'owned_airflow_wire_configuration_required');
  return async function (input, init = {}) {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.username || url.password || url.hash) throw new Error('owned_airflow_egress_denied');
    if (url.origin === syntheticOrigin) {
      if ((init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase() !== 'GET' || !url.pathname.startsWith('/api/v2/')) throw new Error('owned_airflow_egress_denied');
      const headers = Object.fromEntries(new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined)));
      return delegate(`${wireOrigin}${url.pathname}${url.search}`, { ...init, method: 'GET', redirect: 'error', headers: { ...headers, 'x-axiom-fixture-guard': proof, 'x-axiom-fixture-process': String(process.pid) } });
    }
    if (!allowed.has(url.origin)) throw new Error('owned_airflow_egress_denied');
    return delegate(input, init);
  };
}
function ownedAirflowLookup(hostname, options = {}) {
  const address = hostname === 'airflow.fixture.example.test' ? '203.0.113.42' : ['127.0.0.1', 'localhost'].includes(hostname) ? '127.0.0.1' : null;
  if (!address) throw new Error('owned_airflow_dns_denied');
  return options.all ? [{ address, family: 4 }] : { address, family: 4 };
}
/** c-ares and UDP bypass TCP Socket.connect. Fence prototype methods too so
 * captured constructors/instances cannot select custom native DNS servers. */
function installOwnedAirflowDnsUdpGuard() {
  const saved = [], visited = new Set();
  function replace(object, key, value) { saved.push([object, key, Object.getOwnPropertyDescriptor(object, key)]); object[key] = value; }
  const denyDns = () => { throw new Error('owned_airflow_dns_denied'); };
  const denyUdp = () => { throw new Error('owned_airflow_udp_denied'); };
  const dnsEntry = /^(lookup|resolve|reverse$|setServers$|setLocalAddress$)/;
  for (const api of [dns, dns.promises]) {
    for (let prototype = api.Resolver.prototype; prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
      if (visited.has(prototype)) continue; visited.add(prototype);
      for (const key of Object.getOwnPropertyNames(prototype)) if (dnsEntry.test(key) && typeof prototype[key] === 'function') replace(prototype, key, denyDns);
    }
    replace(api, 'Resolver', function deniedResolver() { return denyDns(); });
    for (const key of Object.keys(api)) if (key !== 'lookup' && dnsEntry.test(key) && typeof api[key] === 'function') replace(api, key, api === dns.promises ? async () => denyDns() : denyDns);
  }
  for (const key of Object.getOwnPropertyNames(dgram.Socket.prototype)) if (/^(send|connect|bind)/.test(key) && typeof dgram.Socket.prototype[key] === 'function') replace(dgram.Socket.prototype, key, denyUdp);
  replace(dgram, 'Socket', function deniedUdpSocket() { return denyUdp(); });
  replace(dgram, 'createSocket', denyUdp);
  syncBuiltinESMExports();
  return { restore() { for (const [object, key, descriptor] of saved.reverse()) Object.defineProperty(object, key, descriptor); syncBuiltinESMExports(); } };
}
function installOwnedAirflowGuard({ origins, wireOrigin, proof, databaseUrl }) {
  const db = new URL(databaseUrl);
  assert.ok(['postgres:', 'postgresql:'].includes(db.protocol) && db.hostname === '127.0.0.1' && db.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(db.pathname) && !db.search && !db.hash, 'owned_airflow_database_required');
  const allowedPorts = new Set([...origins.map(value => Number(new URL(origin(value)).port)), Number(new URL(origin(wireOrigin)).port), Number(db.port)]);
  const original = { fetch: globalThis.fetch, connect: net.Socket.prototype.connect, lookup: dns.lookup, lookupPromise: dns.promises.lookup };
  const fetch = makeOwnedAirflowFetch({ origins, wireOrigin, proof }, original.fetch);
  // Reuse the existing literal-loopback builtin HTTP guard. Its historical AWS
  // name does not enable any AWS behavior or credential in this separate child.
  const builtin = installOwnedAwsHttpGuard({ origins: [...origins, wireOrigin], awsOrigin: wireOrigin, proof, announceReady: true });
  const dnsUdp = installOwnedAirflowDnsUdpGuard();
  globalThis.fetch = fetch;
  dns.promises.lookup = async (hostname, options) => ownedAirflowLookup(hostname, options);
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    queueMicrotask(() => { try { const result = ownedAirflowLookup(hostname, options); if (options?.all) callback(null, result); else callback(null, result.address, result.family); } catch (error) { callback(error); } });
  };
  net.Socket.prototype.connect = function (...args) {
    let options = args[0]; if (Array.isArray(options)) options = options[0];
    if (!options || typeof options !== 'object' || (options.host ?? options.hostname) !== '127.0.0.1' || !allowedPorts.has(Number(options.port)) || options.path) throw new Error('owned_airflow_socket_denied');
    return original.connect.apply(this, args);
  };
  syncBuiltinESMExports();
  return { report: builtin.report, restore() { dnsUdp.restore(); globalThis.fetch = original.fetch; net.Socket.prototype.connect = original.connect; dns.lookup = original.lookup; dns.promises.lookup = original.lookupPromise; builtin.restore(); syncBuiltinESMExports(); } };
}
module.exports = { makeOwnedAirflowFetch, ownedAirflowLookup, installOwnedAirflowGuard };
if (process.env.AXIOM_OWNED_AIRFLOW_WIRE === '1') installOwnedAirflowGuard({ origins: JSON.parse(process.env.AXIOM_OWNED_AIRFLOW_HTTP_ORIGINS || 'null'), wireOrigin: process.env.AXIOM_OWNED_AIRFLOW_ORIGIN, proof: process.env.AXIOM_OWNED_AIRFLOW_PROOF, databaseUrl: process.env.DATABASE_URL });
