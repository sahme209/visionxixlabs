export interface ReleaseBatchWait {
  id: string; version: number; status: string; phase: string | null;
  deadlineAt: number | null; nextObservationAt: string | null;
}
export interface ReleaseBatchWaitState {
  requestVersion: number; monitoringEnabled: boolean; canStart: boolean; canCancel: boolean;
  wait: ReleaseBatchWait | null;
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export function isReleaseBatchWait(v: unknown): v is ReleaseBatchWait {
  return record(v) && typeof v.id === "string" && /^release_batch_[a-f0-9]{64}$/.test(v.id)
    && typeof v.version === "number" && Number.isSafeInteger(v.version) && v.version >= 0
    && typeof v.status === "string" && ["queued", "running", "retrying", "paused_for_input", "cancelled", "failed", "completed"].includes(v.status)
    && (v.phase === null || typeof v.phase === "string" && ["observe_batches", "preflight_required", "expired", "blocked", "cancelled"].includes(v.phase))
    && (v.deadlineAt === null || typeof v.deadlineAt === "number" && Number.isSafeInteger(v.deadlineAt) && v.deadlineAt > 0)
    && (v.nextObservationAt === null || typeof v.nextObservationAt === "string" && Number.isFinite(Date.parse(v.nextObservationAt)));
}
export function isReleaseBatchWaitState(v: unknown, expectedVersion: number): v is ReleaseBatchWaitState {
  if (!record(v) || v.requestVersion !== expectedVersion || typeof v.monitoringEnabled !== "boolean"
    || typeof v.canStart !== "boolean" || typeof v.canCancel !== "boolean" || v.wait !== null && !isReleaseBatchWait(v.wait)) return false;
  return (!v.canStart || v.monitoringEnabled && v.wait === null)
    && (!v.canCancel || v.wait !== null && ["queued", "running", "retrying", "paused_for_input"].includes((v.wait as ReleaseBatchWait).status));
}
