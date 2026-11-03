'use strict';

const {
  ordinary
} = require('./core.cjs');
// Accepted syntax establishes no authority. No supplied object or flag can do so.
const args = process.argv.slice(2),
  seen = new Set();
let valid = true;
for (let i = 0; i < args.length; i += 2) {
  if (!['--root', '--catalog', '--version', '--audience', '--question'].includes(args[i]) || seen.has(args[i]) || args[i + 1] === undefined) valid = false;
  seen.add(args[i]);
}
console.log(JSON.stringify(ordinary()));
process.exitCode = 1;
