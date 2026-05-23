/**
 * Local audit log of votes cast from this desktop session.
 *
 * Backed by tauri-plugin-store (already a project dep), capped at 25
 * entries to keep the file small. Persists across window-hide cycles
 * and full app restarts so the operator can confirm what they voted on
 * yesterday without checking the platform audit log.
 *
 * Privacy: the only payload here is the run id + decision + outcome
 * fields the v1 endpoint already returns. No keys, no PII beyond a
 * pipelineId.
 *
 * No-op outside Tauri — the load() resolves to an empty array.
 */

import { useEffect, useSyncExternalStore } from "react";
import { load as loadStorePlugin } from "@tauri-apps/plugin-store";

const STORE_FILE = "vote-history.json";
const STORE_KEY = "votes";
const MAX_ENTRIES = 25;

export interface VoteRecord {
  runId: string;
  pipelineId?: string;
  decision: "approved" | "rejected";
  /** ISO 8601 timestamp when the vote was cast. */
  castAt: string;
  /** Mirror of the v1 response — `true` only if this call tipped quorum. */
  isTerminal: boolean;
  snapshotStatus: "pending" | "approved" | "rejected" | "expired";
  approvedCount: number;
  rejectedCount: number;
  requiredApprovers: number;
  /** "tray" when cast from the menubar; "row" when cast inline in ApprovalsView. */
  source: "tray" | "row";
}

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: ReadonlyArray<VoteRecord> = [];
let loaded = false;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function loadStore(): Promise<ReadonlyArray<VoteRecord>> {
  if (loaded || !isTauri()) {
    loaded = true;
    return cache;
  }
  try {
    const store = await loadStorePlugin(STORE_FILE, { autoSave: true });
    const raw = await store.get<unknown>(STORE_KEY);
    if (Array.isArray(raw)) {
      cache = raw.filter(isVoteRecord);
    }
  } catch {
    /* file may not exist on first launch — empty cache is correct */
  }
  loaded = true;
  return cache;
}

function isVoteRecord(v: unknown): v is VoteRecord {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.runId === "string"
    && (r.decision === "approved" || r.decision === "rejected")
    && typeof r.castAt === "string"
    && typeof r.isTerminal === "boolean"
    && (r.snapshotStatus === "pending" || r.snapshotStatus === "approved" || r.snapshotStatus === "rejected" || r.snapshotStatus === "expired")
    && typeof r.approvedCount === "number"
    && typeof r.rejectedCount === "number"
    && typeof r.requiredApprovers === "number"
    && (r.source === "tray" || r.source === "row");
}

/** Prepend a new vote and persist. Caps the list at MAX_ENTRIES. */
export async function recordVote(vote: VoteRecord): Promise<void> {
  await loadStore();
  cache = [vote, ...cache].slice(0, MAX_ENTRIES);
  for (const l of listeners) l();
  if (!isTauri()) return;
  try {
    const store = await loadStorePlugin(STORE_FILE, { autoSave: true });
    await store.set(STORE_KEY, cache as unknown as object);
    await store.save();
  } catch {
    /* best-effort — in-memory cache stays correct */
  }
}

export function useVoteHistory(): ReadonlyArray<VoteRecord> {
  // Trigger an async load on first mount. The subscription pattern then
  // delivers the post-load cache via the listener fired in `recordVote`
  // — we also fire one manually here so an empty store still flips the
  // hook out of "not yet loaded" rendering.
  useEffect(() => {
    let cancelled = false;
    void loadStore().then(() => {
      if (!cancelled) for (const l of listeners) l();
    });
    return () => { cancelled = true; };
  }, []);
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
    () => cache,
    () => cache,
  );
}
