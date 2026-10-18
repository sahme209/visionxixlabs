import { describe, expect, it } from "vitest";
import ts from "typescript";
import { ownedWorkerRecipe } from "./fixtures/ownedCheckoutWorkerBundle";
const result = () => ({
  observations: [{ stage: "paid_read", status: 200 }], workerOutputDigest: "a".repeat(64),
  workerBuildReceipt: { recipe: ownedWorkerRecipe(), compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, sourceMap: false, declaration: false }, schemaQualification: { source: "b".repeat(64), generated: "c".repeat(64), modelFacts: [] }, tooling: [], configuration: [], compiler: { version: "5.9.3", sha256: "d".repeat(64), integrity: "synthetic-lock" }, externalGraphs: [], sources: [], outputs: [] },
  syntheticProviderOnly: true, actualHostedPayment: false,
});
describe("owned28 returned evidence record (pure metadata; no process or filesystem)", () => {
  it("emits one fixed marker and JSON of the existing returned metadata only", async () => {
    const { ownedCheckoutEvidenceLine } = await import("./fixtures/ownedCheckoutHttpAcceptance");
    const receipt = result(), input = { ...receipt, cookie: "excluded-cookie", capability: "excluded-capability", databaseUrl: "excluded-database" };
    const line = ownedCheckoutEvidenceLine(input), marker = "AXIOM_OWNED_CHECKOUT_RECEIPT_V1 ";
    expect(line.startsWith(marker)).toBe(true); expect(line.split("\n")).toHaveLength(1);
    expect(JSON.parse(line.slice(marker.length))).toEqual(receipt);
    for (const value of [input.cookie, input.capability, input.databaseUrl]) expect(line.includes(value)).toBe(false);
  });
  it("bounds UTF8 bytes, including multibyte content, before anything can be emitted", async () => {
    const { ownedCheckoutEvidenceLine } = await import("./fixtures/ownedCheckoutHttpAcceptance");
    const receipt = result(); receipt.observations[0].stage = "é".repeat(131073);
    expect(() => ownedCheckoutEvidenceLine(receipt)).toThrow("owned_checkout_evidence_unavailable");
  });
  it("does not traverse unrelated return fields while retaining the complete build receipt", async () => {
    const { ownedCheckoutEvidenceLine } = await import("./fixtures/ownedCheckoutHttpAcceptance");
    const receipt = result(), input = { ...receipt, get rawError(): never { throw new Error("must_not_read"); } };
    const line = ownedCheckoutEvidenceLine(input);
    expect(JSON.parse(line.slice(line.indexOf(" ") + 1)).workerBuildReceipt).toEqual(receipt.workerBuildReceipt);
  });
});
