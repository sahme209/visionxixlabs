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

export async function createDesktopSession(input: CreateSessionInput): Promise<DesktopSession> {
  const ttlDays = Math.min(input.ttlDays ?? DEFAULT_TTL_DAYS, MAX_TTL_DAYS);
  const now = new Date();
  const session: DesktopSession = {
    id: input.id ?? `dsk_${crypto.randomUUID().replaceAll("-", "")}`,
    userId: input.userId,
    organizationId: input.organizationId,
    deviceFingerprint: input.deviceFingerprint,
    deviceLabel: input.deviceLabel,
    platform: input.platform ?? "unknown",
    desktopVersion: input.desktopVersion,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlDays * 86_400_000).toISOString(),
    lastSeenAt: now.toISOString(),
  };
  await (await store()).create(session);
  return session;
}

export async function getDesktopSession(id: string): Promise<DesktopSession | undefined> {
  return (await store()).getById(id);
}

/** Resolve the session for an inbound desktop request — returns undefined if revoked / expired. */
export async function resolveActiveSession(id: string): Promise<DesktopSession | undefined> {
  const sessionStore = await store();
  const session = await sessionStore.getById(id);
  if (!session) return undefined;
  if (statusFor(session) !== "active") return undefined;
  return session;
}

/** Record a heartbeat. Updates `lastSeenAt` only; cheap, idempotent. */
export async function touchDesktopSession(id: string): Promise<void> {
  const sessionStore = await store();
  const s = await sessionStore.getById(id);
  if (!s) return;
  if (statusFor(s) !== "active") return;
  await sessionStore.update({ ...s, lastSeenAt: new Date().toISOString() });
}

export async function revokeDesktopSession(id: string, reason: string): Promise<void> {
  const sessionStore = await store();
  const s = await sessionStore.getById(id);
  if (!s) return;
  if (s.revokedAt) return;
  await sessionStore.update({ ...s, revokedAt: new Date().toISOString(), revokeReason: reason });
}

export async function listActiveSessions(userId: UserId): Promise<DesktopSession[]> {
  const all = await (await store()).listByUser(userId);
  return all.filter((s) => statusFor(s) === "active");
}
