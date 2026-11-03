'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
const mode = process.argv[3];
if (process.argv.length !== 4 || !/^\/private\/tmp\/axiom-preexec-owned-[A-Za-z0-9_-]{8}$/.test(root) || !['control', 'restricted'].includes(mode)) throw Error('fixed_fixture_arguments');
const addon = require(path.join(__dirname, 'fixture.node'));
let pathWrite = false;
try { const fd = fs.openSync(path.join(root, 'path-write'), fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW); fs.writeSync(fd, Buffer.from('P'), 0, 1, 0); fs.closeSync(fd); pathWrite = true; } catch {}
const native = JSON.parse(addon.run(root));
console.log(JSON.stringify({ mode, nodeStarted: true, pathWrite, ...native, identity: 'unavailable', qualification: 'feasibility_only' }));
