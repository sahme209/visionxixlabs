'use strict';

// There is deliberately no real-authority constructor or customer-success path.
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const {
  createRequire
} = require('node:module');
const formatsRequire = createRequire(require.resolve('ajv-formats'));
const Ajv = formatsRequire('ajv/dist/2020').default;
const ajv = new Ajv({
  strict: true,
  allErrors: true
});
require('ajv-formats')(ajv);
const schemaRoot = path.resolve(__dirname, '../../docs/product/documentation-coverage');
const schemaBytes = ['article-record.schema.json', 'retrieval-evaluation.schema.json'].map(name => ({
  name,
  bytes: fs.readFileSync(path.join(schemaRoot, name))
}));
const articleCheck = ajv.compile(JSON.parse(schemaBytes[0].bytes));
const evaluationCheck = ajv.compile(JSON.parse(schemaBytes[1].bytes));
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const MESSAGE = 'I do not have approved guidance for this version and question. Check the documented troubleshooting or contact path.';
const refusal = reason => ({
  status: 'no_answer',
  reason,
  message: MESSAGE,
  simulationOnly: true,
  customerEligible: false
});
function ordinary() {
  return {
    ...refusal('catalog_unconfirmed'),
    simulationOnly: false
  };
}
function strictJSON(bytes) {
  if (bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) throw Error();
  const s = new TextDecoder('utf-8', {
    fatal: true
  }).decode(bytes);
  if (s.charCodeAt(0) === 0xfeff) throw Error();
  let i = 0;
  const ws = () => {
    while (/[\t\n\r ]/.test(s[i] || 'x')) i++;
  };
  function str() {
    const start = i++;
    while (i < s.length) {
      if (s[i] === '\\') {
        i += 2;
        continue;
      }
      if (s[i++] === '"') {
        const v = JSON.parse(s.slice(start, i));
        if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v)) throw Error();
        return v;
      }
    }
    throw Error();
  }
  function val() {
    ws();
    if (s[i] === '"') return str();
    if (s[i] === '{') {
      i++;
      ws();
      const keys = new Set();
      if (s[i] === '}') {
        i++;
        return;
      }
      while (true) {
        ws();
        if (s[i] !== '"') throw Error();
        const k = str();
        if (keys.has(k)) throw Error();
        keys.add(k);
        ws();
        if (s[i++] !== ':') throw Error();
        val();
        ws();
        const c = s[i++];
        if (c === '}') return;
        if (c !== ',') throw Error();
      }
    }
    if (s[i] === '[') {
      i++;
      ws();
      if (s[i] === ']') {
        i++;
        return;
      }
      while (true) {
        val();
        ws();
        const c = s[i++];
        if (c === ']') return;
        if (c !== ',') throw Error();
      }
    }
    const m = s.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if (!m) throw Error();
    i += m[0].length;
  }
  val();
  ws();
  if (i !== s.length) throw Error();
  return JSON.parse(s);
}
function fields(o, names) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || Object.keys(o).sort().join('|') !== names.split(' ').sort().join('|')) throw Error();
}
function sandboxProfile(root, filename) {
  // The only directory-data allowance is / for system process startup.
  // Content reads must be regular files at the declared canonical path AND root.
  return '(version 1)(allow default)(deny network*)(deny file-write*)' + '(deny file-read-data)(allow file-read-data (literal "/") (require-all ' + '(subpath ' + JSON.stringify(root) + ') (literal ' + JSON.stringify(filename) + ') (vnode-type REGULAR-FILE)))';
}
function readInKernelBoundary(root, filename, expectedSize) {
  if (process.platform !== 'darwin') throw Error('unsupported containment platform');
  const result = require('node:child_process').spawnSync('/usr/bin/sandbox-exec', ['-p', sandboxProfile(root, filename), '/bin/cat', filename], {
    timeout: 2000,
    maxBuffer: 1048577,
    encoding: null,
    env: {}
  });
  if (result.error || result.status !== 0 || result.signal || result.stdout.length !== expectedSize) throw Error('contained read unavailable');
  return result.stdout;
}
function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}
function reader(root) {
  root = fs.realpathSync(root);
  if (!fs.statSync(root).isDirectory()) throw Error('snapshot root');
  let total = 0;
  const cache = new Map();
  const read = relative => {
    if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(x => !x || x === '.' || x === '..')) throw Error('unsafe relative path');
    if (cache.has(relative)) return cache.get(relative);
    const filename = fs.realpathSync(path.resolve(root, relative));
    if (!filename.startsWith(root + path.sep)) throw Error('outside snapshot');
    const before = fs.lstatSync(filename);
    if (!before.isFile() || before.size > 1048576 || total + before.size > 16777216) throw Error('file or bundle bound');
    // No bytes are read from this parent descriptor. NONBLOCK avoids FIFO open hangs.
    const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    try {
      const opened = fs.fstatSync(fd);
      if (!opened.isFile() || !sameFile(before, opened)) throw Error('changed open identity');
      const bytes = readInKernelBoundary(root, filename, opened.size);
      if (!sameFile(opened, fs.fstatSync(fd)) || !sameFile(opened, fs.lstatSync(filename))) throw Error('changed read identity');
      total += bytes.length;
      cache.set(relative, bytes);
      return bytes;
    } finally {
      fs.closeSync(fd);
    }
  };
  read.identity = () => {
    const files = [...cache].map(([path, bytes]) => ({
      path,
      sha256: hash(bytes),
      size: bytes.length
    })).sort((a, b) => a.path.localeCompare(b.path, 'en'));
    return {
      files,
      totalBytes: total,
      digest: hash(JSON.stringify(files))
    };
  };
  return read;
}
const tokens = s => s.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
function pointer(a, p) {
  if (typeof p !== 'string' || !/^\/(goal|expectedOutcome|title|prerequisites\/\d+|permissions\/\d+|limitations\/\d+|recovery\/\d+|steps\/\d+\/(instruction|expectedState|effect))$/.test(p)) throw Error();
  const v = p.slice(1).split('/').reduce((v, k) => v?.[k], a);
  if (typeof v !== 'string') throw Error();
  return v;
}
const time = s => {
  if (typeof s !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(s) || !Number.isFinite(Date.parse(s))) throw Error();
  return Date.parse(s);
};
function validateCompleteContext(article, pointers) {
  const mandatory = ['prerequisites', 'permissions', 'limitations', 'recovery'].flatMap(key => article[key].map((_, index) => `/${key}/${index}`));
  const selectedSteps = new Set(pointers.map(p => p.match(/^\/steps\/(\d+)\//)?.[1]).filter(Boolean));
  for (const index of selectedSteps) {
    for (const field of ['instruction', 'expectedState', 'effect']) mandatory.push(`/steps/${index}/${field}`);
  }
  if (mandatory.some(p => !pointers.includes(p))) throw Error('incomplete context');
}
function validateReplacementGraph(c) {
  if (!Array.isArray(c.members) || c.members.length > 64) throw Error();
  const byKey = new Map(),
    immutable = new Map(),
    replaced = new Set(),
    successor = new Map();
  for (const e of c.members) {
    fields(e, 'id revision version article evaluation manifest evidence audience revoked supersedes routes');
    for (const b of [e.article, e.evaluation, e.manifest, ...e.evidence]) {
      fields(b, 'path sha256');
      if (!/^[a-f0-9]{64}$/.test(b.sha256)) throw Error();
    }
    if (!Number.isSafeInteger(e.revision) || e.revision < 1 || typeof e.revoked !== 'boolean' || !['public', 'internal'].includes(e.audience) || !Array.isArray(e.routes)) throw Error();
    const k = JSON.stringify([e.id, e.revision, e.version]),
      ik = JSON.stringify([e.id, e.revision]);
    if (byKey.has(k) || immutable.has(ik)) throw Error();
    byKey.set(k, e);
    immutable.set(ik, e);
    e.key = k;
  }
  for (const e of c.members) if (e.supersedes !== null) {
    const p = byKey.get(e.supersedes);
    if (!p || p.id !== e.id || p.version !== e.version || successor.has(e.supersedes)) throw Error();
    successor.set(e.supersedes, e.key);
    replaced.add(e.supersedes);
  }
  for (const e of c.members) {
    const seen = new Set();
    let k = e.key;
    while (successor.has(k)) {
      if (seen.has(k)) throw Error();
      seen.add(k);
      k = successor.get(k);
    }
  }
  const current = new Set();
  for (const e of c.members) if (!replaced.has(e.key)) {
    const k = JSON.stringify([e.id, e.version]);
    if (current.has(k)) throw Error();
    current.add(k);
  }
  return {
    byKey,
    replaced
  };
}
function validateMemberBytes(e, byKey, read) {
  const checked = b => {
    const bytes = read(b.path);
    if (hash(bytes) !== b.sha256) throw Error();
    return bytes;
  };
  const a = strictJSON(checked(e.article)),
    ev = strictJSON(checked(e.evaluation)),
    manifest = strictJSON(checked(e.manifest));
  if (!articleCheck(a) || !evaluationCheck(ev) || a.sources.length > 128 || ev.cases.length > 256 || new Set(ev.cases.map(x => x.id)).size !== ev.cases.length) throw Error();
  if (a.id !== e.id || a.revision !== e.revision || a.productVersion !== e.version || a.verification.verifiedVersion !== e.version || ev.articleId !== e.id || ev.revision !== e.revision || ev.productVersion !== e.version || ev.articleSha256 !== e.article.sha256 || a.supersedes !== (e.supersedes === null ? null : byKey.get(e.supersedes).id + '@' + byKey.get(e.supersedes).revision)) throw Error();
  fields(manifest, 'version sources');
  if (manifest.version !== e.version || JSON.stringify(manifest.sources) !== JSON.stringify(a.sources) || new Set(a.sources.map(x => x.path)).size !== a.sources.length) throw Error();
  for (const b of [...a.sources, ...a.media]) checked({
    path: b.path,
    sha256: b.sha256
  });
  const needed = [...a.verification.evidencePaths, ...a.media.map(m => m.transcriptPath).filter(x => x !== null)];
  if (new Set(e.evidence.map(x => x.path)).size !== e.evidence.length || [...new Set(needed)].sort().join('|') !== e.evidence.map(x => x.path).sort().join('|')) throw Error();
  e.evidence.forEach(checked);
  return a;
}
function publicMetadataEligible(article, entry) {
  return entry.audience === 'public' && article.status === 'approved' && article.classification === 'public' && !article.productVersion.startsWith('local-source-preview:') && ['local-native', 'live'].includes(article.verification.kind) && article.media.every(m => m.publicReviewApproved);
}
function validateRoute(r, e, a, routeIds) {
  fields(r, 'id version audience controls requiredTokens primary context group incompatible destination');
  if (typeof r.id !== 'string' || !r.id || routeIds.has(r.id) || r.version !== e.version || r.audience !== e.audience || typeof r.group !== 'string' || !Array.isArray(r.controls) || !Array.isArray(r.requiredTokens) || !Array.isArray(r.context) || !Array.isArray(r.incompatible)) throw Error();
  routeIds.add(r.id);
  fields(r.destination, 'url version fragment');
  if (r.destination.version !== e.version || !/^https:\/\/[^\s?#]+$/.test(r.destination.url) || !/^#[A-Za-z0-9_-]+$/.test(r.destination.fragment)) throw Error();
  if (!r.controls.every(x => [...a.controlIds, ...a.screenIds].includes(x)) || !r.requiredTokens.every(x => typeof x === 'string' && tokens(x).length === 1 && tokens(x)[0] === x)) throw Error();
  const ps = [r.primary, ...r.context];
  if (new Set(ps).size !== ps.length) throw Error();
  ps.forEach(p => pointer(a, p));
  validateCompleteContext(a, ps);
}
function selectAndCite(candidates, allRoutes, audience, version, c, cb) {
  for (const [k, {
    r
  }] of allRoutes) for (const other of r.incompatible) {
    if (!allRoutes.has(other) || !allRoutes.get(other).r.incompatible.includes(k)) throw Error();
  }
  if (!candidates.length) return refusal('no_eligible_evidence');
  if (candidates.some(x => candidates.some(y => x.r.incompatible.includes(y.rk)))) return refusal('ambiguous_evidence');
  const best = candidates.filter(x => x.priority === Math.max(...candidates.map(x => x.priority)));
  if (best.length !== 1) return refusal('ambiguous_evidence');
  const {
      a,
      e,
      r
    } = best[0],
    ps = [r.primary, ...r.context];
  if (ps.length > 3) return refusal('no_eligible_evidence');
  return {
    status: 'selected',
    simulationOnly: true,
    customerEligible: false,
    inspection: audience === 'internal-inspection',
    unicode: process.versions.unicode,
    catalogDigest: hash(cb),
    components: ps.map(p => ({
      text: pointer(a, p),
      citation: {
        articleId: e.id,
        revision: e.revision,
        productVersion: version,
        articleDigest: e.article.sha256,
        pointer: p,
        sectionDigest: hash(JSON.stringify(pointer(a, p))),
        catalogGeneration: c.generation,
        catalogDigest: hash(cb),
        destination: r.destination.url + r.destination.fragment,
        destinationVersion: version
      }
    }))
  };
}
function simulate({
  root,
  catalogPath,
  context,
  version,
  audience,
  question
}, observation = {}) {
  let read;
  let catalogDigest = null;
  try {
    if (process.versions.unicode !== '17.0') throw Error();
    if (typeof question !== 'string' || [...question].length > 512 || /\b(?:sk-[\w-]+|AKIA[A-Z0-9]+|password\s*[:=]|token\s*[:=]|secret\s*[:=])/i.test(question)) return refusal('unsupported_question');
    if (!['public', 'internal-inspection'].includes(audience) || typeof version !== 'string') throw Error();
    fields(context, 'kind authority decisionDigest generation catalogDigest issuedAt instant expiresAt invocation audience version');
    if (context.kind !== 'simulation' || context.authority !== 'SIMULATED' || !context.invocation || context.audience !== audience || context.version !== version) return refusal('catalog_unconfirmed');
    read = reader(root);
    const cb = read(catalogPath),
      c = strictJSON(cb);
    catalogDigest = hash(cb);
    fields(c, 'schema generation predecessor supportedReleases validFrom validUntil decision members');
    if (c.schema !== 1 || !Number.isSafeInteger(c.generation) || c.generation < 1 || !(c.predecessor === null || /^[a-f0-9]{64}$/.test(c.predecessor))) throw Error();
    if (hash(cb) !== context.catalogDigest || c.generation !== context.generation || time(context.instant) < time(context.issuedAt) || time(context.instant) > time(context.expiresAt) || time(context.instant) < time(c.validFrom) || time(context.instant) > time(c.validUntil)) return refusal('catalog_unconfirmed');
    fields(c.decision, 'path sha256');
    if (hash(read(c.decision.path)) !== c.decision.sha256 || c.decision.sha256 !== context.decisionDigest) throw Error();
    if (!Array.isArray(c.supportedReleases) || new Set(c.supportedReleases).size !== c.supportedReleases.length || !c.supportedReleases.every(v => typeof v === 'string' && !v.startsWith('local-source-preview:'))) throw Error();
    if (!c.supportedReleases.includes(version)) return refusal('version_unavailable');
    const {
      byKey,
      replaced
    } = validateReplacementGraph(c);
    const candidates = [],
      allRoutes = new Map();
    for (const e of c.members) {
      const a = validateMemberBytes(e, byKey, read);
      const routeIds = new Set();
      for (const r of e.routes) {
        validateRoute(r, e, a, routeIds);
        const rk = e.key + ':' + r.id;
        allRoutes.set(rk, {
          r,
          e
        });
        const qt = tokens(question),
          priority = r.controls.some(x => tokens(x).join(' ') === qt.join(' ')) ? 2 : r.requiredTokens.length && r.requiredTokens.every(x => qt.includes(x)) ? 1 : 0;
        if (priority && !e.revoked && !replaced.has(e.key) && e.version === version && (audience === 'internal-inspection' || publicMetadataEligible(a, e))) candidates.push({
          r,
          e,
          a,
          priority,
          rk
        });
      }
    }
    return selectAndCite(candidates, allRoutes, audience, version, c, cb);
  } catch {
    return refusal('integrity_failure');
  } finally {
    observation.catalogDigest = catalogDigest;
    observation.bundle = read ? read.identity() : {
      files: [],
      totalBytes: 0,
      digest: hash('[]')
    };
  }
}
module.exports = {
  ordinary,
  simulate,
  strictJSON,
  hash,
  reader,
  runtimeIdentity,
  sandboxProfile,
  publicMetadataEligible
};
function runtimeIdentity() {
  const paths = ['core.cjs', 'evaluate.cjs'].map(p => path.join(__dirname, p));
  const files = paths.map(p => ({
    name: path.basename(p),
    sha256: hash(fs.readFileSync(p))
  })).concat(schemaBytes.map(({
    name,
    bytes
  }) => ({
    name,
    sha256: hash(bytes)
  })));
  return {
    unicode: '17.0',
    files,
    digest: hash(JSON.stringify(files))
  };
}
