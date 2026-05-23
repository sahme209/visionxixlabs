/**
 * Offline-resilient vote queue.
 *
 * When the user fires Approve/Reject from the tray (or the Approvals row)
 * and the v1 POST fails with a *transport* error — Wi-Fi drop, DNS
 * failure, ETIMEDOUT — we enqueue the request to disk and retry on the
 * next ambient tick. The platform's `pipeline:trigger` quota cost is
 * tiny per call so retrying is safe; the DB-unique constraint on
 * (snapshotId, approverUserId) is the authoritative double-vote lock,
 * so even a successful retry of an already-delivered vote 409s cleanly
 * as `already_voted` and the queue drops the entry.
 *
 * Validation errors (4xx other than 429) drop the entry immediately
 * with a result notification — replaying a malformed body will never
 * succeed. 429 / 5xx retain the entry for backoff.
 *
 * Persisted via tauri-plugin-store so a Wi-Fi outage that survives
 * app restart still drains when the network returns.
 */

import { useSyncExternalStore } from "react";
import { load as loadStorePlugin } from "@tauri-apps/plugin-store";
import { desktopClient } from "./desktopClient";
import { notifyResult } from "./notifications";
import { recordVote } from "./voteHistory";

const STORE_FILE = "vote-queue.json";
const STORE_KEY = "queue";
const MAX_QUEUE_DEPTH = 25;

export interface QueuedVote {
  /** Stable client-side id so the UI can dedupe rendering. */
  localId: string;
  runId: string;
  decision: "approved" | "rejected";
  approverUserId: string;
  reason?: string;
  /** ISO timestamp the user fired it. */
  enqueuedAt: string;
  attempts: number;
  /** Last transport/HTTP error string. Null on first enqueue. */
  lastError: string | null;
  /** ISO; set on each failed attempt, used for back-off. */
  lastAttemptAt: string | null;
  source: "tray" | "row";
}

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: ReadonlyArray<QueuedVote> = [];
let loaded = false;

// Minimum gap between retry attempts for a given queued vote — keeps the
// ambient hook from hammering a sustained outage every 15s.
const MIN_RETRY_BACKOFF_MS = 30_000;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function load(): Promise<ReadonlyArray<QueuedVote>> {
  if (loaded || !isTauri()) { loaded = true; return cache; }
  try {
    const store = await loadStorePlugin(STORE_FILE, { autoSave: true });
    const raw = await store.get<unknown>(STORE_KEY);
    if (Array.isArray(raw)) cache = raw.filter(isQueuedVote);
  } catch { /* empty cache is correct */ }
  loaded = true;
  return cache;
}

function isQueuedVote(v: unknown): v is QueuedVote {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.localId === "string"
    && typeof r.runId === "string"
    && (r.decision === "approved" || r.decision === "rejected")
    && typeof r.approverUserId === "string"
    && typeof r.enqueuedAt === "string"
    && typeof r.attempts === "number"
    && (r.lastError === null || typeof r.lastError === "string")
    && (r.lastAttemptAt === null || typeof r.lastAttemptAt === "string")
    && (r.source === "tray" || r.source === "row");
}

async function persist(): Promise<void> {
  for (const l of listeners) l();
  if (!isTauri()) return;
  try {
    const store = await loadStorePlugin(STORE_FILE, { autoSave: true });
    await store.set(STORE_KEY, cache as unknown as object);
    await store.save();
  } catch { /* best-effort */ }
}

export async function enqueueVote(
  args: Omit<QueuedVote, "localId" | "enqueuedAt" | "attempts" | "lastError" | "lastAttemptAt">,
): Promise<void> {
  await load();
  const entry: QueuedVote = {
    ...args,
    localId: `${args.runId}:${args.decision}:${Date.now().toString(36)}`,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
  };
  cache = [entry, ...cache].slice(0, MAX_QUEUE_DEPTH);
  await persist();
}

/** Public hook for surfaces that want to render the queue depth. */
export function useVoteQueue(): ReadonlyArray<QueuedVote> {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => cache,
    () => cache,
  );
}

/**
 * One drain pass. Called by the ambient watcher every 15s. Iterates
 * the snapshot (NOT the live cache) so concurrent enqueues during a
 * drain don't double-fire. Honors per-vote backoff so a sustained
 * outage doesn't burn the rate limit.
 */
export async function drainVoteQueue(): Promise<void> {
  await load();
  if (cache.length === 0) return;
  if (!desktopClient.hasAuth()) return; // wait for re-pair before retrying.

  const now = Date.now();
  const remaining: QueuedVote[] = [];
  for (const v of cache) {
    const lastAttemptMs = v.lastAttemptAt ? Date.parse(v.lastAttemptAt) : 0;
    if (now - lastAttemptMs < MIN_RETRY_BACKOFF_MS) {
      remaining.push(v);
      continue;
    }

    const res = await desktopClient.v1DecideApproval({
      runId: v.runId,
      decision: v.decision,
      approverUserId: v.approverUserId,
      ...(v.reason ? { reason: v.reason } : {}),
    });

    if (res.ok) {
      // Mirror the in-band path: record in audit history.
      void recordVote({
        runId: v.runId,
        decision: v.decision,
        castAt: new Date().toISOString(),
        isTerminal: res.data.isTerminal,
        snapshotStatus: res.data.snapshotStatus,
        approvedCount: res.data.approvedCount,
        rejectedCount: res.data.rejectedCount,
        requiredApprovers: res.data.requiredApprovers,
        source: v.source,
      });
      void notifyResult({
        title: `Queued vote delivered · ${v.decision}`,
        body: `${res.data.approvedCount}/${res.data.requiredApprovers} approved · ${shortId(v.runId)}`,
      });
      // Drop from the queue (do not push into `remaining`).
      continue;
    }

    // already_voted means the server already has our vote — drop quietly.
    if (res.error === "already_voted") continue;

    // 4xx other than 429 → unrecoverable, drop with an error notification.
    if (isPermanentFailure(res.error)) {
      void notifyResult({
        title: `Queued vote dropped · ${v.decision}`,
        body: `${shortId(v.runId)} — ${res.error}`,
      });
      continue;
    }

    // Retain for next ambient tick, bumping the attempt + backoff fields.
    remaining.push({
      ...v,
      attempts: v.attempts + 1,
      lastError: res.error,
      lastAttemptAt: new Date(now).toISOString(),
    });
  }
  cache = remaining;
  await persist();
}

function isPermanentFailure(err: string): boolean {
  // Closed-union of v1 error codes that won't change by retrying.
  return err === "invalid_decision"
      || err === "approval_not_found"
      || err === "cross_tenant"
      || err === "already_decided"
      || err === "no_pending_approval"
      || err === "not_engineer_sourced"
      || err === "missing_scope"
      || err === "malformed_token"
      || err === "unknown_token"
      || err === "token_expired"
      || err === "token_revoked"
      || err === "no_bearer_token"
      || err === "run_not_found";
}

function shortId(s: string): string {
  return s.length <= 10 ? s : `${s.slice(0, 10)}…`;
}
