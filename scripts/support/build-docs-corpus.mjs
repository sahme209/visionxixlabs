// Builds lib/support/docsCorpus.json from public guide navigation for Ask V19.
// Public pages only; literal text between
// JSX tags (no attributes, code or expressions). Run after editing any docs page:
//   node scripts/support/build-docs-corpus.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import headingIndex from "../generate-docs-heading-index.cjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const corpusPath = join(root, "lib/support/docsCorpus.json");
const ENT = { "&apos;": "'", "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&rarr;": "→", "&mdash;": "—", "&ndash;": "–" };
const clean = (jsx) => jsx
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")      // JSX comments
  .replace(/\{["'`]([^"'`{}]*)["'`]\}/g, "$1") // {" "} and {"text"}
  .replace(/\{[^{}]*\}/g, " ")                 // other expressions
  .replace(/<[^>]+>/g, " ")                    // tags and attributes
  .replace(/&[a-z]+;/g, (e) => ENT[e] ?? " ")
  .replace(/\s+/g, " ").trim();

export function buildDocsCorpus(guides) {
  const sections = [];
  const sectionPaths = new Set();
  for (const { href, source, sourceSha256 } of [...guides].sort((a, b) => a.href < b.href ? -1 : 1)) {
    const body = readFileSync(join(root, source), "utf8");
    if (createHash("sha256").update(body).digest("hex") !== sourceSha256) {
      throw new Error(`Public guide changed while building support corpus: ${source}`);
    }

    const matches = body.matchAll(/<DocSection\s+([^>]*?)>([\s\S]*?)<\/DocSection>/g);
    for (const [, attrs, contents] of matches) {
      const id = /id="([a-z0-9-]+)"/.exec(attrs)?.[1];
      const title = /title="([^"]+)"/.exec(attrs)?.[1];
      const text = clean(contents);
      if (!id || !title || text.length < 40) continue;

      const sectionPath = `${href}#${id}`;
      if (sectionPaths.has(sectionPath)) throw new Error(`Duplicate public support section: ${sectionPath}`);
      sectionPaths.add(sectionPath);
      sections.push({ href: sectionPath, title: clean(title), text: text.slice(0, 1500), source, sourceSha256 });
    }
  }
  return { format: "axiom.support-docs-corpus/1", sections };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const corpus = buildDocsCorpus(headingIndex.build().guides);
  const expected = JSON.stringify(corpus, null, 1) + "\n";
  if (process.argv.includes("--check")) {
    if (readFileSync(corpusPath, "utf8") !== expected) {
      throw new Error("Public support corpus is stale. Regenerate it with node scripts/support/build-docs-corpus.mjs.");
    }
  } else {
    writeFileSync(corpusPath, expected);
  }
  console.log(`${corpus.sections.length} sections from public docs`);
}
