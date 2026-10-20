/* eslint-disable @typescript-eslint/no-require-imports -- Fixed local config-file adapter, not an application entry point. */
'use strict';
const assert = require('node:assert/strict');
const { constants, openSync, closeSync, fstatSync, readSync, lstatSync, realpathSync, readFileSync } = require('node:fs');
const { join, relative, dirname } = require('node:path');
const { createHash } = require('node:crypto');
const framework = require('./ownedWebsiteFramework.cjs');
const root = realpathSync(join(__dirname, '../..'));
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');

function privateDirectory(path) {
  const row = lstatSync(path);
  assert.ok(row.isDirectory() && !row.isSymbolicLink() && row.uid === process.getuid() && (row.mode & 0o7777) === 0o700 && realpathSync(path) === path, 'website_config_private_directory');
  return { dev: row.dev, ino: row.ino };
}

function readPrivateConfig(path) {
  const directory = dirname(path);
  const owner = privateDirectory(directory);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = fstatSync(fd);
    assert.ok(before.isFile() && before.uid === process.getuid() && (before.mode & 0o7777) === 0o600 && before.size > 0 && before.size <= 1024 * 1024, 'website_config_private_file');
    const bytes = Buffer.alloc(before.size + 1);
    assert.equal(readSync(fd, bytes, 0, bytes.length, 0), before.size, 'website_config_file_changed');
    const after = fstatSync(fd);
    for (const key of ['dev', 'ino', 'size', 'mode', 'uid', 'gid', 'mtimeMs', 'ctimeMs']) assert.equal(after[key], before[key], 'website_config_file_changed');
    assert.deepEqual(privateDirectory(directory), owner, 'website_config_directory_changed');
    const current = lstatSync(path);
    assert.ok(current.isFile() && !current.isSymbolicLink() && current.dev === before.dev && current.ino === before.ino, 'website_config_file_changed');
    return JSON.parse(bytes.subarray(0, before.size).toString('utf8'));
  } finally { closeSync(fd); }
}

/** Custom-server prepare reloads next.config.ts without options.conf. Put only
 * the reviewed fixture's output paths in that supported config-file path. */
function applyOwnedWebsiteConfig(phase, actual) {
  const mode = process.env.AXIOM_WEBSITE_VISUAL_MODE;
  const configPath = process.env.AXIOM_WEBSITE_CONFIG;
  if (mode === undefined && configPath === undefined) return actual;
  assert.ok(phase === 'phase-development-server' && process.env.NODE_ENV === 'development' && mode === 'owned-website-visual', 'website_config_context');
  assert.ok(typeof configPath === 'string' && /^\/tmp\/axiom-website-[A-Za-z0-9]+\/config\.json$/.test(configPath), 'website_config_private_path');
  assert.equal(realpathSync(process.cwd()), root, 'website_config_root');
  const config = readPrivateConfig(configPath);
  assert.equal(config.root, root, 'website_config_root');
  assert.equal(config.directory, dirname(configPath), 'website_config_directory');
  assert.match(config.nonce, /^[a-f0-9]{32}$/, 'website_config_nonce');
  assert.ok(typeof config.dist === 'string' && dirname(config.dist) === join(root, '.next') && /^visual-[A-Za-z0-9]+$/.test(config.dist.slice(config.dist.lastIndexOf('/') + 1)), 'website_config_owned_dist');
  assert.equal(realpathSync(join(root, '.next')), join(root, '.next'), 'website_config_dist_root');
  privateDirectory(config.dist);
  assert.deepEqual(config.framework, framework.captureOwnedWebsiteFramework(root), 'website_config_framework_identity');
  const self = join(root, 'scripts/fixtures/ownedWebsiteConfig.cjs');
  assert.equal(config.hashes?.[self], digest(self), 'website_config_source_pin');
  const tsconfig = join(config.dist, 'tsconfig.json');
  assert.deepEqual(readPrivateConfig(tsconfig), { extends: join(root, 'tsconfig.next.json') }, 'website_config_tsconfig_content');
  return { ...actual, distDir: relative(root, config.dist), typescript: { ...actual.typescript, tsconfigPath: relative(root, tsconfig) } };
}
module.exports = { applyOwnedWebsiteConfig };
