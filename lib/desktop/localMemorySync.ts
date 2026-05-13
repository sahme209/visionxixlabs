/**
 * Local memory sync — typed model for the desktop runtime's local audit +
 * memory store and its bidirectional sync with the cloud platform.
 *
 * No actual desktop implementation here — just the contract. The Tauri shell
 * implements `LocalMemoryStore` and `LocalMemorySync` using a local SQLite
 * database (or whatever the desktop runtime chooses).
 */

import type { MemoryRecord, MemoryStore, MemoryQuery } from "@/lib/memory/operationalMemory";

// ---------------------------------------------------------------------------
// Local event kinds — extends operational memory with desktop-specific events
// ---------------------------------------------------------------------------

export type LocalEventKind =
  | "plan.downloaded"
  | "plan.opened_locally"
  | "terraform.reviewed_locally"
  | "cli.reviewed_locally"
  | "terraform.applied_locally"
  | "cli.applied_locally"
  | "verification.ran_locally"
  | "audit.exported_locally"
  | "notification.delivered"
  | "notification.acknowledged"
  | "sync.pushed"
  | "sync.pulled"
  | "sync.skipped_workstation_mode";

export interface LocalMemoryRecord {
  id: string;
  /** Tenant scope. */
  organizationId: string;
  /** Local actor — typically the OS user. */
  actorId: string;
  /** Local event kind. */
  kind: LocalEventKind;
  /** Reference to the plan or audit event this record relates to. */
  refs: { planId?: string; recommendationId?: string; auditEventId?: string };
  /** Short summary. */
  summary: string;
  /** When the event happened locally. */
  occurredAt: string;
  /** Whether this record has been synced to the cloud platform. */
  synced: boolean;
  /** When the record was synced (if applicable). */
  syncedAt?: string;
  /** Sync attempt count. */
  syncAttempts?: number;
}

// ---------------------------------------------------------------------------
// Local memory store interface
// ---------------------------------------------------------------------------

export interface LocalMemoryStore {
  /** Append a local memory record. */
  append(record: LocalMemoryRecord): Promise<void>;
  /** Query local records by predicate. */
  query(predicate: (record: LocalMemoryRecord) => boolean, limit?: number): Promise<LocalMemoryRecord[]>;
  /** Mark a record as synced. */
  markSynced(id: string): Promise<void>;
  /** Count records pending sync. */
  pendingSyncCount(): Promise<number>;
  /** Export local memory to disk in the chosen format. */
  exportToFile(path: string, format: "ndjson" | "csv" | "json"): Promise<{ bytesWritten: number; recordsExported: number }>;
}

// ---------------------------------------------------------------------------
// Sync interface
// ---------------------------------------------------------------------------

export interface SyncOptions {
  /** Maximum records to push per batch. */
  batchSize?: number;
  /** Skip push entirely (workstation mode). */
  skipPush?: boolean;
}

export interface LocalMemorySync {
  /** Push pending local records to the cloud memory store. */
  push(cloud: MemoryStore, options?: SyncOptions): Promise<{ pushed: number; skipped: number; failed: number }>;
  /** Pull recent cloud memory into the local store for offline review. */
  pull(cloud: MemoryStore, query: MemoryQuery): Promise<{ pulled: number }>;
  /** Return summary status: connected vs workstation-mode. */
  status(): { mode: "connected" | "workstation"; pendingPush: number; lastPushAt?: string; lastPullAt?: string };
}

// ---------------------------------------------------------------------------
// Conversion helpers — local record → operational memory record
// ---------------------------------------------------------------------------

/**
 * Map a LocalMemoryRecord into an OperationalMemoryRecord suitable for sync
 * into the cloud memory store.
 */
export function localToOperational(local: LocalMemoryRecord): MemoryRecord {
  const cloudKindMap: Partial<Record<LocalEventKind, MemoryRecord["kind"]>> = {
    "plan.downloaded": "user.decision",
    "plan.opened_locally": "desktop.handoff_delivered",
    "terraform.applied_locally": "desktop.local_execution",
    "cli.applied_locally": "desktop.local_execution",
    "verification.ran_locally": "verification.passed",
  };

  return {
    id: `cloud_${local.id}`,
    organizationId: local.organizationId,
    actorId: local.actorId,
    kind: cloudKindMap[local.kind] ?? "user.decision",
    provider: undefined,
    resources: [],
    summary: local.summary,
    evidence: [
      { name: "source", value: "desktop" },
      { name: "local_event_kind", value: local.kind },
    ],
    outcome: "neutral",
    impact: {},
    links: {
      executionPlanIds: local.refs.planId ? [local.refs.planId] : undefined,
      recommendationIds: local.refs.recommendationId ? [local.refs.recommendationId] : undefined,
      auditEventIds: local.refs.auditEventId ? [local.refs.auditEventId] : undefined,
    },
    occurredAt: local.occurredAt,
    recordedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Web-side stub — used when the desktop runtime is not present
// ---------------------------------------------------------------------------

export const WEB_LOCAL_MEMORY_STUB: LocalMemoryStore & LocalMemorySync = {
  async append() { /* no-op */ },
  async query() { return []; },
  async markSynced() { /* no-op */ },
  async pendingSyncCount() { return 0; },
  async exportToFile() { throw new Error("Local memory export unavailable in web runtime"); },
  async push() { return { pushed: 0, skipped: 0, failed: 0 }; },
  async pull() { return { pulled: 0 }; },
  status() { return { mode: "connected", pendingPush: 0 }; },
};
