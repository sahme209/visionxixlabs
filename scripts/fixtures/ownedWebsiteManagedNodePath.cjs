/* eslint-disable @typescript-eslint/no-require-imports -- Fixed managed-environment identity, no application imports. */
'use strict';
const { createHash } = require('node:crypto');
const { realpathSync, lstatSync, accessSync, constants } = require('node:fs');
const { dirname, normalize } = require('node:path');
const reviewedValueHash = 'dbc7bc884f72c70bb3d320e868da710a56a621286fba48b3c6b610776b41b4fd';
const system = {
  digest: value => createHash('sha256').update(value).digest('hex'),
  realpath: realpathSync,
  lstat: lstatSync,
  uid: () => process.getuid(),
  writable: path => {
    try { accessSync(path, constants.W_OK); return true; }
    catch (error) { if (['EACCES', 'EROFS'].includes(error.code)) return false; throw error; }
  },
};
// The injectable IO seam is for deterministic tests only. Every executable caller uses
// these fixed system functions; no environment, CLI, HTTP or manifest can configure it.
function capture(value, io = system) {
  if (value === undefined) return null;
  try {
    const reject = () => { throw Error('unsupported'); };
    if (typeof value !== 'string' || value.length > 4096 || !/^\/(usr|opt|run)(\/|$)/.test(value) || /[:\0]/.test(value) || normalize(value) !== value || io.digest(value) !== reviewedValueHash) reject();
    if (io.realpath(value) !== value) reject();
    const ancestors = [];
    for (let path = value; ; path = dirname(path)) {
      if (ancestors.length >= 32) reject();
      const row = io.lstat(path);
      if (!row.isDirectory() || row.isSymbolicLink() || io.realpath(path) !== path || ![0, 65534].includes(row.uid) || row.gid !== row.uid || row.uid === io.uid() || (row.mode & 0o7022) !== 0 || io.writable(path)) reject();
      if (path === value && (row.mode & 0o7777) !== 0o755) reject();
      const identity = { path, dev: row.dev, ino: row.ino, mode: row.mode, uid: row.uid, gid: row.gid, ctimeMs: row.ctimeMs };
      if (![identity.dev, identity.ino, identity.mode, identity.uid, identity.gid, identity.ctimeMs].every(Number.isFinite)) reject();
      ancestors.push(identity);
      if (path === '/') break;
    }
    return { valueSha256: reviewedValueHash, realpath: value, profile: `system-${ancestors[0].uid}`, ancestors };
  } catch { throw Error('website_managed_node_path_unsupported'); }
}
function revalidate(value, expected, io = system) {
  const current = capture(value, io);
  if (JSON.stringify(current) !== JSON.stringify(expected)) throw Error('website_managed_node_path_changed');
  return current;
}
module.exports = { capture, revalidate };
