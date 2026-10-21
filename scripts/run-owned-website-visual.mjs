import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import policy from './fixtures/ownedWebsitePolicy.cjs';
import framework from './fixtures/ownedWebsiteFramework.cjs';
import lifecycle from './fixtures/ownedWebsiteLifecycle.cjs';
import managedNodePath from './fixtures/ownedWebsiteManagedNodePath.cjs';
const root = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));
const browser = '/usr/lib/chromium/chromium';
const sourceFiles = ['scripts/run-owned-website-visual.mjs', 'scripts/owned-website-ci.mjs', 'scripts/fixtures/ownedWebsiteConfig.cjs', 'scripts/fixtures/ownedWebsitePolicy.cjs', 'scripts/fixtures/ownedWebsiteGuard.cjs', 'scripts/fixtures/ownedWebsiteFramework.cjs', 'scripts/fixtures/ownedWebsiteChild.cjs', 'scripts/fixtures/ownedWebsiteProxy.cjs', 'scripts/fixtures/ownedWebsiteProxyTransport.cjs', 'scripts/fixtures/ownedWebsiteLifecycle.cjs', 'scripts/fixtures/ownedWebsiteSession.cjs', 'scripts/fixtures/ownedWebsitePointerObservation.cjs', 'scripts/fixtures/ownedWebsiteManagedNodePath.cjs', 'scripts/fixtures/ownedManagedEnvironment.cjs', 'scripts/capture-owned-website.mjs'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function captureEnvironment() {
  const managed = policy.captureManagedEnvironment(process.env);
  const base = policy.checkedEnvironment(process.env, process.execArgv); // Refuse inherited guard/trust changes before even a git child.
  policy.revalidateManagedEnvironment(process.env, managed);
  return Object.freeze({ managed, nodePath: managedNodePath.capture(base.NODE_PATH), gitEnv: Object.freeze({ ...base, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }) });
}
function git(args, environment, checkLive = true) {
  if (checkLive) { policy.checkedEnvironment(process.env, process.execArgv); policy.revalidateManagedEnvironment(process.env, environment.managed); }
  policy.revalidateManagedEnvironment(environment.gitEnv, environment.managed);
  managedNodePath.revalidate(environment.gitEnv.NODE_PATH, environment.nodePath);
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', env: environment.gitEnv, timeout: 5000 }).trim();
}
function capture(environment = captureEnvironment()) {
  assert.equal(git(['status', '--porcelain', '--untracked-files=no'], environment), '', 'website_clean_source_required');
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) assert.equal(existsSync(join(root, name)), false, 'website_ambient_env_file');
  return { schema: 1, root, sourceHead: git(['rev-parse', 'HEAD'], environment), managedNodePath: environment.nodePath, managedSelectors: policy.managedSelectorIdentity(environment.managed), framework: framework.captureOwnedWebsiteFramework(root), hashes: Object.fromEntries([...sourceFiles.map(path => join(root, path)), realpathSync(process.execPath), realpathSync(browser)].map(path => [path, policy.sha256(path)])), productionEquivalent: false };
}
const groupMembers = policy.groupMembers;
async function stopGroup(owner, io = { members: groupMembers, snapshot: policy.snapshot, sameOwner: policy.sameOwner, kill: (group, signal) => process.kill(group, signal), now: Date.now, pause }) {
  // Registration/preflight retries consume the existing TERM grace, never extend it.
  const termDeadline = io.now() + 5000;
  const finalDeadline = termDeadline + 2000;
  function members() {
    try {
      const rows = io.members(owner.group);
      for (const row of rows) assert.ok(Number(row.start) >= Number(owner.start) && row.executable === owner.executable, 'website_cleanup_foreign_group_member');
      return rows;
    } catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return null; throw error; }
  }
  function authority() {
    const rows = members(); if (rows === null || rows.length === 0) return rows;
    try { assert.ok(io.sameOwner(owner, io.snapshot(owner.pid)), 'website_cleanup_leader_changed'); }
    catch (error) { if (['ENOENT', 'ESRCH'].includes(error.code)) return null; throw error; }
    return members(); // Recheck known members after fresh leader identity, before signaling.
  }
  async function waitForAuthority(deadline) {
    while (io.now() < deadline) { const rows = authority(); if (rows !== null) return rows; await io.pause(Math.min(25, deadline - io.now())); }
    throw Error('website_cleanup_metadata_unverified');
  }
  const initial = await waitForAuthority(termDeadline);
  if (!initial.length) return;
  io.kill(-owner.group, 'SIGTERM');
  while (io.now() < termDeadline) {
    const rows = members(); if (rows !== null && rows.length === 0) return;
    await io.pause(Math.min(25, termDeadline - io.now()));
  }
  const escalation = await waitForAuthority(finalDeadline);
  if (!escalation.length) return;
  io.kill(-owner.group, 'SIGKILL');
  while (io.now() < finalDeadline) {
    const rows = members(); if (rows !== null && rows.length === 0) return;
    await io.pause(Math.min(25, finalDeadline - io.now()));
  }
  const final = members();
  assert.ok(final !== null, 'website_cleanup_metadata_unverified');
  assert.equal(final.length, 0, 'website_cleanup_incomplete');
}
function directoryBytes(path) { let total = 0; for (const item of readdirSync(path, { withFileTypes: true })) { if (item.isSymbolicLink()) continue; const next = join(path, item.name); total += item.isDirectory() ? directoryBytes(next) : statSync(next).size; } return total; }
async function execute(manifest) {
  // Install cancellation before capture() can spawn even its bounded local git checks.
  const control = lifecycle.createCoordinator();
  const outputError = () => control.cancel(Error('website_supervisor_output_error'));
  process.stdout.on('error', outputError); process.stderr.on('error', outputError);
  try {
  const environment = captureEnvironment();
  assert.deepEqual(capture(environment), manifest, 'website_reviewed_manifest_changed');
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
  const config = { root, directory, dist, nonce, appPort, proxyPort, cdpPort, assets, hashes: manifest.hashes, framework: manifest.framework, managedNodePath: manifest.managedNodePath };
  const configPath = join(directory, 'config.json'); writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  const env = policy.childEnvironment(process.env, { directory, configPath });
  const logs = [];
  let cleaning = false;
  const ledger = lifecycle.createLedger({ spawn, snapshot: policy.snapshot, canonical: realpathSync, stopGroup, groupMembers, onFailure: control.cancel, onChange: records => lifecycle.persistLedger(directory, nonce, records) });
  const disk = setInterval(() => { try { if (directoryBytes(directory) + directoryBytes(dist) > 400 * 1024 * 1024) control.cancel(Error('website_resource_limit')); } catch { control.cancel(Error('website_resource_limit')); } }, 5000);
  function launch(role, executable, args, childEnv) {
    policy.checkedEnvironment(process.env, process.execArgv);
    policy.revalidateManagedEnvironment(process.env, environment.managed);
    policy.revalidateManagedEnvironment(childEnv, environment.managed);
    managedNodePath.revalidate(process.env.NODE_PATH, manifest.managedNodePath);
    managedNodePath.revalidate(childEnv.NODE_PATH, manifest.managedNodePath);
    return control.run(() => ledger.launch(executable, args, { cwd: root, env: childEnv, detached: true, stdio: ['ignore', 'pipe', 'pipe'] }, child => {
      let count = 0;
      lifecycle.observeOwnedChild(child, { critical: role !== 'capture', isCleaning: () => cleaning, onFailure: control.cancel, onData: chunk => { count += chunk.length; if (count <= 512_000) logs.push(chunk.toString()); } });
    }, role));
  }
  async function waitFor(check, milliseconds) { const deadline = Date.now() + milliseconds; while (Date.now() < deadline) { control.check(); const result = await control.run(check); if (result) return result; await control.run(() => pause(100)); } throw Error('website_readiness_timeout'); }
  let result = { status: 'failed', bundler: 'webpack', productionEquivalent: false, sourceHead: manifest.sourceHead };
  try {
    const serverRecord = await launch('server', process.execPath, [join(root, 'scripts/fixtures/ownedWebsiteChild.cjs')], env);
    const child = serverRecord.handle;
    const receipt = await waitFor(() => {
      assert.ok(!serverRecord.exited, 'website_server_exited');
      if (!existsSync(join(directory, 'server.json'))) return false;
      let value; try { value = JSON.parse(readFileSync(join(directory, 'server.json'), 'utf8')); } catch { return false; }
      assert.equal(value.pid, child.pid); assert.equal(value.nonce, nonce); assert.equal(value.origin, origin);
      assert.ok(!['startup_failed', 'listen_failed', 'expired'].includes(value.stage), 'website_startup_failed');
      return value.stage === 'ready' && value;
    }, 150_000);
    const proxyRecord = await launch('proxy', process.execPath, [join(root, 'scripts/fixtures/ownedWebsiteProxy.cjs')], env);
    const proxyReceipt = await waitFor(() => {
      if (!existsSync(join(directory, 'proxy.json'))) return false;
      let value; try { value = JSON.parse(readFileSync(join(directory, 'proxy.json'), 'utf8')); } catch { return false; }
      assert.equal(value.pid, proxyRecord.pid); assert.equal(value.nonce, nonce); assert.equal(value.origin, policy.endpoint(proxyPort));
      assert.equal(value.stage, 'ready', 'website_proxy_startup_failed'); return value;
    }, 10_000);
    const browserEnv = { ...env }; delete browserEnv.AXIOM_WEBSITE_CONFIG; delete browserEnv.AXIOM_WEBSITE_VISUAL_MODE;
    const browserRecord = await launch('browser', browser, policy.chromiumArgs({ profile: join(directory, 'chromium'), proxyPort, cdpPort }), browserEnv);
    await waitFor(() => {
      assert.ok(!browserRecord.exited, 'website_browser_exited');
      try { return policy.proveListener(browserRecord.owner, cdpPort); } catch (error) { if (error.message === 'website_listener_not_ready') return false; throw error; }
    }, 10_000);
    result = { ...result, status: 'owned_window_ready', directory, origin, cdpOrigin: policy.endpoint(cdpPort), nonce, receipt, owners: ledger.owners(), browserOwner: browserRecord.owner, proxyReceipt };
    writeFileSync(join(directory, 'window.json'), JSON.stringify(result), { mode: 0o600 });
    if (!process.stdout.destroyed) process.stdout.write(`${JSON.stringify({ directory, origin, cdpOrigin: policy.endpoint(cdpPort), productionEquivalent: false })}\n`);
    // Fixed manifest-pinned driver is an owned child, never an untracked external process.
    const driver = await launch('capture', process.execPath, [join(root, 'scripts/capture-owned-website.mjs'), directory], env);
    await waitFor(() => driver.exited, 125_000);
    assert.equal(driver.exitCode, 0, 'website_driver_failed'); assert.equal(driver.signal, null, 'website_driver_signalled');
    assert.ok(existsSync(join(directory, 'done.json')), 'website_driver_receipt_missing');
    const completed = JSON.parse(readFileSync(join(directory, 'done.json'), 'utf8'));
    assert.equal(completed.nonce, nonce); assert.equal(completed.success, true, 'website_capture_failed');
    policy.checkedEnvironment(process.env, process.execArgv);
    policy.revalidateManagedEnvironment(process.env, environment.managed);
    control.check();
    result = { ...result, status: 'driver_finished' };
  } catch (error) { control.cancel(error instanceof Error ? error : Error('website_fixture_failed')); result = { ...result, error: control.report().failure }; }
  finally {
    cleaning = true; clearInterval(disk);
    // Signals remain installed; cleanup is intentionally not raced against cancellation.
    const cleanupErrors = await ledger.cleanup();
    let finalProxyReceipt = null;
    try { const value = JSON.parse(readFileSync(join(directory, 'proxy.json'), 'utf8')); if (value.nonce === nonce && value.origin === policy.endpoint(proxyPort)) finalProxyReceipt = value; } catch { /* unavailable counts remain unknown */ }
    // Retain owned artifacts if a process could not be safely stopped; never remove any existing .next root.
    if (cleanupErrors.length === 0) {
      assert.equal(realpathSync(dist), dist); assert.ok(dist.startsWith(`${nextRoot}/visual-`)); rmSync(dist, { recursive: true });
      rmSync(join(directory, 'chromium'), { recursive: true });
    }
    writeFileSync(join(directory, 'bounded-runtime.log'), logs.join(''), { mode: 0o600 });
    // Cleanup uses the captured validated controls, independently of later live metadata drift.
    const sourceUnchanged = git(['rev-parse', 'HEAD'], environment, false) === manifest.sourceHead && git(['status', '--porcelain', '--untracked-files=no'], environment, false) === '';
    if (cleanupErrors.length || !sourceUnchanged || control.report().failure) result.status = 'failed';
    if (control.report().failure && !result.error) result.error = control.report().failure;
    writeFileSync(join(directory, 'result.json'), JSON.stringify({ ...result, coordinator: control.report(), cleanup: cleanupErrors.length ? 'failed' : 'owned_groups_empty', cleanupErrors, cleanupDiagnostics: ledger.cleanupDiagnostics(), children: ledger.report(), finalProxyReceipt, fontRendering: 'external-font-fetch-denied; inspect fallback rendering', sourceUnchanged }), { mode: 0o600 });
    if (!process.stdout.destroyed) process.stdout.write(`${join(directory, 'result.json')}\n`);
  }
  if (result.status !== 'driver_finished') process.exitCode = 1;
  } finally { control.dispose(); process.stdout.removeListener('error', outputError); process.stderr.removeListener('error', outputError); }
}
const [command, path, expectedDigest] = process.argv.slice(2);
if (command === '--prepare' && path?.startsWith('/tmp/axiom-website-review-') && expectedDigest === undefined) {
  writeFileSync(path, JSON.stringify(capture(), null, 2), { mode: 0o600, flag: 'wx' }); process.stdout.write(`${policy.sha256(path)}\n`);
} else if (command === '--execute-reviewed' && path?.startsWith('/tmp/axiom-website-review-') && /^[a-f0-9]{64}$/.test(expectedDigest ?? '')) {
  assert.equal(policy.sha256(path), expectedDigest, 'website_review_manifest_digest'); await execute(JSON.parse(readFileSync(path, 'utf8')));
} else throw Error('Usage: --prepare /tmp/axiom-website-review-...json OR --execute-reviewed <same path> <reviewed sha256>');
