'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const launcher = resolve(__dirname, '../run-native-typecheck.mjs');
test('native checker accepts valid source and rejects real type errors while compiler API stays pinned', () => {
  assert.equal(require('typescript').version, '5.9.3');
  assert.equal(typeof require('typescript').createSourceFile, 'function');
  const temp = mkdtempSync(join(tmpdir(), 'axiom-native-typecheck-'));
  try {
    for (const [name, source, status] of [['valid', 'const count: number = 1; export {};', 0], ['invalid', 'const count: number = "wrong"; export {};', 2]]) {
      const file = join(temp, name + '.ts'); writeFileSync(file, source);
      const result = spawnSync(process.execPath, [launcher, '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--ignoreConfig', file], { cwd: temp, encoding: 'utf8', timeout: 30000 });
      assert.equal(result.error, undefined);
      assert.equal(result.status, status, result.stdout + result.stderr);
      if (status) assert.match(result.stdout, /TS2322/);
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
