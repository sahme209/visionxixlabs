/**
 * Reliability policy for consequential deployment operations.
 *
 * The desktop process is an observer and initiator, not the lifetime owner of
 * work running in external systems. Every consequential operation receives a
 * durable identifier and idempotency key. An uncertain result must be
 * reconciled with the provider before another attempt is permitted.
 */

export const consequentialOperationKinds = [
    "merge_pull_request",
    "publish_release",
    "create_change",
    "dispatch_workflow",
    "approve_environment",
    "create_tag",
    "rollback",
] as const;

export type ConsequentialOperationKind =
    (typeof consequentialOperationKinds)[number];

export const consequentialOperationStatuses = [
    "queued",
    "attempting",
    "outcome_unknown",
    "reconciling",
    "externally_running",
    "succeeded",
    "failed_certain",
    "cancelled_before_dispatch",
    "cancel_requested",
] as const;

export type ConsequentialOperationStatus =
    (typeof consequentialOperationStatuses)[number];

export interface ConsequentialOperation {
    operationId: string;
    idempotencyKey: string;
    tenantId: string;
    deploymentId: string;
    kind: ConsequentialOperationKind;
    clientId: string;
    environmentId: string;
    contextDigest: string;
    status: ConsequentialOperationStatus;
    attemptCount: number;
    createdAtUtc: string;
    lastAttemptAtUtc?: string;
    lastReconciledAtUtc?: string;
    externalReference?: string;
}

export interface CurrentExecutionContext {
    tenantId: string;
    deploymentId: string;
    clientId: string;
    environmentId: string;
    contextDigest: string;
    nowUtc: string;
    windowStartUtc: string;
    windowEndUtc: string;
    approvalsCurrent: boolean;
    permissionsCurrent: boolean;
    deploymentContextCurrent: boolean;
    concurrentDeploymentClear: boolean;
}

export type OperationDecision =
    | { action: "attempt"; reason: string }
    | { action: "reconcile"; reason: string }
    | { action: "block"; reason: string };

function isValidInstant(value: string): boolean {
    return value.length > 0 && Number.isFinite(Date.parse(value));
}

function contextBlocker(
    operation: ConsequentialOperation,
    context: CurrentExecutionContext,
): string | undefined {
    if (operation.tenantId !== context.tenantId) {
        return "Tenant context changed; operation is not valid for this workspace.";
    }
    if (operation.deploymentId !== context.deploymentId) {
        return "Deployment context changed; operation is not valid for this request.";
    }
    if (operation.clientId !== context.clientId) {
        return "Client context changed; refresh and select the intended client.";
    }
    if (operation.environmentId !== context.environmentId) {
        return "Environment context changed; refresh and select the intended environment.";
    }
    if (operation.contextDigest !== context.contextDigest || !context.deploymentContextCurrent) {
        return "Deployment facts changed; regenerate or reconfirm the operation.";
    }
    if (!context.approvalsCurrent) {
        return "Required approvals are missing, expired, or stale.";
    }
    if (!context.permissionsCurrent) {
        return "Required operation-specific permissions are not currently verified.";
    }
    if (!context.concurrentDeploymentClear) {
        return "Another deployment conflicts with this client and environment.";
    }
    if (
        !isValidInstant(context.nowUtc) ||
        !isValidInstant(context.windowStartUtc) ||
        !isValidInstant(context.windowEndUtc)
    ) {
        return "Deployment window could not be verified.";
    }

    const now = Date.parse(context.nowUtc);
    const start = Date.parse(context.windowStartUtc);
    const end = Date.parse(context.windowEndUtc);
    if (start >= end || now < start || now > end) {
        return "Consequential action is outside the approved deployment window.";
    }

    return undefined;
}

export function decideConsequentialOperation(
    operation: ConsequentialOperation,
    context: CurrentExecutionContext,
): OperationDecision {
    const blocker = contextBlocker(operation, context);
    if (blocker) return { action: "block", reason: blocker };

    switch (operation.status) {
        case "queued":
        case "failed_certain":
            return {
                action: "attempt",
                reason: operation.status === "queued"
                    ? "Current execution context is verified."
                    : "The prior failure is confirmed and safe to retry with the same idempotency key.",
            };
        case "attempting":
        case "outcome_unknown":
        case "reconciling":
        case "externally_running":
        case "cancel_requested":
            return {
                action: "reconcile",
                reason: "External outcome may already exist; reconcile provider state before retrying.",
            };
        case "succeeded":
            return {
                action: "block",
                reason: "Operation already succeeded; duplicate execution is prohibited.",
            };
        case "cancelled_before_dispatch":
            return {
                action: "block",
                reason: "Operation was cancelled before dispatch; create a new governed operation to continue.",
            };
    }
}

export type CloseBehavior =
    | { effect: "cancel_local"; reason: string }
    | { effect: "continue_external_observation"; reason: string };

export function closeBehaviorForOperation(
    operation: ConsequentialOperation,
): CloseBehavior {
    if (
        operation.status === "queued" ||
        operation.status === "cancelled_before_dispatch"
    ) {
        return {
            effect: "cancel_local",
            reason: "No external action has been dispatched.",
        };
    }

    return {
        effect: "continue_external_observation",
        reason: "Closing the desktop app does not cancel work that may be running externally.",
    };
}
