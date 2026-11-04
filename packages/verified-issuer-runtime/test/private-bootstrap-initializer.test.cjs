'use strict';
// Pure initializer tests: synthetic bytes and mocked effects. Never native/main.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../../lib/desktop/privateReleaseMergeBootstrap.ts'), 'utf8');
function load(failGraph = false) {
  const events = [];
  const exports = {};
  const client = { $disconnect: async () => { events.push('disconnect'); } };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Buffer, Uint8Array, Object, Reflect, Error, Promise, Date, fetch: () => { throw Error('no transport allowed'); }, require(name) {
    if (name === 'server-only') return {};
    if (name.endsWith('/privateAuthorityDatabase')) return { createPrivateAuthorityDatabase: value => { events.push('database'); assert.equal(value, 'postgresql://synthetic.invalid/example'); return client; } };
    if (name.endsWith('/privateCredentialVault')) return { createPrivateCredentialVault: value => { events.push('vault'); assert.equal(value.length, 32); return {}; } };
    if (name.endsWith('privateReleaseMergeComposition')) return { createPrivateReleaseMergeComposition: resources => { events.push('composition'); assert.equal(resources.client, client); assert.equal(resources.enabled(), false); assert.equal(resources.governanceEnabled(), false); assert.equal(resources.billing.kind, 'legacy'); if (failGraph) throw Error('mock construction failure'); return Object.freeze({ forRequest() { throw Error('unmounted'); } }); } };
    throw Error('unexpected import');
  } });
  return { initialize: exports.initializePrivateReleaseMergeBootstrap, events };
}
function material() { return Object.freeze({ datasource: 'postgresql://synthetic.invalid/example', vaultKey: new Uint8Array(32).fill(3), sessionSigningKey: new Uint8Array(32).fill(4) }); }
test('actual initializer constructs fixed graph, wipes staging and exposes idempotent cleanup only', async () => {
  const { initialize, events } = load(); const input = material(); const lifetime = await initialize(input);
  assert.deepEqual(events, ['database', 'vault', 'composition']);
  assert.deepEqual(Object.keys(lifetime), ['close']); assert.ok(Object.isFrozen(lifetime));
  assert.ok(input.vaultKey.every(x => x === 0)); assert.ok(input.sessionSigningKey.every(x => x === 0));
  await Promise.all([lifetime.close(), lifetime.close()]); assert.deepEqual(events, ['database', 'vault', 'composition', 'disconnect']);
});
test('graph failure disconnects actual owned client port and wipes mutable staging', async () => {
  const { initialize, events } = load(true); const input = material();
  await assert.rejects(initialize(input), /private_bootstrap_initialization_unavailable/);
  assert.deepEqual(events, ['database', 'vault', 'composition', 'disconnect']); assert.ok(input.vaultKey.every(x => x === 0));
});
test('rejects unknown fields, accessor records, wrong bounds before factory construction', async () => {
  for (const input of [Object.freeze({ ...material(), extra: true }), Object.freeze({ datasource: 'postgresql://synthetic.invalid/example', vaultKey: new Uint8Array(31), sessionSigningKey: new Uint8Array(32) }), Object.freeze({ get datasource() { throw Error('accessor must never run'); }, vaultKey: new Uint8Array(32), sessionSigningKey: new Uint8Array(32) })]) {
    const { initialize, events } = load(); await assert.rejects(initialize(input), /private_bootstrap_initialization_unavailable/); assert.deepEqual(events, []);
  }
});
