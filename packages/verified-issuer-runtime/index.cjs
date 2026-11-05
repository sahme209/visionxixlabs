'use strict';
// The real process main and the external compiled consumer share THIS module.
// Nothing passed to a reader, stored in ENV, or imported as a descriptor can arm it.
const fs = require('node:fs');
const path = require('node:path');
const { isMainThread } = require('node:worker_threads');
const apply = Reflect.apply;
const unavailable = Object.freeze({
  status: 'unavailable',
  reason: 'sealed_launch_not_implemented',
  executingIssuerIdentity: 'unavailable',
  runtimeQualification: 'unavailable',
  fleetQualification: 'unavailable',
  legacyQualification: 'unavailable',
  executionAuthorized: false,
});
const canonicalModule = module;
let privateRuntime = null;
let canonicalExports;
let activeRequest = null;
let shutdown = () => {};
function revokeRuntime() { const wasLive = privateRuntime !== null; privateRuntime = null; if (wasLive) shutdown(); }
function refuse() { throw Error('verified_issuer_launch_unavailable'); }
function cleanLoader() {
  if (!isMainThread || process.execArgv.length || process.argv.length !== 2 || process.env.NODE_ENV !== 'production') refuse();
  for (const [name, value] of Object.entries(process.env)) {
    // Fixed production mode is application configuration, never origin authority.
    if (name === 'NODE_ENV' && value === 'production') continue;
    const key = name.toUpperCase();
    if (['PYTHONPATH', 'PYTHONHOME', 'PYTHONSTARTUP'].includes(key) || ['NODE_', 'DYLD_', 'LD_', 'TS_NODE_', 'BABEL_', 'AXIOM_ISSUER_', 'V8_', 'UV_'].some(prefix => key.startsWith(prefix))) refuse();
  }
}
function actualRoot() {
  cleanLoader();
  if (require.main !== canonicalModule || canonicalModule.parent !== null || canonicalModule.id !== '.' || canonicalModule.filename !== __filename || require.cache[__filename] !== canonicalModule || canonicalModule.exports !== canonicalExports) refuse();
  const suffix = '/node_modules/@axiom/verified-issuer-runtime/index.cjs';
  const main = process.argv[1];
  if (typeof main !== 'string' || !main.endsWith(suffix)) refuse();
  const root = main.slice(0, -suffix.length);
  if (!root || !path.isAbsolute(root) || path.normalize(root) !== root || fs.realpathSync(root) !== root || fs.realpathSync(main) !== __filename || fs.realpathSync(__filename) !== __filename || fs.realpathSync(process.execPath) !== path.join(root, '__axiom_runtime__/node') || fs.realpathSync(process.cwd()) !== root) refuse();
  return root;
}
function readIssuerIdentity() {
  if (arguments.length || !privateRuntime) return unavailable;
  try {
    if (actualRoot() !== privateRuntime.root || require.cache[privateRuntime.addon] !== privateRuntime.nativeModule || privateRuntime.nativeModule.exports !== privateRuntime.nativeExports) refuse();
    // Actual native code owns this zero-argument fresh challenge. No public
    // ready bit, copied receipt or caller verifier is accepted at this seam.
    apply(privateRuntime.assertCurrentOrigin, undefined, []);
  } catch {
    revokeRuntime(); // Permanent origin revocation, never reconnect/rearm.
    return unavailable;
  }
  if (activeRequest) {
    try { apply(privateRuntime.assertRequestCurrent, undefined, [activeRequest.id]); }
    catch {
      // A cancelled request does not revoke a healthy epoch. A lost origin does.
      try { apply(privateRuntime.assertCurrentOrigin, undefined, []); }
      catch { revokeRuntime(); }
      return unavailable;
    }
  }
  return privateRuntime ? privateRuntime.observation : unavailable;
}
canonicalExports = Object.freeze({ readIssuerIdentity });
module.exports = canonicalExports;
if (require.main === canonicalModule) {
  try {
    const root = actualRoot();
    const verifier = path.join(root, 'node_modules/@axiom/verified-issuer-runtime/internal/verify-package.cjs');
    const { verifyPackageFiles } = require(verifier);
    const files = verifyPackageFiles(root); // File observation alone cannot arm.
    if (!files || files.qualification !== 'package_file_set_verified' || !/^[a-f0-9]{64}$/.test(files.packageDigest)) refuse();
    const addon = fs.realpathSync(path.join(root, 'node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node'));
    if (require.cache[addon]) refuse();
    const nativeExports = require(addon); // Fresh native constructor or refusal.
    const nativeModule = require.cache[addon];
    if (!nativeModule || nativeModule.exports !== nativeExports || !Object.isFrozen(nativeExports) || Object.keys(nativeExports).join(',') !== 'assertCurrentOrigin,consumeBootstrapResources,nextRequestEvent,completeRequest,assertRequestCurrent,closeRuntime' || typeof nativeExports.assertCurrentOrigin !== 'function' || !Object.isFrozen(nativeExports.assertCurrentOrigin) || typeof nativeExports.consumeBootstrapResources !== 'function' || !Object.isFrozen(nativeExports.consumeBootstrapResources)) refuse();
    for (const name of ['nextRequestEvent', 'completeRequest', 'assertRequestCurrent', 'closeRuntime']) if (typeof nativeExports[name] !== 'function' || !Object.isFrozen(nativeExports[name])) refuse();
    const assertCurrentOrigin = nativeExports.assertCurrentOrigin;
    apply(assertCurrentOrigin, undefined, []);
    // Reverify the actual closure after native preimport checks. A stale file
    // snapshot cannot substitute for the native readonly/owned-origin gates.
    const after = verifyPackageFiles(root);
    if (after.packageDigest !== files.packageDigest) refuse();
    const observation = Object.freeze({ status: 'current', issuerArtifactDigest: files.packageDigest, executingIssuerIdentity: 'current', runtimeQualification: 'unavailable', fleetQualification: 'unavailable', legacyQualification: 'unavailable', executionAuthorized: false });
    privateRuntime = Object.freeze({ root, addon, nativeModule, nativeExports, assertCurrentOrigin, assertRequestCurrent: nativeExports.assertRequestCurrent, observation });
    // Live instance identity is distinct from action/fleet/operational qualification.
    if (readIssuerIdentity() !== observation) refuse();
    let material;
    let lifetime;
    let inFlight = null;
    let closing = null;
    let closed = false;
    let retiredRequestId = null;
    const cleanup = () => {
      if (!closing) {
        closed = true;
        privateRuntime = null;
        activeRequest?.controller.abort();
        // Native origin teardown may terminate this owned child. Disposal below
        // is best-effort, never proof that remote effects or resources stopped.
        try { apply(nativeExports.closeRuntime, undefined, []); } catch {}
        closing = (async () => {
          await inFlight?.catch(() => {});
          if (lifetime) { const owned = lifetime; lifetime = null; await owned.close(); }
        })();
      }
      return closing;
    };
    shutdown = () => { void cleanup().catch(() => {}); };
    const submit = (id, response) => {
      if (!response || !Number.isInteger(response.status) || response.status < 100 || response.status > 599 || !(response.body instanceof Uint8Array) || response.body.byteLength > 262144) throw Error('private_response_invalid');
      const frame = Buffer.alloc(8 + response.body.byteLength);
      frame.writeUInt32BE(response.status, 0); frame.writeUInt32BE(response.body.byteLength, 4); frame.set(response.body, 8);
      apply(nativeExports.completeRequest, undefined, [id, frame]);
    };
    const startRequest = event => {
      if (closed || inFlight || activeRequest || !/^[a-f0-9]{64}$/.test(event.id) || !(event.bytes instanceof Uint8Array) || event.bytes.byteLength > 4096) refuse();
      const request = {id: event.id, controller: new AbortController()};
      activeRequest = request;
      const bytes = event.bytes.slice();
      let completionAttempted = false;
      const refusalResponse = {status: 503, body: Buffer.from('{"ok":false,"error":"private_request_unavailable"}')};
      const complete = response => { completionAttempted = true; submit(request.id, response); };
      const work = Promise.resolve().then(async () => {
        try {
          if (closed || readIssuerIdentity() !== observation) refuse();
          const response = await lifetime.dispatch(bytes, request.controller.signal);
          if (!closed) {
            const eligible = readIssuerIdentity() === observation;
            if (!closed && privateRuntime) complete(eligible && !request.controller.signal.aborted ? response : refusalResponse);
          }
        } catch (error) {
          if (error && error.message === 'private_bootstrap_drain_unknown') revokeRuntime();
          // Terminal native acknowledgement releases this exact drained slot;
          // it never retries a provider effect or reauthorizes cancelled work.
          if (completionAttempted) revokeRuntime();
          else if (!closed) {
            readIssuerIdentity(); // Origin loss is distinct from request terminal.
            if (!closed && privateRuntime) {
              try { complete(refusalResponse); }
              catch { revokeRuntime(); }
            }
          }
        } finally {
          bytes.fill(0);
          if (activeRequest === request) activeRequest = null;
          retiredRequestId = request.id;
          if (inFlight === work) inFlight = null;
        }
      });
      inFlight = work;
      void work.catch(() => {});
    };
    (async () => {
      try {
        material = apply(nativeExports.consumeBootstrapResources, undefined, []);
        if (actualRoot() !== root || readIssuerIdentity() !== observation || verifyPackageFiles(root).packageDigest !== files.packageDigest) refuse();
        const { initializePrivateReleaseMergeBootstrap } = require(path.join(root, '.next/server/__axiom_private__/release-merge-bootstrap.cjs'));
        lifetime = await initializePrivateReleaseMergeBootstrap(material);
        if (material.vaultKey instanceof Uint8Array) material.vaultKey.fill(0);
        if (material.sessionSigningKey instanceof Uint8Array) material.sessionSigningKey.fill(0);
        material = null;
        if (actualRoot() !== root || readIssuerIdentity() !== observation || verifyPackageFiles(root).packageDigest !== files.packageDigest) refuse();
        if (!lifetime || !Object.isFrozen(lifetime) || typeof lifetime.dispatch !== 'function' || typeof lifetime.close !== 'function') refuse();
        for (;;) {
          const event = await apply(nativeExports.nextRequestEvent, undefined, []);
          if (closed || !privateRuntime || !event || typeof event !== 'object') refuse();
          if (event.kind === 'request') startRequest(event);
          else if (event.kind === 'cancel' && activeRequest && event.id === activeRequest.id) activeRequest.controller.abort();
          else if (event.kind === 'cancel' && event.id === retiredRequestId) continue;
          else refuse();
        }
      } catch {
        await cleanup().catch(() => {});
        process.stderr.write('verified_issuer_private_runtime_unavailable\n');
        process.exitCode = 1;
      } finally {
        if (material) {
          if (material.vaultKey instanceof Uint8Array) material.vaultKey.fill(0);
          if (material.sessionSigningKey instanceof Uint8Array) material.sessionSigningKey.fill(0);
          material = null;
        }
      }
    })();
  } catch {
    revokeRuntime();
    process.stderr.write('verified_issuer_launch_unavailable\n');
    process.exitCode = 1;
  }
}
