import "server-only";
import type { OrganizationId, UserId } from "@/lib/domain/ids";
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


const MAX_TTL_DAYS = 30;
const DEFAULT_TTL_DAYS = 30;

export function statusFor(s: DesktopSession, now: Date = new Date()): DesktopSessionStatus {
  if (s.revokedAt) return "revoked";
  if (Date.parse(s.expiresAt) <= now.getTime()) return "expired";
  return "active";
}

export function createPrivateDesktopSessionService(sessionStore: DesktopSessionStore, clock: () => Date) {
 const getStore = async () => sessionStore;
async function createDesktopSession(input: CreateSessionInput): Promise<DesktopSession> {
  const ttlDays = Math.min(input.ttlDays ?? DEFAULT_TTL_DAYS, MAX_TTL_DAYS);
  const now = clock();
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
  await (await getStore()).create(session);
  return session;
}

async function getDesktopSession(id: string): Promise<DesktopSession | undefined> {
  return (await getStore()).getById(id);
}

/** Resolve the session for an inbound desktop request — returns undefined if revoked / expired. */
async function resolveActiveSession(id: string): Promise<DesktopSession | undefined> {
  const sessionStore = await getStore();
  const session = await sessionStore.getById(id);
  if (!session) return undefined;
  if (statusFor(session, clock()) !== "active") return undefined;
  return session;
}

/** Record a heartbeat. Updates `lastSeenAt` only; cheap, idempotent. */
async function touchDesktopSession(id: string): Promise<void> {
  const sessionStore = await getStore();
  const s = await sessionStore.getById(id);
  if (!s) return;
  if (statusFor(s, clock()) !== "active") return;
  await sessionStore.update({ ...s, lastSeenAt: clock().toISOString() });
}

async function revokeDesktopSession(id: string, reason: string): Promise<void> {
  const sessionStore = await getStore();
  const s = await sessionStore.getById(id);
  if (!s) return;
  if (s.revokedAt) return;
  await sessionStore.update({ ...s, revokedAt: clock().toISOString(), revokeReason: reason });
}

async function listActiveSessions(userId: UserId): Promise<DesktopSession[]> {
  const all = await (await getStore()).listByUser(userId);
  return all.filter((s) => statusFor(s, clock()) === "active");
}

return Object.freeze({ createDesktopSession, getDesktopSession, resolveActiveSession, touchDesktopSession, revokeDesktopSession, listActiveSessions });
}
