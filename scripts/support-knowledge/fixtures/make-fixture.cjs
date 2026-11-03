// Test-only synthetic release. Never a real editorial/release claim.
const fs = require('node:fs');
const {
  hash
} = require('../core.cjs');
module.exports = function (root) {
  const write = (p, v) => {
    const b = typeof v === 'string' ? v : JSON.stringify(v);
    fs.writeFileSync(root + '/' + p, b);
    return {
      path: p,
      sha256: hash(b)
    };
  };
  const source = write('source.txt', 'SIMULATED release'),
    evidence = write('evidence.txt', 'SIMULATED review');
  const article = {
    schema: 1,
    id: 'axiom.help.synthetic',
    revision: 1,
    status: 'approved',
    classification: 'public',
    title: 'SIMULATED',
    productVersion: 'SIMULATED-1',
    screenIds: [],
    controlIds: ['inspect'],
    goal: 'Inspect saved outcome.',
    prerequisites: ['Never resend an uncertain action.'],
    permissions: [],
    steps: [{
      instruction: 'Inspect only.',
      effect: 'read',
      expectedState: 'Saved outcome.'
    }],
    expectedOutcome: 'Read only.',
    limitations: [],
    recovery: [],
    searchTerms: [],
    sources: [source],
    media: [],
    verification: {
      kind: 'local-native',
      evidencePaths: [evidence.path],
      verifiedVersion: 'SIMULATED-1',
      verifiedAt: '2026-11-03T00:00:00.000Z'
    },
    review: {
      reviewer: 'SIMULATED',
      reviewedAt: '2026-11-03T00:00:00.000Z'
    },
    supersedes: null
  };
  const ab = write('article.json', article);
  const ev = write('evaluation.json', {
    schema: 1,
    articleId: article.id,
    revision: 1,
    productVersion: article.productVersion,
    articleSha256: ab.sha256,
    status: 'proposed-not-executed',
    scope: 'Synthetic only',
    cases: [{
      id: 'one',
      question: 'inspect',
      requiredResponse: 'test only',
      requiredCitation: 'test only'
    }]
  });
  const manifest = write('manifest.json', {
      version: article.productVersion,
      sources: article.sources
    }),
    decision = write('decision.txt', 'SIMULATED authority only');
  const route = {
    id: 'inspect',
    version: article.productVersion,
    audience: 'public',
    controls: ['inspect'],
    requiredTokens: ['outcome'],
    primary: '/goal',
    context: ['/prerequisites/0'],
    group: 'read',
    incompatible: [],
    destination: {
      url: 'https://example.invalid/docs',
      version: article.productVersion,
      fragment: '#inspect'
    }
  };
  const entry = {
    id: article.id,
    revision: 1,
    version: article.productVersion,
    article: ab,
    evaluation: ev,
    manifest,
    evidence: [evidence],
    audience: 'public',
    revoked: false,
    supersedes: null,
    routes: [route]
  };
  const catalog = {
    schema: 1,
    generation: 1,
    predecessor: null,
    supportedReleases: [article.productVersion],
    validFrom: '2026-11-03T00:00:00.000Z',
    validUntil: '2026-11-04T00:00:00.000Z',
    decision,
    members: [entry]
  };
  const cb = write('catalog.json', catalog);
  const context = {
    kind: 'simulation',
    authority: 'SIMULATED',
    decisionDigest: decision.sha256,
    generation: 1,
    catalogDigest: cb.sha256,
    issuedAt: catalog.validFrom,
    instant: '2026-11-03T12:00:00.000Z',
    expiresAt: catalog.validUntil,
    invocation: 'SIMULATED-one',
    audience: 'public',
    version: article.productVersion
  };
  return {
    write,
    article,
    catalog,
    entry,
    route,
    input: {
      root,
      catalogPath: 'catalog.json',
      context,
      version: article.productVersion,
      audience: 'public',
      question: 'inspect'
    }
  };
};
