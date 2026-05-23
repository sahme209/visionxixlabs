/**
 * Tiny external store for the current count of pipeline runs awaiting
 * approval. Backed by `useSyncExternalStore` so any component can read
 * the count without prop-drilling through App.tsx.
 *
 * The single producer is `useTrayApprovalsBadge` — the App-level ambient
 * hook that polls the v1 endpoint. Consumers include the TopBar badge
 * and any future surface that wants ambient awareness.
 */

import { useSyncExternalStore } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

interface PendingSnapshot {
  count: number;
  runIds: ReadonlyArray<string>;
  /** True after the first successful poll — gates UI from flashing "0" pre-fetch. */
  hasPolled: boolean;
}

let snapshot: PendingSnapshot = { count: 0, runIds: [], hasPolled: false };

function emit() {
  for (const l of listeners) l();
}

export function setPendingApprovals(runIds: ReadonlyArray<string>): void {
  // Reference-equality short-circuit so unchanged polls don't churn React.
  const next: PendingSnapshot = {
    count: runIds.length,
    runIds,
    hasPolled: true,
  };
  if (
    next.count === snapshot.count &&
    next.hasPolled === snapshot.hasPolled &&
    arraysEqual(next.runIds, snapshot.runIds)
  ) {
    return;
  }
  snapshot = next;
  emit();
}

export function clearPendingApprovals(): void {
  if (snapshot.count === 0 && !snapshot.hasPolled) return;
  snapshot = { count: 0, runIds: [], hasPolled: false };
  emit();
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function getSnapshot(): PendingSnapshot {
  return snapshot;
}

export function usePendingApprovals(): PendingSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function arraysEqual(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
