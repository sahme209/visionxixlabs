/* eslint-disable @typescript-eslint/no-require-imports -- Guard precedes framework/application imports. */
'use strict';
const assert = require('node:assert/strict');
const { syncBuiltinESMExports } = require('node:module');
const http = require('node:http'), https = require('node:https'), net = require('node:net');
const tls = require('node:tls'), dns = require('node:dns'), dgram = require('node:dgram'), http2 = require('node:http2');
const children = require('node:child_process'), threads = require('node:worker_threads'), cluster = require('node:cluster');
let installed = false;
/** No outbound connection or new process is needed to render these public pages.
 * Captured Node APIs reach denied lower bindings. This is a trusted-process guard,
 * not an arbitrary native-code or operating-system sandbox. The sole listener is
 * already bound by the fixture host, before any application import. */
function installOwnedWebsiteGuard() {
  assert.equal(installed, false, 'website_guard_once'); installed = true;
  void process.stdout; void process.stderr; void process.stdin;
  const counts = { transport: 0, process: 0, worker: 0, listener: 0 };
  const deny = category => function deniedOperation() { counts[category]++; throw Error(`owned_website_${category}_denied`); };
  const transport = deny('transport'), subprocess = deny('process');
  function patch(object, names, replacement) { for (const name of names) if (typeof object[name] === 'function') object[name] = replacement; }
  patch(http, ['request', 'get'], transport); patch(https, ['request', 'get'], transport);
  globalThis.fetch = async () => transport();
  patch(net.Socket.prototype, ['connect'], transport); patch(net, ['connect', 'createConnection'], transport);
  patch(tls, ['connect'], transport); patch(http2, ['connect'], transport);
  patch(net.Server.prototype, ['listen'], deny('listener')); patch(net, ['createServer'], deny('listener'));
  const cares = process.binding('cares_wrap');
  patch(cares, ['getaddrinfo', 'getnameinfo'], transport);
  for (const name of ['GetAddrInfoReqWrap', 'GetNameInfoReqWrap', 'QueryReqWrap']) Object.defineProperty(cares[name].prototype, 'oncomplete', { configurable: false, set: transport, get: () => undefined });
  const tcp = process.binding('tcp_wrap').TCP.prototype, udp = process.binding('udp_wrap').UDP.prototype, pipe = process.binding('pipe_wrap').Pipe.prototype;
  patch(tcp, ['connect', 'connect6'], transport); patch(tcp, ['bind', 'bind6', 'listen'], deny('listener'));
  patch(udp, ['connect', 'connect6', 'bind', 'bind6', 'send', 'send6'], transport);
  patch(pipe, ['connect', 'bind', 'listen'], transport);
  const pattern = /^(lookup|resolve|reverse$|setServers$|setLocalAddress$)/;
  const seen = new Set();
  for (const api of [dns, dns.promises]) {
    for (let proto = api.Resolver.prototype; proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      if (seen.has(proto)) continue; seen.add(proto);
      patch(proto, Object.getOwnPropertyNames(proto).filter(name => pattern.test(name)), transport);
    }
    patch(api, Object.keys(api).filter(name => pattern.test(name)), transport); patch(api, ['Resolver'], transport);
  }
  patch(dgram.Socket.prototype, ['send', 'connect', 'bind'], transport);
  patch(children, ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'], subprocess);
  patch(children.ChildProcess.prototype, ['spawn'], subprocess);
  patch(process.binding('process_wrap').Process.prototype, ['spawn'], subprocess); patch(process.binding('spawn_sync'), ['spawn'], subprocess);
  patch(threads, ['Worker'], deny('worker')); patch(cluster, ['fork'], subprocess); patch(process, ['execve'], subprocess);
  syncBuiltinESMExports();
  return { report: () => ({ ...counts, policy: 'deny-all-outbound-and-new-processes', productionEquivalent: false }) };
}
module.exports = { installOwnedWebsiteGuard };
