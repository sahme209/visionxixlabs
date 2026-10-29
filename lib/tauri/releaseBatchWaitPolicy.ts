/** Pure scheduling policy only. The durable worker must obtain tenant/version-bound
 * observations under a lease. This grants neither approval nor provider execution,
 * and must not consume the operation ledger's write-attempt budget for each read.
 */
export function decideReleaseBatchWait(input: {
  startedAt: number;
  deadlineAt: number;
  now: number;
  observation: "waiting" | "ready" | "changed" | "unavailable";
}): { phase: "waiting"; nextObservationAt: number }
  | { phase: "expired" | "blocked" | "preflight_required" } {
  const { startedAt, deadlineAt, now, observation } = input;
  if (![startedAt, deadlineAt, now].every(Number.isSafeInteger)
    || startedAt < 0 || now < startedAt || deadlineAt <= startedAt
    || deadlineAt - startedAt > 7 * 24 * 60 * 60 * 1_000) {
    throw new Error("Invalid release observation window.");
  }
  if (now >= deadlineAt) return { phase: "expired" };
  if (observation === "ready") return { phase: "preflight_required" };
  if (observation !== "waiting") return { phase: "blocked" };
  return { phase: "waiting", nextObservationAt: Math.min(now + 15_000, deadlineAt) };
}
