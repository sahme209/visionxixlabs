/** Existing per-request ceiling, shared by generation and governed extraction. */
export const AI_REQUEST_MAX_OUTPUT_TOKENS = 4096;

export function requestReservationCents(): number {
  const configured = Number(process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS);
  return Number.isSafeInteger(configured) && configured >= 1 && configured <= 10_000 ? configured : 1000;
}
