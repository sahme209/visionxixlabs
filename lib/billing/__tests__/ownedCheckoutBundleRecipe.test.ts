import { describe, expect, it } from "vitest";
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
