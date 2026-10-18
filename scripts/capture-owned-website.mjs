import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { request } from 'node:http';
import policy from './fixtures/ownedWebsitePolicy.cjs';
const directory = process.argv[2];
assert.ok(/^\/tmp\/axiom-website-[A-Za-z0-9]+$/.test(directory ?? '') && realpathSync(directory) === directory, 'website_owned_capture_directory');
const windowState = JSON.parse(readFileSync(join(directory, 'window.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(directory, 'config.json'), 'utf8'));
assert.equal(windowState.directory, directory); assert.equal(windowState.nonce, config.nonce);
assert.equal(windowState.origin, policy.endpoint(config.appPort)); assert.equal(windowState.productionEquivalent, false);
for (const owner of windowState.owners) assert.ok(policy.sameOwner(owner, policy.snapshot(owner.pid)), 'website_capture_owner_changed');
for (const [path, hash] of Object.entries(config.hashes)) assert.equal(policy.sha256(path), hash, 'website_capture_source_changed');
assert.equal(windowState.cdpOrigin, policy.endpoint(config.cdpPort));
const cdpOrigin = new URL(windowState.cdpOrigin); policy.endpoint(Number(cdpOrigin.port)); assert.equal(cdpOrigin.hostname, '127.0.0.1');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function getTargets() { return new Promise((resolve, reject) => {
  const req = request({ hostname: '127.0.0.1', port: Number(cdpOrigin.port), path: '/json/list', method: 'GET', agent: false }, res => {
    let text = ''; res.on('data', chunk => { text += chunk; if (text.length > 65536) req.destroy(Error('website_cdp_response_bound')); }); res.on('end', () => { try { assert.equal(res.statusCode, 200); resolve(JSON.parse(text)); } catch (error) { reject(error); } });
  }); req.on('error', reject); req.setTimeout(2000, () => req.destroy(Error('website_cdp_timeout'))); req.end();
}); }
let targets;
for (let attempt = 0; attempt < 30; attempt++) { try { targets = await getTargets(); if (targets.some(row => row.type === 'page')) break; } catch { /* bounded local startup retry */ } await sleep(100); }
const target = targets?.find(row => row.type === 'page' && row.url === 'about:blank'); assert.ok(target, 'website_initial_blank_target');
const endpoint = new URL(target.webSocketDebuggerUrl);
assert.equal(endpoint.protocol, 'ws:'); assert.equal(endpoint.host, cdpOrigin.host); assert.match(endpoint.pathname, /^\/devtools\/page\/[A-Fa-f0-9-]+$/);
const socket = new WebSocket(endpoint);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let sequence = 0, denied = 0, imageBytes = 0;
const pending = new Map(), consoleErrors = [], evidence = [], images = [];
function send(method, params = {}) { return new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(Error(`website_cdp_timeout:${method}`)); }, 15000); pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params })); }); }
socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id) { const task = pending.get(data.id); if (!task) return; pending.delete(data.id); clearTimeout(task.timer); if (data.error) task.reject(Error(`website_cdp_protocol:${data.error.code}`)); else task.resolve(data.result); return; }
  if (data.method === 'Fetch.requestPaused') {
    let allowed = false; try { const url = new URL(data.params.request.url); allowed = url.origin === windowState.origin && !url.username && !url.password && policy.allowedRequest({ method: data.params.request.method, raw: `${url.pathname}${url.search}`, origin: windowState.origin, assets: config.assets }); } catch { /* refuse */ }
    if (!allowed) denied++;
    void send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? { requestId: data.params.requestId } : { requestId: data.params.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
  }
  if (data.method === 'Runtime.exceptionThrown' && consoleErrors.length < 128) consoleErrors.push('runtime_exception');
  if (data.method === 'Log.entryAdded' && data.params.entry.level === 'error' && consoleErrors.length < 128) consoleErrors.push(String(data.params.entry.source));
});
async function evaluate(fn, argument) { const result = await send('Runtime.evaluate', { expression: `(${fn})(${JSON.stringify(argument)})`, returnByValue: true, awaitPromise: true }); assert.ok(!result.exceptionDetails, 'website_browser_evaluation_failed'); return result.result.value; }
async function waitFor(fn, argument, timeout = 45000) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { if (await evaluate(fn, argument)) return; await sleep(100); } throw Error('website_dom_timeout'); }
async function viewport(width, reduced = false) { await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 360 }); await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] }); }
async function navigate(path) { assert.ok(['/', '/product', '/docs/approval-workflow'].includes(path)); await send('Page.navigate', { url: `${windowState.origin}${path}` }); await waitFor(path => document.readyState === 'complete' && Boolean(document.querySelector(path === '/docs/approval-workflow' ? '#execution' : '#product-tour')), path); }
async function click(label) {
  const point = await evaluate(label => { const element = [...document.querySelectorAll('#product-tour button, #product-tour a')].find(el => (el.getAttribute('aria-label') ?? el.textContent.trim()) === label); if (!element || element.disabled) throw Error('missing_control'); element.scrollIntoView({ block: 'center' }); const box = element.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, label);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
async function frame(name, selector = '#product-tour') {
  assert.ok(images.length < 8); await evaluate(selector => document.querySelector(selector).scrollIntoView({ block: 'start' }), selector); await sleep(150);
  const box = await evaluate(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: Math.min(r.height, 2400), scale: 1 }; }, selector);
  assert.ok(box.width <= 1440 && box.height <= 2400 && box.width > 0 && box.height > 0, 'website_framebuffer_bound');
  const result = await send('Page.captureScreenshot', { format: 'png', clip: box, captureBeyondViewport: true }); const bytes = Buffer.from(result.data, 'base64'); imageBytes += bytes.length;
  assert.ok(bytes.length <= 8 * 1024 * 1024 && imageBytes <= 24 * 1024 * 1024, 'website_image_bound');
  const path = join(directory, 'screenshots', `${name}.png`); writeFileSync(path, bytes, { mode: 0o600 }); images.push({ path, width: box.width, height: box.height });
}
const state = () => evaluate(() => ({ title: document.querySelector('#product-tour h2').textContent, code: document.querySelector('#product-tour pre')?.innerText ?? '' }));
let success = false;
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await viewport(1440); await navigate('/'); await waitFor(() => !document.querySelector('[aria-label="Play story"]').disabled);
  await frame('home-desktop');
  await click('Step 2: Make a small, reviewable edit.'); await click('Play story'); await sleep(700); await click('Pause story');
  const paused = await state(); await sleep(700); assert.deepEqual(await state(), paused); evidence.push('play_pause_preserves_typed_output');
  await click('Play story'); await evaluate(() => scrollTo(0, document.body.scrollHeight)); await sleep(200); const offscreen = await state(); await sleep(5700); assert.deepEqual(await state(), offscreen); evidence.push('offscreen_timer_stopped');
  await evaluate(() => document.querySelector('#product-tour').scrollIntoView()); await sleep(150); await click('Pause story');
  await click('Step 3: Review the bounded check.'); await click('Simulate approval'); assert.ok(await evaluate(() => document.querySelector('#product-tour').innerText.includes('Sample decision recorded')));
  await click('Reject sample'); assert.ok(await evaluate(() => document.querySelector('#product-tour').innerText.includes('Sample rejected'))); evidence.push('sample_approve_reject');
  const oldBranch = await evaluate(() => { const select = [...document.querySelectorAll('#product-tour select')][1]; select.focus(); return select.value; });
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await waitFor(old => [...document.querySelectorAll('#product-tour select')][1].value !== old, oldBranch, 2000);
  assert.equal((await state()).title, 'Choose the working context.'); evidence.push('native_branch_selector_resets_story');
  await click('Replay story'); await sleep(250); await click('Pause story'); assert.equal((await state()).title, 'Choose the working context.'); evidence.push('replay');
  await click('Step 2: Make a small, reviewable edit.'); await click('Play story');
  const background = await send('Target.createTarget', { url: 'about:blank' });
  try {
    await send('Target.activateTarget', { targetId: background.targetId }); await waitFor(() => document.hidden, undefined, 2000);
    const hidden = await state(); await sleep(5700); assert.deepEqual(await state(), hidden); evidence.push('hidden_document_timer_stopped');
  } finally { await send('Target.closeTarget', { targetId: background.targetId }); await send('Page.bringToFront'); }
  await click('Pause story');
  await click('Agent & approval'); await click('Step 3: Decide on the exact action.'); await frame('agent-review-desktop');
  await click('Terraform & cloud'); await click('Step 3: Keep the release on hold.'); assert.equal(await evaluate(() => [...document.querySelectorAll('#product-tour button')].some(button => /apply|Simulate approval/i.test(button.textContent))), false); await frame('terraform-held-desktop'); evidence.push('terraform_apply_absent');
  await viewport(360); await navigate('/product'); await click('Step 2: Make a small, reviewable edit.');
  assert.ok(await evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'website_mobile_overflow'); await frame('product-mobile'); evidence.push('mobile_360_no_horizontal_overflow');
  await click('Next step'); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft' }); assert.equal((await state()).title, 'Make a small, reviewable edit.'); evidence.push('keyboard_previous');
  await viewport(360, true); await navigate('/product'); await waitFor(() => document.querySelector('[aria-label="Play story"]').disabled); await click('Next step'); await frame('product-reduced-motion-mobile'); evidence.push('reduced_motion_static_manual_step');
  await viewport(1440); await click('Read approval workflow'); await waitFor(() => location.pathname === '/docs/approval-workflow' && Boolean(document.querySelector('#execution'))); assert.ok(await evaluate(() => document.querySelector('#execution').innerText.includes('does not verify ECS execution'))); await frame('approval-documentation', 'main'); evidence.push('actual_documentation_destination');
  success = true;
} finally {
  for (const task of pending.values()) clearTimeout(task.timer); socket.close();
  const result = { success, productionEquivalent: false, evidence, images, deniedRequests: denied, consoleErrorCategories: consoleErrors, qualification: 'Actual local integrated Next pages; API requests denied; external fonts may fall back; screenshots require human inspection. No provider/native acceptance.' };
  writeFileSync(join(directory, 'capture.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  writeFileSync(join(directory, 'done.json'), JSON.stringify({ success, nonce: config.nonce }), { mode: 0o600 });
  process.stdout.write(`${join(directory, 'capture.json')}\n`);
}
