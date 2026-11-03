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
    return privateRuntime.observation;
  } catch {
    privateRuntime = null; // Permanent local revocation, never reconnect/rearm.
    return unavailable;
  }
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
    if (!nativeModule || nativeModule.exports !== nativeExports || !Object.isFrozen(nativeExports) || Object.keys(nativeExports).join(',') !== 'assertCurrentOrigin' || typeof nativeExports.assertCurrentOrigin !== 'function' || !Object.isFrozen(nativeExports.assertCurrentOrigin)) refuse();
    const assertCurrentOrigin = nativeExports.assertCurrentOrigin;
    apply(assertCurrentOrigin, undefined, []);
    // Reverify the actual closure after native preimport checks. A stale file
    // snapshot cannot substitute for the native readonly/owned-origin gates.
    const after = verifyPackageFiles(root);
    if (after.packageDigest !== files.packageDigest) refuse();
    const observation = Object.freeze({ status: 'unavailable', reason: 'canonical_consumer_qualification_pending', packageFileSetObservationDigest: files.packageDigest, nativeOriginObservation: 'observed', executingIssuerIdentity: 'unavailable', runtimeQualification: 'unavailable', fleetQualification: 'unavailable', legacyQualification: 'unavailable', executionAuthorized: false });
    privateRuntime = Object.freeze({ root, addon, nativeModule, nativeExports, assertCurrentOrigin, observation });
    // Successful primitives remain observations until the actual compiled
    // consumer and full original matrix qualify. No flag/manifest can flip this.
    if (readIssuerIdentity() !== observation) refuse();
    // Fixed manifest-bound compiled server; no caller entrypoint/port/callback.
    const required = JSON.parse(fs.readFileSync(path.join(root, '.next/required-server-files.json'), 'utf8'));
    if (!required || !required.config || typeof required.config !== 'object') refuse();
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(required.config);
    const { startServer } = require(path.join(root, 'node_modules/next/dist/server/lib/start-server.js'));
    if (typeof startServer !== 'function') refuse();
    Promise.resolve(startServer({ dir: root, dev: false, hostname: '127.0.0.1', port: 32167, allowRetry: false })).catch(() => {
      privateRuntime = null;
      process.stderr.write('verified_issuer_server_unavailable\n');
      process.exitCode = 1;
    });
  } catch {
    privateRuntime = null;
    process.stderr.write('verified_issuer_launch_unavailable\n');
    process.exitCode = 1;
  }
}
