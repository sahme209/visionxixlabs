import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer, request } from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import policy from './fixtures/ownedWebsitePolicy.cjs';
import framework from './fixtures/ownedWebsiteFramework.cjs';
import lifecycle from './fixtures/ownedWebsiteLifecycle.cjs';
const root = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));
const browser = '/usr/lib/chromium/chromium';
const sourceFiles = ['scripts/run-owned-website-visual.mjs', 'scripts/fixtures/ownedWebsitePolicy.cjs', 'scripts/fixtures/ownedWebsiteGuard.cjs', 'scripts/fixtures/ownedWebsiteFramework.cjs', 'scripts/fixtures/ownedWebsiteChild.cjs', 'scripts/fixtures/ownedWebsiteLifecycle.cjs', 'scripts/fixtures/ownedWebsiteSession.cjs', 'scripts/capture-owned-website.mjs'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }, timeout: 5000 }).trim(); }
function capture() {
  policy.checkedEnvironment(process.env, process.execArgv); // Refuse inherited guard/trust changes before even a git child.
  assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '', 'website_clean_source_required');
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) assert.equal(existsSync(join(root, name)), false, 'website_ambient_env_file');
  return { schema: 1, root, sourceHead: git(['rev-parse', 'HEAD']), framework: framework.captureOwnedWebsiteFramework(root), hashes: Object.fromEntries([...sourceFiles.map(path => join(root, path)), realpathSync(process.execPath), realpathSync(browser)].map(path => [path, policy.sha256(path)])), productionEquivalent: false };
}
function groupMembers(group) {
  return readdirSync('/proc').filter(name => /^\d+$/.test(name)).flatMap(name => { try { const row = policy.snapshot(Number(name)); return row.group === group && row.state !== 'Z' ? [row] : []; } catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return []; throw error; } });
}
async function stopGroup(owner) {
  function members() { const rows = groupMembers(owner.group); for (const row of rows) assert.ok(Number(row.start) >= Number(owner.start) && row.executable === owner.executable, 'website_cleanup_foreign_group_member'); return rows; }
  if (!members().length) return;
  try { const current = policy.snapshot(owner.pid); assert.ok(policy.sameOwner(owner, current), 'website_cleanup_leader_changed'); } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
  process.kill(-owner.group, 'SIGTERM');
  let deadline = Date.now() + 5000; while (members().length && Date.now() < deadline) await pause(25);
  if (members().length) process.kill(-owner.group, 'SIGKILL');
  deadline = Date.now() + 2000; while (members().length && Date.now() < deadline) await pause(25);
  assert.equal(members().length, 0, 'website_cleanup_incomplete');
}
function directoryBytes(path) { let total = 0; for (const item of readdirSync(path, { withFileTypes: true })) { if (item.isSymbolicLink()) continue; const next = join(path, item.name); total += item.isDirectory() ? directoryBytes(next) : statSync(next).size; } return total; }
async function execute(manifest) {
  // Install cancellation before capture() can spawn even its bounded local git checks.
  const control = lifecycle.createCoordinator();
  try {
  assert.deepEqual(capture(), manifest, 'website_reviewed_manifest_changed');
  const directory = mkdtempSync('/tmp/axiom-website-');
  const nonce = randomBytes(16).toString('hex');
  const ports = new Set(); while (ports.size < 3) ports.add(randomInt(20000, 60001));
  const [appPort, proxyPort, cdpPort] = [...ports];
  const origin = policy.endpoint(appPort);
  const nextRoot = join(root, '.next');
  if (!existsSync(nextRoot)) mkdirSync(nextRoot, { mode: 0o700 });
  assert.equal(realpathSync(nextRoot), nextRoot, 'website_dist_root_symlink');
  const dist = mkdtempSync(join(nextRoot, 'visual-'));
  writeFileSync(join(dist, 'tsconfig.json'), JSON.stringify({ extends: join(root, 'tsconfig.next.json') }), { mode: 0o600 });
  for (const name of ['home', 'config', 'cache', 'tmp', 'chromium', 'screenshots']) mkdirSync(join(directory, name), { mode: 0o700 });
  const assets = policy.publicAssets(root);
  const config = { root, directory, dist, nonce, appPort, proxyPort, cdpPort, assets, hashes: manifest.hashes, framework: manifest.framework };
  const configPath = join(directory, 'config.json'); writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  const env = policy.childEnvironment(process.env, { directory, configPath });
  const logs = [];
  const ledger = lifecycle.createLedger({ spawn, snapshot: policy.snapshot, canonical: realpathSync, stopGroup, groupMembers });
  let proxy;
  const disk = setInterval(() => { try { if (directoryBytes(directory) + directoryBytes(dist) > 400 * 1024 * 1024) control.cancel(Error('website_resource_limit')); } catch { control.cancel(Error('website_resource_limit')); } }, 5000);
  function launch(executable, args, childEnv) {
    return control.run(() => ledger.launch(executable, args, { cwd: root, env: childEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }, child => {
      let count = 0;
      for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { count += chunk.length; if (count <= 512_000) logs.push(chunk.toString()); });
    }));
  }
  async function waitFor(check, milliseconds) { const deadline = Date.now() + milliseconds; while (Date.now() < deadline) { control.check(); const result = await control.run(check); if (result) return result; await control.run(() => pause(100)); } throw Error('website_readiness_timeout'); }
  let result = { status: 'failed', productionEquivalent: false, sourceHead: manifest.sourceHead };
  try {
    const serverRecord = await launch(process.execPath, [join(root, 'scripts/fixtures/ownedWebsiteChild.cjs')], env);
    const child = serverRecord.handle;
    const receipt = await waitFor(() => {
      assert.ok(!serverRecord.exited, 'website_server_exited');
      if (!existsSync(join(directory, 'server.json'))) return false;
      let value; try { value = JSON.parse(readFileSync(join(directory, 'server.json'), 'utf8')); } catch { return false; }
      assert.equal(value.pid, child.pid); assert.equal(value.nonce, nonce); assert.equal(value.origin, origin);
      assert.ok(!['startup_failed', 'listen_failed', 'expired'].includes(value.stage), 'website_startup_failed');
      return value.stage === 'ready' && value;
    }, 150_000);
    let proxyDenied = 0;
    control.check();
    proxy = createServer((req, res) => {
      try { control.check(); } catch { res.writeHead(503).end(); return; }
      let url; try { url = new URL(req.url); } catch { proxyDenied++; res.writeHead(403).end(); return; }
      if (url.origin !== origin || url.username || url.password || url.hash || !policy.allowedRequest({ method: req.method, raw: `${url.pathname}${url.search}`, origin, assets })) { proxyDenied++; res.writeHead(403).end(); return; }
      const upstream = request({ hostname: '127.0.0.1', port: appPort, path: `${url.pathname}${url.search}`, method: req.method, agent: false, headers: { host: `127.0.0.1:${appPort}`, accept: req.headers.accept ?? '*/*', ...(req.headers.rsc === '1' ? { rsc: '1' } : {}) } }, reply => { res.writeHead(reply.statusCode, reply.headers); reply.pipe(res); });
      upstream.on('error', () => res.writeHead(502).end()); upstream.setTimeout(30_000, () => upstream.destroy()); upstream.end();
    });
    proxy.on('connect', (_req, socket) => { proxyDenied++; socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); });
    proxy.on('upgrade', (_req, socket) => { proxyDenied++; socket.destroy(); });
    await control.run(() => new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen({ host: '127.0.0.1', port: proxyPort, exclusive: true }, resolve); }));
    const browserEnv = { ...env }; delete browserEnv.AXIOM_WEBSITE_CONFIG; delete browserEnv.AXIOM_WEBSITE_VISUAL_MODE;
    const browserRecord = await launch(browser, policy.chromiumArgs({ profile: join(directory, 'chromium'), proxyPort, cdpPort }), browserEnv);
    await waitFor(() => {
      assert.ok(!browserRecord.exited, 'website_browser_exited');
      try { return policy.proveListener(browserRecord.owner, cdpPort); } catch (error) { if (error.message === 'website_listener_not_ready') return false; throw error; }
    }, 10_000);
    result = { ...result, status: 'owned_window_ready', directory, origin, cdpOrigin: policy.endpoint(cdpPort), nonce, receipt, owners: ledger.owners(), browserOwner: browserRecord.owner, proxyDenied };
    writeFileSync(join(directory, 'window.json'), JSON.stringify(result), { mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ directory, origin, cdpOrigin: policy.endpoint(cdpPort), productionEquivalent: false })}\n`);
    // Fixed manifest-pinned driver is an owned child, never an untracked external process.
    const driver = await launch(process.execPath, [join(root, 'scripts/capture-owned-website.mjs'), directory], env);
    await waitFor(() => driver.exited, 125_000);
    assert.equal(driver.exitCode, 0, 'website_driver_failed'); assert.equal(driver.signal, null, 'website_driver_signalled');
    assert.ok(existsSync(join(directory, 'done.json')), 'website_driver_receipt_missing');
    const completed = JSON.parse(readFileSync(join(directory, 'done.json'), 'utf8'));
    assert.equal(completed.nonce, nonce); assert.equal(completed.success, true, 'website_capture_failed');
    control.check();
    result = { ...result, status: 'driver_finished', proxyDenied };
  } catch (error) { control.cancel(error instanceof Error ? error : Error('website_fixture_failed')); result = { ...result, error: control.report().failure }; }
  finally {
    clearInterval(disk);
    // Signals remain installed; cleanup is intentionally not raced against cancellation.
    const cleanupErrors = await ledger.cleanup();
    proxy?.closeAllConnections(); await new Promise(resolve => proxy?.listening ? proxy.close(resolve) : resolve());
    // Retain owned artifacts if a process could not be safely stopped; never remove any existing .next root.
    if (cleanupErrors.length === 0) {
      assert.equal(realpathSync(dist), dist); assert.ok(dist.startsWith(`${nextRoot}/visual-`)); rmSync(dist, { recursive: true });
      rmSync(join(directory, 'chromium'), { recursive: true });
    }
    writeFileSync(join(directory, 'bounded-runtime.log'), logs.join(''), { mode: 0o600 });
    const sourceUnchanged = git(['rev-parse', 'HEAD']) === manifest.sourceHead && git(['status', '--porcelain', '--untracked-files=no']) === '';
    if (cleanupErrors.length || !sourceUnchanged || control.report().failure) result.status = 'failed';
    if (control.report().failure && !result.error) result.error = control.report().failure;
    writeFileSync(join(directory, 'result.json'), JSON.stringify({ ...result, coordinator: control.report(), cleanup: cleanupErrors.length ? 'failed' : 'owned_groups_empty', cleanupErrors, children: ledger.records.map(record => ({ pid: record.pid, owner: record.owner, exited: record.exited, neverSpawned: record.neverSpawned, exitCode: record.exitCode, signal: record.signal })), fontRendering: 'external-font-fetch-denied; inspect fallback rendering', sourceUnchanged }), { mode: 0o600 });
    process.stdout.write(`${join(directory, 'result.json')}\n`);
  }
  if (result.status !== 'driver_finished') process.exitCode = 1;
  } finally { control.dispose(); }
}
const [command, path, expectedDigest] = process.argv.slice(2);
if (command === '--prepare' && path?.startsWith('/tmp/axiom-website-review-') && expectedDigest === undefined) {
  writeFileSync(path, JSON.stringify(capture(), null, 2), { mode: 0o600, flag: 'wx' }); process.stdout.write(`${policy.sha256(path)}\n`);
} else if (command === '--execute-reviewed' && path?.startsWith('/tmp/axiom-website-review-') && /^[a-f0-9]{64}$/.test(expectedDigest ?? '')) {
  assert.equal(policy.sha256(path), expectedDigest, 'website_review_manifest_digest'); await execute(JSON.parse(readFileSync(path, 'utf8')));
} else throw Error('Usage: --prepare /tmp/axiom-website-review-...json OR --execute-reviewed <same path> <reviewed sha256>');
