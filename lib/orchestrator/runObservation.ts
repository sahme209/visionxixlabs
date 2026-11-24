import { z } from "zod";
import { CAPABILITY_PROFILES, ENGINE_KINDS, normalizeState, ORCHESTRATOR_SCHEMA, reconcileObservations } from "./contract";

const identity = z.string().min(1).max(512).regex(/^[^\s\u0000-\u001f\u007f]+$/);
const bindingSchema = z.object({
  schemaVersion: z.literal(ORCHESTRATOR_SCHEMA),
  organizationId: identity,
  connectionId: identity,
  connectionRevision: identity,
  engineKind: z.enum(ENGINE_KINDS),
  profileVersion: identity,
  workflowId: identity,
  runId: identity,
  sourceDigest: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const receiptSchema = bindingSchema.extend({
  nativeState: z.string().max(80),
  observedAt: z.string().datetime({ precision: 3 }),
  complete: z.boolean(),
}).strict();

export type RunObservationBinding = z.infer<typeof bindingSchema>;
export type RunObservationReceipt = z.infer<typeof receiptSchema>;

function readReceipt(expected: RunObservationBinding, value: unknown) {
  const result = receiptSchema.safeParse(value);
  if (!result.success) return { ok: false, error: "receiptMismatch" } as const;
  const receipt = result.data;
  if (Object.keys(bindingSchema.shape).some(key =>
    receipt[key as keyof RunObservationBinding] !== expected[key as keyof RunObservationBinding]
  )) return { ok: false, error: "scopeMismatch" } as const;
  return { ok: true, receipt } as const;
}

/** A9 status-read conformance. The expected binding comes from the reviewed server record.
 * Receipts carry evidence only. This does not authorize the caller or dispatch work. */
export function compareRunObservations(expected: RunObservationBinding, previous: unknown, next: unknown) {
  if (!bindingSchema.safeParse(expected).success
    || CAPABILITY_PROFILES[expected.engineKind].profileVersion !== expected.profileVersion) {
    return { ok: false, error: "unsupported" } as const;
  }
  const current = readReceipt(expected, next);
  if (!current.ok) return current;
  const nextDate = new Date(current.receipt.observedAt);
  const nextObservation = normalizeState(expected.engineKind, current.receipt.nativeState, nextDate, current.receipt.complete);
  if (previous === null) {
    return current.receipt.complete
      ? { ok: true, disposition: "accepted", state: nextObservation.state } as const
      : { ok: true, disposition: "incomplete", state: "unknown" } as const;
  }

  const saved = readReceipt(expected, previous);
  if (!saved.ok) return saved;
  const savedDate = new Date(saved.receipt.observedAt);
  const savedObservation = normalizeState(expected.engineKind, saved.receipt.nativeState, savedDate, saved.receipt.complete);
  const acceptedObservation = saved.receipt.complete ? savedObservation : null;
  const acceptedState = acceptedObservation?.state ?? "unknown";
  if (nextDate < savedDate) return { ok: true, disposition: "stale", state: acceptedState } as const;
  if (nextDate.getTime() === savedDate.getTime()) {
    const duplicate = current.receipt.nativeState === saved.receipt.nativeState && current.receipt.complete === saved.receipt.complete;
    return { ok: true, disposition: duplicate ? "duplicate" : "anomaly", state: acceptedState } as const;
  }
  if (!current.receipt.complete) return { ok: true, disposition: "incomplete", state: acceptedState } as const;
  const reconciled = reconcileObservations(acceptedObservation, nextObservation);
  return { ok: true, disposition: reconciled.anomaly ? "anomaly" : "accepted", state: reconciled.state } as const;
}
