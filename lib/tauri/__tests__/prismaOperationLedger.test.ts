import { describe, expect, it } from "vitest";
import {
    PrismaOperationLedger,
    type OperationPrismaClient,
} from "../prismaOperationLedger";
import type { ConsequentialOperation } from "../operationReliability";

type Row = Awaited<ReturnType<
    OperationPrismaClient["tauriDeploymentOperation"]["findFirst"]
>> extends infer Value ? NonNullable<Value> : never;

class FakeOperationDelegate {
    readonly rows = new Map<string, Row>();

    async upsert(args: Parameters<
        OperationPrismaClient["tauriDeploymentOperation"]["upsert"]
    >[0]): Promise<Row> {
        const key = `${args.where.organizationId_idempotencyKey.organizationId}:${args.where.organizationId_idempotencyKey.idempotencyKey}`;
        const existing = this.rows.get(key);
        if (existing) return existing;

        const row: Row = {
            ...args.create,
            lastAttemptAt: null,
            lastReconciledAt: null,
            externalReference: null,
        };
        this.rows.set(key, row);
        return row;
    }

    async updateMany(args: Parameters<
        OperationPrismaClient["tauriDeploymentOperation"]["updateMany"]
    >[0]): Promise<{ count: number }> {
        const match = [...this.rows.entries()].find(([, row]) =>
            row.id === args.where.id &&
            row.organizationId === args.where.organizationId &&
            (args.where.status === undefined || row.status === args.where.status)
        );
        if (!match) return { count: 0 };

        const [key, row] = match;
        const increment = args.data.attemptCount?.increment ?? 0;
        this.rows.set(key, {
            ...row,
            status: args.data.status,
            attemptCount: row.attemptCount + increment,
            lastAttemptAt: args.data.lastAttemptAt ?? row.lastAttemptAt,
            lastReconciledAt: args.data.lastReconciledAt ?? row.lastReconciledAt,
            externalReference: args.data.externalReference === undefined
                ? row.externalReference
                : args.data.externalReference,
        });
        return { count: 1 };
    }

    async findFirst(args: Parameters<
        OperationPrismaClient["tauriDeploymentOperation"]["findFirst"]
    >[0]): Promise<Row | null> {
        return [...this.rows.values()].find((row) =>
            row.id === args.where.id &&
            row.organizationId === args.where.organizationId
        ) ?? null;
    }
}

function operation(
    tenantId = "tenant-a",
    operationId = "op-01",
): ConsequentialOperation {
    return {
        operationId,
        idempotencyKey: "dep-01:dispatch:production:v1",
        tenantId,
        deploymentId: "dep-01",
        kind: "dispatch_workflow",
        clientId: "client-example",
        environmentId: "production",
        contextDigest: "sha256:confirmed-context",
        status: "queued",
        attemptCount: 0,
        createdAtUtc: "2026-09-25T13:00:00.000Z",
    };
}

function setup(tenantId = "tenant-a") {
    const delegate = new FakeOperationDelegate();
    const client: OperationPrismaClient = {
        tauriDeploymentOperation: delegate,
    };
    return {
        delegate,
        ledger: new PrismaOperationLedger(client, tenantId),
    };
}

describe("PrismaOperationLedger", () => {
    it("creates one durable row per tenant-scoped idempotency key", async () => {
        const { ledger, delegate } = setup();
        const first = await ledger.createOrGet(operation());
        const duplicate = await ledger.createOrGet(operation("tenant-a", "op-02"));

        expect(duplicate.operationId).toBe(first.operationId);
        expect(delegate.rows).toHaveLength(1);
    });

    it("rejects an operation belonging to another tenant", async () => {
        const { ledger } = setup("tenant-a");
        await expect(ledger.createOrGet(operation("tenant-b")))
            .rejects.toThrow("Operation tenant does not match");
    });

    it("atomically claims only the expected tenant and status", async () => {
        const { ledger } = setup();
        await ledger.createOrGet(operation());

        const claimed = await ledger.claimAttempt({
            operationId: "op-01",
            expectedStatus: "queued",
            attemptedAtUtc: "2026-09-25T14:00:00.000Z",
        });
        const duplicateClaim = await ledger.claimAttempt({
            operationId: "op-01",
            expectedStatus: "queued",
            attemptedAtUtc: "2026-09-25T14:00:01.000Z",
        });

        expect(claimed).toMatchObject({
            status: "attempting",
            attemptCount: 1,
            lastAttemptAtUtc: "2026-09-25T14:00:00.000Z",
        });
        expect(duplicateClaim).toBeNull();
    });

    it("records provider outcome without crossing a tenant boundary", async () => {
        const { ledger } = setup();
        await ledger.createOrGet(operation());

        const updated = await ledger.recordOutcome({
            operationId: "op-01",
            status: "succeeded",
            reconciledAtUtc: "2026-09-25T14:01:00.000Z",
            externalReference: "https://example.test/runs/42",
        });
        expect(updated).toMatchObject({
            status: "succeeded",
            externalReference: "https://example.test/runs/42",
            lastReconciledAtUtc: "2026-09-25T14:01:00.000Z",
        });

        const otherTenant = setup("tenant-b").ledger;
        await expect(otherTenant.recordOutcome({
            operationId: "op-01",
            status: "succeeded",
        })).rejects.toThrow("current tenant");
    });

    it("fails closed for an unknown persisted status", async () => {
        const { ledger, delegate } = setup();
        await ledger.createOrGet(operation());
        const row = [...delegate.rows.values()][0];
        row.status = "invented_success";

        await expect(ledger.createOrGet(operation()))
            .rejects.toThrow("Unknown persisted consequential operation status");
    });
});
