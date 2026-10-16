import { vi } from "vitest";
import type { AzureEnrollmentRepo, AzureEnrollmentDependencies, AzureAccountRow, AzureCredentialRow } from "../service";
export const principal = { organizationId: "ws_fixture_azure", userId: "owner", sessionId: "device" };
export const input = { tenantId: "11111111-1111-4111-8111-111111111111", subscriptionId: "22222222-2222-4222-8222-222222222222", clientId: "33333333-3333-4333-8333-333333333333", clientSecret: "fixture-only-secret", expectedVersion: null };
type Args = {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
};
export function fixture() {
    const date = new Date("2026-10-16T12:00:00Z");
    const state = { account: null as AzureAccountRow | null, credential: null as AzureCredentialRow | null, extraAccounts: 0, membership: { acceptedAt: date as Date | null, role: "owner" }, device: { id: "device", ...principal, expiresAt: new Date(date.getTime() + 60000), revokedAt: null as Date | null }, billing: null as null | {
            organizationId: string;
            tier: string;
            status: string;
        } };
    const matches = (row: unknown, where: Record<string, unknown>): boolean => !!row && Object.entries(where).every(([key, value]) => {
        if (key === "organizationId_provider_externalAccountId")
            return matches(row, value as Record<string, unknown>);
        const actual = (row as Record<string, unknown>)[key];
        return value instanceof Date ? actual instanceof Date && actual.getTime() === value.getTime() : actual === value;
    });
    const update = (row: unknown, data: Record<string, unknown>) => { for (const [key, value] of Object.entries(data))
        (row as Record<string, unknown>)[key] = value && typeof value === "object" && "increment" in value ? Number((row as Record<string, unknown>)[key]) + Number(value.increment) : value; };
    const repo = {
        cloudAccount: {
            findUnique: vi.fn(async ({ where }: Args) => matches(state.account, where) ? structuredClone(state.account) : null),
            findMany: vi.fn(async ({ where }: Args) => matches(state.account, where) ? [structuredClone(state.account)] : []),
            count: vi.fn(async () => (state.account ? 1 : 0) + state.extraAccounts),
            create: vi.fn(async ({ data }: Args) => { state.account = { alias: null, updatedAt: date, ...data } as AzureAccountRow; return structuredClone(state.account); }),
            updateMany: vi.fn(async ({ where, data }: Args) => { if (!matches(state.account, where))
                return { count: 0 }; update(state.account, data); return { count: 1 }; }),
        },
        cloudAccountCredential: {
            findUnique: vi.fn(async ({ where }: Args) => matches(state.credential, where) ? structuredClone(state.credential) : null),
            findMany: vi.fn(async () => state.credential ? [structuredClone(state.credential)] : []),
            create: vi.fn(async ({ data }: Args) => { state.credential = data as AzureCredentialRow; return structuredClone(state.credential); }),
            updateMany: vi.fn(async ({ where, data }: Args) => { if (!matches(state.credential, where))
                return { count: 0 }; update(state.credential, data); return { count: 1 }; }),
        },
        desktopSessionRecord: { findUnique: vi.fn(async () => structuredClone(state.device)) },
        orgMembership: { findUnique: vi.fn(async () => structuredClone(state.membership)) },
        tenantBillingPlan: { findUnique: vi.fn(async () => state.billing) },
        $transaction: vi.fn(async (operation: (tx: unknown) => Promise<unknown>) => { const before = structuredClone({ account: state.account, credential: state.credential }); try {
            return await operation(repo);
        }
        catch (error) {
            state.account = before.account;
            state.credential = before.credential;
            throw error;
        } }),
    } satisfies Record<string, unknown>;
    let sealed = "";
    const deps = { now: () => date, randomId: () => "azure-account", configured: vi.fn(), validate: vi.fn(async () => ({ tenantId: input.tenantId, subscriptionId: input.subscriptionId })), read: vi.fn(async () => ({ resourceGroups: [], complete: false as const, scope: "first_resource_groups_page" as const, limit: 100 as const, limitations: ["First page only."] })), seal: vi.fn((plain: string) => { sealed = plain; return "v2.fixture"; }), open: vi.fn(() => sealed), audit: vi.fn(async () => { }) } satisfies Partial<AzureEnrollmentDependencies>;
    return { state, repo, typedRepo: repo as unknown as AzureEnrollmentRepo, deps };
}
