'use strict';
// Actual candidate source, synthetic Node module/cache objects; no native load or XPC.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const file = path.join(__dirname, 'candidate-main.cjs');
const source = fs.readFileSync(file, 'utf8');
for (const condition of ['cached-native', 'wrong-canonical-cache']) {
  const mod = {};
  let nativeCalls = 0;
  const req = (name) => { if (name === 'node:path') return path; nativeCalls++; throw Error('native_must_not_be_called'); };
  req.main = mod;
  req.cache = { [file]: condition === 'wrong-canonical-cache' ? {} : mod };
  if (condition === 'cached-native') req.cache[path.join(__dirname, 'origin-client.node')] = { exports: {} };
  assert.throws(() => vm.runInNewContext(source, { require: req, module: mod, __filename: file, __dirname, process: { stdout: { write() { throw Error('must_not_emit'); } } } }), /origin_unit_fresh_main_required/);
  assert.equal(nativeCalls, 0);
}
console.log('cache_refusal_cases=2 synthetic_module_metadata_no_native_no_identity');
