import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('./index.html',import.meta.url),'utf8');
assert.match(html,/<title>Axiom synthetic acceptance<\/title>/);
assert.match(html,/id="release-marker">synthetic-release-(before|after)<\/p>/);
assert.doesNotMatch(html,/<script|https?:\/\//i);
process.stdout.write('Synthetic content checks passed; no deployment performed.\n');
