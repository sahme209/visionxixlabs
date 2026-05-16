/**
 * Prisma-backed implementation of DesktopSessionStore.
 *
 * Persists desktop pairing sessions into the DesktopSessionRecord table.
 * Brought to life via the store factory at lib/platform/storeFactory.ts
 * when DATABASE_URL is set.
 */

import "server-only";

import { prisma } from "@/lib/db";
import type { DesktopSession, DesktopSessionStore } from "./desktopSession";
import type { OrganizationId, UserId } from "@/lib/domain/ids";

type SessionRow = {
  id: string;
  userId: string;
  organizationId: string;
  deviceFingerprint: string;
  deviceLabel: string;
  platform: string;
  desktopVersion: string | null;
  issuedAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
};

function fromRow(row: SessionRow): DesktopSession {
  return {
    id: row.id,
    userId: row.userId as UserId,
    organizationId: row.organizationId as OrganizationId,
    deviceFingerprint: row.deviceFingerprint,
    deviceLabel: row.deviceLabel,
    platform: row.platform as DesktopSession["platform"],
    desktopVersion: row.desktopVersion ?? undefined,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : undefined,
    revokeReason: row.revokeReason ?? undefined,
  };
}

type PrismaSessionModel = {
  create: (args: unknown) => Promise<unknown>;
  findUnique: (args: unknown) => Promise<SessionRow | null>;
  findMany: (args: unknown) => Promise<SessionRow[]>;
  update: (args: unknown) => Promise<unknown>;
};

function sessionModel(): PrismaSessionModel {
  return (prisma as unknown as { desktopSessionRecord: PrismaSessionModel }).desktopSessionRecord;
}

export const prismaDesktopSessionStore: DesktopSessionStore = {
  async create(s) {
    await sessionModel().create({
      data: {
        id: s.id,
        userId: s.userId,
        organizationId: s.organizationId,
        deviceFingerprint: s.deviceFingerprint,
        deviceLabel: s.deviceLabel,
        platform: s.platform,
        desktopVersion: s.desktopVersion ?? null,
        issuedAt: new Date(s.issuedAt),
        expiresAt: new Date(s.expiresAt),
        lastSeenAt: new Date(s.lastSeenAt),
        revokedAt: s.revokedAt ? new Date(s.revokedAt) : null,
        revokeReason: s.revokeReason ?? null,
      },
    });
  },

  async getById(id) {
    const row = await sessionModel().findUnique({ where: { id } });
    return row ? fromRow(row) : undefined;
  },

  async listByUser(userId) {
    const rows = await sessionModel().findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
    });
    return rows.map(fromRow);
  },

  async update(s) {
    await sessionModel().update({
      where: { id: s.id },
      data: {
        deviceLabel: s.deviceLabel,
        platform: s.platform,
        desktopVersion: s.desktopVersion ?? null,
        expiresAt: new Date(s.expiresAt),
        lastSeenAt: new Date(s.lastSeenAt),
        revokedAt: s.revokedAt ? new Date(s.revokedAt) : null,
        revokeReason: s.revokeReason ?? null,
      },
    });
  },
};
