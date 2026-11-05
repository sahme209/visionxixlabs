// Finite source extraction only; imports TypeScript, never application code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const trees = new Map();
for (const file of ['components/Navigation.tsx', 'components/Footer.tsx']) {
  const bytes = fs.readFileSync(path.join(root, file));
  const tree = ts.createSourceFile(file, bytes.toString(), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (tree.parseDiagnostics.length) throw Error('invalid_source');
  trees.set(file, { bytes, tree });
}
const unwrap = node => ts.isAsExpression(node) ? unwrap(node.expression) : node;
const literal = node => { if (!ts.isStringLiteral(node)) throw Error('literal_required'); return node.text; };
function declared(tree, name) {
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      if (found) throw Error('duplicate_declaration');
      found = unwrap(node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  if (!found || !ts.isArrayLiteralExpression(found)) throw Error('literal_array_required');
  return found;
}
function fields(node) {
  if (!ts.isObjectLiteralExpression(node)) throw Error('literal_object_required');
  const result = {};
  for (const p of node.properties) {
    if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name) || p.name.text in result) throw Error('fixed_property_required');
    result[p.name.text] = p.initializer;
  }
  return result;
}
const nav = trees.get('components/Navigation.tsx').tree;
const linkArrays = {};
for (const name of ['primaryLinks', 'secondaryLinks', 'mobileLinks']) {
  linkArrays[name] = [];
  for (const node of declared(nav, name).elements) {
    if (ts.isSpreadElement(node)) {
      if (!ts.isIdentifier(node.expression) || !linkArrays[node.expression.text]) throw Error('known_prior_spread_required');
      linkArrays[name].push(...linkArrays[node.expression.text]);
    } else {
      const p = fields(node);
      if (Object.keys(p).sort().join(',') !== 'href,label') throw Error('exact_link_fields_required');
      linkArrays[name].push({ label: literal(p.label), href: literal(p.href) });
    }
  }
}
const footer = trees.get('components/Footer.tsx').tree;
const columns = [...declared(footer, 'columns').elements].map(node => {
  const p = fields(node);
  if (Object.keys(p).sort().join(',') !== 'links,title' || !ts.isArrayLiteralExpression(p.links)) throw Error('exact_column_fields_required');
  return { title: literal(p.title), links: [...p.links.elements].map(pair => {
    if (!ts.isArrayLiteralExpression(pair) || pair.elements.length !== 2) throw Error('literal_pair_required');
    return { label: literal(pair.elements[0]), href: literal(pair.elements[1]) };
  }) };
});
const files = [];
for (const [file, { bytes, tree }] of trees) {
  const declarations = [];
  function visit(node) {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening && ['button', 'Link'].includes(opening.tagName.getText(tree))) {
      const text = node.getText(tree);
      declarations.push({ tag: opening.tagName.getText(tree), startLine: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        endLine: tree.getLineAndCharacterOfPosition(node.getEnd()-1).line + 1, nodeSha256: hash(text), sourceText: text });
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  files.push({ path: file, sha256: hash(bytes), declarations });
}
process.stdout.write(JSON.stringify({ scope: 'All direct button and Link JSX declarations in the two selected shared components, and literal destination arrays; not runtime instances, mounted visibility, browser execution, destination health or permissions.', typescriptVersion: ts.version, linkArrays, columns, files }, null, 2) + '\n');
