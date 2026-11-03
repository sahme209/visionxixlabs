'use strict';

const {
  simulate,
  reader,
  strictJSON,
  hash,
  runtimeIdentity
} = require('./core.cjs');
function run() {
  const a = process.argv.slice(2);
  if (a.length !== 6 || a[0] !== '--root' || a[2] !== '--suite' || a[4] !== '--sha256') throw Error();
  const bytes = reader(a[1])(a[3]);
  if (hash(bytes) !== a[5]) throw Error();
  const s = strictJSON(bytes);
  if (Object.keys(s).sort().join('|') !== 'cases|schema' || s.schema !== 1 || !Array.isArray(s.cases) || s.cases.length > 256 || new Set(s.cases.map(x => x.id)).size !== s.cases.length) throw Error();
  return {
    simulationOnly: true,
    customerEligible: false,
    suiteDigest: hash(bytes),
    implementation: runtimeIdentity(),
    unicode: process.versions.unicode,
    results: s.cases.map(c => {
      if (Object.keys(c).sort().join('|') !== 'expected|id|input' || typeof c.id !== 'string') throw Error();
      const identity = {};
      const actual = simulate({
        ...c.input,
        root: a[1]
      }, identity);
      return {
        id: c.id,
        identity,
        pass: JSON.stringify(actual) === JSON.stringify(c.expected),
        expected: c.expected,
        actual
      };
    })
  };
}
try {
  const r = run();
  console.log(JSON.stringify(r));
  if (r.results.some(x => !x.pass)) process.exitCode = 1;
} catch {
  console.log(JSON.stringify({
    status: 'no_answer',
    reason: 'integrity_failure',
    simulationOnly: true,
    customerEligible: false
  }));
  process.exitCode = 1;
}
