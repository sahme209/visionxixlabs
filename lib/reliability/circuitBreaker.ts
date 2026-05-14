/**
 * Circuit breaker — protect external systems and Axiom itself from
 * cascading failures.
 *
 * A breaker is keyed by `(tenant, target)`. After `failureThreshold` failures
 * inside `rollingWindowMs`, the circuit *opens* — further calls are refused
 * locally with an `AxiomError(category=external, code=circuit.open)`. After
 * `cooldownMs`, the breaker transitions to *half-open* and lets a single
 * probe through. Success closes the circuit; another failure reopens it.
 *
 * Why per-(tenant, target): a single noisy tenant shouldn't pause the
 * provider for everyone else. A single failing provider shouldn't disable
 * unrelated providers.
 *
 * This is in-process state. Production should back it with a shared store
 * (Redis / Prisma) so multiple app instances share a circuit — the interface
 * is here, the in-memory implementation is the default.
 */

import type { OrganizationId } from "@/lib/domain/ids";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CircuitState = "closed" | "open" | "half_open";

/** Target tag — what the circuit is protecting. Free-form so callers can
 *  distinguish `aws.sts`, `aws.ec2`, `github.api`, `copilot.llm`. */
export type CircuitTarget = string;

export interface CircuitConfig {
  failureThreshold: number;
  rollingWindowMs: number;
  cooldownMs: number;
  /** Per-attempt sample limit when half-open (we only let one probe through). */
  halfOpenSampleSize: number;
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitConfig = {
  failureThreshold: 5,
  rollingWindowMs: 60_000,
  cooldownMs: 30_000,
  halfOpenSampleSize: 1,
};

export interface CircuitSnapshot {
  organizationId: OrganizationId;
  target: CircuitTarget;
  state: CircuitState;
  /** Failure timestamps within the rolling window. */
  recentFailuresMs: number[];
  /** Successes since last open transition. */
  successesSinceOpen: number;
  /** Timestamp when current state was entered. */
  stateEnteredAtMs: number;
  /** Next time the breaker will attempt to half-open (when open). */
  nextProbeAtMs?: number;
  /** Last failure reason — short string for UI rendering. */
  lastFailureReason?: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface CircuitStore {
  load(org: OrganizationId, target: CircuitTarget): Promise<CircuitSnapshot | null>;
  save(snapshot: CircuitSnapshot): Promise<void>;
  list(org: OrganizationId): Promise<CircuitSnapshot[]>;
}

class InMemoryCircuitStore implements CircuitStore {
  private byKey = new Map<string, CircuitSnapshot>();
  private key(o: OrganizationId, t: CircuitTarget) { return `${o}::${t}`; }
  async load(o: OrganizationId, t: CircuitTarget) { return this.byKey.get(this.key(o, t)) ?? null; }
  async save(s: CircuitSnapshot) { this.byKey.set(this.key(s.organizationId, s.target), s); }
  async list(o: OrganizationId) {
    const out: CircuitSnapshot[] = [];
    for (const s of this.byKey.values()) if (s.organizationId === o) out.push(s);
    return out;
  }
}

let _store: CircuitStore = new InMemoryCircuitStore();
export function configureCircuitStore(s: CircuitStore): void { _store = s; }
export function circuitStore(): CircuitStore { return _store; }

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

function freshSnapshot(o: OrganizationId, t: CircuitTarget, now: number): CircuitSnapshot {
  return {
    organizationId: o,
    target: t,
    state: "closed",
    recentFailuresMs: [],
    successesSinceOpen: 0,
    stateEnteredAtMs: now,
  };
}

function pruneWindow(snap: CircuitSnapshot, cfg: CircuitConfig, now: number): CircuitSnapshot {
  const cutoff = now - cfg.rollingWindowMs;
  return { ...snap, recentFailuresMs: snap.recentFailuresMs.filter((ms) => ms >= cutoff) };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BreakerOutcome<T> {
  result?: T;
  state: CircuitState;
  rejected: boolean;
  rejectionReason?: string;
}

/**
 * Run an operation through the breaker. If the breaker is open and not yet
 * ready to probe, the operation is refused without being called. Otherwise
 * the operation runs and the breaker updates based on success/failure.
 */
export async function runWithBreaker<T>(opts: {
  organizationId: OrganizationId;
  target: CircuitTarget;
  config?: Partial<CircuitConfig>;
  operation: () => Promise<T>;
}): Promise<BreakerOutcome<T>> {
  const cfg = { ...DEFAULT_CIRCUIT_CONFIG, ...(opts.config ?? {}) };
  const store = circuitStore();
  const now = Date.now();
  const existing = (await store.load(opts.organizationId, opts.target)) ?? freshSnapshot(opts.organizationId, opts.target, now);
  let snap = pruneWindow(existing, cfg, now);

  // 1. If open: check whether cooldown elapsed → transition to half_open
  if (snap.state === "open") {
    if (snap.nextProbeAtMs && now >= snap.nextProbeAtMs) {
      snap = { ...snap, state: "half_open", stateEnteredAtMs: now, successesSinceOpen: 0, nextProbeAtMs: undefined };
      await store.save(snap);
    } else {
      // Refuse the call
      const remainingMs = Math.max(0, (snap.nextProbeAtMs ?? now) - now);
      const reason = `Circuit ${opts.target} is open — next probe in ~${Math.ceil(remainingMs / 1000)}s.`;
      return { state: "open", rejected: true, rejectionReason: reason };
    }
  }

  // 2. Execute
  try {
    const result = await opts.operation();
    snap = onSuccess(snap, cfg, now);
    await store.save(snap);
    return { result, state: snap.state, rejected: false };
  } catch (err) {
    const reason = errorReason(err);
    snap = onFailure(snap, cfg, now, reason);
    await store.save(snap);
    throw err;
  }
}

function onSuccess(snap: CircuitSnapshot, cfg: CircuitConfig, now: number): CircuitSnapshot {
  if (snap.state === "half_open") {
    // Probe succeeded — close the circuit
    return { ...snap, state: "closed", stateEnteredAtMs: now, recentFailuresMs: [], successesSinceOpen: snap.successesSinceOpen + 1, lastFailureReason: undefined };
  }
  // Closed: nothing to change
  return { ...snap, successesSinceOpen: snap.successesSinceOpen + 1 };
}

function onFailure(snap: CircuitSnapshot, cfg: CircuitConfig, now: number, reason: string): CircuitSnapshot {
  const failures = [...snap.recentFailuresMs, now];
  if (snap.state === "half_open") {
    // Probe failed — reopen
    return { ...snap, state: "open", recentFailuresMs: failures, stateEnteredAtMs: now, nextProbeAtMs: now + cfg.cooldownMs, lastFailureReason: reason };
  }
  if (failures.length >= cfg.failureThreshold) {
    return { ...snap, state: "open", recentFailuresMs: failures, stateEnteredAtMs: now, nextProbeAtMs: now + cfg.cooldownMs, lastFailureReason: reason };
  }
  return { ...snap, recentFailuresMs: failures, lastFailureReason: reason };
}

function errorReason(err: unknown): string {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  if (err instanceof Error) return err.message.slice(0, 120);
  return String(err).slice(0, 120);
}

// ---------------------------------------------------------------------------
// Manual API for the reliability center
// ---------------------------------------------------------------------------

/** Force-open a circuit — admins use this to pause an integration. */
export async function forceOpen(o: OrganizationId, t: CircuitTarget, reason: string, cfg: Partial<CircuitConfig> = {}): Promise<CircuitSnapshot> {
  const config = { ...DEFAULT_CIRCUIT_CONFIG, ...cfg };
  const now = Date.now();
  const snap: CircuitSnapshot = {
    organizationId: o,
    target: t,
    state: "open",
    recentFailuresMs: [now],
    successesSinceOpen: 0,
    stateEnteredAtMs: now,
    nextProbeAtMs: now + config.cooldownMs,
    lastFailureReason: reason,
  };
  await circuitStore().save(snap);
  return snap;
}

/** Force-close a circuit — admins resume an integration. */
export async function forceClose(o: OrganizationId, t: CircuitTarget): Promise<CircuitSnapshot> {
  const now = Date.now();
  const snap: CircuitSnapshot = {
    organizationId: o,
    target: t,
    state: "closed",
    recentFailuresMs: [],
    successesSinceOpen: 0,
    stateEnteredAtMs: now,
  };
  await circuitStore().save(snap);
  return snap;
}

/** Throw the canonical circuit-open AxiomError. Used by callers that want
 *  to surface rejection as an error rather than a flagged outcome. */
export function throwCircuitOpen(target: CircuitTarget, reason: string): never {
  throw AxiomErrors.external("circuit.open", reason, undefined, { target });
}
