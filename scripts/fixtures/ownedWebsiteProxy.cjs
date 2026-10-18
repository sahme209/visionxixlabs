/* eslint-disable @typescript-eslint/no-require-imports -- Fixed private-config proxy child, no application or command dispatch. */
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const { readFileSync, writeFileSync, realpathSync } = require('node:fs');
const { join } = require('node:path');
const policy = require('./ownedWebsitePolicy.cjs');
const managedNodePath = require('./ownedWebsiteManagedNodePath.cjs');
const { createProxyTransport } = require('./ownedWebsiteProxyTransport.cjs');
assert.equal(process.env.AXIOM_WEBSITE_VISUAL_MODE, 'owned-website-visual');
const configPath = process.env.AXIOM_WEBSITE_CONFIG;
assert.match(configPath ?? '', /^\/tmp\/axiom-website-[A-Za-z0-9]+\/config\.json$/);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const root = realpathSync(join(__dirname, '../..'));
assert.equal(config.root, root); assert.equal(realpathSync(process.cwd()), root);
assert.equal(configPath, join(config.directory, 'config.json')); assert.equal(realpathSync(config.directory), config.directory);
assert.match(config.nonce, /^[a-f0-9]{32}$/);
managedNodePath.revalidate(process.env.NODE_PATH, config.managedNodePath);
for (const [path, hash] of Object.entries(config.hashes)) assert.equal(policy.sha256(path), hash, 'website_proxy_source_pin');
const origin = policy.endpoint(config.appPort); policy.endpoint(config.proxyPort); assert.notEqual(config.appPort, config.proxyPort);
let stopping = false;
const counts = {};
const transport = createProxyTransport({ origin, appPort: config.appPort, assets: config.assets, request: http.request, isStopping: () => stopping, onEvent: event => { counts[event] = Math.min((counts[event] ?? 0) + 1, 1000000); } });
const server = http.createServer(transport.request);
server.on('connection', transport.connection); server.on('connect', transport.connect); server.on('upgrade', transport.upgrade); server.on('clientError', transport.clientError);
function report(stage) { writeFileSync(join(config.directory, 'proxy.json'), JSON.stringify({ stage, pid: process.pid, nonce: config.nonce, origin: policy.endpoint(config.proxyPort), counts, productionEquivalent: false }), { mode: 0o600 }); }
function stop(code, stage) {
  if (stopping) return; stopping = true; clearTimeout(expiry);
  // A single fixed service exits after its own streams close; its supervisor owns every other child.
  const forced = setTimeout(() => { report('close_timeout'); process.exit(1); }, 1000);
  server.closeAllConnections(); server.close(() => { clearTimeout(forced); report(stage); process.exit(code); });
}
const expiry = setTimeout(() => stop(1, 'expired'), 300000);
process.on('SIGTERM', () => stop(0, 'stopped')); process.on('SIGINT', () => stop(1, 'interrupted'));
server.on('error', () => stop(1, 'failed'));
managedNodePath.revalidate(process.env.NODE_PATH, config.managedNodePath);
server.listen({ host: '127.0.0.1', port: config.proxyPort, exclusive: true }, () => report('ready'));
