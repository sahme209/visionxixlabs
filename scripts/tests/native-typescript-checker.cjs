'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const launcher = resolve(__dirname, '../run-native-typecheck.mjs');
test('native checker accepts valid source and rejects real type errors while compiler API stays pinned', () => {
  assert.equal(require('typescript').version, '5.9.3');
  assert.equal(typeof require('typescript').createSourceFile, 'function');
  const temp = mkdtempSync(join(tmpdir(), 'axiom-native-typecheck-'));
  try {
    for (const [name, source, status] of [['valid', 'const count: number = 1; export {};', 0], ['invalid', 'const count: number = "wrong"; export {};', 1]]) {
      const file = join(temp, name + '.ts'); writeFileSync(file, source);
      const result = spawnSync(process.execPath, [launcher, '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--ignoreConfig', file], { cwd: temp, encoding: 'utf8', timeout: 30000 });
      assert.equal(result.error, undefined);
      assert.equal(result.status, status, result.stdout + result.stderr);
      if (status) assert.match(result.stdout, /TS2322/);
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('refuses an unreviewed compiler identity before importing its executable wrapper', () => {
  const temp = mkdtempSync(join(tmpdir(), 'axiom-native-identity-'));
  try {
    mkdirSync(join(temp, 'scripts'));
    mkdirSync(join(temp, 'node_modules/@typescript/native/lib'), { recursive: true });
    const fixtureLauncher = join(temp, 'scripts/run-native-typecheck.mjs');
    writeFileSync(fixtureLauncher, readFileSync(launcher));
    writeFileSync(join(temp, 'node_modules/@typescript/native/lib/tsc.js'), 'throw new Error("WRAPPER_MUST_NOT_RUN")');
    for (const metadata of [{ name: 'typescript', version: '7.0.3' }, { name: 'other', version: '7.0.2' }]) {
      writeFileSync(join(temp, 'node_modules/@typescript/native/package.json'), JSON.stringify(metadata));
      const result = spawnSync(process.execPath, [fixtureLauncher], { cwd: temp, encoding: 'utf8', timeout: 10000 });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /native_typescript_version_unreviewed/);
      assert.doesNotMatch(result.stderr, /WRAPPER_MUST_NOT_RUN/);
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
