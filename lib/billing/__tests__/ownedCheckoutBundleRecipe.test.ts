import { describe, expect, it } from "vitest";
import ts from "typescript";
describe("owned worker build recipe does not execute during source verification", () => {
  it("fixes its entry, conditions, external names and synthetic-only launch domain", async () => {
    const b = await import("./fixtures/ownedCheckoutWorkerBundle");
    expect(b.ownedWorkerRecipe()).toEqual({ entry: "lib/billing/__tests__/fixtures/ownedCheckoutWorkerEntry.ts", compiler: "typescript@5.9.3", conditions: ["react-server"], externalPackages: ["@prisma/client", "server-only", "stripe"], platform: "node", format: "cjs", mode: "synthetic_only" });
  });
  it("refuses inherited application guard and real provider selectors before any build/spawn", async () => {
    const b = await import("./fixtures/ownedCheckoutWorkerBundle");
    for (const inherited of [{ AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true" }, { STRIPE_SECRET_KEY: "sk_test_opaque_not_read" }, { STRIPE_WEBHOOK_SECRET: "whsec_opaque_not_read" }, { ESBUILD_BINARY_PATH: "/caller/binary" }]) expect(() => b.assertSyntheticSupervisor(inherited)).toThrow("owned_checkout_supervisor_scope_required");
    expect(() => b.assertSyntheticSupervisor({})).not.toThrow();
  });
  it("rejects unknown imports, source escape, source drift and output drift without transpiling", async () => {
    const b = await import("./fixtures/ownedCheckoutWorkerBundle");
    expect(b.ownedSourceClosure("lib/entry.ts", { "lib/entry.ts": 'import { value } from "@/lib/other"; export const x = value;', "lib/other.ts": "export const value = 1;" })).toEqual(["lib/entry.ts", "lib/other.ts"]);
    for (const code of ['import x from "unknown-sdk";', 'require(process.env.CALLER_MODULE)', 'import("../../escape")', 'import x from "../../escape";']) expect(() => b.ownedSourceClosure("lib/entry.ts", { "lib/entry.ts": code })).toThrow("owned_checkout_closure_invalid");
    const source = { "lib/entry.ts": "export const x = 1;" }, outputs = { "lib/entry.js": "exports.x = 1;" }, receipt = b.ownedByteReceipt(source, outputs);
    expect(() => b.verifyOwnedBytes(receipt, source, outputs)).not.toThrow();
    expect(() => b.verifyOwnedBytes(receipt, { "lib/entry.ts": "export const x = 2;" }, outputs)).toThrow("owned_checkout_build_drift");
    expect(() => b.verifyOwnedBytes(receipt, source, { "lib/entry.js": "exports.x = 2;" })).toThrow("owned_checkout_build_drift");
    expect(() => b.verifyOwnedBytes(receipt, source, { ...outputs, "injected.js": "" })).toThrow("owned_checkout_build_drift");
  });

  it("verifies the actual extended build-receipt shape without letting metadata bypass byte drift", async () => {
    const b = await import("./fixtures/ownedCheckoutWorkerBundle");
    const sources = { "lib/inert.ts": "export const value = 1;" }, outputs = { "lib/inert.js": "exports.value = 1;" };
    // Complete actual return shape, with inert unit-only metadata; no build/transpile.
    const full: Awaited<ReturnType<typeof b.buildOwnedWorker>>["receipt"] = {
      recipe: b.ownedWorkerRecipe(), compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, sourceMap: false, declaration: false },
      schemaQualification: { source: "unit-source-schema", generated: "unit-generated-schema", modelFacts: [] },
      tooling: [], configuration: [], compiler: { version: "5.9.3", sha256: "unit-only", integrity: "unit-only" }, externalGraphs: [], ...b.ownedByteReceipt(sources, outputs),
    };
    expect(() => b.verifyOwnedBytes(full, sources, outputs)).not.toThrow();
    expect(() => b.verifyOwnedBytes(full, { "lib/inert.ts": "export const value = 2;" }, outputs)).toThrow("owned_checkout_build_drift");
    expect(() => b.verifyOwnedBytes(full, sources, { "lib/inert.js": "exports.value = 2;" })).toThrow("owned_checkout_build_drift");
    expect(() => b.verifyOwnedBytes(full, sources, { ...outputs, "injected.js": "" })).toThrow("owned_checkout_build_drift");
    expect(() => b.verifyOwnedBytes({ ...full, sources: [{ ...full.sources[0], sha256: "0".repeat(64) }] }, sources, outputs)).toThrow("owned_checkout_build_drift");
    expect(() => b.verifyOwnedBytes({ ...full, outputs: [{ ...full.outputs[0], sha256: "0".repeat(64) }] }, sources, outputs)).toThrow("owned_checkout_build_drift");
  });

  it("preserves known-literal import/export/call AST output with a Node visitor and typed SourceFile root", async () => {
    const b = await import("./fixtures/ownedCheckoutWorkerBundle"), file = "lib/nested/entry.ts";
    const input = 'import { value as alias } from "@/lib/shared"; export { value } from "@/lib/shared"; const a = require("@/lib/shared"); const b = import("@/lib/shared"); import type { Shape } from "@/lib/types"; export const result: Shape = alias;';
    const expected = 'import { value as alias } from "../shared"; export { value } from "../shared"; const a = require("../shared"); const b = import("../shared"); import type { Shape } from "../types"; export const result: Shape = alias;';
    const source = ts.createSourceFile(file, input, ts.ScriptTarget.ES2022, true), comparison = ts.createSourceFile(file, expected, ts.ScriptTarget.ES2022, true);
    const transformed = ts.transform(source, [b.ownedWorkerAliasTransform(file, { [file]: input, "lib/shared.ts": "export const value=1;", "lib/types.ts": "export type Shape=number;" })]);
    try { expect(ts.createPrinter().printFile(transformed.transformed[0])).toBe(ts.createPrinter().printFile(comparison)); } finally { transformed.dispose(); }
    for (const unknown of ['import x from "@/lib/unknown";', 'import x from "@/../escape";']) expect(() => ts.transform(ts.createSourceFile(file, unknown, ts.ScriptTarget.ES2022, true), [b.ownedWorkerAliasTransform(file, { [file]: unknown })])).toThrow("owned_checkout_closure_invalid");
    // AST/printer only: no transpileModule, actual worker closure or output files.
  });

  it("detects an extra or modified actual output file before a child can be launched", async () => {
    const b = await import("./fixtures/ownedCheckoutWorkerBundle"), fs = await import("node:fs"), { createHash } = await import("node:crypto");
    const directory = fs.mkdtempSync("/tmp/axiom-output-bytes-");
    try {
      fs.writeFileSync(directory + "/entry.js", "not executed"); const expected = [{ path: "entry.js", sha256: createHash("sha256").update("not executed").digest("hex") }];
      expect(() => b.verifyOwnedOutputTree(directory, expected)).not.toThrow(); fs.writeFileSync(directory + "/entry.js", "changed, not executed"); expect(() => b.verifyOwnedOutputTree(directory, expected)).toThrow("owned_checkout_build_drift");
      fs.writeFileSync(directory + "/entry.js", "not executed"); fs.writeFileSync(directory + "/injected.js", "not executed"); expect(() => b.verifyOwnedOutputTree(directory, expected)).toThrow("owned_checkout_build_drift");
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

});
