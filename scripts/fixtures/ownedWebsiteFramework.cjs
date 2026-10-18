/* eslint-disable @typescript-eslint/no-require-imports -- Test-only preload must precede Next consumers. */
'use strict';
// Website-specific adaptation of the independently reviewed ownedNextFrameworkMode.cjs.
// Same source/dependency pins and sole default change; no Agent context is accepted.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync, realpathSync } = require('node:fs');
const { join } = require('node:path');
const rootPath = realpathSync(join(__dirname, '../..'));
const sourcePins = {
  'package-lock.json': '24228d15d056785f239f77107cd9ed1f8161beed53e1edc128826e4ce4298fd7',
  'next.config.ts': 'e29e0ed18407a18820a2047e41e52272a80dc7cd1f69dbb221ad9e9977f1a040',
  'tsconfig.json': '49995c2a39f9d8442187af48c2070474181bee8eca5812ca44075db407ece5d1',
  'tsconfig.next.json': '1b7acd54eea2b33af5e4c8601132f9244687ed14ebbbb3f330a295d199fdac41',
};
const dependencyPins = {
  'next/package.json': '6da8fc4823b66b8f2906d150002618e3f3e0d2446ebf3823b2a2f7efe73a46a4',
  'next/dist/server/config-shared.js': '2c15353ce27ba7ea7322b53f3194c6d39593936f2c73e303cbd2dd7d37d88f0a',
  'next/dist/build/load-jsconfig.js': '419d124c1708f6cff3bcd4ad63f379f9e45912c392a8e462bfaf6ef571a222ef',
  'next/dist/lib/typescript/runTypeScriptCli.js': '7dbbcc8190d3fd835c339cc6feed9e70bd3191f8af6fe5441c06b441626c5f58',
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
  assert.equal(lock.packages['node_modules/next'].version, '16.3.8', 'owned_framework_next_version');
  assert.equal(lock.packages['node_modules/typescript'].version, '5.9.3', 'owned_framework_typescript_version');
  assert.equal(JSON.parse(readFileSync(require.resolve('next/package.json'), 'utf8')).version, '16.3.8', 'owned_framework_next_version');
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
      return { mode: 'owned-website-typescript-api', productionEquivalent: false, identity, nextVersion: '16.3.8', typescriptVersion: '5.9.3' };
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
