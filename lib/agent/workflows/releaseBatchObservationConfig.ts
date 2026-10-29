/** Explicit server opt-in, never a client body/query switch. Disabled by default. */
export function releaseBatchObservationsEnabled(): boolean {
  return process.env.AXIOM_RELEASE_BATCH_WAITS_ENABLED === "true";
}
