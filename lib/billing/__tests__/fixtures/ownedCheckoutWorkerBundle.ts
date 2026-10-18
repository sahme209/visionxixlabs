/** Explicit future owned-runtime packaging only. Merely importing this file
 * does not transpile/write/execute anything. Transpilation is not typechecking. */
import ts from "typescript";
import { createHash } from "node:crypto";
import { createRequire, isBuiltin } from "node:module";
import { dirname, relative, resolve, posix } from "node:path";
import { lstatSync, realpathSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
const entry = "lib/billing/__tests__/fixtures/ownedCheckoutWorkerEntry.ts";
const externalPackages = ["@prisma/client", "server-only", "stripe"] as const;
const sha = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
function invalid(): never { throw new Error("owned_checkout_closure_invalid"); }
export function ownedWorkerRecipe() { return { entry, compiler: "typescript@5.9.3", conditions: ["react-server"], externalPackages: [...externalPackages], platform: "node", format: "cjs", mode: "synthetic_only" } as const; }
export function assertSyntheticSupervisor(inherited: Readonly<Record<string, string | undefined>>) {
  if (inherited.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME !== undefined && inherited.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME !== "false" || ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "ESBUILD_BINARY_PATH"].some(k => Object.prototype.hasOwnProperty.call(inherited, k))) throw new Error("owned_checkout_supervisor_scope_required");
}
function imports(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, true); const found = new Set<string>();
  const literal = (node: ts.Node | undefined) => { if (!node || !ts.isStringLiteral(node)) invalid(); found.add(node.text); };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) { if (!node.importClause?.isTypeOnly) literal(node.moduleSpecifier); }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.isTypeOnly) literal(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node)) invalid();
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && ["require", "createRequire", "eval", "Function"].includes(node.expression.text))) {
      if (ts.isIdentifier(node.expression) && node.expression.text !== "require" || node.arguments.length !== 1) invalid(); literal(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source); return [...found];
}
function importedPath(from: string, specifier: string, exists: (path: string) => boolean): string | null {
  if (isBuiltin(specifier)) return null;
  if ((externalPackages as readonly string[]).includes(specifier)) return null;
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) invalid();
  const base = posix.normalize(specifier.startsWith("@/") ? specifier.slice(2) : posix.join(posix.dirname(from), specifier));
  if (!base.startsWith("lib/") || base.includes("/node_modules/") || base.split("/").includes("..")) invalid();
  const choices = [base + ".ts", base + ".tsx", base + "/index.ts"]; const match = choices.find(exists); if (!match) invalid(); return match;
}
function collect(initial: string, read: (path: string) => string, exists: (path: string) => boolean): string[] {
  if (!initial.startsWith("lib/") || posix.normalize(initial) !== initial) invalid();
  const visited = new Set<string>();
  const visit = (path: string) => { if (visited.has(path)) return; visited.add(path); for (const name of imports(path, read(path))) { const target = importedPath(path, name, exists); if (target) visit(target); } };
  visit(initial); return [...visited].sort();
}
export function ownedSourceClosure(initial: string, sources: Readonly<Record<string, string>>): string[] { return collect(initial, path => { if (!Object.prototype.hasOwnProperty.call(sources, path)) invalid(); return sources[path]; }, path => Object.prototype.hasOwnProperty.call(sources, path)); }
export function ownedByteReceipt(sources: Readonly<Record<string, string>>, outputs: Readonly<Record<string, string>>) { const rows = (value: Readonly<Record<string, string>>) => Object.keys(value).sort().map(path => ({ path, sha256: sha(value[path]) })); return { sources: rows(sources), outputs: rows(outputs) }; }
export function verifyOwnedBytes(receipt: ReturnType<typeof ownedByteReceipt>, sources: Readonly<Record<string, string>>, outputs: Readonly<Record<string, string>>) { if (JSON.stringify(receipt) !== JSON.stringify(ownedByteReceipt(sources, outputs))) throw new Error("owned_checkout_build_drift"); }
function checkedDirectory(directory: string) { const stat = lstatSync(directory); if (!/^\/tmp\/axiom-owned-checkout-[a-f0-9]{32}$/.test(directory) || !stat.isDirectory() || stat.isSymbolicLink() || realpathSync(directory) !== directory || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o700) invalid(); }
function tree(directory: string): Array<{ path: string; sha256: string }> {
  const rows: Array<{ path: string; sha256: string }> = [];
  const walk = (path: string) => { for (const name of readdirSync(path).sort()) { const file = resolve(path, name), stat = lstatSync(file); if (stat.isSymbolicLink()) invalid(); if (stat.isDirectory()) walk(file); else if (stat.isFile()) rows.push({ path: relative(directory, file), sha256: sha(readFileSync(file)) }); else invalid(); } }; walk(directory); return rows;
}
/** Call only after separate source closure and owned runtime grant. Pins source,
 * compiler implementation/lock and entire external package trees. No install,
 * generation, permissive runtime loader or shared dependency mutation. */
export async function buildOwnedWorker(directory: string, reviewed: { sources: Array<{ path: string; sha256: string }>; tooling: Array<{ path: string; sha256: string }>; configuration: Array<{ path: string; sha256: string }>; compiler: { sha256: string; version: string; integrity: string }; externalGraphs: Array<{ name: string; directory: string; owner: string; version: string; integrity: string; files: Array<{ path: string; sha256: string }> }> }) {
  assertSyntheticSupervisor(process.env); checkedDirectory(directory);
  const root = resolve(dirname(new URL(import.meta.url).pathname), "../../../.."), require = createRequire(resolve(root, "package.json"));
  const expectedTooling = ["lib/billing/__tests__/fixtures/ownedCheckoutWorkerBundle.ts", "lib/billing/__tests__/fixtures/ownedCheckoutWorkerSupervisor.ts", "lib/billing/__tests__/fixtures/newTestChildEnvironment.ts", "lib/billing/__tests__/fixtures/ownedCheckoutHttpAcceptance.ts"].sort();
  const expectedConfiguration = ["package.json", "package-lock.json", "prisma/schema.prisma", "tsconfig.json", "tsconfig.next.json", "next.config.ts", "vitest.config.ts"].sort();
  for (const [expected, actual] of [[expectedTooling, reviewed.tooling], [expectedConfiguration, reviewed.configuration]] as const) {
    const rows = expected.map(path => ({ path, sha256: sha(readFileSync(resolve(root, path))) })); if (JSON.stringify(rows) !== JSON.stringify(actual)) invalid();
  }
  const lock = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8")) as { packages: Record<string, { version?: string; integrity?: string }> };
  const compiler = require.resolve("typescript"), compilerLock = lock.packages["node_modules/typescript"];
  if (ts.version !== "5.9.3" || ts.version !== compilerLock?.version || reviewed.compiler.version !== ts.version || reviewed.compiler.integrity !== compilerLock.integrity || sha(readFileSync(compiler)) !== reviewed.compiler.sha256) invalid();
  const exists = (path: string) => { try { const file = resolve(root, path); return file.startsWith(root + "/lib/") && realpathSync(file) === file && lstatSync(file).isFile(); } catch { return false; } };
  const read = (path: string) => { if (!exists(path)) invalid(); return readFileSync(resolve(root, path), "utf8"); };
  const sources = Object.fromEntries(collect(entry, read, exists).map(path => [path, read(path)]));
  if (JSON.stringify(reviewed.sources) !== JSON.stringify(ownedByteReceipt(sources, {}).sources)) invalid();
  if (reviewed.externalGraphs.length !== 4 || reviewed.externalGraphs.map(r => r.name).sort().join("|") !== ["@prisma/client", ".prisma/client", "server-only", "stripe"].sort().join("|")) invalid();
  for (const graph of reviewed.externalGraphs) {
    const expected = graph.name === ".prisma/client" ? dirname(require.resolve(".prisma/client/default")) : graph.name === "server-only" ? resolve(root, "node_modules/next/dist/compiled/server-only") : resolve(root, "node_modules", graph.name);
    const owner = graph.name === "server-only" ? "next" : graph.name === ".prisma/client" ? "@prisma/client" : graph.name;
    const ownerLock = lock.packages["node_modules/" + owner], ownerPackage = JSON.parse(readFileSync(resolve(root, "node_modules", owner, "package.json"), "utf8")) as { version?: string };
    if (graph.owner !== owner || graph.version !== ownerLock?.version || graph.version !== ownerPackage.version || graph.integrity !== ownerLock.integrity || realpathSync(graph.directory) !== realpathSync(expected) || JSON.stringify(tree(expected)) !== JSON.stringify(graph.files)) invalid();
  }
  // The reused generated client has a historically qualified different whole
  // schema. All used/conservatively included auth/billing/admission model definitions must
  // match, independent of formatting and attribute order; never regenerate.
  const sourceSchema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8"), cachedSchema = readFileSync(resolve(reviewed.externalGraphs.find(g => g.name === ".prisma/client")!.directory, "schema.prisma"), "utf8");
  const modelFacts = ownedGeneratedModelFacts(sourceSchema, cachedSchema);
  const schemaQualification = { source: sha(sourceSchema), generated: sha(cachedSchema), modelFacts };
  const output = resolve(directory, "compiled"); mkdirSync(output, { mode: 0o700 });
  const outputs: Record<string, string> = {};
  const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, sourceMap: false, declaration: false };
  for (const [path, source] of Object.entries(sources)) {
    const result = ts.transpileModule(source, { fileName: path, compilerOptions, reportDiagnostics: true, transformers: { before: [context => file => ts.visitNode(file, function visit(node): ts.VisitResult<ts.Node> {
      const rewrite = (literal: ts.Expression) => {
        if (!ts.isStringLiteral(literal) || !literal.text.startsWith("@/")) return literal;
        const target = importedPath(path, literal.text, p => p in sources); if (!target) invalid(); const rel = posix.relative(posix.dirname(path), target).replace(/\.tsx?$/, ""); return context.factory.createStringLiteral(rel.startsWith(".") ? rel : "./" + rel);
      };
      if (ts.isImportDeclaration(node)) return context.factory.updateImportDeclaration(node, node.modifiers, node.importClause, rewrite(node.moduleSpecifier), node.attributes);
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) return context.factory.updateExportDeclaration(node, node.modifiers, node.isTypeOnly, node.exportClause, rewrite(node.moduleSpecifier), node.attributes);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require")) return context.factory.updateCallExpression(node, node.expression, node.typeArguments, node.arguments.map(rewrite));
      return ts.visitEachChild(node, visit, context);
    }) as ts.SourceFile] } });
    if (result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) invalid();
    const target = path.replace(/\.tsx?$/, ".js"); outputs[target] = result.outputText; const destination = resolve(output, target); mkdirSync(dirname(destination), { recursive: true, mode: 0o700 }); writeFileSync(destination, result.outputText, { flag: "wx", mode: 0o600 });
  }
  // Ordinary Node package resolution uses only a supervisor-owned link to the
  // exact previously hashed graph, installed in the separate launch helper.
  const receipt = { recipe: ownedWorkerRecipe(), compilerOptions, schemaQualification, tooling: reviewed.tooling, configuration: reviewed.configuration, compiler: reviewed.compiler, externalGraphs: reviewed.externalGraphs, ...ownedByteReceipt(sources, outputs) };
  writeFileSync(resolve(directory, "build-receipt.json"), JSON.stringify(receipt), { flag: "wx", mode: 0o600 });
  return { entry: resolve(output, entry.replace(/\.ts$/, ".js")), receipt, output, outputDigest: sha(JSON.stringify(receipt.outputs)) };
}

export function verifyOwnedOutputTree(directory: string, outputs: Array<{ path: string; sha256: string }>) { if (JSON.stringify(tree(directory)) !== JSON.stringify([...outputs].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) throw new Error("owned_checkout_build_drift"); }

export function ownedGeneratedModelFacts(source: string, generated: string) {
  const names = ["User", "OrgMembership", "TenantBillingPlan", "StripeBillingEvent", "UsageEvent", "AIUsageReservation", "AddOnPurchase", "OrganizationAIProviderPolicy", "SecureAuditRecord"];
  const line = (input: string) => {
    let output = "", quoted = false, escaped = false;
    for (let n = 0; n < input.length; n++) {
      const c = input[n];
      if (quoted) { output += c; if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') quoted = false; }
      else if (c === "/" && input[n + 1] === "/") break;
      else if (c === '"') { quoted = true; output += c; }
      else if (/\s/.test(c)) { if (output && !output.endsWith(" ")) output += " "; }
      else output += c;
    }
    if (quoted || escaped) invalid(); return output.trim();
  };
  const facts = (schema: string, name: string) => { const match = schema.match(new RegExp("^model " + name + " \\{[\\s\\S]*?^\\}", "m")); if (!match) invalid(); return match[0].split("\n").map(line).filter(Boolean).sort(); };
  return names.map(name => { const expected = facts(source, name), actual = facts(generated, name); if (JSON.stringify(expected) !== JSON.stringify(actual)) invalid(); return { name, sha256: sha(JSON.stringify(expected)) }; });
}
