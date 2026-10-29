/* eslint-disable @typescript-eslint/no-require-imports -- Test-only preload must precede Next consumers. */
'use strict';
// Website-specific adaptation of the independently reviewed ownedNextFrameworkMode.cjs.
// Reviewed against the locked Next16.4.2 registry archive. Exact hashes remain
// mandatory; the sole default change is unchanged and no Agent context is accepted.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync, realpathSync } = require('node:fs');
const { join } = require('node:path');
const rootPath = realpathSync(join(__dirname, '../..'));
const sourcePins = {
  'package-lock.json': '563b933cccd467783f60d3c8e88d02f855107c2ca9beda5ead13d6bd66a3920c',
  'next.config.ts': '0e92d9076a0fde2e5523d86ff9024b727fdb5a272cb2d55e0159f7d693f1ab7d',
  'tsconfig.json': '49995c2a39f9d8442187af48c2070474181bee8eca5812ca44075db407ece5d1',
  'tsconfig.next.json': '1b7acd54eea2b33af5e4c8601132f9244687ed14ebbbb3f330a295d199fdac41',
};
const dependencyPins = {
  'next/package.json': 'e84ada0a68191fed192392bfb8ee35ad4ed8e7439f645a40dd48cf139588ddc5',
  'next/dist/server/config-shared.js': 'cc8b6197fd97a12b0d9257c9d7d4288347053fc8712b021d03c3bfad7a19cdd3',
  'next/dist/build/load-jsconfig.js': 'b313de8c53ff3f060b18d199743fa48b0a59ce57b28b95d6095e6104d5163621',
  'next/dist/lib/typescript/runTypeScriptCli.js': '9462f0a83eb0c24e7cd1c33d22abade44e63664ff2897a74ddb88b70abe3c16a',
  'typescript/package.json': '822ef7ca6452205657b6288b066481ecf508bfbf43455d715cf7d3ec457561e6',
  'typescript/lib/typescript.js': '3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675',
};
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
let installed;
/** Trusted parent captures exact runtime; children independently compare before changing any default. */
function captureOwnedWebsiteFramework(root) {
  assert.equal(realpathSync(root), rootPath, 'owned_framework_root');
  const sourceHashes = Object.fromEntries(Object.keys(sourcePins).map(path => [path, digest(join(rootPath, path))]));
  assert.deepEqual(sourceHashes, sourcePins, 'owned_framework_source_pins');
  for (const [specifier, expected] of Object.entries(dependencyPins)) assert.equal(digest(require.resolve(specifier)), expected, 'owned_framework_dependency_pin');
  const lock = JSON.parse(readFileSync(join(rootPath, 'package-lock.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/next'].version, '16.4.2', 'owned_framework_next_version');
  assert.equal(lock.packages['node_modules/typescript'].version, '5.9.3', 'owned_framework_typescript_version');
  assert.equal(JSON.parse(readFileSync(require.resolve('next/package.json'), 'utf8')).version, '16.4.2', 'owned_framework_next_version');
  assert.equal(JSON.parse(readFileSync(require.resolve('typescript/package.json'), 'utf8')).version, '5.9.3', 'owned_framework_typescript_version');
  return { root: rootPath, runtime: { node: process.versions.node, platform: process.platform, arch: process.arch, executable: realpathSync(process.execPath), executableSha256: digest(process.execPath) }, sourceHashes };
}
function installOwnedWebsiteFramework({ root, role, environment, identity }) {
  assert.ok(environment?.AXIOM_WEBSITE_VISUAL_MODE === 'owned-website-visual' && role === 'website-server' && environment.NODE_ENV === 'development', 'owned_framework_context');
  assert.ok(environment.AXIOM_NEXT_AGENT_MODE === undefined && environment.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME === undefined && environment.__NEXT_PRIVATE_STANDALONE_CONFIG === undefined, 'owned_framework_context');
  assert.equal(realpathSync(process.cwd()), rootPath, 'owned_framework_cwd');
  assert.deepEqual(identity, captureOwnedWebsiteFramework(root), 'owned_framework_identity');
  if (installed) { assert.equal(installed.role, role, 'owned_framework_lifetime_role'); installed.handle.report(); return installed.handle; }
  for (const specifier of ['next/dist/server/config', 'next/dist/build/load-jsconfig']) assert.equal(require.cache[require.resolve(specifier)], undefined, 'owned_framework_before_consumers');
  const ts = require('typescript');
  for (const key of ['readConfigFile', 'parseJsonConfigFileContent', 'createSourceFile']) assert.equal(typeof ts[key], 'function', 'owned_framework_compiler_api');
  const defaults = require('next/dist/server/config-shared').defaultConfig.experimental;
  const original = Object.getOwnPropertyDescriptor(defaults, 'useTypeScriptCli');
  assert.ok(original && original.value === true && original.writable === true && original.configurable === true, 'owned_framework_default');
  const modified = { ...original, value: false };
  Object.defineProperty(defaults, 'useTypeScriptCli', modified);
  const handle = {
    report() {
      assert.deepEqual(identity, captureOwnedWebsiteFramework(root), 'owned_framework_identity_changed');
      assert.deepEqual(Object.getOwnPropertyDescriptor(defaults, 'useTypeScriptCli'), modified, 'owned_framework_default_changed');
      return { mode: 'owned-website-typescript-api', productionEquivalent: false, identity, nextVersion: '16.4.2', typescriptVersion: '5.9.3' };
    },
    restore() {
      assert.ok(installed?.handle === handle, 'owned_framework_restore_lifetime');
      assert.deepEqual(Object.getOwnPropertyDescriptor(defaults, 'useTypeScriptCli'), modified, 'owned_framework_default_changed');
      Object.defineProperty(defaults, 'useTypeScriptCli', original); installed = undefined;
    },
  };
  installed = { role, handle }; return handle;
}
module.exports = { captureOwnedWebsiteFramework, installOwnedWebsiteFramework };
