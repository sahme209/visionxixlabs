/**
 * Desktop handoff inbox — local typed state for incoming + processed
 * handoffs. Mirrors the canonical lifecycle in `/lib/desktop/
 * handoffLifecycle.ts` so the desktop and web speak the same language.
 *
 * Local persistence comes via @tauri-apps/plugin-store when running
 * inside Tauri. Outside Tauri (e.g. when developing the React shell in
 * the browser), the store falls back to localStorage.
 */

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

export interface HandoffInbox {
  list(): Promise<InboxHandoff[]>;
  upsert(handoff: InboxHandoff): Promise<void>;
  setState(id: string, state: HandoffLifecycleState, note?: string): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

class LocalStorageInbox implements HandoffInbox {
  async list(): Promise<InboxHandoff[]> {
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw) as InboxHandoff[];
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }
  async upsert(handoff: InboxHandoff): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((h) => h.id === handoff.id);
    if (idx >= 0) all[idx] = handoff;
    else all.unshift(handoff);
    this.save(all);
  }
  async setState(id: string, state: HandoffLifecycleState, note?: string): Promise<void> {
    void note;
    const all = await this.list();
    const next = all.map((h) => (h.id === id ? { ...h, state } : h));
    this.save(next);
  }
  async remove(id: string): Promise<void> {
    const all = await this.list();
    this.save(all.filter((h) => h.id !== id));
  }
  async clear(): Promise<void> {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }
  private save(handoffs: InboxHandoff[]) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(handoffs.slice(0, 100)));
    }
  }
}

export const handoffInbox: HandoffInbox = new LocalStorageInbox();

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
      "Local apply is disabled in this build. Approve the plan on the web; signed handoffs will " +
      "unlock apply once tenant policy allows it.",
  };
}
