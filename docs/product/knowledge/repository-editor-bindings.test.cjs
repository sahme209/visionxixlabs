const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const inventory = require('./repository-editor-bindings.json');
const root = path.resolve(__dirname, '../../..');
const source = fs.readFileSync(path.join(root, inventory.source), 'utf8');
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const strip = text => text.replace(/ data-help-id="repositories\.editor\.[a-z-]+"/g, '');
function issues(text) {
 const file = ts.createSourceFile(inventory.source, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 const found = new Map(), errors = [];
 function visit(node) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
   for (const attr of node.attributes.properties.filter(a => ts.isJsxAttribute(a) && a.name.getText(file) === 'data-help-id')) {
    if (!attr.initializer || !ts.isStringLiteral(attr.initializer)) { errors.push('nonliteral ID'); continue; }
    const id = attr.initializer.text;
    const control = inventory.controls.find(c => c.helpId === id);
    found.set(id, (found.get(id) || 0) + 1);
    if (!control) { errors.push(`unknown ID ${id}`); continue; }
    if (node.tagName.getText(file) !== control.tag) errors.push(`wrong tag ${id}`);
    const element = ts.isJsxOpeningElement(node) ? node.parent : node;
    // Exact existing node, including handlers, labels and descendants, binds the metadata.
    if (sha(strip(element.getText(file))) !== control.nodeSha256) errors.push(`wrong node ${id}`);
   }
  }
  ts.forEachChild(node, visit);
 }
 visit(file);
 for (const c of inventory.controls) if (found.get(c.helpId) !== 1) errors.push(`missing or duplicate ${c.helpId}`);
 return errors;
}
test('finite draft inventory records local nodes and explicit shared-control gaps', () => {
 assert.equal(inventory.customerEligible, false);
 assert.equal(inventory.publicationApproved, false);
 assert.equal(inventory.controls.length, 23);
 assert.equal(new Set(inventory.controls.map(c => c.helpId)).size, 23);
 assert.equal(new Set(inventory.controls.map(c => c.family)).size, 22);
 for (const c of inventory.controls) {
  assert.match(c.helpId, /^repositories\.editor\.[a-z-]+$/);
  assert.equal(c.source, inventory.source);
 }
 assert.deepEqual(inventory.unbound.flatMap(c => c.families), [7, 8, 9, 24, 25, 27]);
});
test('all declarations bind literal metadata to their exact existing JSX controls', () => {
 assert.deepEqual(issues(source), []);
});
test('stripping only added attributes restores byte-identical baseline runtime source', () => {
 assert.equal(sha(strip(source)), inventory.baselineSha256);
});
test('validator rejects absent, dynamic, duplicate, misplaced and wrong-tag metadata', () => {
 const id = 'repositories.editor.filter-files';
 const attr = `data-help-id="${id}"`;
 assert(issues(source.replace(` ${attr}`, '')).includes(`missing or duplicate ${id}`));
 assert(issues(source.replace(attr, `${attr} ${attr}`)).includes(`missing or duplicate ${id}`));
 assert(issues(source.replace(attr, 'data-help-id={"repositories.editor.filter-files"}')).includes('nonliteral ID'));
 assert(issues(source.replace(`<input ${attr}`, `<label ${attr}`)).includes(`wrong tag ${id}`));
 assert(issues(source.replace(attr, 'data-help-id="repositories.editor.unknown"')).some(e => e.startsWith('unknown ID')));
 const swapped = source.replace('data-help-id="repositories.editor.filter-files"', 'data-help-id="repositories.editor.line-number"').replace('data-help-id="repositories.editor.line-number" aria-label="Line number"', 'data-help-id="repositories.editor.filter-files" aria-label="Line number"');
 assert(issues(swapped).some(e => e.startsWith('wrong node')));
});
