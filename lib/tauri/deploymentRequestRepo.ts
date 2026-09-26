import type { DeploymentIntake } from "./deploymentOperations";
import { validateIntake } from "./deploymentOperations";
import { sha256ContentHash } from "./contentHash";

export interface DeploymentRequestRow {
    id: string;
    organizationId: string;
    requesterUserId: string;
    title: string;
    status: string;
    correlationId: string;
    intakeJson: unknown;
    version: number;
    submittedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

interface DeploymentRequestDelegate {
    create(args: {
        data: {
            id: string;
            organizationId: string;
            requesterUserId: string;
            title: string;
            status: string;
            correlationId: string;
            intakeJson: unknown;
            version: number;
            submittedAt: Date;
        };
    }): Promise<DeploymentRequestRow>;
    findFirst(args: {
        where: { organizationId: string; correlationId: string };
    }): Promise<DeploymentRequestRow | null>;
    findMany(args: {
        where: { organizationId: string };
        orderBy: { updatedAt: "desc" };
        take: number;
    }): Promise<DeploymentRequestRow[]>;
}

interface DeploymentRequestVersionDelegate {
    create(args: {
        data: {
            organizationId: string;
            deploymentRequestId: string;
            version: number;
            intakeJson: unknown;
            contentHash: string;
            createdByUserId: string;
        };
    }): Promise<unknown>;
}

interface DeploymentAuditDelegate {
    create(args: {
        data: {
            organizationId: string;
            deploymentRequestId: string;
            actorUserId: string;
            actorRole: string;
            action: string;
            newValueJson: unknown;
            source: string;
            correlationId: string;
            timeZone: string;
        };
    }): Promise<unknown>;
}

export interface DeploymentRequestRepo {
    tauriDeploymentRequest: DeploymentRequestDelegate;
    tauriDeploymentRequestVersion: DeploymentRequestVersionDelegate;
    tauriAuditEvent: DeploymentAuditDelegate;
    $transaction<T>(fn: (tx: DeploymentRequestRepo) => Promise<T>): Promise<T>;
}

export type CreateDeploymentRequestResult =
    | {
        ok: true;
        request: DeploymentRequestRow;
        replayed: boolean;
    }
    | {
        ok: false;
        reason: "validation_failed" | "tenant_mismatch" | "correlation_conflict";
        issues: Array<{ code: string; field: string; message: string }>;
    };

export interface CreateDeploymentRequestInput {
    organizationId: string;
    requesterUserId: string;
    actorRole: string;
    correlationId: string;
    requestId: string;
    receivedAtUtc: string;
    intake: DeploymentIntake;
}

export async function createDeploymentRequest(
    repo: DeploymentRequestRepo,
    input: CreateDeploymentRequestInput,
): Promise<CreateDeploymentRequestResult> {
    if (input.intake.tenantId !== input.organizationId) {
        return {
            ok: false,
            reason: "tenant_mismatch",
            issues: [{
                code: "tenant_mismatch",
                field: "tenantId",
                message: "The request tenant must match the authenticated desktop workspace.",
            }],
        };
    }

    const issues = validateIntake(input.intake);
    if (issues.length > 0) {
        return { ok: false, reason: "validation_failed", issues };
    }

    const result = await repo.$transaction(async (tx) => {
        const existing = await tx.tauriDeploymentRequest.findFirst({
            where: {
                organizationId: input.organizationId,
                correlationId: input.correlationId,
            },
        });
        if (existing) {
            const stored = existing.intakeJson as Record<string, unknown>;
            const { id: _storedId, ...storedContent } = stored;
            const { id: _incomingId, ...incomingContent } = input.intake;
            if (sha256ContentHash(storedContent) === sha256ContentHash(incomingContent)) {
                return { kind: "replay" as const, request: existing };
            }
            return { kind: "conflict" as const };
        }

        const created = await tx.tauriDeploymentRequest.create({
            data: {
                id: input.requestId,
                organizationId: input.organizationId,
                requesterUserId: input.requesterUserId,
                title: input.intake.title,
                status: "submitted",
                correlationId: input.correlationId,
                intakeJson: input.intake,
                version: 1,
                submittedAt: new Date(input.receivedAtUtc),
            },
        });

        await tx.tauriDeploymentRequestVersion.create({
            data: {
                organizationId: input.organizationId,
                deploymentRequestId: created.id,
                version: created.version,
                intakeJson: input.intake,
                contentHash: sha256ContentHash(input.intake),
                createdByUserId: input.requesterUserId,
            },
        });

        await tx.tauriAuditEvent.create({
            data: {
                organizationId: input.organizationId,
                deploymentRequestId: created.id,
                actorUserId: input.requesterUserId,
                actorRole: input.actorRole,
                action: "deployment_request.submitted",
                newValueJson: {
                    version: created.version,
                    status: created.status,
                    title: created.title,
                },
                source: "desktop",
                correlationId: input.correlationId,
                timeZone: input.intake.displayTimeZone,
            },
        });
        return { kind: "created" as const, request: created };
    });

    if (result.kind === "conflict") {
        return {
            ok: false,
            reason: "correlation_conflict",
            issues: [{
                code: "correlation_conflict",
                field: "correlationId",
                message: "This idempotency identifier is already bound to different request content.",
            }],
        };
    }
    return {
        ok: true,
        request: result.request,
        replayed: result.kind === "replay",
    };
}

export async function listDeploymentRequests(
    repo: DeploymentRequestRepo,
    organizationId: string,
    limit = 50,
): Promise<DeploymentRequestRow[]> {
    if (!organizationId.trim()) {
        throw new Error("A tenant is required.");
    }
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return repo.tauriDeploymentRequest.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: safeLimit,
    });
}
