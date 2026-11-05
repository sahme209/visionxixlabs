// Finite current-source inventory only. Does not import or execute application code.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const files = ['WorkflowCatalogue', 'WorkflowDefinitionInputs', 'WorkflowInputsEditor', 'ReleaseBatchSelection'].map(name => `desktop/src/components/${name}.tsx`);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const output = files.map(file => {
  const raw = fs.readFileSync(path.join(root, file));
  const source = ts.createSourceFile(file, raw.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (source.parseDiagnostics.length) throw Error('source_parse_required');
  const declarations = [];
  const visit = node => {
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    const tag = opening?.tagName.getText(source);
    if (['button', 'input', 'select', 'textarea'].includes(tag)) {
      const start = node.getStart(source), end = node.getEnd();
      declarations.push({ tag, startLine: source.getLineAndCharacterOfPosition(start).line + 1, endLine: source.getLineAndCharacterOfPosition(end - 1).line + 1,
        nodeSha256: hash(source.text.slice(start, end)), opening: opening.getText(source), sourceText: source.text.slice(start, end) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {path: file, sha256: hash(raw), declarations};
});
process.stdout.write(JSON.stringify({scope: 'four fixed source files; interactive intrinsic JSX declarations, not mounted instances, complete dynamic schema or runtime help identifiers', total: output.reduce((n, row) => n + row.declarations.length, 0), files: output}, null, 2) + '\n');
