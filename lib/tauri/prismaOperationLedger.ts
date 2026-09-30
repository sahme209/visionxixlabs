import {
    consequentialOperationKinds,
    consequentialOperationStatuses,
    type ConsequentialOperation,
    type ConsequentialOperationKind,
    type ConsequentialOperationStatus,
} from "./operationReliability";
import type { OperationLedger } from "./operationCoordinator";

interface OperationRow {
    id: string;
    organizationId: string;
    deploymentRequestId: string;
    idempotencyKey: string;
    kind: string;
    clientId: string;
    environmentId: string;
    contextDigest: string;
    status: string;
    attemptCount: number;
    lastAttemptAt: Date | null;
    lastReconciledAt: Date | null;
    externalReference: string | null;
    createdAt: Date;
}

interface OperationDelegate {
    upsert(args: {
        where: {
            organizationId_idempotencyKey: {
                organizationId: string;
                idempotencyKey: string;
            };
        };
        create: {
            id: string;
            organizationId: string;
            deploymentRequestId: string;
            idempotencyKey: string;
            kind: string;
            clientId: string;
            environmentId: string;
            contextDigest: string;
            status: string;
            attemptCount: number;
            createdAt: Date;
        };
        update: Record<string, never>;
    }): Promise<OperationRow>;

    updateMany(args: {
        where: {
            id: string;
            organizationId: string;
            status?: string;
        };
        data: {
            status: string;
            attemptCount?: { increment: number };
            lastAttemptAt?: Date;
            lastReconciledAt?: Date;
            externalReference?: string | null;
        };
    }): Promise<{ count: number }>;

    findFirst(args: {
        where: {
            id: string;
            organizationId: string;
        };
    }): Promise<OperationRow | null>;
}

export interface OperationPrismaClient {
    tauriDeploymentOperation: OperationDelegate;
}

function assertKind(value: string): ConsequentialOperationKind {
    if ((consequentialOperationKinds as readonly string[]).includes(value)) {
        return value as ConsequentialOperationKind;
    }
    throw new Error(`Unknown persisted consequential operation kind: ${value}`);
}

function assertStatus(value: string): ConsequentialOperationStatus {
    if ((consequentialOperationStatuses as readonly string[]).includes(value)) {
        return value as ConsequentialOperationStatus;
    }
    throw new Error(`Unknown persisted consequential operation status: ${value}`);
}

function toOperation(row: OperationRow): ConsequentialOperation {
    return {
        operationId: row.id,
        idempotencyKey: row.idempotencyKey,
        tenantId: row.organizationId,
        deploymentId: row.deploymentRequestId,
        kind: assertKind(row.kind),
        clientId: row.clientId,
        environmentId: row.environmentId,
        contextDigest: row.contextDigest,
        status: assertStatus(row.status),
        attemptCount: row.attemptCount,
        createdAtUtc: row.createdAt.toISOString(),
        lastAttemptAtUtc: row.lastAttemptAt?.toISOString(),
        lastReconciledAtUtc: row.lastReconciledAt?.toISOString(),
        externalReference: row.externalReference ?? undefined,
    };
}

/**
 * Tenant-bound Prisma implementation of the consequential operation ledger.
 * Every read and write includes organizationId, including compare-and-set
 * updates, so an operation identifier cannot cross a tenant boundary.
 */
export class PrismaOperationLedger implements OperationLedger {
    constructor(
        private readonly client: OperationPrismaClient,
        private readonly organizationId: string,
    ) {
        if (!organizationId.trim()) {
            throw new Error("A tenant is required for the operation ledger.");
        }
    }

    async createOrGet(
        operation: ConsequentialOperation,
    ): Promise<ConsequentialOperation> {
        if (operation.tenantId !== this.organizationId) {
            throw new Error("Operation tenant does not match the ledger tenant.");
        }

        const row = await this.client.tauriDeploymentOperation.upsert({
            where: {
                organizationId_idempotencyKey: {
                    organizationId: this.organizationId,
                    idempotencyKey: operation.idempotencyKey,
                },
            },
            create: {
                id: operation.operationId,
                organizationId: this.organizationId,
                deploymentRequestId: operation.deploymentId,
                idempotencyKey: operation.idempotencyKey,
                kind: operation.kind,
                clientId: operation.clientId,
                environmentId: operation.environmentId,
                contextDigest: operation.contextDigest,
                status: operation.status,
                attemptCount: operation.attemptCount,
                createdAt: new Date(operation.createdAtUtc),
            },
            update: {},
        });
        return toOperation(row);
    }

    async claimAttempt(input: {
        operationId: string;
        expectedStatus: "queued" | "failed_certain";
        attemptedAtUtc: string;
    }): Promise<ConsequentialOperation | null> {
        const result = await this.client.tauriDeploymentOperation.updateMany({
            where: {
                id: input.operationId,
                organizationId: this.organizationId,
                status: input.expectedStatus,
            },
            data: {
                status: "attempting",
                attemptCount: { increment: 1 },
                lastAttemptAt: new Date(input.attemptedAtUtc),
            },
        });
        if (result.count !== 1) return null;
        return this.findRequired(input.operationId);
    }

    async recordOutcome(input: {
        operationId: string;
        status: "succeeded" | "failed_certain" | "outcome_unknown";
        reconciledAtUtc?: string;
        externalReference?: string;
    }): Promise<ConsequentialOperation> {
        const result = await this.client.tauriDeploymentOperation.updateMany({
            where: {
                id: input.operationId,
                organizationId: this.organizationId,
            },
            data: {
                status: input.status,
                lastReconciledAt: input.reconciledAtUtc
                    ? new Date(input.reconciledAtUtc)
                    : undefined,
                externalReference: input.externalReference ?? null,
            },
        });
        if (result.count !== 1) {
            throw new Error("Operation was not found in the current tenant.");
        }
        return this.findRequired(input.operationId);
    }

    private async findRequired(
        operationId: string,
    ): Promise<ConsequentialOperation> {
        const row = await this.client.tauriDeploymentOperation.findFirst({
            where: {
                id: operationId,
                organizationId: this.organizationId,
            },
        });
        if (!row) {
            throw new Error("Operation was not found in the current tenant.");
        }
        return toOperation(row);
    }
}
