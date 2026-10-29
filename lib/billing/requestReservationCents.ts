/** Existing per-request ceiling, shared by generation and governed extraction. */
export const AI_REQUEST_MAX_OUTPUT_TOKENS = 4096;

/**
 * Resolve the server-owned output-token bound for any Gateway generation.
 * Missing caller values use the existing ceiling; malformed values and
 * attempts to raise it fail closed before provider dispatch.
 */
export function boundedAIOutputTokens(requested: unknown): number {
  const value = requested === undefined ? AI_REQUEST_MAX_OUTPUT_TOKENS : requested;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > AI_REQUEST_MAX_OUTPUT_TOKENS) {
    throw new RangeError("AI output token limit must be an integer from 1 through the server limit");
  }
  return value;
}

export function requestReservationCents(): number {
  const configured = Number(process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS);
  return Number.isSafeInteger(configured) && configured >= 1 && configured <= 10_000 ? configured : 1000;
}
