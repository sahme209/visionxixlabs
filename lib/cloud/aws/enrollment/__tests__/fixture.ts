import { vi } from "vitest";
import type { EnrollmentRepo, CloudAccountRow, CloudCredentialRow, EnrollmentAttemptRow } from "../service";
export const principal = { organizationId: "org_fixture", userId: "user_fixture", sessionId: "device_fixture" };
export const input = { expectedAccountId: "123456789012", roleArn: "arn:aws:iam::123456789012:role/ReadOnly", region: "us-east-1" };
export const externalId = "axiom-0123456789abcdef0123456789abcdef";
export function fixture() {
  let now = new Date("2026-10-16T00:00:00Z");
  let state = { account: null as CloudAccountRow | null, credential: null as CloudCredentialRow | null, attempt: null as EnrollmentAttemptRow | null,
    serializationAbort: false, additionalAccountCount: 0, billingPlan: null as { organizationId: string; tier: string; status: string } | null,
    device: { id: principal.sessionId, userId: principal.userId, organizationId: principal.organizationId, expiresAt: new Date("2026-10-17"), revokedAt: null as Date | null },
    membership: { acceptedAt: new Date("2026-10-01"), role: "admin" },
    lifecycle: null as Record<string, unknown> | null, transitions: [] as unknown[] };
  const repo = {
    tenantBillingPlan: { findUnique: vi.fn(async () => state.billingPlan) },
    cloudAccount: {
      count: vi.fn(async () => (state.account ? 1 : 0) + state.additionalAccountCount),
      findMany: vi.fn(async () => state.account ? [state.account] : []),
      findUnique: vi.fn(async () => state.account),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.account = { alias: null, updatedAt: now, ...data } as unknown as CloudAccountRow),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!state.account || state.account.id !== where.id || state.account.organizationId !== where.organizationId || state.account.updatedAt.getTime() !== (where.updatedAt as Date).getTime()) return { count: 0 };
        state.account = { ...state.account, ...data } as CloudAccountRow; return { count: 1 };
      }),
    },
    cloudAccountCredential: {
      findMany: vi.fn(async () => state.credential ? [state.credential] : []), findUnique: vi.fn(async () => state.credential),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.credential = data as unknown as CloudCredentialRow),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!state.credential || state.credential.id !== where.id || state.credential.organizationId !== where.organizationId || state.credential.version !== where.version || (where.revokedAt === null && state.credential.revokedAt !== null)) return { count: 0 };
        state.credential = { ...state.credential, ...data, ...(typeof data.version === "object" ? { version: state.credential.version + (data.version as { increment: number }).increment } : {}) } as CloudCredentialRow; return { count: 1 };
      }),
    },
    cloudAccountEnrollmentAttempt: {
      findMany: vi.fn(async () => state.attempt ? [state.attempt] : []), findUnique: vi.fn(async () => state.attempt),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.attempt = { consumedAt: null, ...data } as unknown as EnrollmentAttemptRow),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!state.attempt || state.attempt.consumedAt || state.attempt.expiresAt <= (where.expiresAt as { gt: Date }).gt || state.attempt.organizationId !== where.organizationId || (where.userId !== undefined && state.attempt.userId !== where.userId) || (where.externalIdDigest !== undefined && state.attempt.externalIdDigest !== where.externalIdDigest)) return { count: 0 };
        if (Array.isArray(where.OR) && !where.OR.some((condition) => condition.cloudAccountId === state.attempt!.cloudAccountId || condition.expectedAccountId === state.attempt!.expectedAccountId)) return { count: 0 };
        state.attempt = { ...state.attempt, ...data } as EnrollmentAttemptRow; return { count: 1 };
      }),
    },
    orgMembership: { findUnique: vi.fn(async () => state.membership) }, desktopSessionRecord: { findUnique: vi.fn(async () => state.device) },
    connectorSetupSession: {
      findUnique: vi.fn(async () => state.lifecycle),
      create: vi.fn(async () => state.lifecycle = { id: "lifecycle_fixture", status: "not_connected", firstConnectedAt: null }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.lifecycle = { ...state.lifecycle, ...data }),
    },
    connectorSetupTransition: { findMany: vi.fn(async () => state.transitions), create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { state.transitions.push(data); return data; }) },
    $transaction: vi.fn(async (operation: (transaction: EnrollmentRepo) => Promise<unknown>) => {
      const prior = structuredClone(state);
      try { const result = await operation(repo as unknown as EnrollmentRepo); if (state.serializationAbort) throw { code: "P2034" }; return result; } catch (error) { state = prior; throw error; }
    }),
  };
  let id = 0;
  const dependencies = { now: () => now, randomId: () => `fixture-${++id}`, randomExternalId: () => externalId, configured: vi.fn(),
    validate: vi.fn(async () => ({ accountId: input.expectedAccountId, assumedRoleArn: "verified-session" })), seal: vi.fn((plain: string, context: string) => { void plain; void context; return "v2.fixture-sealed"; }), audit: vi.fn(async () => {}) };
  return { repo, dependencies, get state() { return state; }, setNow(value: Date) { now = value; }, typedRepo: repo as unknown as EnrollmentRepo };
}
