/* eslint-disable @typescript-eslint/no-require-imports -- Fixture-only inherited trust boundary. */
'use strict';
const managedNodePath = require('./ownedWebsiteManagedNodePath.cjs');
const inherited = ['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'CODEX_PROXY_CERT', 'NODE_USE_ENV_PROXY', 'REQUESTS_CA_BUNDLE', 'CURL_CA_BUNDLE', 'AWS_CA_BUNDLE', 'NODE_PATH'];
const selectors = inherited.filter(key => !['PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_ALL'].includes(key));
function captureManagedControls(env) {
  /** @returns {never} */
  const reject = () => { throw Error('owned_fixture_managed_controls_unsupported'); };
  if (!env || typeof env !== 'object' || Array.isArray(env)) reject();
  const isControl = key => key.startsWith('CODEX_') || key === 'GNUPGHOME';
  // Native child env enumeration can include inherited enumerable keys. Such
  // maps cannot represent the required own-data-only controls without loss.
  for (const key in env) if (isControl(key) && !Object.hasOwn(env, key)) reject();
  /** @type {Record<string, string>} */
  const snapshot = Object.create(null);
  for (const key of Object.getOwnPropertyNames(env).filter(isControl).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(env, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') reject();
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}
function revalidateManagedControls(env, snapshot) {
  const current = captureManagedControls(env);
  const keys = Object.keys(snapshot);
  if (Object.keys(current).length !== keys.length || keys.some(key => !Object.hasOwn(current, key) || current[key] !== snapshot[key])) throw Error('owned_fixture_managed_controls_changed');
}
function validateManagedFixtureTrust(env) {
  captureManagedControls(env);
  const reject = () => { throw Error('owned_fixture_inherited_trust_unsupported'); };
  for (const key of Object.keys(env)) {
    if (/^(LD_|DYLD_|OPENSSL_)/.test(key) || (key.startsWith('NODE_') && !['NODE_ENV', 'NODE_EXTRA_CA_CERTS', 'NODE_USE_ENV_PROXY', 'NODE_PATH'].includes(key))) reject();
  }
  // Inherited NODE_OPTIONS (including heap-only/empty) is unsupported here:
  // fixtures exclusively construct their already-reviewed owned preload option.
  for (const key of selectors) if (env[key] !== undefined && typeof env[key] !== 'string') reject();
  return managedNodePath.capture(env.NODE_PATH);
}
function selectManagedFixtureEnvironment(env) {
  const controls = captureManagedControls(env);
  validateManagedFixtureTrust(env);
  const selected = { ...Object.fromEntries(inherited.filter(key => typeof env[key] === 'string').map(key => [key, env[key]])), ...controls };
  revalidateManagedControls(env, controls);
  revalidateManagedControls(selected, controls);
  return selected;
}
module.exports = { captureManagedControls, revalidateManagedControls, validateManagedFixtureTrust, selectManagedFixtureEnvironment };
