// Builds lib/support/docsCorpus.json: the visible text of every public docs
// section, for the Ask Axiom support agent. Public pages only; text between
// JSX tags (no attributes, code or expressions). Run after editing any docs page:
//   node scripts/support/build-docs-corpus.mjs
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const docsDir = join(root, "app/docs");
const ENT = { "&apos;": "'", "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&rarr;": "→", "&mdash;": "—", "&ndash;": "–" };
const clean = (jsx) => jsx
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")      // JSX comments
  .replace(/\{["'`]([^"'`{}]*)["'`]\}/g, "$1") // {" "} and {"text"}
  .replace(/\{[^{}]*\}/g, " ")                 // other expressions
  .replace(/<[^>]+>/g, " ")                    // tags and attributes
  .replace(/&[a-z]+;/g, (e) => ENT[e] ?? " ")
  .replace(/\s+/g, " ").trim();

const out = [];
for (const slug of readdirSync(docsDir).sort()) {
  const file = join(docsDir, slug, "page.tsx");
  if (!existsSync(file)) continue;
  const src = readFileSync(file, "utf8");
  const sha = createHash("sha256").update(src).digest("hex");
  const re = /<DocSection\s+([^>]*?)>([\s\S]*?)<\/DocSection>/g;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1];
    const id = /id="([a-z0-9-]+)"/.exec(attrs)?.[1];
    const title = /title="([^"]+)"/.exec(attrs)?.[1];
    const text = clean(m[2]);
    if (!id || !title || text.length < 40) continue;
    out.push({ href: `/docs/${slug}#${id}`, title: clean(title), text: text.slice(0, 1500), source: `app/docs/${slug}/page.tsx`, sourceSha256: sha });
  }
}
writeFileSync(join(root, "lib/support/docsCorpus.json"), JSON.stringify({ format: "axiom.support-docs-corpus/1", sections: out }, null, 1) + "\n");
console.log(`${out.length} sections from public docs`);
