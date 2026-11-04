'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const evidence = '/private/tmp/axiom-b5-offline-evidence/diagnostic';
const fixture = fs.mkdtempSync(path.join(evidence, 'synthetic-read-'));
try {
  const root = fs.realpathSync(fixture);
  const filename = path.join(root, 'synthetic.txt');
  const expected = Buffer.from('SIMULATED_BOUNDARY_READ_ONLY\n', 'utf8');
  fs.writeFileSync(filename, expected);
  // Exact unchanged core sandboxProfile semantics; no core import or payload read.
  const profile = '(version 1)(allow default)(deny network*)(deny file-write*)' + '(deny file-read-data)(allow file-read-data (literal "/") (require-all ' + '(subpath ' + JSON.stringify(root) + ') (literal ' + JSON.stringify(filename) + ') (vnode-type REGULAR-FILE)))';
  fs.writeFileSync(path.join(evidence, 'inner-profile.sb'), profile);
  const result = spawnSync('/usr/bin/sandbox-exec', ['-p', profile, '/bin/cat', filename], {
    timeout: 2000,
    maxBuffer: 1048577,
    encoding: null,
    env: {}
  });
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
  console.log(JSON.stringify({
    simulationOnly: true,
    customerEligible: false,
    node: process.version,
    unicode: process.versions.unicode,
    innerProfileSha256: crypto.createHash('sha256').update(profile).digest('hex'),
    errorCode: result.error?.code ?? null,
    status: result.status,
    signal: result.signal,
    expectedByteCount: expected.length,
    actualByteCount: Buffer.isBuffer(result.stdout) ? result.stdout.length : 0,
    stderrByteCount: stderr.length,
    stderrPrefix: stderr.subarray(0, 512).toString('utf8'),
    stderrPrefixLimitBytes: 512
  }, null, 2));
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
