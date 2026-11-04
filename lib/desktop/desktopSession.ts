/**
 * Desktop workspace session — the bridge between a signed-in web user
 * and a paired desktop workstation.
 *
 * A session represents a long-lived (≤ 30 day) pairing between a
 * NextAuth-authenticated user and a Tauri desktop instance. The desktop
 * client holds an opaque bearer token (see `desktopToken.ts`) that
 * resolves to a `DesktopSession` here.
 *
 * Hard rules:
 *  - Sessions are scoped to (userId, organizationId, deviceFingerprint).
 *  - Revoked sessions stay revoked — never resurrected.
 *  - Expired sessions are treated identically to non-existent sessions.
 *  - The session record never carries any cloud credentials. Those live
 *    in the desktop's OS keychain via `KeychainAdapter`.
 *
 * The default store is in-memory; the Prisma adapter (later step) plugs in
 * via the store factory at `lib/platform/storeFactory.ts`.
 */

import "server-only";

import type { OrganizationId, UserId } from "@/lib/domain/ids";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DesktopSessionStatus = "active" | "revoked" | "expired";

export interface DesktopSession {
  id: string;
  userId: UserId;
  organizationId: OrganizationId;
  /** Stable device fingerprint reported by the desktop (Tauri OS + hostname hash). */
  deviceFingerprint: string;
  /** Human-readable label the user sees ("MacBook · Sam"). */
  deviceLabel: string;
  /** Tauri-reported platform — for audit + UI. */
  platform: "macos-arm" | "macos-intel" | "windows" | "linux" | "unknown";
  /** Tauri shell version, if reported. */
  desktopVersion?: string;
  issuedAt: string;
  expiresAt: string;
  lastSeenAt: string;
  revokedAt?: string;
  /** Reason captured when the session was revoked (audit trail). */
  revokeReason?: string;
}

export interface CreateSessionInput {
  /** Optional server-verified id used by the browser-assisted pairing flow. */
  id?: string;
  userId: UserId;
  organizationId: OrganizationId;
  deviceFingerprint: string;
  deviceLabel: string;
  platform?: DesktopSession["platform"];
  desktopVersion?: string;
  /** Session lifetime in days (default 30, max 30). */
  ttlDays?: number;
}

export interface DesktopSessionStore {
  create(s: DesktopSession): Promise<void>;
  getById(id: string): Promise<DesktopSession | undefined>;
  listByUser(userId: UserId): Promise<DesktopSession[]>;
  update(s: DesktopSession): Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory store (default)
// ---------------------------------------------------------------------------

class InMemorySessionStore implements DesktopSessionStore {
  private sessions = new Map<string, DesktopSession>();
  async create(s: DesktopSession) { this.sessions.set(s.id, s); }
  async getById(id: string) { return this.sessions.get(id); }
  async listByUser(userId: UserId) {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }
  async update(s: DesktopSession) {
    if (!this.sessions.has(s.id)) return;
    this.sessions.set(s.id, s);
  }
}

let storeOverride: DesktopSessionStore | undefined;
const defaultStore = new InMemorySessionStore();
let durableStorePromise: Promise<DesktopSessionStore> | undefined;

async function store(): Promise<DesktopSessionStore> {
  if (storeOverride) return storeOverride;
  if (!process.env.DATABASE_URL?.trim()) return defaultStore;
  durableStorePromise ??= import("./desktopSessionStore.prisma").then(
    ({ prismaDesktopSessionStore }) => prismaDesktopSessionStore,
  );
  return durableStorePromise;
}

/** Used by the store factory to switch to the Prisma-backed adapter. */
export function setDesktopSessionStore(s: DesktopSessionStore): void {
  storeOverride = s;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const MAX_TTL_DAYS = 30;
const DEFAULT_TTL_DAYS = 30;

export function statusFor(s: DesktopSession, now: Date = new Date()): DesktopSessionStatus {
  if (s.revokedAt) return "revoked";
  if (Date.parse(s.expiresAt) <= now.getTime()) return "expired";
  return "active";
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

const legacyService = createDesktopSessionServiceCore({
 create: async s => (await store()).create(s),
 getById: async id => (await store()).getById(id),
 listByUser: async id => (await store()).listByUser(id),
 update: async s => (await store()).update(s),
}, () => new Date(), false);
export const { createDesktopSession, getDesktopSession, resolveActiveSession, touchDesktopSession, revokeDesktopSession, listActiveSessions } = legacyService;
export { createPrivateDesktopSessionService } from "./privateDesktopSession";
import { createDesktopSessionServiceCore } from "./privateDesktopSession";
