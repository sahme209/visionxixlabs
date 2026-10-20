import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, realpathSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
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
export function publicNextMarkers(value) {
  const keys = ['bootstrapRegistered', 'flightArrayPresent', 'flightConsumerInstalled'];
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return null;
  const result = { bootstrapRegistered: false, flightArrayPresent: false, flightConsumerInstalled: false };
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'boolean') return null;
    result[key] = descriptor.value;
  }
  return result;
}
export function publicProxyDelivery(proxy, result, nonce) {
  const children = Array.isArray(result?.children) ? result.children.filter(row => row?.role === 'proxy') : [];
  if (children.length !== 1 || children[0].exited !== true || !Number.isInteger(proxy?.pid) || proxy.pid <= 0 || proxy.pid !== children[0].pid || proxy.pid !== children[0].owner?.pid || proxy.pid !== result?.proxyReceipt?.pid || proxy.nonce !== nonce || result.proxyReceipt.nonce !== nonce) return null;
  if (!['stopped', 'interrupted', 'expired', 'failed', 'close_timeout'].includes(proxy.stage) || proxy.productionEquivalent !== false || !proxy.counts || typeof proxy.counts !== 'object' || Object.getPrototypeOf(proxy.counts) !== Object.prototype) return null;
  const counts = { script_accepted: 0, script_response: 0, script_complete: 0, script_cancelled: 0, script_upstream_timeout: 0, upstream_timeout: 0 };
  for (const key of ['script_accepted', 'script_response', 'script_complete', 'script_cancelled', 'script_upstream_timeout', 'upstream_timeout']) {
    const descriptor = Object.getOwnPropertyDescriptor(proxy.counts, key);
    if (!descriptor) { counts[key] = 0; continue; }
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || !Number.isInteger(descriptor.value) || descriptor.value < 0 || descriptor.value > 1000000) return null;
    counts[key] = descriptor.value;
  }
  function category(name) {
    const values = { accepted: 0, response: 0, complete: 0, cancelled: 0, status_2xx: 0, status_3xx: 0, status_4xx: 0, status_5xx: 0, status_other: 0, mime_js: 0, mime_other: 0, cancelled_successful_js: 0, cancelled_other: 0 };
    for (const key of Object.keys(values)) {
      const descriptor = Object.getOwnPropertyDescriptor(proxy.counts, `script_${name}_${key}`);
      if (!descriptor) continue;
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || !Number.isInteger(descriptor.value) || descriptor.value < 0 || descriptor.value > 1000000) return null;
      values[key] = descriptor.value;
    }
    return values;
  }
  const categories = { webpack: category('webpack'), main_app: category('main_app'), app_page: category('app_page'), app_layout: category('app_layout'), other: category('other') };
  if (Object.values(categories).some(value => value === null)) return null;
  function documentationCategory(name) {
    const values = { accepted: 0, response: 0, complete: 0, cancelled: 0, status_2xx: 0, status_3xx: 0, status_4xx: 0, status_5xx: 0, status_other: 0, mime_rsc: 0, mime_html: 0, mime_other: 0, upstream_timeout: 0 };
    for (const key of Object.keys(values)) {
      const descriptor = Object.getOwnPropertyDescriptor(proxy.counts, `docs_${name}_${key}`);
      if (!descriptor) continue;
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || !Number.isInteger(descriptor.value) || descriptor.value < 0 || descriptor.value > 1000000) return null;
      values[key] = descriptor.value;
    }
    return values;
  }
  const denied = Object.getOwnPropertyDescriptor(proxy.counts, 'docs_denied');
  if (denied && (!denied.enumerable || !Object.hasOwn(denied, 'value') || !Number.isInteger(denied.value) || denied.value < 0 || denied.value > 1000000)) return null;
  const documentation = { rsc_navigation: documentationCategory('rsc_navigation'), rsc_prefetch: documentationCategory('rsc_prefetch'), document: documentationCategory('document'), denied: denied?.value ?? 0 };
  if (!documentation.rsc_navigation || !documentation.rsc_prefetch || !documentation.document) return null;
  return { stage: proxy.stage, counts, categories, documentation };
}
const captureFailures = new Set(['website_dom_timeout', 'website_driver_failed', 'website_driver_deadline', 'website_driver_operation_timeout', 'website_driver_interrupted', 'website_driver_closed', 'website_browser_evaluation_failed', 'website_capture_browser_not_registered', 'website_capture_owner_changed', 'website_capture_source_changed', 'website_cdp_response_bound', 'website_cdp_closed', 'website_cdp_error', 'website_cdp_invalid_message', 'website_cdp_not_open', 'website_cdp_protocol', 'website_dom_diagnostic_phase', 'website_framebuffer_bound', 'website_image_bound', 'website_initial_blank_target', 'website_mobile_overflow', 'website_owned_capture_directory']);
const cleanupCodes = new Set(['website_cleanup_foreign_group_member', 'website_cleanup_leader_changed', 'website_cleanup_incomplete', 'website_pending_child_unresolved', 'website_child_group_not_empty', 'website_ledger_persistence_failed', 'website_cleanup_metadata_unverified']);
const interactionTokens = new Set(['setup', 'edit_step', 'play', 'pause', 'review_step', 'sample_approve', 'sample_reject', 'replay_control', 'agent_story', 'agent_decide', 'terraform_story', 'terraform_hold', 'next_control', 'documentation_control', 'home-desktop', 'agent-review-desktop', 'terraform-held-desktop', 'product-mobile', 'product-reduced-motion-mobile', 'approval-documentation', 'play_pause_check', 'offscreen_check', 'sample_approval_check', 'branch_keyboard', 'hidden_document_check', 'terraform_guard_check', 'mobile_overflow_check', 'keyboard_previous_check', 'documentation_check', 'essential_consent_control', 'unclassified']);
const completedEvidence = new Set(['play_pause_preserves_typed_output', 'offscreen_timer_stopped', 'sample_approve_reject', 'native_branch_selector_resets_story', 'replay', 'hidden_document_timer_stopped', 'terraform_apply_absent', 'mobile_360_no_horizontal_overflow', 'keyboard_previous', 'reduced_motion_static_manual_step', 'actual_documentation_destination', 'essential_consent_selected']);
export function publicDocumentationSnapshot(value) {
  const result = { pathnameIsDocs: false, executionPresent: false, tourPresent: false };
  const keys = Object.keys(result);
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return null;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'boolean') return null;
    result[key] = descriptor.value;
  }
  return result;
}
export function publicInteractions(capture) {
  const token = value => value == null ? null : interactionTokens.has(value) ? value : 'unclassified';
  return { currentInteraction: token(capture?.currentInteraction), lastInteraction: token(capture?.lastInteraction), completedEvidence: Array.isArray(capture?.evidence) ? [...new Set(capture.evidence.filter(value => completedEvidence.has(value)))] : [] };
}
/** Six fixed numbers only; no timestamps, labels, URLs or page contents. */
export function publicDocumentationTiming(value) {
  const keys = ['startedMs', 'clickCompletedMs', 'preWaitCompletedMs', 'lastPollMs', 'pollCount', 'observedMs'];
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return null;
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
    const number = descriptor.value;
    if (number !== null && (!Number.isInteger(number) || number < 0 || number > (key === 'pollCount' ? 4096 : 120000))) return null;
    if (key === 'pollCount' && number === null) return null;
    result[key] = number;
  }
  return result;
}
export function publicDomSnapshot(value) {
  const keys = ['readyState', 'tourPresent', 'playPresent', 'playDisabled', 'reducedMotion', 'visibility'];
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return null;
  const data = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
    data[key] = descriptor.value;
  }
  if (!['loading', 'interactive', 'complete'].includes(data.readyState) || !['hidden', 'visible'].includes(data.visibility)
    || typeof data.tourPresent !== 'boolean' || typeof data.playPresent !== 'boolean' || typeof data.reducedMotion !== 'boolean'
    || (data.playPresent ? typeof data.playDisabled !== 'boolean' : data.playDisabled !== null)) return null;
  return data;
}
export function publicCounts(value, keys) {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return null;
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || !Number.isInteger(descriptor.value) || descriptor.value < 0 || descriptor.value > 4096) return null;
    result[key] = descriptor.value;
  }
  return result;
}
export function publicServerGuard(server, result, nonce) {
  const children = Array.isArray(result?.children) ? result.children.filter(row => row?.role === 'server') : [];
  if (children.length !== 1 || children[0].exited !== true || !Number.isInteger(server?.pid) || server.pid <= 0 || server.pid !== children[0].pid || server.pid !== children[0].owner?.pid || server.pid !== result?.receipt?.pid || server.nonce !== nonce || result.receipt.nonce !== nonce) return null;
  if (!['stopping', 'expired', 'startup_failed', 'listen_failed'].includes(server.stage) || server.guard?.policy !== 'deny-all-outbound-and-new-processes' || server.guard.productionEquivalent !== false) return null;
  const guard = server.guard;
  const counts = publicCounts({ transport: guard.transport, process: guard.process, worker: guard.worker, listener: guard.listener }, ['transport', 'process', 'worker', 'listener']);
  return counts ? { stage: server.stage, counts } : null;
}
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
  const phase = capture?.preImageWait?.phase;
  const timingDescriptor = capture && Object.getOwnPropertyDescriptor(capture, 'documentationTiming');
  const timing = timingDescriptor?.enumerable && Object.hasOwn(timingDescriptor, 'value') ? timingDescriptor.value : null;
  const exceptionClass = value => value == null ? null : ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'Error', 'other'].includes(value) ? value : 'other';
  const cleanupDiagnostics = Array.isArray(result?.cleanupDiagnostics) ? result.cleanupDiagnostics.slice(0, 4).map(row => ({ role: ['server', 'proxy', 'browser', 'capture'].includes(row?.role) ? row.role : 'other', stage: ['registration', 'stop_group', 'wait_exit', 'exited_check', 'group_check'].includes(row?.stage) ? row.stage : 'other', errorCode: ['ENOENT', 'ESRCH', 'EPERM', 'EACCES', 'ERR_ASSERTION'].includes(row?.errorCode) ? row.errorCode : 'other' })) : [];
  return { ...publicInteractions(capture), documentationTiming: ['documentation_control', 'documentation_check', 'approval-documentation'].includes(capture?.currentInteraction) ? publicDocumentationTiming(timing) : null, documentationPreWaitSnapshot: capture?.currentInteraction === 'documentation_check' ? publicDocumentationSnapshot(capture.documentationPreWaitSnapshot) : null, documentationTimeoutSnapshot: capture?.currentInteraction === 'documentation_check' && capture?.failure === 'website_dom_timeout' ? publicDocumentationSnapshot(capture.documentationTimeoutSnapshot) : null, scriptRequests: publicCounts(capture?.scriptRequests, ['allowed', 'denied']), scriptCounts: publicCounts(capture?.preImageWait?.scriptCounts, ['elements', 'external', 'inline', 'resourceSuccess', 'resourceFailure', 'resourceUnknown']), schema: 1, sourceHead, sourceKind: 'pull_request_head', productionEquivalent: false, outcome: passed ? 'passed' : result ? 'failed' : 'unavailable', cleanup: result?.cleanup === 'owned_groups_empty' ? 'owned_groups_empty' : result ? 'failed_or_unverified' : 'unavailable', cleanupErrors: Array.isArray(result?.cleanupErrors) ? [...new Set(result.cleanupErrors.map(code => cleanupCodes.has(code) ? code : 'unclassified'))] : [], sourceUnchanged: result?.sourceUnchanged === true, captureSuccess: capture?.success === true, cleanupDiagnostics, homeCapturePhase: ['document_ready_before_playback', 'playback_ready_after_essential_consent'].includes(capture?.homeCapturePhase) ? capture.homeCapturePhase : null, consoleErrorCount: Number.isInteger(capture?.consoleErrorCount) && capture.consoleErrorCount >= 0 && capture.consoleErrorCount <= 128 ? capture.consoleErrorCount : null, runtimeExceptionCount: Number.isInteger(capture?.runtimeExceptionCount) && capture.runtimeExceptionCount >= 0 && capture.runtimeExceptionCount <= 128 ? capture.runtimeExceptionCount : null, evaluationExceptionClass: exceptionClass(capture?.evaluationExceptionClass), predicateExceptionClass: exceptionClass(capture?.preImageWait?.predicateExceptionClass), captureFailure: capture?.failure == null ? null : captureFailures.has(capture.failure) ? capture.failure : 'unclassified', preImagePhase: ['homepage_document', 'homepage_playback'].includes(phase) ? phase : null, nextMarkers: ['homepage_document', 'homepage_playback'].includes(phase) ? publicNextMarkers(capture.preImageWait.nextMarkers) : null, preImageDomSnapshot: ['homepage_document', 'homepage_playback'].includes(phase) ? publicDomSnapshot(capture.preImageWait.lastDomSnapshot) : null, timedOutOperation: operation == null ? null : [...methods, 'http.targets', 'websocket.open', 'sleep', 'unclassified'].includes(operation) ? operation : 'unclassified', qualification: 'Isolated public website fixture only; not production, authentication, native desktop, or customer deployment acceptance.' };
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
  let result; let capture; let done; let nonce; let server; let proxy; const screenshots = [];
  if (matches.length) {
    const { directory, config } = matches[0]; nonce = config.nonce;
    for (const name of ['result.json', 'capture.json', 'done.json', 'server.json', 'proxy.json']) {
      if (!existsSync(join(directory, name))) continue;
      const value = json(join(directory, name));
      if (name === 'result.json') result = value;
      if (name === 'capture.json') capture = value;
      if (name === 'done.json') done = value;
      if (name === 'server.json') server = value;
      if (name === 'proxy.json') proxy = value;
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
  const summary = { ...publicSummary(expected, result, capture, done, nonce), serverGuard: publicServerGuard(server, result, nonce), proxyDelivery: publicProxyDelivery(proxy, result, nonce) };
  if (summary.outcome === 'passed') assert.equal(screenshots.length, screenshotNames.length, 'website_ci_complete_images');
  // Validate all inputs before creating a fresh upload directory. Never reuse or remove one.
  assert.equal(existsSync(destination), false, 'website_ci_existing_destination');
  mkdirSync(destination, { mode: 0o700 }); mkdirSync(join(destination, 'screenshots'), { mode: 0o700 });
  for (const image of screenshots) writeFileSync(join(destination, 'screenshots', image.name), image.bytes, { mode: 0o600, flag: 'wx' });
  writeFileSync(join(destination, 'summary.json'), JSON.stringify({ ...summary, images: screenshots.map(({ name, width, height }) => ({ name, width, height })) }, null, 2), { mode: 0o600, flag: 'wx' });
  return summary;
}
export function collectForUpload({ output, ...options }) {
  assert.ok(isAbsolute(options.destination) && !/[\r\n]/.test(options.destination), 'website_ci_artifact_path');
  const summary = collect(options);
  // One directory prevents host/container translation from splitting a multiline path.
  // No eligibility outputs are written until every input and copied artifact validates.
  appendFileSync(output, `artifactPath=${options.destination}\nready=true\n`);
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
    const summary = collectForUpload({ manifest, expected, destination, output });
    process.stdout.write(`${JSON.stringify(summary)}\n`); // Constructed closed fields only, never raw receipts.
  } else throw Error('website_ci_command');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { console.error('website_ci_refused'); process.exitCode = 1; }
}
