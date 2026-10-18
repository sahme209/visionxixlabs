/* eslint-disable @typescript-eslint/no-require-imports -- Exact fixture entry; no application import before guard. */
'use strict';
const assert = require('node:assert/strict');
const { readFileSync, writeFileSync, existsSync, realpathSync } = require('node:fs');
const { join, relative } = require('node:path');
const http = require('node:http');
const { allowedRequest, endpoint, sha256 } = require('./ownedWebsitePolicy.cjs');
const { installOwnedWebsiteGuard } = require('./ownedWebsiteGuard.cjs');
const framework = require('./ownedWebsiteFramework.cjs');
const managedNodePath = require('./ownedWebsiteManagedNodePath.cjs');
assert.equal(process.env.AXIOM_WEBSITE_VISUAL_MODE, 'owned-website-visual');
const directory = process.env.AXIOM_WEBSITE_CONFIG?.replace(/\/config\.json$/, '');
assert.ok(directory?.startsWith('/tmp/axiom-website-') && process.env.AXIOM_WEBSITE_CONFIG === join(directory, 'config.json'));
const config = JSON.parse(readFileSync(process.env.AXIOM_WEBSITE_CONFIG, 'utf8'));
managedNodePath.revalidate(process.env.NODE_PATH, config.managedNodePath);
const root = realpathSync(join(__dirname, '../..'));
assert.equal(config.root, root); assert.equal(realpathSync(process.cwd()), root);
assert.match(config.nonce, /^[a-f0-9]{32}$/); assert.equal(config.directory, directory);
assert.ok(config.dist.startsWith(`${root}/.next/visual-`) && realpathSync(config.dist) === config.dist);
for (const [path, hash] of Object.entries(config.hashes)) assert.equal(sha256(path), hash, 'website_source_pin');
for (const filename of ['.env', '.env.local', '.env.development', '.env.development.local']) assert.equal(existsSync(join(root, filename)), false, 'website_ambient_env_file');
const origin = endpoint(config.appPort);
let app, ready = false, guard;
function report(stage) { writeFileSync(join(directory, 'server.json'), JSON.stringify({ stage, pid: process.pid, nonce: config.nonce, origin, productionEquivalent: false, framework: config.framework, guard: guard?.report() }), { mode: 0o600 }); }
const server = http.createServer(async (req, res) => {
  if (req.headers.host !== `127.0.0.1:${config.appPort}` || !allowedRequest({ method: req.method, raw: req.url, origin, assets: config.assets })) { res.writeHead(403).end('Owned visual fixture: request denied'); return; }
  if (!ready) { res.writeHead(503).end('Owned visual fixture preparing'); return; }
  try { await app.getRequestHandler()(req, res); } catch { res.writeHead(500).end('Owned visual fixture render failed'); }
});
server.on('upgrade', (_req, socket) => socket.destroy()); // No HMR, WebSocket or alternate application transport.
const expiry = setTimeout(() => { report('expired'); process.exit(1); }, 300_000);
async function stop() { clearTimeout(expiry); ready = false; report('stopping'); server.closeAllConnections(); server.close(); try { await app?.close(); } finally { process.exit(0); } }
process.once('SIGTERM', () => { void stop(); }); process.once('SIGINT', () => { void stop(); });
server.once('error', () => { report('listen_failed'); process.exit(1); });
server.listen({ host: '127.0.0.1', port: config.appPort, exclusive: true }, async () => {
  try {
    guard = installOwnedWebsiteGuard();
    managedNodePath.revalidate(process.env.NODE_PATH, config.managedNodePath);
    const mode = framework.installOwnedWebsiteFramework({ root, role: 'website-server', environment: process.env, identity: config.framework });
    report('guarded');
    managedNodePath.revalidate(process.env.NODE_PATH, config.managedNodePath);
    const next = require('next');
    // conf is the real pinned config loaded through Next; only owned distDir is overridden.
    const loadConfig = require('next/dist/server/config').default;
    const constants = require('next/constants');
    const actual = await loadConfig(constants.PHASE_DEVELOPMENT_SERVER, root);
    app = next({ dev: true, dir: root, hostname: '127.0.0.1', port: config.appPort, conf: { ...actual, distDir: relative(root, config.dist), typescript: { ...actual.typescript, tsconfigPath: relative(root, join(config.dist, "tsconfig.json")) } } });
    await app.prepare(); mode.report(); ready = true; report('ready');
  } catch { report('startup_failed'); process.exitCode = 1; server.closeAllConnections(); server.close(); clearTimeout(expiry); }
});
