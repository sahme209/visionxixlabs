/**
 * Engine-independent orchestrator contract, read-only foundations (A9.5).
 * Implements the observation half of docs/product/orchestrator-contract-design.md
 * (schema `axiom.orchestrator/1`). Pure: no I/O, no credentials, no dispatch.
 *
 * What is here: capability profiles, native→normalized state mapping, closed
 * error codes and the shared contract vectors that do not need a real engine.
 * What is NOT here: start/cancel/retry submission. Those stay behind core
 * Governance enforcement (A9.10); every read-only engine reports them as
 * `unsupported`, never simulated.
 */

export const ORCHESTRATOR_SCHEMA = "axiom.orchestrator/1" as const;
export const ENGINE_KINDS = ["airflow", "prefect", "dagster", "argo_workflows"] as const;
export type EngineKind = (typeof ENGINE_KINDS)[number];

/** Normalized engine observation states (design §4). Axiom ledger states are deliberately absent. */
export const NORMALIZED_STATES = ["accepted", "queued", "running", "succeeded", "failed", "cancelRequested", "cancelled", "unknown"] as const;
export type NormalizedState = (typeof NORMALIZED_STATES)[number];

/** Closed error codes (design §4). */
export const ORCHESTRATOR_ERRORS = ["unsupported", "authorityUnavailable", "scopeMismatch", "sourceChanged", "connectionChanged", "deadlineExpired", "cancelledBeforeSubmission", "providerRejected", "rateLimited", "transportUnknown", "receiptMismatch", "historyUnavailable"] as const;
export type OrchestratorError = (typeof ORCHESTRATOR_ERRORS)[number];

export type Support = "supported" | "unsupported";
export interface CapabilityProfile {
  schemaVersion: typeof ORCHESTRATOR_SCHEMA;
  engineKind: EngineKind;
  profileVersion: string;
  capabilities: {
    listDefinitions: Support; status: Support; taskObservation: Support; events: Support;
    start: Support; cancel: Support; retryAssessment: Support;
  };
  /** Bounds the adapter honours on every observation. */
  observationLimits: { maxEntries: number; firstPageOnly: boolean };
  /** Plain statements of what this profile does not establish. */
  limits: readonly string[];
}

const READ_ONLY_LIMITS = ["Observation only: no submission, cancellation or retry is implemented for this engine.", "A capability never implies Governance coverage."];

/** Reviewed, server-owned profiles. Not request-supplied. */
export const CAPABILITY_PROFILES: Readonly<Record<EngineKind, CapabilityProfile>> = Object.freeze({
  airflow: { schemaVersion: ORCHESTRATOR_SCHEMA, engineKind: "airflow", profileVersion: "airflow-v2-observe-1",
    capabilities: { listDefinitions: "supported", status: "supported", taskObservation: "supported", events: "unsupported", start: "unsupported", cancel: "unsupported", retryAssessment: "unsupported" },
    observationLimits: { maxEntries: 20, firstPageOnly: true },
    limits: ["Existing Airflow triggers stay on their current reviewed path and are not exposed through this contract yet.", "The inspected Airflow client exposes no generic cancel.", ...READ_ONLY_LIMITS.slice(1)] },
  prefect: { schemaVersion: ORCHESTRATOR_SCHEMA, engineKind: "prefect", profileVersion: "prefect-observe-1",
    capabilities: { listDefinitions: "supported", status: "supported", taskObservation: "supported", events: "unsupported", start: "unsupported", cancel: "unsupported", retryAssessment: "unsupported" },
    observationLimits: { maxEntries: 20, firstPageOnly: true }, limits: READ_ONLY_LIMITS },
  dagster: { schemaVersion: ORCHESTRATOR_SCHEMA, engineKind: "dagster", profileVersion: "dagster-observe-1",
    capabilities: { listDefinitions: "supported", status: "supported", taskObservation: "unsupported", events: "unsupported", start: "unsupported", cancel: "unsupported", retryAssessment: "unsupported" },
    observationLimits: { maxEntries: 20, firstPageOnly: true }, limits: READ_ONLY_LIMITS },
  argo_workflows: { schemaVersion: ORCHESTRATOR_SCHEMA, engineKind: "argo_workflows", profileVersion: "argo-observe-1",
    capabilities: { listDefinitions: "supported", status: "supported", taskObservation: "unsupported", events: "unsupported", start: "unsupported", cancel: "unsupported", retryAssessment: "unsupported" },
    observationLimits: { maxEntries: 20, firstPageOnly: true }, limits: ["Scoped to one namespace.", ...READ_ONLY_LIMITS] },
});

/** Native state vocabularies per engine → normalized. Anything not listed is `unknown` (never a guessed terminal). */
const NATIVE: Readonly<Record<EngineKind, Readonly<Record<string, NormalizedState>>>> = Object.freeze({
  airflow: { queued: "queued", scheduled: "queued", running: "running", success: "succeeded", failed: "failed" },
  prefect: { SCHEDULED: "queued", PENDING: "queued", RUNNING: "running", COMPLETED: "succeeded", FAILED: "failed", CRASHED: "failed", CANCELLING: "cancelRequested", CANCELLED: "cancelled", PAUSED: "running" },
  dagster: { QUEUED: "queued", NOT_STARTED: "queued", MANAGED: "queued", STARTING: "running", STARTED: "running", SUCCESS: "succeeded", FAILURE: "failed", CANCELING: "cancelRequested", CANCELED: "cancelled" },
  argo_workflows: { Pending: "queued", Running: "running", Succeeded: "succeeded", Failed: "failed", Error: "failed" },
});

export interface Observation { engineKind: EngineKind; nativeState: string; state: NormalizedState; observedAt: string; complete: boolean }

/** Normalizes one native state. Keeps the native value so nothing is lost. */
export function normalizeState(engine: EngineKind, nativeState: unknown, observedAt: Date, complete = false): Observation {
  const native = typeof nativeState === "string" ? nativeState.slice(0, 80) : "";
  return { engineKind: engine, nativeState: native, state: NATIVE[engine][native] ?? "unknown", observedAt: observedAt.toISOString(), complete };
}

export type CapabilityCheck = { ok: true; profile: CapabilityProfile } | { ok: false; error: OrchestratorError; detail: string };

/**
 * Contract vector C01: an unknown schema major version, unknown engine, or an
 * operation the profile does not support refuses BEFORE any credential or write.
 */
export function requireCapability(input: { schemaVersion: unknown; engineKind: unknown; operation: keyof CapabilityProfile["capabilities"] }): CapabilityCheck {
  if (input.schemaVersion !== ORCHESTRATOR_SCHEMA) return { ok: false, error: "unsupported", detail: "Unknown orchestrator schema version." };
  if (typeof input.engineKind !== "string" || !(ENGINE_KINDS as readonly string[]).includes(input.engineKind)) return { ok: false, error: "unsupported", detail: "Unknown engine." };
  const profile = CAPABILITY_PROFILES[input.engineKind as EngineKind];
  if (profile.capabilities[input.operation] !== "supported") return { ok: false, error: "unsupported", detail: `${input.operation} is not supported by ${profile.profileVersion}.` };
  return { ok: true, profile };
}

/** Contract vector C09 (read-only engines): cancellation is reported, never faked. */
export function cancelResult(engine: EngineKind): "notSupported" {
  if (CAPABILITY_PROFILES[engine].capabilities.cancel === "supported") throw new Error("cancel_requires_governed_permit");
  return "notSupported";
}

/** Design §4: contradictory terminal observations append an anomaly instead of silently regressing history. */
export function reconcileObservations(previous: Observation | null, next: Observation): { state: NormalizedState; anomaly: boolean } {
  const terminal = (s: NormalizedState) => s === "succeeded" || s === "failed" || s === "cancelled";
  if (previous && terminal(previous.state) && next.state !== previous.state) return { state: previous.state, anomaly: true };
  return { state: next.state, anomaly: false };
}
