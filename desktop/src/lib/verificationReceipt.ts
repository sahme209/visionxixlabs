/** Native IPC is a boundary, not a TypeScript type assertion. */
export interface VerificationReceipt { checkId: string; success: boolean; exitCode: number | null; output: string; durationMs: number }
export function verificationReceipt(value: unknown, checkId: string): VerificationReceipt {
  if (!value || typeof value !== "object") throw Error("Invalid verification receipt; no result can be trusted.");
  const receipt = value as Record<string, unknown>;
  if (receipt.checkId !== checkId || typeof receipt.success !== "boolean"
    || !(receipt.exitCode === null || (typeof receipt.exitCode === "number" && Number.isInteger(receipt.exitCode)))
    || receipt.success !== (receipt.exitCode === 0)
    || typeof receipt.output !== "string" || receipt.output.length > 1_000_001
    || typeof receipt.durationMs !== "number" || !Number.isFinite(receipt.durationMs) || receipt.durationMs < 0)
    throw Error("Invalid verification receipt; no result can be trusted.");
  return {checkId, success: receipt.success, exitCode: receipt.exitCode as number | null, output: receipt.output, durationMs: receipt.durationMs};
}
