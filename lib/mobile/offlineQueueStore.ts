/**
 * Pure mobile offline-queue store.
 *
 * When the device is offline, operator actions (approve / reject /
 * acknowledge / etc.) land in this in-memory queue. When the network
 * comes back the mobile shell calls drainQueue() to replay them
 * against the API. The store is bounded; conflicts are surfaced
 * (e.g. two approves for the same packet) so the operator can
 * resolve them.
 *
 * Pure / deterministic. Test injects a custom now(). No persistence;
 * a mobile shell would mirror state into IndexedDB / SQLite separately.
 */

export type QueuedOpKind = "approval_decision" | "acknowledge_incident" | "submit_proposal" | "comment";

export interface QueuedOp {
  id: string;             // uuid, supplied by caller
  kind: QueuedOpKind;
  targetId: string;       // packet id / incident id / proposal id
  payload: Record<string, unknown>;
  enqueuedAt: number;     // ms epoch
  attempts: number;
  lastError?: string;
}

export interface EnqueueInput {
  id: string;
  kind: QueuedOpKind;
  targetId: string;
  payload: Record<string, unknown>;
}

export interface EnqueueResult {
  enqueued: boolean;
  conflictWithId?: string;
  reason?: "queue_full" | "duplicate_target_for_kind";
}

const MAX_ENTRIES = 200;
const QUEUE: QueuedOp[] = [];

let _now: () => number = () => Date.now();
export function _setNowForTests(fn: () => number): void { _now = fn; }
export function _resetNowForTests(): void { _now = () => Date.now(); }
export function _clearQueueForTests(): void { QUEUE.length = 0; }

const isConflictKind = (kind: QueuedOpKind): boolean =>
  kind === "approval_decision" || kind === "acknowledge_incident";

export function enqueueOp(input: EnqueueInput): EnqueueResult {
  if (QUEUE.length >= MAX_ENTRIES) {
    return { enqueued: false, reason: "queue_full" };
  }
  if (isConflictKind(input.kind)) {
    const existing = QUEUE.find((q) => q.kind === input.kind && q.targetId === input.targetId);
    if (existing) {
      return { enqueued: false, reason: "duplicate_target_for_kind", conflictWithId: existing.id };
    }
  }
  QUEUE.push({
    id: input.id,
    kind: input.kind,
    targetId: input.targetId,
    payload: input.payload,
    enqueuedAt: _now(),
    attempts: 0,
  });
  return { enqueued: true };
}

export function listQueuedOps(): QueuedOp[] {
  // Caller-side copy so tests can read state without holding references.
  return QUEUE.map((q) => ({ ...q, payload: { ...q.payload } }));
}

export interface DrainAttemptResult {
  op: QueuedOp;
  ok: boolean;
  error?: string;
}

/**
 * Drain the queue by invoking the caller-supplied executor on each
 * op. The executor returns the per-op outcome. Failed ops stay in
 * the queue with attempts++ + lastError so the next drain retries.
 */
export async function drainQueue(executor: (op: QueuedOp) => Promise<{ ok: boolean; error?: string }>): Promise<DrainAttemptResult[]> {
  const results: DrainAttemptResult[] = [];
  // Take a snapshot so additions during drain don't loop forever.
  const snapshot = [...QUEUE];
  for (const op of snapshot) {
    let outcome: { ok: boolean; error?: string };
    try {
      outcome = await executor(op);
    } catch (err) {
      outcome = { ok: false, error: err instanceof Error ? err.message : "executor threw" };
    }
    if (outcome.ok) {
      const idx = QUEUE.findIndex((q) => q.id === op.id);
      if (idx >= 0) QUEUE.splice(idx, 1);
      results.push({ op, ok: true });
    } else {
      const live = QUEUE.find((q) => q.id === op.id);
      if (live) {
        live.attempts += 1;
        live.lastError = outcome.error;
      }
      results.push({ op, ok: false, error: outcome.error });
    }
  }
  return results;
}

export function queueSize(): number { return QUEUE.length; }
