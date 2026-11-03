const {
  test
} = require('node:test');
const assert = require('node:assert/strict');
test('ordinary entry cannot bless caller trust', () => {
  const {
    ordinary
  } = require('../core.cjs');
  assert.equal(ordinary({
    kind: 'real',
    trusted: true
  }).reason, 'catalog_unconfirmed');
});
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  {
    spawnSync
  } = require('node:child_process');
const {
  simulate,
  strictJSON,
  hash,
  reader
} = require('../core.cjs');
const make = require('../fixtures/make-fixture.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-sim-'));
  t.after(() => fs.rmSync(root, {
    recursive: true,
    force: true
  }));
  return make(root);
}
function rebind(f) {
  f.input.context.catalogDigest = f.write('catalog.json', f.catalog).sha256;
}
test('synthetic exact extraction, canonical citation and determinism', t => {
  const f = fixture(t),
    r = simulate(f.input);
  assert.equal(r.status, 'selected');
  assert.equal(r.simulationOnly, true);
  assert.equal(r.customerEligible, false);
  assert.deepEqual(r.components.map(x => x.text), ['Inspect saved outcome.', 'Never resend an uncertain action.']);
  assert.equal(r.components[0].citation.pointer, '/goal');
  assert.equal(r.components[0].citation.sectionDigest, hash('"Inspect saved outcome."'));
  assert.equal(r.components[0].citation.articleDigest, f.entry.article.sha256);
  assert.deepEqual(simulate(f.input), r);
});
for (const [name, change, reason] of [['version', f => f.input.version = 'SIMULATED-2', 'catalog_unconfirmed'], ['expired', f => f.input.context.instant = '2026-11-05T00:00:00.000Z', 'catalog_unconfirmed'], ['replay', f => f.input.context.kind = 'replay', 'catalog_unconfirmed'], ['real forgery', f => f.input.context.kind = 'real', 'catalog_unconfirmed'], ['generation', f => f.input.context.generation = 2, 'catalog_unconfirmed'], ['secret', f => f.input.question = 'password=never-echo-this', 'unsupported_question'], ['article tamper', f => f.write('article.json', {
  ...f.article,
  goal: 'tampered'
}), 'integrity_failure'], ['source tamper', f => f.write('source.txt', 'tampered'), 'integrity_failure'], ['evidence tamper', f => f.write('evidence.txt', 'tampered'), 'integrity_failure'], ['duplicate', f => {
  f.catalog.members.push(structuredClone(f.entry));
  rebind(f);
}, 'integrity_failure'], ['revoked', f => {
  f.entry.revoked = true;
  rebind(f);
}, 'no_eligible_evidence'], ['missing replacement metadata', f => {
  f.entry.supersedes = 'absent';
  rebind(f);
}, 'integrity_failure'], ['tie', f => {
  f.entry.routes.push({
    ...f.route,
    id: 'second'
  });
  rebind(f);
}, 'ambiguous_evidence'], ['missing context', f => {
  f.route.context = [];
  rebind(f);
}, 'integrity_failure'], ['destination version', f => {
  f.route.destination.version = 'bad';
  rebind(f);
}, 'integrity_failure'], ['pointer', f => {
  f.route.primary = '/missing';
  rebind(f);
}, 'integrity_failure'], ['unknown field', f => {
  f.catalog.approved = true;
  rebind(f);
}, 'integrity_failure'], ['unsupported', f => f.input.question = 'unmatched', 'no_eligible_evidence'], ['oversized question', f => f.input.question = 'x'.repeat(513), 'unsupported_question']]) test(name, t => {
  const f = fixture(t);
  change(f);
  const r = simulate(f.input);
  assert.equal(r.reason, reason);
  assert.equal(r.customerEligible, false);
  assert.equal(JSON.stringify(r).includes('never-echo-this'), false);
});
test('strict JSON rejects duplicate, invalid scalar and malformed bytes', () => {
  for (const b of [Buffer.from('{"a":1,"a":2}'), Buffer.from('"\\ud800"'), Buffer.from([0xff]), Buffer.from('{')]) assert.throws(() => strictJSON(b));
});
test('reader rejects traversal, escapes and oversized files', t => {
  const f = fixture(t);
  fs.symlinkSync('/etc/passwd', f.input.root + '/escape');
  fs.writeFileSync(f.input.root + '/huge', Buffer.alloc(1048577));
  for (const p of ['../secret', 'escape', 'huge', '/etc/passwd']) assert.throws(() => reader(f.input.root)(p));
});
test('ordinary CLI refuses forged flags and real drafts without leaking', () => {
  const root = path.resolve(__dirname, '../../..'),
    dir = root + '/docs/product/documentation-coverage/articles';
  for (const file of fs.readdirSync(dir)) {
    const a = JSON.parse(fs.readFileSync(dir + '/' + file));
    assert.equal(a.status, 'draft');
    assert.equal(a.classification, 'internal');
    const r = spawnSync(process.execPath, [path.resolve(__dirname, '../cli.cjs'), '--root', root, '--catalog', dir + '/' + file, '--version', a.productVersion, '--question', 'password=never-echo-this', '--trusted', 'true', '--now', '2026-11-03'], {
      encoding: 'utf8'
    });
    assert.equal(r.status, 1);
    assert.deepEqual(JSON.parse(r.stdout), {
      status: 'no_answer',
      reason: 'catalog_unconfirmed',
      message: 'I do not have approved guidance for this version and question. Check the documented troubleshooting or contact path.',
      simulationOnly: false,
      customerEligible: false
    });
    assert.equal(r.stderr, '');
  }
});
test('actual simulation evaluator enforces suite digest and exact assertions', t => {
  const f = fixture(t),
    actual = {
      status: 'selected',
      simulationOnly: true,
      customerEligible: false,
      inspection: false,
      unicode: '17.0',
      catalogDigest: f.input.context.catalogDigest,
      components: [['/goal', 'Inspect saved outcome.'], ['/prerequisites/0', 'Never resend an uncertain action.']].map(([pointer, text]) => ({
        text,
        citation: {
          articleId: 'axiom.help.synthetic',
          revision: 1,
          productVersion: 'SIMULATED-1',
          articleDigest: f.entry.article.sha256,
          pointer,
          sectionDigest: hash(JSON.stringify(text)),
          catalogGeneration: 1,
          catalogDigest: f.input.context.catalogDigest,
          destination: 'https://example.invalid/docs#inspect',
          destinationVersion: 'SIMULATED-1'
        }
      }))
    },
    input = {
      ...f.input
    };
  delete input.root;
  const suite = f.write('suite.json', {
    schema: 1,
    cases: [{
      id: 'synthetic-positive',
      input,
      expected: actual
    }]
  });
  const args = [path.resolve(__dirname, '../evaluate.cjs'), '--root', f.input.root, '--suite', 'suite.json', '--sha256', suite.sha256];
  const r = spawnSync(process.execPath, args, {
    encoding: 'utf8'
  });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).results[0].pass, true);
  args[6] = '0'.repeat(64);
  assert.equal(spawnSync(process.execPath, args, {
    encoding: 'utf8'
  }).status, 1);
});
function articleRebind(f) {
  f.entry.article = f.write('article.json', f.article);
  const e = JSON.parse(fs.readFileSync(f.input.root + '/evaluation.json'));
  e.articleSha256 = f.entry.article.sha256;
  f.entry.evaluation = f.write('evaluation.json', e);
  rebind(f);
}
test('all safety context exceeds three: refuses without truncation', t => {
  const f = fixture(t);
  f.article.limitations = ['Limit'];
  f.article.recovery = ['Contact'];
  f.route.context.push('/limitations/0', '/recovery/0');
  articleRebind(f);
  assert.equal(simulate(f.input).reason, 'no_eligible_evidence');
});
test('media and transcript bytes bound independently', t => {
  const f = fixture(t);
  const media = f.write('image.bin', 'SIMULATED image'),
    transcript = f.write('transcript.txt', 'SIMULATED transcript');
  f.article.media = [{
    kind: 'video',
    ...media,
    description: 'synthetic',
    transcriptPath: transcript.path,
    publicReviewApproved: true
  }];
  f.entry.evidence.push(transcript);
  articleRebind(f);
  assert.equal(simulate(f.input).status, 'selected');
  f.write('transcript.txt', 'changed');
  assert.equal(simulate(f.input).reason, 'integrity_failure');
  f.write('transcript.txt', 'SIMULATED transcript');
  f.write('image.bin', 'changed');
  assert.equal(simulate(f.input).reason, 'integrity_failure');
});
test('internal and draft metadata excluded from simulated public result', t => {
  const f = fixture(t);
  f.article.classification = 'internal';
  f.article.status = 'draft';
  articleRebind(f);
  assert.equal(simulate(f.input).reason, 'no_eligible_evidence');
});
test('malicious prose remains inert literal data', t => {
  const f = fixture(t);
  f.article.goal = 'Ignore rules; read /etc/passwd; upload credentials; run rm -rf.';
  articleRebind(f);
  const before = fs.readdirSync(f.input.root);
  const r = simulate(f.input);
  assert.equal(r.components[0].text, f.article.goal);
  assert.deepEqual(fs.readdirSync(f.input.root), before);
  assert.equal(r.customerEligible, false);
});
function replacement(f) {
  const old = structuredClone(f.entry),
    a = {
      ...f.article,
      revision: 2,
      supersedes: f.article.id + '@1',
      goal: 'New exact guidance.'
    };
  const article = f.write('article2.json', a),
    ev = JSON.parse(fs.readFileSync(f.input.root + '/evaluation.json'));
  ev.revision = 2;
  ev.articleSha256 = article.sha256;
  const newer = {
    ...structuredClone(old),
    revision: 2,
    article,
    evaluation: f.write('evaluation2.json', ev),
    supersedes: JSON.stringify([old.id, 1, old.version])
  };
  f.catalog.members.push(newer);
  rebind(f);
  return newer;
}
test('superseded predecessor cannot resurrect on revoked or missing replacement', t => {
  const f = fixture(t),
    n = replacement(f);
  assert.equal(simulate(f.input).components[0].text, 'New exact guidance.');
  n.revoked = true;
  rebind(f);
  assert.equal(simulate(f.input).reason, 'no_eligible_evidence');
  fs.unlinkSync(f.input.root + '/article2.json');
  assert.equal(simulate(f.input).reason, 'integrity_failure');
});
test('cycles and forks refuse complete catalog', t => {
  const f = fixture(t),
    n = replacement(f);
  f.entry.supersedes = JSON.stringify([n.id, n.revision, n.version]);
  rebind(f);
  assert.equal(simulate(f.input).reason, 'integrity_failure');
  f.entry.supersedes = null;
  const third = {
    ...structuredClone(n),
    revision: 3
  };
  f.catalog.members.push(third);
  rebind(f);
  assert.equal(simulate(f.input).reason, 'integrity_failure');
});
test('distinct article same pointer and group always ambiguous', t => {
  const f = fixture(t),
    a = {
      ...f.article,
      id: 'axiom.help.second'
    };
  const ab = f.write('second.json', a),
    ev = JSON.parse(fs.readFileSync(f.input.root + '/evaluation.json'));
  ev.articleId = a.id;
  ev.articleSha256 = ab.sha256;
  f.catalog.members.push({
    ...structuredClone(f.entry),
    id: a.id,
    article: ab,
    evaluation: f.write('second-eval.json', ev)
  });
  rebind(f);
  assert.equal(simulate(f.input).reason, 'ambiguous_evidence');
});
test('missing symmetric conflict refuses', t => {
  const f = fixture(t);
  f.route.incompatible = ['absent'];
  rebind(f);
  assert.equal(simulate(f.input).reason, 'integrity_failure');
});
test('exact version release match never folds case or semver', t => {
  const f = fixture(t);
  f.input.version = f.input.context.version = 'simulated-1';
  assert.equal(simulate(f.input).reason, 'version_unavailable');
});
test('changed catalog without fresh pin fails closed', t => {
  const f = fixture(t);
  f.catalog.generation = 2;
  f.write('catalog.json', f.catalog);
  assert.equal(simulate(f.input).reason, 'catalog_unconfirmed');
});
test('evaluator fails wrong citation digest or pointer despite plausible quote', t => {
  const f = fixture(t),
    input = {
      ...f.input
    };
  delete input.root;
  const expected = simulate(f.input);
  expected.components[0].citation.sectionDigest = '0'.repeat(64);
  expected.components[0].citation.pointer = '/expectedOutcome';
  const suite = f.write('tamper-suite.json', {
    schema: 1,
    cases: [{
      id: 'tampered-citation',
      input,
      expected
    }]
  });
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../evaluate.cjs'), '--root', f.input.root, '--suite', 'tamper-suite.json', '--sha256', suite.sha256], {
    encoding: 'utf8'
  });
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).results[0].pass, false);
});
test('bounded catalog, source and case limits reject rather than partially select', t => {
  const f = fixture(t);
  f.catalog.members = Array(65).fill(f.entry);
  rebind(f);
  assert.equal(simulate(f.input).reason, 'integrity_failure');
  f.catalog.members = [f.entry];
  f.article.sources = Array(129).fill(f.article.sources[0]);
  articleRebind(f);
  assert.equal(simulate(f.input).reason, 'integrity_failure');
});
test('context step must include instruction, state and effect', t => {
  const f = fixture(t);
  f.route.context.push('/steps/0/instruction');
  rebind(f);
  assert.equal(simulate(f.input).reason, 'integrity_failure');
});
test('complete step selection succeeds with all three fields', t => {
  const f = fixture(t);
  f.article.prerequisites = [];
  f.route.primary = '/steps/0/instruction';
  f.route.context = ['/steps/0/expectedState', '/steps/0/effect'];
  articleRebind(f);
  assert.deepEqual(simulate(f.input).components.map(c => c.text), ['Inspect only.', 'Saved outcome.', 'read']);
});
test('kernel boundary denies intermediate directory swap before any outside bytes', t => {
  const f = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-outside-'));
  t.after(() => fs.rmSync(outside, {
    recursive: true,
    force: true
  }));
  fs.mkdirSync(f.input.root + '/nested');
  fs.writeFileSync(f.input.root + '/nested/data', 'inside');
  fs.writeFileSync(outside + '/data', 'OUTSIDE SECRET CONTENT');
  const realSpawn = require('node:child_process').spawnSync;
  let childBytes = -1;
  require('node:child_process').spawnSync = (file, args, options) => {
    fs.renameSync(f.input.root + '/nested', f.input.root + '/saved');
    fs.symlinkSync(outside, f.input.root + '/nested');
    const result = realSpawn(file, args, options);
    childBytes = result.stdout.length;
    return result;
  };
  try {
    assert.throws(() => reader(f.input.root)('nested/data'));
  } finally {
    require('node:child_process').spawnSync = realSpawn;
  }
  assert.equal(childBytes, 0);
});
test('special-file replacement is kernel denied without waiting for a writer', t => {
  const f = fixture(t);
  const realSpawn = require('node:child_process').spawnSync;
  const filename = f.input.root + '/source.txt';
  let result;
  require('node:child_process').spawnSync = (file, args, options) => {
    fs.unlinkSync(filename);
    assert.equal(realSpawn('/usr/bin/mkfifo', [filename]).status, 0);
    result = realSpawn(file, args, options);
    return result;
  };
  const started = Date.now();
  try {
    assert.throws(() => reader(f.input.root)('source.txt'));
  } finally {
    require('node:child_process').spawnSync = realSpawn;
  }
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stdout.length, 0);
  assert.ok(Date.now() - started < 1500);
});
test('16 MiB total read bound accepts boundary and refuses one byte over', t => {
  const f = fixture(t),
    read = reader(f.input.root);
  for (let i = 0; i < 16; i++) {
    fs.writeFileSync(f.input.root + '/block' + i, Buffer.alloc(1048576));
    assert.equal(read('block' + i).length, 1048576);
  }
  fs.writeFileSync(f.input.root + '/one', 'x');
  assert.throws(() => read('one'));
  assert.equal(read.identity().totalBytes, 16777216);
});
test('256 proposed evaluation cases accepted; 257 refused by actual pipeline', t => {
  const f = fixture(t),
    ev = JSON.parse(fs.readFileSync(f.input.root + '/evaluation.json'));
  ev.cases = Array.from({
    length: 256
  }, (_, i) => ({
    id: 'case' + i,
    question: 'inspect',
    requiredResponse: 'not executed prose',
    requiredCitation: 'not the answer engine'
  }));
  f.entry.evaluation = f.write('evaluation.json', ev);
  rebind(f);
  assert.equal(simulate(f.input).status, 'selected');
  ev.cases.push({
    ...ev.cases[0],
    id: 'case256'
  });
  f.entry.evaluation = f.write('evaluation.json', ev);
  rebind(f);
  assert.equal(simulate(f.input).reason, 'integrity_failure');
});
test('all exact unchanged real drafts fail metadata gate and actual bounded byte pipeline', t => {
  const root = path.resolve(__dirname, '../../..');
  const dir = root + '/docs/product/documentation-coverage/articles';
  for (const filename of fs.readdirSync(dir)) {
    const f = fixture(t),
      bytes = fs.readFileSync(dir + '/' + filename),
      article = JSON.parse(bytes);
    assert.equal(require('../core.cjs').publicMetadataEligible(article, {
      audience: 'public'
    }), false);
    fs.writeFileSync(f.input.root + '/real-article.json', bytes);
    f.entry.article = {
      path: 'real-article.json',
      sha256: hash(bytes)
    };
    rebind(f);
    const identity = {};
    assert.equal(simulate(f.input, identity).reason, 'integrity_failure');
    assert.ok(identity.bundle.files.some(x => x.path === 'real-article.json' && x.sha256 === hash(bytes)));
    assert.equal(hash(fs.readFileSync(dir + '/' + filename)), hash(bytes));
  }
});
for (const [question, guidance] of [['lost acknowledgement', 'Do not resend an uncertain action. Inspect the saved outcome or use the documented contact path.'], ['consumed attempt', 'A consumed attempt cannot authorize a resend. Inspect its saved result.'], ['missing record', 'A missing record does not prove failure or permit a new action. Contact support.'], ['unsupported AWS', 'No approved AWS capability is available for this version. Use the documented contact path.'], ['approval execution', 'Approval records review. It does not execute the action.'], ['health claim', 'A saved status is not proof of current service health.']]) test('literal safe operational guidance: ' + question, t => {
  const f = fixture(t);
  f.article.goal = guidance;
  f.route.controls = [];
  f.route.requiredTokens = question.toLowerCase().match(/[a-z]+/g);
  f.input.question = question;
  articleRebind(f);
  const result = simulate(f.input);
  assert.equal(result.status, 'selected');
  assert.equal(result.customerEligible, false);
  assert.equal(result.components[0].text, guidance);
  assert.equal(result.components[0].citation.sectionDigest, hash(JSON.stringify(guidance)));
});
test('evaluation identity binds actual full selected bundle and pipeline/evaluator/schema bytes', t => {
  const f = fixture(t),
    observation = {};
  simulate(f.input, observation);
  assert.deepEqual(observation.bundle.files.map(x => x.path), ['article.json', 'catalog.json', 'decision.txt', 'evaluation.json', 'evidence.txt', 'manifest.json', 'source.txt']);
  assert.equal(observation.catalogDigest, f.input.context.catalogDigest);
  assert.equal(observation.bundle.digest, hash(JSON.stringify(observation.bundle.files)));
  const identity = require('../core.cjs').runtimeIdentity();
  assert.deepEqual(identity.files.map(x => x.name), ['core.cjs', 'evaluate.cjs', 'article-record.schema.json', 'retrieval-evaluation.schema.json']);
  const paths = [path.resolve(__dirname, '../core.cjs'), path.resolve(__dirname, '../evaluate.cjs'), path.resolve(__dirname, '../../../docs/product/documentation-coverage/article-record.schema.json'), path.resolve(__dirname, '../../../docs/product/documentation-coverage/retrieval-evaluation.schema.json')];
  assert.deepEqual(identity.files.map(x => x.sha256), paths.map(p => hash(fs.readFileSync(p))));
  assert.equal(identity.digest, hash(JSON.stringify(identity.files)));
  f.input.context.generation = 2;
  const refusalIdentity = {};
  simulate(f.input, refusalIdentity);
  assert.equal(refusalIdentity.catalogDigest, f.input.context.catalogDigest);
  assert.deepEqual(refusalIdentity.bundle.files.map(x => x.path), ['catalog.json']);
});
test('actual evaluator accepts 256 explicit refusals and refuses 257 cases', t => {
  const f = fixture(t),
    input = {
      ...f.input,
      context: {
        ...f.input.context,
        kind: 'replay'
      }
    };
  delete input.root;
  const expected = {
    status: 'no_answer',
    reason: 'catalog_unconfirmed',
    message: 'I do not have approved guidance for this version and question. Check the documented troubleshooting or contact path.',
    simulationOnly: true,
    customerEligible: false
  };
  const cases = Array.from({
    length: 256
  }, (_, i) => ({
    id: 'case' + i,
    input,
    expected
  }));
  function run(cases) {
    const binding = f.write('bounded-suite.json', {
      schema: 1,
      cases
    });
    return spawnSync(process.execPath, [path.resolve(__dirname, '../evaluate.cjs'), '--root', f.input.root, '--suite', binding.path, '--sha256', binding.sha256], {
      encoding: 'utf8'
    });
  }
  const valid = run(cases);
  assert.equal(valid.status, 0);
  assert.equal(JSON.parse(valid.stdout).results.length, 256);
  assert.equal(run([...cases, {
    ...cases[0],
    id: 'case256'
  }]).status, 1);
});
