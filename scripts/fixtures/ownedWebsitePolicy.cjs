/* eslint-disable @typescript-eslint/no-require-imports -- Shared synchronous fixture policy. */
'use strict';
const assert = require('node:assert/strict');
const { realpathSync, readFileSync, readdirSync, readlinkSync } = require('node:fs');
const { join, relative } = require('node:path');
const { createHash } = require('node:crypto');
const managedNodePath = require('./ownedWebsiteManagedNodePath.cjs');
const managedEnvironment = require('./ownedManagedEnvironment.cjs');
const pages = new Set(['/', '/product', '/docs/approval-workflow']);
const inherited = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'CODEX_PROXY_CERT', 'NODE_USE_ENV_PROXY', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE', 'AWS_CA_BUNDLE', 'NODE_PATH', 'NODE_VERSION'];
const selectors = inherited.filter(key => !['PATH', 'TMPDIR', 'LANG', 'LC_ALL'].includes(key));
function captureManagedEnvironment(env) {
  const controls = managedEnvironment.captureManagedControls(env);
  const reject = () => { throw Error('website_managed_selectors_unsupported'); };
  for (const key in env) if (selectors.includes(key) && !Object.hasOwn(env, key)) reject();
  const selected = Object.create(null);
  for (const key of selectors) {
    const descriptor = Object.getOwnPropertyDescriptor(env, key);
    if (!descriptor) continue;
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') reject();
    selected[key] = descriptor.value;
  }
  return Object.freeze({ controls, selectors: Object.freeze(selected) });
}
function revalidateManagedEnvironment(env, snapshot) {
  managedEnvironment.revalidateManagedControls(env, snapshot.controls);
  const current = captureManagedEnvironment(env).selectors;
  if (Object.keys(current).length !== Object.keys(snapshot.selectors).length || Object.keys(snapshot.selectors).some(key => !Object.hasOwn(current, key) || current[key] !== snapshot.selectors[key])) throw Error('website_managed_selectors_changed');
}
function managedSelectorIdentity(snapshot) {
  return Object.fromEntries(selectors.map(key => [key, Object.hasOwn(snapshot.selectors, key) ? { present: true, sha256: createHash('sha256').update(snapshot.selectors[key]).digest('hex') } : { present: false }]));
}
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function endpoint(port) { assert.ok(Number.isInteger(port) && port >= 20000 && port <= 60000, 'website_port'); return `http://127.0.0.1:${port}`; }
function publicAssets(root) {
  const result = [];
  function walk(directory, prefix) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), 'website_public_symlink');
      if (entry.isDirectory()) walk(join(directory, entry.name), `${prefix}${entry.name}/`);
      else if (entry.isFile()) result.push(`${prefix}${entry.name}`);
    }
  }
  walk(join(root, 'public'), '/'); return result.sort();
}
function allowedRequest({ method, raw, origin, assets }) {
  if (!['GET', 'HEAD'].includes(method) || typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//') || /[\\\r\n#]/.test(raw)) return false;
  let url; try { url = new URL(raw, origin); } catch { return false; }
  if (url.origin !== origin || url.username || url.password || url.pathname.includes('%') || raw.split('?')[0] !== url.pathname) return false;
  if (pages.has(url.pathname)) return [...url.searchParams.keys()].every(key => key === '_rsc');
  if (assets.includes(url.pathname) || /^\/_next\/static\/[A-Za-z0-9_./-]+$/.test(url.pathname)) return [...url.searchParams.keys()].every(key => key === 'v');
  if (url.pathname === '/_next/image') return assets.includes(url.searchParams.get('url')) && /^(16|32|48|64|96|128|256|384|640|750|828|1080|1200|1920|2048|3840)$/.test(url.searchParams.get('w') ?? '') && url.searchParams.get('q') === '75' && [...url.searchParams.keys()].every(key => ['url', 'w', 'q'].includes(key));
  return false;
}
// Adapted from frozen billing b7ff/781 newTestChildEnvironment.ts, SHA-256
// 3bec9efa59f74176884354ed133307df37c374b923b266d95a83c512e9ac82b0.
// Website has no Vitest subprocess purpose: all preload/loader CLI options are unsupported.
function checkedEnvironment(env, execArgv) {
  const managed = captureManagedEnvironment(env);
  managedNodePath.capture(managed.selectors.NODE_PATH);
  const unsupported = () => { throw Error('website_child_options_unsupported'); };
  const heap = /^--max[-_]old[-_]space[-_]size=[1-9][0-9]*$/;
  // Official Node images export version metadata; it cannot select another runtime.
  if (Object.hasOwn(env, 'NODE_VERSION') && env.NODE_VERSION !== process.versions.node) unsupported();
  for (const key of Object.keys(env)) {
    if (/^(LD_|DYLD_|OPENSSL_)/.test(key) || (key.startsWith('NODE_') && !['NODE_OPTIONS', 'NODE_ENV', 'NODE_EXTRA_CA_CERTS', 'NODE_USE_ENV_PROXY', 'NODE_PATH', 'NODE_VERSION'].includes(key))) unsupported();
  }
  if (env.NODE_OPTIONS?.trim() && !heap.test(env.NODE_OPTIONS.trim())) unsupported();
  if (execArgv.some(option => !heap.test(option))) unsupported();
  const base = Object.fromEntries(inherited.filter(key => typeof env[key] === 'string').map(key => [key, env[key]]));
  const options = [env.NODE_OPTIONS, ...execArgv].filter(value => value !== undefined && value !== '').join(' ');
  revalidateManagedEnvironment(env, managed);
  return { ...base, ...managed.controls, NODE_OPTIONS: options.trim() ? options : '--max-old-space-size=3072' };
}
function childEnvironment(env, { directory, configPath }, execArgv = process.execArgv) {
  assert.ok(directory.startsWith('/tmp/axiom-website-') && configPath === join(directory, 'config.json'), 'website_private_paths');
  const base = checkedEnvironment(env, execArgv);
  return { ...base, TMPDIR: join(directory, 'tmp'), XDG_CONFIG_HOME: join(directory, 'config'), XDG_CACHE_HOME: join(directory, 'cache'), NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', AXIOM_WEBSITE_VISUAL_MODE: 'owned-website-visual', AXIOM_WEBSITE_CONFIG: configPath, AWS_CONFIG_FILE: '/dev/null', AWS_SHARED_CREDENTIALS_FILE: '/dev/null', AWS_EC2_METADATA_DISABLED: 'true' };
}
function chromiumArgs({ profile, proxyPort, cdpPort }) {
  assert.ok(profile.startsWith('/tmp/axiom-website-') && profile.endsWith('/chromium'), 'website_browser_profile');
  endpoint(proxyPort); endpoint(cdpPort); assert.notEqual(proxyPort, cdpPort);
  return ['--headless=new', '--enable-automation', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--disable-default-apps', '--disable-extensions', '--disable-sync', '--disable-quic', '--no-first-run', '--no-default-browser-check', '--disable-breakpad', '--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', `--proxy-server=http://127.0.0.1:${proxyPort}`, '--proxy-bypass-list=<-loopback>', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, '--window-size=1440,1000', 'about:blank'];
}
function processStat(pid) {
  const raw = readFileSync(`/proc/${pid}/stat`, 'utf8'); const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
  return { pid, state: fields[0], group: Number(fields[2]), start: fields[19] };
}
function snapshot(pid) { return { ...processStat(pid), executable: realpathSync(`/proc/${pid}/exe`) }; }
function groupMembers(group, io = { pids: () => readdirSync('/proc').filter(name => /^\d+$/.test(name)).map(Number), stat: processStat, executable: pid => realpathSync(`/proc/${pid}/exe`) }) {
  assert.ok(Number.isInteger(group) && group > 0, 'website_group_invalid');
  const rows = [];
  const gone = error => ['ENOENT', 'ESRCH'].includes(error.code);
  function readStat(pid) { try { return io.stat(pid); } catch (error) { if (gone(error)) return null; throw error; } }
  for (const pid of io.pids()) {
    const before = readStat(pid);
    // Unrelated executable metadata is never consulted. Unreadable stat still refuses,
    // because relevance cannot be established safely in that case.
    if (!before || before.group !== group || before.state === 'Z') continue;
    let executable, metadataError;
    try { executable = io.executable(pid); } catch (error) { metadataError = error; }
    const after = readStat(pid);
    if (!after) continue;
    assert.ok(before.pid === after.pid && before.group === after.group && before.start === after.start, 'website_group_identity_changed');
    if (after.state === 'Z') continue;
    if (metadataError) throw metadataError; // A live relevant member must remain inspectable.
    rows.push({ ...after, executable });
  }
  return rows;
}
function ownedNextOptions({ root, dist, appPort, actual }) {
  endpoint(appPort);
  assert.ok(dist.startsWith(`${root}/.next/visual-`), 'website_owned_dist');
  return { dev: true, webpack: true, dir: root, hostname: '127.0.0.1', port: appPort, conf: { ...actual, distDir: relative(root, dist), typescript: { ...actual.typescript, tsconfigPath: relative(root, join(dist, 'tsconfig.json')) } } };
}
function sameOwner(original, current) { return original.pid === current.pid && original.start === current.start && original.group === original.pid && current.group === original.group && current.executable === original.executable; }
function listeners() {
  return ['tcp', 'tcp6'].flatMap(family => readFileSync(`/proc/net/${family}`, 'utf8').trim().split('\n').slice(1).flatMap(line => {
    const fields = line.trim().split(/\s+/); if (fields[3] !== '0A') return [];
    const [address, port] = fields[1].split(':'); return [{ family, address, port: parseInt(port, 16), inode: fields[9] }];
  }));
}
function descriptors(pid) {
  return readdirSync(`/proc/${pid}/fd`).flatMap(fd => { try { return [readlinkSync(`/proc/${pid}/fd/${fd}`)]; } catch (error) { if (error.code === 'ENOENT') return []; throw error; } });
}
function proveListener(owner, port, io = { snapshot, listeners, descriptors }) {
  endpoint(port);
  assert.ok(sameOwner(owner, io.snapshot(owner.pid)), 'website_listener_owner_changed');
  const rows = io.listeners().filter(row => row.port === port);
  assert.ok(rows.length > 0, 'website_listener_not_ready');
  assert.equal(rows.length, 1, 'website_listener_collision');
  const row = rows[0];
  assert.ok(row.family === 'tcp' && row.address === '0100007F' && /^[1-9][0-9]*$/.test(row.inode), 'website_listener_not_exact_loopback');
  // Require the leader itself to own CDP; no inferred descendant permission.
  assert.ok(io.descriptors(owner.pid).includes(`socket:[${row.inode}]`), 'website_listener_not_owned');
  assert.ok(sameOwner(owner, io.snapshot(owner.pid)), 'website_listener_owner_changed');
  assert.deepEqual(io.listeners().filter(candidate => candidate.port === port), rows, 'website_listener_changed');
  return { inode: row.inode, owner };
}
module.exports = { captureManagedEnvironment, revalidateManagedEnvironment, managedSelectorIdentity, groupMembers, ownedNextOptions, checkedEnvironment, proveListener, sha256, endpoint, publicAssets, allowedRequest, childEnvironment, chromiumArgs, snapshot, sameOwner };
