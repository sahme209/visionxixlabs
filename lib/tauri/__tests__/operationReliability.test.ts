import { describe, expect, it } from "vitest";
import {
    closeBehaviorForOperation,
    decideConsequentialOperation,
    type ConsequentialOperation,
    type CurrentExecutionContext,
} from "../operationReliability";

function operation(
    status: ConsequentialOperation["status"] = "queued",
): ConsequentialOperation {
    return {
        operationId: "op-01",
        idempotencyKey: "dep-01:dispatch:production:v1",
        tenantId: "tenant-example",
        deploymentId: "dep-01",
        kind: "dispatch_workflow",
        clientId: "client-example",
        environmentId: "production",
        contextDigest: "sha256:confirmed-context",
        status,
        attemptCount: status === "queued" ? 0 : 1,
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

describe("consequential operation reliability", () => {
    it("allows a queued operation only with current verified context", () => {
        expect(decideConsequentialOperation(operation(), context()).action).toBe("attempt");
    });

    it.each([
        "attempting",
        "outcome_unknown",
        "reconciling",
        "externally_running",
        "cancel_requested",
    ] as const)("requires provider reconciliation for %s outcomes", (status) => {
        expect(decideConsequentialOperation(operation(status), context()).action).toBe("reconcile");
    });

    it("prohibits duplicate execution after success", () => {
        expect(decideConsequentialOperation(operation("succeeded"), context())).toEqual({
            action: "block",
            reason: "Operation already succeeded; duplicate execution is prohibited.",
        });
    });

    it("blocks a stale or wrong client and environment", () => {
        const wrongClient = context();
        wrongClient.clientId = "client-other";
        expect(decideConsequentialOperation(operation(), wrongClient).action).toBe("block");

        const wrongEnvironment = context();
        wrongEnvironment.environmentId = "stage";
        expect(decideConsequentialOperation(operation(), wrongEnvironment).action).toBe("block");
    });

    it("rechecks approvals, permissions, concurrency, context, and window", () => {
        const checks: Array<(value: CurrentExecutionContext) => void> = [
            (value) => { value.approvalsCurrent = false; },
            (value) => { value.permissionsCurrent = false; },
            (value) => { value.concurrentDeploymentClear = false; },
            (value) => { value.contextDigest = "sha256:stale-context"; },
            (value) => { value.nowUtc = "2026-09-25T15:00:00.000Z"; },
        ];

        for (const invalidate of checks) {
            const current = context();
            invalidate(current);
            expect(decideConsequentialOperation(operation(), current).action).toBe("block");
        }
    });

    it("permits retry only after a certain failure", () => {
        expect(decideConsequentialOperation(operation("failed_certain"), context()).action).toBe("attempt");
        expect(decideConsequentialOperation(operation("outcome_unknown"), context()).action).toBe("reconcile");
    });

    it("makes desktop-close semantics explicit", () => {
        expect(closeBehaviorForOperation(operation("queued")).effect).toBe("cancel_local");
        expect(closeBehaviorForOperation(operation("externally_running")).effect)
            .toBe("continue_external_observation");
        expect(closeBehaviorForOperation(operation("outcome_unknown")).effect)
            .toBe("continue_external_observation");
    });
});
