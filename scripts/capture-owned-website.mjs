import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'node:http';
import policy from './fixtures/ownedWebsitePolicy.cjs';
import pointerObservation from './fixtures/ownedWebsitePointerObservation.cjs';
import transport from './fixtures/ownedWebsiteSession.cjs';
import managedNodePath from './fixtures/ownedWebsiteManagedNodePath.cjs';
function pointerForControl(label) {
  const controls = label === 'Essential only' ? document.querySelector('[role="dialog"][aria-labelledby="privacy-consent-title"]')?.querySelectorAll('button') ?? [] : document.querySelectorAll('#product-tour button, #product-tour a');
  const element = [...controls].find(el => (el.getAttribute('aria-label') ?? el.textContent.trim()) === label);
  if (!element || element.disabled) throw Error('missing_control');
  const measurement = label === 'Read approval workflow' ? Object.getOwnPropertyDescriptor(window, '__axiomPointerMeasure') : null;
  const observe = measurement && Object.hasOwn(measurement, 'value') && typeof measurement.value === 'function' ? measurement.value : null;
  if (observe) observe('selection');
  element.scrollIntoView({ block: 'center', behavior: 'instant' });
  const box = element.getBoundingClientRect();
  const x = box.x + box.width / 2; const y = box.y + box.height / 2;
  if (!Number.isFinite(x) || !Number.isFinite(y) || box.width <= 0 || box.height <= 0 || x < 0 || x >= innerWidth || y < 0 || y >= innerHeight) throw Error('control_geometry_invalid');
  const hit = document.elementFromPoint(x, y);
  if (!hit || (hit !== element && !element.contains(hit))) throw Error('control_target_obscured');
  if (observe) observe('after_scroll_call', { x, y });
  return { x, y };
}
// Observation only: no event cancellation, navigation calls, source text or credentials.
function installDocumentationClickProbe() {
  const anchor = document.querySelector('#product-tour a[href="/docs/approval-workflow"]');
  const state = { captureSeen: false, bubbleSeen: false, targetIsDocumentation: null, trusted: null, primaryButton: null, defaultPrevented: null, routerIntentSeen: false };
  let captured;
  Object.defineProperty(window, '__axiomDocumentationClickProbe', { value: state, configurable: true });
  document.addEventListener('click', event => {
    captured = event; state.captureSeen = true; state.targetIsDocumentation = Boolean(anchor && (event.target === anchor || anchor.contains(event.target)));
    state.trusted = event.isTrusted === true; state.primaryButton = event.button === 0;
  }, { capture: true, once: true, passive: true });
  window.addEventListener('click', event => { if (event === captured) { state.bubbleSeen = true; state.defaultPrevented = event.defaultPrevented === true; } }, { once: true, passive: true });
  window.addEventListener('axiom:documentation-navigation-intent', () => { state.routerIntentSeen = true; }, { once: true, passive: true });
}
function readDocumentationClickProbe() {
  const descriptor = Object.getOwnPropertyDescriptor(window, '__axiomDocumentationClickProbe');
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : null;
}
function controlToken(label) {
  return ({ 'Step 2: Make a small, reviewable edit.': 'edit_step', 'Play story': 'play', 'Pause story': 'pause', 'Step 3: Review the bounded check.': 'review_step', 'Simulate approval': 'sample_approve', 'Reject sample': 'sample_reject', 'Replay story': 'replay_control', 'Agent & approval': 'agent_story', 'Step 3: Decide on the exact action.': 'agent_decide', 'Terraform & cloud': 'terraform_story', 'Step 3: Keep the release on hold.': 'terraform_hold', 'Next step': 'next_control', 'Read approval workflow': 'documentation_control', 'Essential only': 'essential_consent_control' })[label] ?? 'unclassified';
}
function isHomepagePlaybackReady() {
  const play = document.querySelector('[aria-label="Play story"]');
  return document.readyState === 'complete' && play instanceof HTMLButtonElement && play.disabled === false;
}
function readNextBootstrapMarkers() {
  try {
    const next = Object.getOwnPropertyDescriptor(window, 'next');
    const appDir = next && Object.hasOwn(next, 'value') && next.value && Object.getOwnPropertyDescriptor(next.value, 'appDir');
    const version = next && Object.hasOwn(next, 'value') && next.value && Object.getOwnPropertyDescriptor(next.value, 'version');
    const flightDescriptor = Object.getOwnPropertyDescriptor(window, '__next_f');
    const flight = flightDescriptor && Object.hasOwn(flightDescriptor, 'value') ? flightDescriptor.value : undefined;
    const push = Array.isArray(flight) ? Object.getOwnPropertyDescriptor(flight, 'push') : undefined;
    return { bootstrapRegistered: Boolean(appDir && Object.hasOwn(appDir, 'value') && appDir.value === true && version && Object.hasOwn(version, 'value') && version.value === '16.3.8'), flightArrayPresent: Array.isArray(flight), flightConsumerInstalled: Boolean(push && Object.hasOwn(push, 'value') && typeof push.value === 'function' && push.value !== Array.prototype.push) };
  } catch { return null; }
}
function sanitizeNextBootstrapMarkers(value) {
  const keys = ['bootstrapRegistered', 'flightArrayPresent', 'flightConsumerInstalled'];
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return null;
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'boolean') return null;
    result[key] = descriptor.value;
  }
  return result;
}
function readPreImageDomSnapshot() {
  try {
    const play = document.querySelector('[aria-label="Play story"]');
    return { readyState: document.readyState, tourPresent: Boolean(document.querySelector('#product-tour')), playPresent: Boolean(play),
      playDisabled: play instanceof HTMLButtonElement ? play.disabled : null, reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches, visibility: document.visibilityState };
  } catch { return null; }
}
function readScriptCounts() {
  try {
    const cap = value => Math.min(value, 4096);
    const scripts = Array.from(document.scripts);
    const counts = { elements: cap(scripts.length), external: cap(scripts.filter(script => script.hasAttribute('src')).length), inline: cap(scripts.filter(script => !script.hasAttribute('src')).length), resourceSuccess: 0, resourceFailure: 0, resourceUnknown: 0 };
    for (const entry of performance.getEntriesByType('resource')) {
      if (entry.initiatorType !== 'script') continue;
      const status = entry.responseStatus;
      const key = Number.isInteger(status) && status >= 200 && status < 400 ? 'resourceSuccess' : Number.isInteger(status) && status >= 400 && status <= 599 ? 'resourceFailure' : 'resourceUnknown';
      counts[key] = cap(counts[key] + 1);
    }
    return counts;
  } catch { return null; }
}
function sanitizeScriptCounts(value) {
  const keys = ['elements', 'external', 'inline', 'resourceSuccess', 'resourceFailure', 'resourceUnknown'];
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return null;
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || !Number.isInteger(descriptor.value) || descriptor.value < 0 || descriptor.value > 4096) return null;
    result[key] = descriptor.value;
  }
  return result;
}
/** Only fixed primitive observations cross into the private receipt; unknown is not readiness evidence. */
function sanitizePreImageDomSnapshot(value) {
  try {
    const keys = ['readyState', 'tourPresent', 'playPresent', 'playDisabled', 'reducedMotion', 'visibility'];
    if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype || Reflect.ownKeys(value).length !== keys.length) return null;
    /** @type {Record<string, unknown>} */
    const data = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) return null;
      data[key] = descriptor.value;
    }
    if (typeof data.readyState !== 'string' || !['loading', 'interactive', 'complete'].includes(data.readyState)
      || typeof data.tourPresent !== 'boolean' || typeof data.playPresent !== 'boolean' || typeof data.reducedMotion !== 'boolean'
      || (data.playPresent ? typeof data.playDisabled !== 'boolean' : data.playDisabled !== null)
      || typeof data.visibility !== 'string' || !['hidden', 'visible'].includes(data.visibility)) return null;
    return { readyState: data.readyState, tourPresent: data.tourPresent, playPresent: data.playPresent, playDisabled: data.playDisabled, reducedMotion: data.reducedMotion, visibility: data.visibility };
  } catch { return null; }
}
// Start the absolute clock before config, listener checks, HTTP or WebSocket setup.
const driverStartedAt = Date.now();
const driverElapsedMs = () => Math.max(0, Math.min(120000, Date.now() - driverStartedAt));
const session = transport.createSession({ duration: 120000 });
let directory, config, success = false, failure = null, denied = 0, imageBytes = 0;
/** @type {{phase: string, lastDomSnapshot: ReturnType<typeof sanitizePreImageDomSnapshot>} | null} */
let preImageWait = null;
const scriptRequests = { allowed: 0, denied: 0 };
let evaluationExceptionClass = null;
let homeCapturePhase = null;
let currentInteraction = 'setup';
let lastInteraction = null;
let documentationTimeoutSnapshot = null;
let documentationPreWaitSnapshot = null;
let documentationTiming = null;
let documentationClick = null;
let documentationPointer = null;
let documentationTransitionSeen = false;
let mainFrameId = null;
const consoleErrors = [], evidence = [], images = [];
const interrupted = () => session.stop(Error('website_driver_interrupted'));
process.once('SIGTERM', interrupted); process.once('SIGINT', interrupted);
try {
  directory = process.argv[2];
  assert.ok(/^\/tmp\/axiom-website-[A-Za-z0-9]+$/.test(directory ?? '') && realpathSync(directory) === directory, 'website_owned_capture_directory');
  const candidate = JSON.parse(readFileSync(join(directory, 'config.json'), 'utf8'));
  assert.equal(candidate.directory, directory); assert.match(candidate.nonce, /^[a-f0-9]{32}$/);
  managedNodePath.revalidate(process.env.NODE_PATH, candidate.managedNodePath);
  config = candidate; // Only a validated, directory-bound nonce can be written in the final receipt.
  const windowState = JSON.parse(readFileSync(join(directory, 'window.json'), 'utf8'));
  assert.equal(windowState.directory, directory); assert.equal(windowState.nonce, config.nonce);
  assert.equal(windowState.bundler, 'webpack');
  assert.equal(windowState.origin, policy.endpoint(config.appPort)); assert.equal(windowState.productionEquivalent, false);
  for (const owner of windowState.owners) assert.ok(policy.sameOwner(owner, policy.snapshot(owner.pid)), 'website_capture_owner_changed');
  for (const [path, hash] of Object.entries(config.hashes)) assert.equal(policy.sha256(path), hash, 'website_capture_source_changed');
  assert.equal(windowState.cdpOrigin, policy.endpoint(config.cdpPort));
  const browserOwner = windowState.browserOwner;
  assert.equal(browserOwner.executable, realpathSync('/usr/lib/chromium/chromium'));
  assert.ok(windowState.owners.some(owner => policy.sameOwner(owner, browserOwner)), 'website_capture_browser_not_registered');
  const cdpOrigin = new URL(windowState.cdpOrigin);
  function proveEndpoint() { session.assertActive(); policy.proveListener(browserOwner, config.cdpPort); }
  const sleep = session.sleep;
  function getTargets() {
    return session.operation((resolve, reject, onCancel) => {
      proveEndpoint(); // No HTTP probe of an unowned listener, even during startup retry.
      const req = request({ hostname: '127.0.0.1', port: config.cdpPort, path: '/json/list', method: 'GET', agent: false }, res => {
        let text = '';
        res.on('data', chunk => { text += chunk; if (text.length > 65536) req.destroy(Error('website_cdp_response_bound')); });
        res.on('error', reject);
        res.on('end', () => { try { proveEndpoint(); assert.equal(res.statusCode, 200); resolve(JSON.parse(text)); } catch (error) { reject(error); } });
      });
      req.on('error', reject); onCancel(() => req.destroy()); req.end();
    }, 2000, 'http.targets');
  }
  const targets = await getTargets();
  const target = targets.find(row => row.type === 'page' && row.url === 'about:blank'); assert.ok(target, 'website_initial_blank_target');
  const endpoint = new URL(target.webSocketDebuggerUrl);
  assert.equal(endpoint.protocol, 'ws:'); assert.equal(endpoint.host, cdpOrigin.host); assert.match(endpoint.pathname, /^\/devtools\/page\/[A-Fa-f0-9-]+$/);
  const { send } = await transport.openChannel({ session, endpoint, createSocket: value => new WebSocket(value), proveEndpoint, onEvent: (data, send) => {
    if (data.method === 'Fetch.requestPaused') {
      let allowed = false; try { const url = new URL(data.params.request.url); allowed = url.origin === windowState.origin && !url.username && !url.password && policy.allowedRequest({ method: data.params.request.method, raw: `${url.pathname}${url.search}`, origin: windowState.origin, assets: config.assets }); } catch { /* refuse */ }
      if (!allowed) denied++;
      if (data.params.resourceType === 'Script') { const key = allowed ? 'allowed' : 'denied'; scriptRequests[key] = Math.min(4096, scriptRequests[key] + 1); }
      void send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? { requestId: data.params.requestId } : { requestId: data.params.requestId, errorReason: 'BlockedByClient' }).catch(error => session.stop(error));
    }
    if (data.method === 'Page.frameNavigated' && !data.params.frame?.parentId && typeof data.params.frame?.id === 'string') mainFrameId = data.params.frame.id;
    if (((data.method === 'Page.frameNavigated' && !data.params.frame?.parentId && data.params.frame?.id === mainFrameId) || (data.method === 'Page.navigatedWithinDocument' && mainFrameId !== null && data.params.frameId === mainFrameId)) && ['documentation_control', 'documentation_check', 'approval-documentation'].includes(currentInteraction)) {
      try { const url = new URL(data.params.frame?.url ?? data.params.url); if (url.origin === windowState.origin && url.pathname === '/docs/approval-workflow') documentationTransitionSeen = true; } catch { /* no arbitrary URL is retained */ }
    }
    if (data.method === 'Runtime.exceptionThrown' && consoleErrors.length < 128) consoleErrors.push('runtime_exception');
    if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error' && consoleErrors.length < 128) consoleErrors.push('console_error');
    if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error' && consoleErrors.length < 128) consoleErrors.push(['javascript', 'network', 'security'].includes(data.params.entry.source) ? data.params.entry.source : 'other');
  } });
  async function evaluate(fn, argument) { const result = await send('Runtime.evaluate', { expression: `(${fn})(${JSON.stringify(argument)})`, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) { const name = result.exceptionDetails.exception?.className; evaluationExceptionClass = ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'Error'].includes(name) ? name : 'other'; } assert.ok(!result.exceptionDetails, 'website_browser_evaluation_failed'); return result.result.value; }
  /** @param {string} [preImagePhase] */
  async function waitFor(fn, argument, timeout = 45000, preImagePhase = undefined, onPoll = undefined, observeDocumentation = false) {
    const deadline = Date.now() + timeout;
    if (preImagePhase !== undefined) assert.ok(['homepage_document', 'homepage_playback'].includes(preImagePhase), 'website_dom_diagnostic_phase');
    /** @type {{phase: string, lastDomSnapshot: ReturnType<typeof sanitizePreImageDomSnapshot>, nextMarkers?: ReturnType<typeof sanitizeNextBootstrapMarkers>, scriptCounts?: ReturnType<typeof sanitizeScriptCounts>, predicateExceptionClass?: string} | null} */
    const diagnostic = preImagePhase === undefined ? null : { phase: preImagePhase, lastDomSnapshot: null };
    if (diagnostic) preImageWait = diagnostic;
    while (Date.now() < deadline) {
      const polled = await evaluate(diagnostic ? `argument => { try { return { satisfied: (${fn})(argument), snapshot: (${readPreImageDomSnapshot})(), scriptCounts: (${readScriptCounts})(), nextMarkers: (${readNextBootstrapMarkers})(), predicateExceptionClass: null }; } catch (error) { return { satisfied: false, snapshot: (${readPreImageDomSnapshot})(), scriptCounts: (${readScriptCounts})(), nextMarkers: (${readNextBootstrapMarkers})(), predicateExceptionClass: ["TypeError", "ReferenceError", "SyntaxError", "RangeError", "Error"].includes(error?.name) ? error.name : "other" }; } }` : observeDocumentation ? `argument => ({ satisfied: (${fn})(argument), click: (${readDocumentationClickProbe})(), pointer: (${pointerObservation.readPointerObservation})() })` : fn, argument);
      if (diagnostic) { diagnostic.lastDomSnapshot = sanitizePreImageDomSnapshot(polled.snapshot); diagnostic.nextMarkers = sanitizeNextBootstrapMarkers(polled.nextMarkers); const scripts = sanitizeScriptCounts(polled.scriptCounts); if (scripts) diagnostic.scriptCounts = scripts; if (polled.predicateExceptionClass !== null) { diagnostic.predicateExceptionClass = ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'Error'].includes(polled.predicateExceptionClass) ? polled.predicateExceptionClass : 'other'; throw Error('website_browser_evaluation_failed'); } }
      if (observeDocumentation && polled.click !== null) documentationClick = polled.click;
      if (observeDocumentation && polled.pointer != null) documentationPointer = polled.pointer;
      if (onPoll) onPoll();
      if ((diagnostic || observeDocumentation) ? polled.satisfied : polled) { if (diagnostic) preImageWait = null; return; }
      await sleep(100);
    }
    throw Error('website_dom_timeout');
  }
  async function viewport(width, reduced = false) { await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 360 }); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] }); }
  /** @param {string} [preImagePhase] */
  async function navigate(path, preImagePhase = undefined) { assert.ok(['/', '/product', '/docs/approval-workflow'].includes(path)); await send('Page.navigate', { url: `${windowState.origin}${path}` }); await waitFor(path => document.readyState === 'complete' && Boolean(document.querySelector(path === '/docs/approval-workflow' ? '#execution' : '#product-tour')), path, 45000, preImagePhase); }
  async function click(label) {
    currentInteraction = controlToken(label);
    const point = await evaluate(pointerForControl, label);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    lastInteraction = currentInteraction;
  }
  async function frame(name, selector = '#product-tour') {
    currentInteraction = ['home-desktop', 'agent-review-desktop', 'terraform-held-desktop', 'product-mobile', 'product-reduced-motion-mobile', 'approval-documentation'].includes(name) ? name : 'unclassified';
    assert.ok(images.length < 8); await evaluate(selector => document.querySelector(selector).scrollIntoView({ block: 'start', behavior: 'instant' }), selector); await sleep(150);
    const box = await evaluate(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: Math.min(r.height, 2400), scale: 1 }; }, selector);
    assert.ok(box.width <= 1440 && box.height <= 2400 && box.width > 0 && box.height > 0, 'website_framebuffer_bound');
    const result = await send('Page.captureScreenshot', { format: 'png', clip: box, captureBeyondViewport: true }); const bytes = Buffer.from(result.data, 'base64'); imageBytes += bytes.length;
    assert.ok(bytes.length <= 8 * 1024 * 1024 && imageBytes <= 24 * 1024 * 1024, 'website_image_bound');
    session.assertActive();
    const path = join(directory, 'screenshots', `${name}.png`); writeFileSync(path, bytes, { mode: 0o600 }); images.push({ path, width: box.width, height: box.height });
    lastInteraction = currentInteraction;
  }
  const state = () => evaluate(() => ({ title: document.querySelector('#product-tour h2').textContent, code: document.querySelector('#product-tour pre')?.innerText ?? '' }));
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await viewport(1440); await navigate('/', 'homepage_document');
  await waitFor(isHomepagePlaybackReady, undefined, 45000, 'homepage_playback');
  currentInteraction = 'essential_consent_control';
  await waitFor(() => Boolean(document.querySelector('[role="dialog"][aria-labelledby="privacy-consent-title"]')));
  await click('Essential only');
  await waitFor(() => !document.querySelector('[role="dialog"][aria-labelledby="privacy-consent-title"]'));
  evidence.push('essential_consent_selected');
  homeCapturePhase = 'playback_ready_after_essential_consent'; await frame('home-desktop');
  await click('Step 2: Make a small, reviewable edit.'); await click('Play story'); await sleep(700); await click('Pause story');
  currentInteraction = 'play_pause_check'; const paused = await state(); await sleep(700); assert.deepEqual(await state(), paused); evidence.push('play_pause_preserves_typed_output');
  await click('Play story'); currentInteraction = 'offscreen_check'; await evaluate(() => scrollTo({ top: document.body.scrollHeight, left: 0, behavior: 'instant' })); await sleep(200); const offscreen = await state(); await sleep(5700); assert.deepEqual(await state(), offscreen); evidence.push('offscreen_timer_stopped');
  await evaluate(() => document.querySelector('#product-tour').scrollIntoView({ behavior: 'instant' })); await sleep(150); await click('Pause story');
  await click('Step 3: Review the bounded check.'); await click('Simulate approval'); currentInteraction = 'sample_approval_check'; assert.ok(await evaluate(() => document.querySelector('#product-tour').innerText.includes('Sample decision recorded')));
  await click('Reject sample'); assert.ok(await evaluate(() => document.querySelector('#product-tour').innerText.includes('Sample rejected'))); evidence.push('sample_approve_reject');
  currentInteraction = 'branch_keyboard'; const oldBranch = await evaluate(() => { const select = [...document.querySelectorAll('#product-tour select')][1]; select.focus(); return select.value; });
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitFor(old => [...document.querySelectorAll('#product-tour select')][1].value !== old, oldBranch, 2000);
  assert.equal((await state()).title, 'Choose the working context.'); evidence.push('native_branch_selector_resets_story');
  await click('Replay story'); await sleep(250); await click('Pause story'); assert.equal((await state()).title, 'Choose the working context.'); evidence.push('replay');
  await click('Step 2: Make a small, reviewable edit.'); await click('Play story');
  currentInteraction = 'hidden_document_check'; const background = await send('Target.createTarget', { url: 'about:blank' });
  try {
    await send('Target.activateTarget', { targetId: background.targetId }); await waitFor(() => document.hidden, undefined, 2000);
    const hidden = await state(); await sleep(5700); assert.deepEqual(await state(), hidden); evidence.push('hidden_document_timer_stopped');
  } finally { await send('Target.closeTarget', { targetId: background.targetId }); await send('Page.bringToFront'); }
  await click('Pause story');
  await click('Agent & approval'); await click('Step 3: Decide on the exact action.'); await frame('agent-review-desktop');
  await click('Terraform & cloud'); await click('Step 3: Keep the release on hold.'); currentInteraction = 'terraform_guard_check'; assert.equal(await evaluate(() => [...document.querySelectorAll('#product-tour button')].some(button => /apply|Simulate approval/i.test(button.textContent))), false); await frame('terraform-held-desktop'); evidence.push('terraform_apply_absent');
  await viewport(360); await navigate('/product'); await click('Step 2: Make a small, reviewable edit.');
  currentInteraction = 'mobile_overflow_check'; assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'website_mobile_overflow'); await frame('product-mobile'); evidence.push('mobile_360_no_horizontal_overflow');
  await click('Next step'); currentInteraction = 'keyboard_previous_check'; await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft' }); assert.equal((await state()).title, 'Make a small, reviewable edit.'); evidence.push('keyboard_previous');
  await viewport(360, true); await navigate('/product'); await waitFor(() => document.querySelector('[aria-label="Play story"]').disabled); await click('Next step'); await frame('product-reduced-motion-mobile'); evidence.push('reduced_motion_static_manual_step');
  await viewport(1440);
  documentationTiming = { startedMs: driverElapsedMs(), clickCompletedMs: null, preWaitCompletedMs: null, lastPollMs: null, pollCount: 0, observedMs: null };
  await evaluate(installDocumentationClickProbe);
  await evaluate(pointerObservation.installPointerObservation);
  await click('Read approval workflow'); documentationTiming.clickCompletedMs = driverElapsedMs(); try { const observation = await evaluate(`() => ({ click: (${readDocumentationClickProbe})(), pointer: (${pointerObservation.readPointerObservation})() })`); documentationClick = observation.click; documentationPointer = observation.pointer; } catch { /* navigation can replace the probe's document */ } currentInteraction = 'documentation_check'; try { documentationPreWaitSnapshot = await evaluate(() => ({ pathnameIsDocs: location.pathname === '/docs/approval-workflow', executionPresent: Boolean(document.querySelector('#execution')), tourPresent: Boolean(document.querySelector('#product-tour')) })); } catch { /* unknown observation does not replace the navigation assertion */ } documentationTiming.preWaitCompletedMs = driverElapsedMs(); try { await waitFor(() => location.pathname === '/docs/approval-workflow' && Boolean(document.querySelector('#execution')), undefined, 45000, undefined, () => { documentationTiming.lastPollMs = driverElapsedMs(); documentationTiming.pollCount = Math.min(4096, documentationTiming.pollCount + 1); }, true); }
  catch (error) {
    if (error.message === 'website_dom_timeout') {
      try { documentationTimeoutSnapshot = await evaluate(() => ({ pathnameIsDocs: location.pathname === '/docs/approval-workflow', executionPresent: Boolean(document.querySelector('#execution')), tourPresent: Boolean(document.querySelector('#product-tour')) })); } catch { /* unknown observation must not replace the original failure */ }
    }
    throw error;
  } assert.ok(await evaluate(() => document.querySelector('#execution').innerText.includes('does not verify ECS execution'))); await frame('approval-documentation', 'main'); evidence.push('actual_documentation_destination');
  session.assertActive(); success = true;
} catch (error) {
  failure = /^website_[a-z_]+$/.test(error.message ?? '') ? error.message : 'website_driver_failed';
  success = false; process.exitCode = 1;
} finally {
  session.stop();
  process.removeListener('SIGTERM', interrupted); process.removeListener('SIGINT', interrupted);
  // The only post-stop writes are this single final evidence/nonce receipt. Parent waits
  // for this owned driver's positive exit before touching its profile/dist artifacts.
  if (config) {
    if (documentationTiming) documentationTiming.observedMs = driverElapsedMs();
    const result = { success, failure, documentationTiming, documentationClick, documentationPointer, documentationTransitionSeen, scriptRequests, timedOutOperation: session.report().timedOutOperation, preImageWait, evaluationExceptionClass, homeCapturePhase, currentInteraction, lastInteraction, documentationTimeoutSnapshot, documentationPreWaitSnapshot, runtimeExceptionCount: consoleErrors.filter(category => category === 'runtime_exception').length, consoleErrorCount: consoleErrors.filter(category => category === 'console_error').length, bundler: 'webpack', productionEquivalent: false, evidence, images, deniedRequests: denied, consoleErrorCategories: consoleErrors, qualification: 'Actual local integrated Next pages; API requests denied; external fonts may fall back; screenshots require human inspection. No provider/native acceptance.' };
    writeFileSync(join(directory, 'capture.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    writeFileSync(join(directory, 'done.json'), JSON.stringify({ success, nonce: config.nonce }), { mode: 0o600 });
    process.stdout.write(`${join(directory, 'capture.json')}\n`);
  }
  // Exit this fixed owned driver after the receipt; do not wait for an uncooperative
  // WebSocket close handshake past its absolute lifetime. Parent observes the exit.
  process.exit(success ? 0 : 1);
}
