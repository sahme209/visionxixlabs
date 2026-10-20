import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, realpathSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import policy from './fixtures/ownedWebsitePolicy.cjs';

export const screenshotNames = Object.freeze(['home-desktop.png', 'agent-review-desktop.png', 'terraform-held-desktop.png', 'product-mobile.png', 'product-reduced-motion-mobile.png', 'approval-documentation.png']);
const root = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));
const manifestPath = '/tmp/axiom-website-review-ci.json';
function privateDirectory(path) {
  const stat = lstatSync(path);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700 && realpathSync(path) === path, 'website_ci_private_directory');
}
export function privateFile(path, limit = 1024 * 1024) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    assert.ok(stat.isFile() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600 && stat.size <= limit, 'website_ci_private_file');
    const allocation = Buffer.alloc(stat.size + 1);
    let length = 0; let received;
    while (length < allocation.length && (received = readSync(fd, allocation, length, allocation.length - length, null)) > 0) length += received;
    const bytes = allocation.subarray(0, length);
    const after = fstatSync(fd);
    assert.ok(bytes.length === stat.size && after.size === stat.size && after.mtimeMs === stat.mtimeMs && after.ctimeMs === stat.ctimeMs, 'website_ci_file_changed');
    return bytes;
  } finally { closeSync(fd); }
}
function json(path) { return JSON.parse(privateFile(path).toString('utf8')); }
export function reviewManifest(manifest, expected, actualRoot, actualHead, clean) {
  assert.match(expected ?? '', /^[a-f0-9]{40}$/, 'website_ci_expected_source');
  assert.equal(actualHead, expected, 'website_ci_source_mismatch');
  assert.equal(clean, '', 'website_ci_dirty_source');
  assert.equal(manifest.schema, 1); assert.equal(manifest.root, actualRoot);
  assert.equal(manifest.sourceHead, expected); assert.equal(manifest.productionEquivalent, false);
  assert.ok(manifest.hashes && Object.keys(manifest.hashes).length >= 15, 'website_ci_source_closure');
  return manifest;
}
export function publicSummary(sourceHead, result, capture, done, nonce) {
  assert.match(sourceHead, /^[a-f0-9]{40}$/);
  if (result) assert.equal(result.sourceHead, sourceHead, 'website_ci_result_source');
  if (done) assert.equal(done.nonce, nonce, 'website_ci_receipt_nonce');
  const passed = result?.status === 'driver_finished' && result?.sourceUnchanged === true && result?.cleanup === 'owned_groups_empty' && capture?.success === true && done?.success === true;
  const operation = capture?.timedOutOperation;
  const methods = ['Emulation.setDeviceMetricsOverride', 'Emulation.setEmulatedMedia', 'Fetch.enable', 'Fetch.continueRequest', 'Fetch.failRequest', 'Input.dispatchKeyEvent', 'Input.dispatchMouseEvent', 'Log.enable', 'Page.bringToFront', 'Page.captureScreenshot', 'Page.enable', 'Page.navigate', 'Runtime.enable', 'Runtime.evaluate', 'Target.activateTarget', 'Target.closeTarget', 'Target.createTarget'].map(name => `cdp.${name}`);
  return { schema: 1, sourceHead, sourceKind: 'pull_request_head', productionEquivalent: false, outcome: passed ? 'passed' : result ? 'failed' : 'unavailable', cleanup: result?.cleanup === 'owned_groups_empty' ? 'owned_groups_empty' : result ? 'failed_or_unverified' : 'unavailable', sourceUnchanged: result?.sourceUnchanged === true, captureSuccess: capture?.success === true, timedOutOperation: operation == null ? null : [...methods, 'http.targets', 'websocket.open', 'sleep', 'unclassified'].includes(operation) ? operation : 'unclassified', qualification: 'Isolated public website fixture only; not production, authentication, native desktop, or customer deployment acceptance.' };
}
export function pngDimensions(bytes) {
  assert.ok(bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR', 'website_ci_png');
  const width = bytes.readUInt32BE(16); const height = bytes.readUInt32BE(20);
  assert.ok(width > 0 && width <= 1440 && height > 0 && height <= 2400, 'website_ci_png_dimensions');
  return { width, height };
}
export function collect({ manifest, expected, temporary = '/tmp', destination }) {
  assert.equal(manifest.sourceHead, expected, 'website_ci_manifest_source');
  assert.equal(manifest.root, root, 'website_ci_manifest_root');
  const matches = [];
  for (const name of readdirSync(temporary).filter(name => /^axiom-website-[A-Za-z0-9]{6}$/.test(name))) {
    const directory = join(temporary, name); privateDirectory(directory);
    if (!existsSync(join(directory, 'config.json'))) continue;
    const config = json(join(directory, 'config.json'));
    if (config.root !== root) continue;
    assert.equal(config.directory, directory); assert.match(config.nonce, /^[a-f0-9]{32}$/);
    assert.deepEqual(config.hashes, manifest.hashes, 'website_ci_config_source');
    assert.deepEqual(config.framework, manifest.framework, 'website_ci_config_framework');
    matches.push({ directory, config });
  }
  assert.ok(matches.length <= 1, 'website_ci_ambiguous_window');
  let result; let capture; let done; let nonce; const screenshots = [];
  if (matches.length) {
    const { directory, config } = matches[0]; nonce = config.nonce;
    for (const name of ['result.json', 'capture.json', 'done.json']) {
      if (!existsSync(join(directory, name))) continue;
      const value = json(join(directory, name));
      if (name === 'result.json') result = value;
      if (name === 'capture.json') capture = value;
      if (name === 'done.json') done = value;
    }
    const screenshotDirectory = join(directory, 'screenshots');
    if (existsSync(screenshotDirectory)) {
      privateDirectory(screenshotDirectory);
      const files = readdirSync(screenshotDirectory);
      assert.ok(files.every(name => screenshotNames.includes(name)), 'website_ci_unknown_image');
      let total = 0;
      for (const name of files) {
        const bytes = privateFile(join(screenshotDirectory, name), 8 * 1024 * 1024); total += bytes.length;
        assert.ok(total <= 24 * 1024 * 1024, 'website_ci_image_budget');
        screenshots.push({ name, bytes, ...pngDimensions(bytes) });
      }
      const reported = capture?.images ?? [];
      assert.ok(Array.isArray(reported) && reported.length === screenshots.length, 'website_ci_image_receipts');
      // CDP clip dimensions are CSS floats; PNG dimensions are device-pixel integers.
      for (const image of screenshots) assert.equal(reported.filter(row => row.path === join(screenshotDirectory, image.name) && Number.isFinite(row.width) && row.width > 0 && row.width <= 1440 && Number.isFinite(row.height) && row.height > 0 && row.height <= 2400 && Math.abs(row.width - image.width) <= 1 && Math.abs(row.height - image.height) <= 1).length, 1, 'website_ci_image_receipt');
    }
  }
  const summary = publicSummary(expected, result, capture, done, nonce);
  if (summary.outcome === 'passed') assert.equal(screenshots.length, screenshotNames.length, 'website_ci_complete_images');
  // Validate all inputs before creating a fresh upload directory. Never reuse or remove one.
  assert.equal(existsSync(destination), false, 'website_ci_existing_destination');
  mkdirSync(destination, { mode: 0o700 }); mkdirSync(join(destination, 'screenshots'), { mode: 0o700 });
  for (const image of screenshots) writeFileSync(join(destination, 'screenshots', image.name), image.bytes, { mode: 0o600, flag: 'wx' });
  writeFileSync(join(destination, 'summary.json'), JSON.stringify({ ...summary, images: screenshots.map(({ name, width, height }) => ({ name, width, height })) }, null, 2), { mode: 0o600, flag: 'wx' });
  return summary;
}
function main() {
  const expected = process.env.AXIOM_WEBSITE_CI_SOURCE_SHA;
  const env = policy.checkedEnvironment(process.env, process.execArgv);
  const gitEnv = { ...env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const git = args => execFileSync('git', args, { cwd: root, env: gitEnv, timeout: 5000, encoding: 'utf8' }).trim();
  const bytes = privateFile(manifestPath);
  const manifest = reviewManifest(JSON.parse(bytes.toString('utf8')), expected, root, git(['rev-parse', 'HEAD']), git(['status', '--porcelain', '--untracked-files=no']));
  const output = process.env.GITHUB_OUTPUT;
  assert.ok(output, 'website_ci_output_required');
  if (process.argv[2] === 'review') appendFileSync(output, `digest=${createHash('sha256').update(bytes).digest('hex')}\n`);
  else if (process.argv[2] === 'collect') {
    const destination = join(process.env.RUNNER_TEMP, 'axiom-website-public');
    collect({ manifest, expected, destination });
    appendFileSync(output, 'ready=true\n'); // No output eligibility on any validation/copy failure.
  } else throw Error('website_ci_command');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { console.error('website_ci_refused'); process.exitCode = 1; }
}
