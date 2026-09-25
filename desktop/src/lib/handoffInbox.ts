/**
 * Desktop handoff inbox — local typed state for incoming + processed
 * handoffs. Mirrors the canonical lifecycle in `/lib/desktop/
 * handoffLifecycle.ts` so the desktop and web speak the same language.
 *
 * Local persistence uses @tauri-apps/plugin-store in the packaged app.
 * Browser development uses localStorage and is never treated as production.
 */

import { Store } from "@tauri-apps/plugin-store";

export type HandoffLifecycleState =
  | "not_available"
  | "eligible"
  | "preparing"
  | "ready"
  | "opened_in_desktop"
  | "expired"
  | "failed"
  | "completed"
  | "audit_sync_pending"
  | "audit_synced";

export interface InboxHandoff {
  id: string;
  receivedAt: string;
  state: HandoffLifecycleState;
  planLabel: string;
  approver: string;
  preparedAt: string;
  expiresAt: string;
  steps: number;
  risk: "low" | "medium" | "high";
  resources: number;
  errorSummary?: string;
}

const STORAGE_KEY = "axiom.handoff.inbox.v1";
const STORE_FILE = "handoff-inbox.json";
let tauriStore: Store | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isInboxHandoff(value: unknown): value is InboxHandoff {
  if (!value || typeof value !== "object") return false;
  const h = value as Record<string, unknown>;
  const states: ReadonlyArray<string> = ["not_available", "eligible", "preparing", "ready", "opened_in_desktop", "expired", "failed", "completed", "audit_sync_pending", "audit_synced"];
  return typeof h.id === "string" && h.id.length > 0
    && typeof h.receivedAt === "string"
    && typeof h.planLabel === "string"
    && typeof h.approver === "string"
    && typeof h.preparedAt === "string"
    && typeof h.expiresAt === "string"
    && typeof h.steps === "number" && Number.isSafeInteger(h.steps) && h.steps >= 0
    && typeof h.resources === "number" && Number.isSafeInteger(h.resources) && h.resources >= 0
    && typeof h.state === "string" && states.includes(h.state)
    && (h.risk === "low" || h.risk === "medium" || h.risk === "high");
}

async function getTauriStore(): Promise<Store> {
  if (!tauriStore) tauriStore = await Store.load(STORE_FILE);
  return tauriStore;
}

export interface HandoffInbox {
  list(): Promise<InboxHandoff[]>;
  upsert(handoff: InboxHandoff): Promise<void>;
  setState(id: string, state: HandoffLifecycleState, note?: string): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

class PersistentHandoffInbox implements HandoffInbox {
  async list(): Promise<InboxHandoff[]> {
    const value: unknown = isTauri()
      ? await (await getTauriStore()).get(STORAGE_KEY)
      : typeof localStorage === "undefined"
        ? []
        : JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (value == null) return [];
    if (!Array.isArray(value) || !value.every(isInboxHandoff)) {
      throw new Error("Stored handoff data is malformed. Clear the inbox before importing another handoff.");
    }
    return value;
  }
  async upsert(handoff: InboxHandoff): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((h) => h.id === handoff.id);
    if (idx >= 0) all[idx] = handoff;
    else all.unshift(handoff);
    await this.save(all);
  }
  async setState(id: string, state: HandoffLifecycleState, note?: string): Promise<void> {
    const all = await this.list();
    if (!all.some((h) => h.id === id)) throw new Error("Handoff no longer exists in the local inbox.");
    const next = all.map((h) => (h.id === id ? { ...h, state, ...(note ? { errorSummary: note } : {}) } : h));
    await this.save(next);
  }
  async remove(id: string): Promise<void> {
    const all = await this.list();
    await this.save(all.filter((h) => h.id !== id));
  }
  async clear(): Promise<void> {
    if (isTauri()) {
      const store = await getTauriStore();
      await store.delete(STORAGE_KEY);
      await store.save();
    } else if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  private async save(handoffs: InboxHandoff[]) {
    const limited = handoffs.slice(0, 100);
    if (isTauri()) {
      const store = await getTauriStore();
      await store.set(STORAGE_KEY, limited);
      await store.save();
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
    }
  }
}

export const handoffInbox: HandoffInbox = new PersistentHandoffInbox();

// ---------------------------------------------------------------------------
// Lifecycle gate — desktop refuses operations when state ≠ ready/opened
// ---------------------------------------------------------------------------

export interface HandoffActionDecision {
  allow: boolean;
  reason: string;
}

export function canOpen(handoff: InboxHandoff): HandoffActionDecision {
  if (handoff.state === "ready" || handoff.state === "opened_in_desktop") {
    return { allow: true, reason: "Bundle is ready to open." };
  }
  if (handoff.state === "expired") return { allow: false, reason: "Bundle has expired." };
  if (handoff.state === "failed") return { allow: false, reason: "Preparation failed." };
  return { allow: false, reason: `Bundle is in state '${handoff.state}'.` };
}

export function canApply(handoff: InboxHandoff): HandoffActionDecision {
  // Desktop apply is *always* refused at this milestone — the runtime
  // guard plus the typed signer + validator handle the real path. The
  // inbox UI must never imply otherwise.
  void handoff;
  return {
    allow: false,
    reason:
      "Local apply is disabled in this build. A signed approval and tenant policy are required before this operation can be enabled.",
  };
}
