/**
 * Store factory.
 *
 * Selects the durable Prisma-backed adapters when `DATABASE_URL` is set,
 * otherwise lets the in-memory defaults stand. Wired exactly once at app
 * boot via `configureStoresFromEnv()`.
 *
 * Hard contract:
 *  - The factory NEVER constructs a Prisma client itself — it delegates
 *    to `@/lib/db` which exports the singleton.
 *  - Adapters are loaded lazily so a deployment without DATABASE_URL pays
 *    no cost (and crucially, the adapter modules never run their
 *    `server-only` imports).
 *  - Configuration is idempotent — calling twice is a no-op.
 */

import "server-only";

import { configureAuditStore } from "@/lib/audit/secureAudit";
import { setDesktopSessionStore } from "@/lib/desktop/desktopSession";

let configured = false;

export interface StoreFactoryResult {
  mode: "prisma" | "in_memory";
  reason: string;
  wired: { audit: boolean; memory: boolean; desktopSession: boolean };
}

export async function configureStoresFromEnv(): Promise<StoreFactoryResult> {
  if (configured) {
    return {
      mode: process.env.DATABASE_URL ? "prisma" : "in_memory",
      reason: "Already configured.",
      wired: { audit: false, memory: false, desktopSession: false },
    };
  }
  configured = true;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      mode: "in_memory",
      reason: "DATABASE_URL not set — using in-memory stores. Audit / memory / desktop sessions are ephemeral.",
      wired: { audit: false, memory: false, desktopSession: false },
    };
  }

  // Lazy imports — only pulled when DATABASE_URL is set so deployments
  // without a database don't load the Prisma client.
  const [{ prismaAuditStore }, { prismaDesktopSessionStore }] = await Promise.all([
    import("@/lib/audit/auditStore.prisma"),
    import("@/lib/desktop/desktopSessionStore.prisma"),
  ]);

  configureAuditStore(prismaAuditStore);
  setDesktopSessionStore(prismaDesktopSessionStore);

  // The MemoryStore at lib/memory/operationalMemory.ts doesn't expose a
  // configureXxx() setter today — its consumers each construct an
  // in-memory store via `createInMemoryStore()`. The Prisma adapter at
  // lib/memory/memoryStore.prisma.ts exists and is wired by consumers
  // directly (e.g. via `getMemoryStore()` below) rather than through a
  // process-global setter. This is intentional: memory is read by many
  // distinct subsystems with different lifecycles.

  return {
    mode: "prisma",
    reason: "DATABASE_URL is set — Prisma-backed stores active.",
    wired: { audit: true, memory: false, desktopSession: true },
  };
}

/**
 * Returns the canonical MemoryStore — Prisma-backed when DATABASE_URL is
 * set, otherwise a fresh in-memory store. Callers cache the return value.
 */
export async function getMemoryStore() {
  if (process.env.DATABASE_URL?.trim()) {
    const { prismaMemoryStore } = await import("@/lib/memory/memoryStore.prisma");
    return prismaMemoryStore;
  }
  const { createInMemoryStore } = await import("@/lib/memory/operationalMemory");
  return createInMemoryStore();
}

/** Diagnostic: is the factory configured to use Prisma right now? */
export function isPrismaMode(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
