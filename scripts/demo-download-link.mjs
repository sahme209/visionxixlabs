import { createRequire } from 'node:module';

// Native staging installs desktop dependencies without root node_modules.
const desktopRequire = createRequire(new URL('../desktop/package.json', import.meta.url));
const ts = desktopRequire('./node_modules/typescript');

// Inspect source only: this does not execute components or establish release readiness.
export function hasActionableDemoDownloadLink(source) {
  const file = ts.createSourceFile('demo.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (file.parseDiagnostics.length > 0) return false;
  let found = false;
  function visit(node) {
    if (ts.isJsxElement(node)) {
      const opening = node.openingElement;
      if (['a', 'Link'].includes(opening.tagName.getText(file)) &&
          actionableAttributes(opening.attributes, true)) {
        const label = visibleText(node.children);
        if (label !== null && /\bdownloads?\b/i.test(label)) found = true;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function attributeValue(attribute) {
  if (!attribute.initializer) return true;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
    return literal(attribute.initializer.expression);
  }
  return undefined;
}

function actionableAttributes(attributes, requireTarget = false) {
  let target;
  const names = new Set();
  for (const attribute of attributes.properties) {
    // Unknown props or duplicate attributes can change what actually renders.
    if (!ts.isJsxAttribute(attribute)) return false;
    const name = attribute.name.text;
    if (names.has(name)) return false;
    names.add(name);
    const value = attributeValue(attribute);
    if (name === 'href') target = value;
    if (['disabled', 'hidden', 'inert'].includes(name) && value !== false) return false;
    if (['aria-disabled', 'aria-hidden'].includes(name) && value !== false && value !== 'false') return false;
    // An override label or inline style requires rendering knowledge this check lacks.
    if (['aria-label', 'aria-labelledby', 'style', 'dangerouslySetInnerHTML'].includes(name)) return false;
  }
  return !requireTarget || target === '/download';
}

function visibleText(children) {
  let text = '';
  for (const child of children) {
    if (ts.isJsxText(child)) text += child.text;
    else if (ts.isJsxExpression(child)) {
      // JSX comments contribute no visible label.
      if (!child.expression) continue;
      const value = literal(child.expression);
      if (typeof value !== 'string') return null;
      text += value;
    } else if (ts.isJsxElement(child)) {
      if (!['span', 'strong', 'em', 'b', 'i', 'small'].includes(child.openingElement.tagName.getText()) ||
          !actionableAttributes(child.openingElement.attributes)) return null;
      const nested = visibleText(child.children);
      if (nested === null) return null;
      text += nested;
    } else return null;
  }
  return text;
}
