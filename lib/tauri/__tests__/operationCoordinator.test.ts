import { describe, expect, it } from "vitest";
import type {
    AdapterRequest,
    AdapterResult,
    AdapterStatus,
    AdapterMode,
    DeploymentAdapter,
} from "../adapters";
import {
    executeConsequentialOperation,
    type OperationLedger,
} from "../operationCoordinator";
import type {
    ConsequentialOperation,
    CurrentExecutionContext,
} from "../operationReliability";

class MemoryLedger implements OperationLedger {
    readonly rows = new Map<string, ConsequentialOperation>();
    forceClaimRace = false;

    async createOrGet(operation: ConsequentialOperation): Promise<ConsequentialOperation> {
        const existing = [...this.rows.values()]
            .find((candidate) => candidate.idempotencyKey === operation.idempotencyKey);
        if (existing) return existing;
        this.rows.set(operation.operationId, operation);
        return operation;
    }

    async claimAttempt(input: {
        operationId: string;
        expectedStatus: "queued" | "failed_certain";
        attemptedAtUtc: string;
    }): Promise<ConsequentialOperation | null> {
        if (this.forceClaimRace) return null;
        const current = this.rows.get(input.operationId);
        if (!current || current.status !== input.expectedStatus) return null;
        const claimed: ConsequentialOperation = {
            ...current,
            status: "attempting",
            attemptCount: current.attemptCount + 1,
            lastAttemptAtUtc: input.attemptedAtUtc,
        };
        this.rows.set(claimed.operationId, claimed);
        return claimed;
    }

    async recordOutcome(input: {
        operationId: string;
        status: "succeeded" | "failed_certain" | "outcome_unknown";
        reconciledAtUtc?: string;
        externalReference?: string;
    }): Promise<ConsequentialOperation> {
        const current = this.rows.get(input.operationId);
        if (!current) throw new Error("missing operation");
        const updated = {
            ...current,
            status: input.status,
            lastReconciledAtUtc: input.reconciledAtUtc,
            externalReference: input.externalReference,
        };
        this.rows.set(updated.operationId, updated);
        return updated;
    }
}

class CapturingAdapter implements DeploymentAdapter<Record<string, string>, { accepted: true }> {
    readonly system = "github" as const;
    lastRequest?: AdapterRequest<Record<string, string>>;

    constructor(
        readonly mode: AdapterMode,
        private readonly behavior: "success" | "certain_failure" | "throw" = "success",
    ) {}

    async healthCheck(): Promise<AdapterStatus> {
        return {
            system: this.system,
            mode: this.mode,
            healthy: true,
            authenticated: true,
            scopes: ["write"],
            checkedAtUtc: "2026-09-25T14:00:00.000Z",
        };
    }

    async execute(
        request: AdapterRequest<Record<string, string>>,
    ): Promise<AdapterResult<{ accepted: true }>> {
        this.lastRequest = request;
        if (this.behavior === "throw") throw new Error("connection dropped after dispatch");
        const ok = this.behavior === "success";
        return {
            ok,
            mode: this.mode,
            data: ok ? { accepted: true } : undefined,
            runUrl: ok ? "https://example.test/runs/42" : undefined,
            error: ok ? undefined : {
                category: "input",
                message: "Provider rejected the request.",
                retryable: false,
            },
            audit: {
                tenantId: request.tenantId,
                correlationId: request.correlationId,
                actorId: request.actorId,
                action: "github.execute",
                occurredAtUtc: "2026-09-25T14:00:01.000Z",
            },
        };
    }
}

function operation(): ConsequentialOperation {
    return {
        operationId: "op-01",
        idempotencyKey: "dep-01:dispatch:production:v1",
        tenantId: "tenant-example",
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

function context(): CurrentExecutionContext {
    return {
        tenantId: "tenant-example",
        deploymentId: "dep-01",
        clientId: "client-example",
        environmentId: "production",
        contextDigest: "sha256:confirmed-context",
        nowUtc: "2026-09-25T14:00:00.000Z",
        windowStartUtc: "2026-09-25T13:30:00.000Z",
        windowEndUtc: "2026-09-25T14:30:00.000Z",
        approvalsCurrent: true,
        permissionsCurrent: true,
        deploymentContextCurrent: true,
        concurrentDeploymentClear: true,
    };
}

function request() {
    return {
        operation: operation(),
        context: context(),
        actorId: "executor",
        correlationId: "correlation-01",
        humanConfirmationId: "confirmation-01",
        payload: { workflow: "deploy-production" },
        attemptedAtUtc: "2026-09-25T14:00:00.000Z",
    };
}

describe("executeConsequentialOperation", () => {
    it("refuses to treat mock and sandbox adapters as live execution", async () => {
        for (const mode of ["mock", "sandbox", "read"] as const) {
            const ledger = new MemoryLedger();
            const result = await executeConsequentialOperation(
                ledger,
                new CapturingAdapter(mode),
                request(),
            );
            expect(result.outcome).toBe("not_executed");
            expect(ledger.rows.get("op-01")?.attemptCount).toBe(0);
        }
    });

    it("atomically claims, forwards durable identity, and records success", async () => {
        const ledger = new MemoryLedger();
        const adapter = new CapturingAdapter("write");
        const result = await executeConsequentialOperation(ledger, adapter, request());

        expect(result.outcome).toBe("executed");
        expect(adapter.lastRequest).toMatchObject({
            operationId: "op-01",
            idempotencyKey: "dep-01:dispatch:production:v1",
            humanConfirmationId: "confirmation-01",
        });
        expect(ledger.rows.get("op-01")).toMatchObject({
            status: "succeeded",
            attemptCount: 1,
            externalReference: "https://example.test/runs/42",
        });
    });

    it("blocks duplicate execution after a recorded success", async () => {
        const ledger = new MemoryLedger();
        const adapter = new CapturingAdapter("write");
        await executeConsequentialOperation(ledger, adapter, request());

        const duplicate = await executeConsequentialOperation(ledger, adapter, request());
        expect(duplicate).toMatchObject({
            outcome: "not_executed",
            decision: { action: "block" },
        });
        expect(ledger.rows.get("op-01")?.attemptCount).toBe(1);
    });

    it("records a transport exception as uncertain and requires reconciliation", async () => {
        const ledger = new MemoryLedger();
        const adapter = new CapturingAdapter("write", "throw");
        const first = await executeConsequentialOperation(ledger, adapter, request());
        expect(first).toMatchObject({
            outcome: "uncertain",
            operation: { status: "outcome_unknown" },
        });

        const second = await executeConsequentialOperation(ledger, adapter, request());
        expect(second).toMatchObject({
            outcome: "not_executed",
            decision: { action: "reconcile" },
        });
        expect(ledger.rows.get("op-01")?.attemptCount).toBe(1);
    });

    it("returns reconciliation when another process wins the atomic claim", async () => {
        const ledger = new MemoryLedger();
        ledger.forceClaimRace = true;
        const result = await executeConsequentialOperation(
            ledger,
            new CapturingAdapter("write"),
            request(),
        );
        expect(result).toMatchObject({
            outcome: "not_executed",
            decision: { action: "reconcile" },
        });
    });

    it("records a provider-confirmed rejection as a certain failure", async () => {
        const ledger = new MemoryLedger();
        const result = await executeConsequentialOperation(
            ledger,
            new CapturingAdapter("write", "certain_failure"),
            request(),
        );
        expect(result).toMatchObject({
            outcome: "executed",
            operation: { status: "failed_certain" },
            adapterResult: { ok: false },
        });
    });
});
