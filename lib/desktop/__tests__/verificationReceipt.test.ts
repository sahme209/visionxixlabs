import {expect, it} from "vitest";
import {verificationReceipt} from "../../../desktop/src/lib/verificationReceipt";
const receipt = {checkId: "npm:test", success: true, exitCode: 0, output: "test output", durationMs: 1};
it("retains bounded matching process receipts", () => {
  expect(verificationReceipt(receipt, "npm:test")).toEqual(receipt);
  expect(verificationReceipt({...receipt, success: false, exitCode: null}, "npm:test").success).toBe(false);
});
it.each([null, {}, {...receipt, checkId: "other"}, {...receipt, success: true, exitCode: 1}, {...receipt, success: false}, {...receipt, durationMs: NaN}, {...receipt, durationMs: Infinity}, {...receipt, durationMs: 0.5}, {...receipt, durationMs: Number.MAX_SAFE_INTEGER + 1}, {...receipt, exitCode: 2147483648}, {...receipt, durationMs: -1}, {...receipt, output: "x".repeat(1_000_002)}])("refuses malformed or mismatched receipts", value => {
  expect(() => verificationReceipt(value, "npm:test")).toThrow(/Invalid verification receipt/);
});
