import type {
    AdapterRequest,
    AdapterResult,
    DeploymentAdapter,
} from "./adapters";
import {
    decideConsequentialOperation,
    type ConsequentialOperation,
    type ConsequentialOperationStatus,
    type CurrentExecutionContext,
    type OperationDecision,
} from "./operationReliability";

export interface OperationLedger {
    /**
     * Must enforce uniqueness for idempotencyKey and return the existing row
     * when another process has already created it.
     */
    createOrGet(operation: ConsequentialOperation): Promise<ConsequentialOperation>;

    /**
     * Atomic compare-and-set. Only one process may move the expected status to
     * attempting and increment the attempt count.
     */
    claimAttempt(input: {
        operationId: string;
        expectedStatus: "queued" | "failed_certain";
        attemptedAtUtc: string;
    }): Promise<ConsequentialOperation | null>;

    recordOutcome(input: {
        operationId: string;
        status: "succeeded" | "failed_certain" | "outcome_unknown";
        reconciledAtUtc?: string;
        externalReference?: string;
    }): Promise<ConsequentialOperation>;
}

export interface ConsequentialExecutionRequest<TPayload> {
    operation: ConsequentialOperation;
    context: CurrentExecutionContext;
    actorId: string;
    correlationId: string;
    humanConfirmationId: string;
    payload: TPayload;
    attemptedAtUtc: string;
}

export type ConsequentialExecutionResult<TData> =
    | {
        outcome: "not_executed";
        decision: OperationDecision;
        operation: ConsequentialOperation;
    }
    | {
        outcome: "executed";
        operation: ConsequentialOperation;
        adapterResult: AdapterResult<TData>;
    }
    | {
        outcome: "uncertain";
        operation: ConsequentialOperation;
        reason: string;
    };

function nonWriteDecision(): OperationDecision {
    return {
        action: "block",
        reason: "Consequential operations require a configured write-mode adapter; mock, sandbox, and read modes cannot produce a live success.",
    };
}

function raceDecision(): OperationDecision {
    return {
        action: "reconcile",
        reason: "Another process claimed this idempotency key; reload the durable operation before taking further action.",
    };
}

export async function executeConsequentialOperation<TPayload, TData>(
    ledger: OperationLedger,
    adapter: DeploymentAdapter<TPayload, TData>,
    request: ConsequentialExecutionRequest<TPayload>,
): Promise<ConsequentialExecutionResult<TData>> {
    const durable = await ledger.createOrGet(request.operation);

    if (adapter.mode !== "write") {
        return {
            outcome: "not_executed",
            decision: nonWriteDecision(),
            operation: durable,
        };
    }

    const decision = decideConsequentialOperation(durable, request.context);
    if (decision.action !== "attempt") {
        return { outcome: "not_executed", decision, operation: durable };
    }

    const claimed = await ledger.claimAttempt({
        operationId: durable.operationId,
        expectedStatus: durable.status as "queued" | "failed_certain",
        attemptedAtUtc: request.attemptedAtUtc,
    });
    if (!claimed) {
        return {
            outcome: "not_executed",
            decision: raceDecision(),
            operation: durable,
        };
    }

    const adapterRequest: AdapterRequest<TPayload> = {
        tenantId: claimed.tenantId,
        correlationId: request.correlationId,
        actorId: request.actorId,
        humanConfirmationId: request.humanConfirmationId,
        operationId: claimed.operationId,
        idempotencyKey: claimed.idempotencyKey,
        payload: request.payload,
    };

    try {
        const adapterResult = await adapter.execute(adapterRequest);
        const operation = await ledger.recordOutcome({
            operationId: claimed.operationId,
            status: adapterResult.ok ? "succeeded" : "failed_certain",
            externalReference: adapterResult.runUrl,
        });
        return { outcome: "executed", operation, adapterResult };
    } catch (error) {
        const operation = await ledger.recordOutcome({
            operationId: claimed.operationId,
            status: "outcome_unknown",
        });
        return {
            outcome: "uncertain",
            operation,
            reason: error instanceof Error
                ? error.message
                : "Adapter ended without a confirmed outcome.",
        };
    }
}

export function isRetryableOperationStatus(
    status: ConsequentialOperationStatus,
): boolean {
    return status === "failed_certain";
}
